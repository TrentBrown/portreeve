// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AttachedCommandRegistry,
  resolveLauncherShell,
  runFiniteCommand,
  startAttachedCommand,
} from '../../src/launcher/command-session.js';

test('runs through an explicit login shell with closed input and streamed output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-command-'));
  /** @type {Array<{sequence: number, stream: 'stdout' | 'stderr' | 'system', text: string}>} */
  const streamed = [];
  try {
    const result = await runFiniteCommand({
      command:
        'if read value; then printf "unexpected:%s\\n" "$value"; else printf "stdin-closed:%s\\n" "$PORTREEVE_TEST"; fi; printf "warning\\n" >&2',
      shellPath: '/bin/sh',
      workingDirectory: directory,
      environment: { PORTREEVE_TEST: 'yes' },
      timeoutMilliseconds: 2_000,
      onOutput: (chunk) => streamed.push(chunk),
    });
    expect(result).toMatchObject({
      outcome: 'succeeded',
      exitCode: 0,
      signal: null,
      shellPath: '/bin/sh',
    });
    expect(result.processGroupId).toBeGreaterThan(0);
    expect(streamed.map(({ text }) => text).join('')).toContain('stdin-closed:yes');
    expect(
      result.output.chunks.some(
        (/** @type {{stream: string}} */ chunk) => chunk.stream === 'stderr',
      ),
    ).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('keeps a truncation-marked bounded tail', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-command-'));
  try {
    const result = await runFiniteCommand({
      command: "head -c 4096 /dev/zero | tr '\\000' x",
      shellPath: '/bin/sh',
      workingDirectory: directory,
      environment: {},
      timeoutMilliseconds: 2_000,
      outputLimitBytes: 128,
    });
    expect(result.outcome).toBe('succeeded');
    expect(result.output).toMatchObject({
      truncated: true,
      retainedBytes: 128,
      totalBytes: 4096,
    });
    expect(result.output.chunks[0]).toMatchObject({
      stream: 'system',
      text: '[PortReeve: earlier output truncated]\n',
    });
    expect(
      result.output.chunks
        .map((/** @type {{text: string}} */ chunk) => chunk.text)
        .join(''),
    ).toEndWith('x'.repeat(128));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('truncates only at UTF-8 character boundaries', async () => {
  const result = await runFiniteCommand({
    command: "printf '🙂🙂'",
    shellPath: '/bin/sh',
    workingDirectory: process.cwd(),
    environment: {},
    timeoutMilliseconds: 2_000,
    outputLimitBytes: 5,
  });
  expect(result.output).toMatchObject({ truncated: true, retainedBytes: 4 });
  expect(result.output.chunks.at(-1)?.text).toBe('🙂');
});

test('times out and escalates signals only to the created process group', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-command-'));
  /** @type {Array<{processGroupId: number, signal: NodeJS.Signals}>} */
  const signals = [];
  try {
    const result = await runFiniteCommand({
      command: "trap '' TERM; while :; do sleep 1; done",
      shellPath: '/bin/sh',
      workingDirectory: directory,
      environment: {},
      timeoutMilliseconds: 30,
      terminationGraceMilliseconds: 30,
      signalProcessGroup(processGroupId, signal) {
        signals.push({ processGroupId, signal });
        process.kill(-processGroupId, signal);
      },
    });
    expect(result).toMatchObject({ outcome: 'timed-out', signal: 'SIGKILL' });
    expect(signals).toEqual([
      { processGroupId: result.processGroupId, signal: 'SIGTERM' },
      { processGroupId: result.processGroupId, signal: 'SIGKILL' },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('cancellation terminates the command group and pre-cancellation never spawns', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-command-'));
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    const cancelled = await runFiniteCommand({
      command: 'sleep 30',
      shellPath: '/bin/sh',
      workingDirectory: directory,
      environment: {},
      timeoutMilliseconds: 2_000,
      signal: controller.signal,
      terminationGraceMilliseconds: 30,
    });
    expect(cancelled.outcome).toBe('cancelled');

    const already = new AbortController();
    already.abort();
    const notSpawned = await runFiniteCommand({
      command: 'printf should-not-run',
      shellPath: '/bin/sh',
      workingDirectory: directory,
      environment: {},
      timeoutMilliseconds: 2_000,
      signal: already.signal,
    });
    expect(notSpawned).toMatchObject({
      outcome: 'cancelled',
      processGroupId: null,
      exitCode: null,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resolves only the supported POSIX shell selections', () => {
  expect(resolveLauncherShell('bash', { platform: 'linux' })).toBe('bash');
  expect(resolveLauncherShell('zsh', { platform: 'darwin' })).toBe('zsh');
  expect(
    resolveLauncherShell('system', {
      platform: 'linux',
      accountShell: () => '/usr/bin/fish',
    }),
  ).toBe('/usr/bin/fish');
  expect(() => resolveLauncherShell('system', { platform: 'win32' })).toThrow();
});

test('returns asynchronous spawn failures even when an output observer throws', async () => {
  const result = await runFiniteCommand({
    command: 'printf unreachable',
    shellPath: '/definitely/missing/portreeve-shell',
    workingDirectory: process.cwd(),
    environment: {},
    timeoutMilliseconds: 2_000,
    onOutput() {
      throw new Error('observer failure');
    },
  });
  expect(result).toMatchObject({
    outcome: 'failed',
    exitCode: null,
    failure: { code: 'launcher_command_spawn_failed' },
  });
});

test('scrubs inherited reserved context before injecting the current operation', async () => {
  const result = await runFiniteCommand({
    command:
      'printf "%s|%s|%s" "${PORTREEVE_STALE-unset}" "$PORTREEVE_STACK_ID" "$ORDINARY_VALUE"',
    shellPath: '/bin/sh',
    workingDirectory: process.cwd(),
    inheritedEnvironment: {
      PATH: process.env.PATH,
      PORTREEVE_STALE: 'old',
      PORTREEVE_STACK_ID: 'wrong',
      ORDINARY_VALUE: 'kept',
    },
    environment: { PORTREEVE_STACK_ID: 'current' },
    timeoutMilliseconds: 2_000,
  });
  expect(result.outcome).toBe('succeeded');
  expect(
    result.output.chunks
      .map((/** @type {{text: string}} */ chunk) => chunk.text)
      .join(''),
  ).toBe('unset|current|kept');
});

test('tracks one attached group locally and terminates only that exact group', async () => {
  const registry = new AttachedCommandRegistry();
  /** @type {Array<{processGroupId: number, signal: NodeJS.Signals}>} */
  const signals = [];
  const running = registry.run('/stacks/example', {
    command: "trap '' TERM; while :; do sleep 1; done",
    shellPath: '/bin/sh',
    workingDirectory: process.cwd(),
    environment: {},
    terminationGraceMilliseconds: 20,
    signalProcessGroup(processGroupId, signal) {
      signals.push({ processGroupId, signal });
      process.kill(-processGroupId, signal);
    },
  });
  await waitFor(() => registry.inspect('/stacks/example') !== null);
  const tracked = registry.inspect('/stacks/example');
  const processGroupId = tracked?.processGroupId;
  if (processGroupId === null || processGroupId === undefined) {
    throw new Error('Attached command did not expose its process group.');
  }
  expect(processGroupId).toBeGreaterThan(0);
  await expect(
    registry.run('/stacks/example', {
      command: 'printf duplicate',
      shellPath: '/bin/sh',
      workingDirectory: process.cwd(),
      environment: {},
    }),
  ).rejects.toMatchObject({ code: 'launcher_attached_already_running' });
  expect(registry.terminate('/stacks/example')).toBe(true);
  const result = await running;
  expect(result).toMatchObject({ outcome: 'cancelled' });
  expect(signals[0]).toEqual({ processGroupId, signal: 'SIGTERM' });
  expect(signals.every((entry) => entry.processGroupId === processGroupId)).toBe(true);
  expect(registry.inspect('/stacks/example')).toBeNull();
  expect(registry.terminate('/stacks/example')).toBe(false);
});

test('does not signal a stale attached group after the child reports exit', async () => {
  const child = Object.assign(new EventEmitter(), {
    pid: 43210,
    stdout: null,
    stderr: null,
    exitCode: 0,
    signalCode: null,
  });
  /** @type {Array<{processGroupId: number, signal: NodeJS.Signals}>} */
  const signals = [];
  const session = startAttachedCommand({
    command: 'not executed by fixture',
    shellPath: '/bin/sh',
    workingDirectory: process.cwd(),
    environment: {},
    spawnProcess: /** @type {any} */ (() => child),
    signalProcessGroup(processGroupId, signal) {
      signals.push({ processGroupId, signal });
    },
  });
  expect(session.terminate()).toBe(false);
  expect(signals).toEqual([]);
  child.emit('close', 0, null);
  expect(await session.result).toMatchObject({ outcome: 'succeeded', signal: null });
});

/** @param {() => boolean} predicate */
async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for condition.');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
  }
}
