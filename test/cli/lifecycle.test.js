// @ts-check

import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  installCommand,
  purgeCommand,
  restartCommand,
  startCommand,
  stopCommand,
  stopManualCommand,
  uninstallCommand,
} from '../../src/cli/commands/lifecycle.js';
import { CliUsageError } from '../../src/cli/exit.js';
import { captureOutput, parseRenderedJson } from '../fixtures/cli-runtime.js';

const timestamp = '2026-07-30T23:00:00.000Z';

test('keeps lifecycle orchestration in the shared service rather than the CLI', async () => {
  const source = await readFile('src/cli/commands/lifecycle.js', 'utf8');
  expect(source).toContain('createLifecycleService');
  expect(source).not.toContain('createLifecycleManager');
  expect(source).not.toContain('executeLifecycleMutation');
  expect(source).not.toContain('lifecycleStateChanged');
});

test('preserves the JSON envelope for every lifecycle mutation adapter', async () => {
  /** @type {string[]} */
  const calls = [];
  const service = mutationService(calls);
  /** @type {Array<[string, (options: any) => Promise<void>]>} */
  const commands = [
    ['install', installCommand],
    ['uninstall', uninstallCommand],
    ['start', startCommand],
    ['restart', restartCommand],
    ['stop', stopCommand],
    ['stop-manual', stopManualCommand],
  ];

  for (const [operation, command] of commands) {
    const output = await captureOutput(() =>
      /** @type {(options: any) => Promise<void>} */ (command)({
        json: true,
        service,
      }),
    );
    expect(output.exitCode).toBe(0);
    expect(parseRenderedJson(output.lines)).toEqual({
      version: 1,
      result: mutationResult(String(operation)),
    });
  }

  expect(calls).toEqual(commands.map(([operation]) => operation));
});

test('maps a shared lifecycle error code onto the existing CLI exit band', async () => {
  const service = mutationService([], {
    start: mutationResult('start', {
      outcome: 'failed',
      changed: false,
      error: { code: 'unavailable', message: 'Supervisor evidence is unavailable.' },
    }),
  });
  const output = await captureOutput(() =>
    startCommand({ json: true, service: /** @type {any} */ (service) }),
  );

  expect(output.exitCode).toBe(30);
  expect(parseRenderedJson(output.lines)).toMatchObject({
    result: {
      operation: 'start',
      outcome: 'failed',
      error: { code: 'unavailable' },
    },
  });
});

test('purge requires exactly one preview or evidence-bound execution mode', async () => {
  await expect(purgeCommand({ json: true })).rejects.toBeInstanceOf(CliUsageError);
  await expect(
    purgeCommand({ dryRun: true, confirm: 'token', json: true }),
  ).rejects.toBeInstanceOf(CliUsageError);
  await expect(
    purgeCommand({ confirm: 'not-a-preview-token', json: true }),
  ).rejects.toThrow('64-character lowercase hexadecimal token');
});

/**
 * @param {string[]} calls
 * @param {Record<string, ReturnType<typeof mutationResult>>} [overrides]
 */
function mutationService(calls, overrides = {}) {
  /** @param {string} operation */
  const invoke = (operation) => async () => {
    calls.push(operation);
    return overrides[operation] ?? mutationResult(operation);
  };
  return /** @type {any} */ ({
    install: invoke('install'),
    uninstall: invoke('uninstall'),
    start: invoke('start'),
    restart: invoke('restart'),
    stop: invoke('stop'),
    stopManual: invoke('stop-manual'),
  });
}

/** @param {string} operation @param {Record<string, unknown>} [overrides] */
function mutationResult(operation, overrides = {}) {
  const status = snapshot();
  return {
    operation,
    outcome: 'succeeded',
    changed: true,
    startedAt: timestamp,
    completedAt: timestamp,
    before: status,
    after: status,
    error: null,
    ...overrides,
  };
}

function snapshot() {
  return {
    observedAt: timestamp,
    installation: {
      state: 'installed',
      managedExecutablePath: '/tmp/portreeve',
      version: '0.1.0',
      error: null,
    },
    supervisor: {
      kind: 'launchd',
      state: 'inactive',
      mainPid: null,
      error: null,
    },
    socket: {
      path: '/tmp/portreeve.sock',
      state: 'unavailable',
      server: null,
      error: { code: 'unavailable', message: 'Socket is unavailable.' },
    },
    mode: 'none',
    versions: { cli: '0.1.0', managed: '0.1.0', running: null },
    limitations: [],
  };
}
