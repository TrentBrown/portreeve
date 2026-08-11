// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LifecycleBusyError,
  LifecycleMutationLock,
} from '../../src/supervision/lock.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test('uses live listener evidence to refuse an active contender', async () => {
  const path = await lockPath();
  const first = new LifecycleMutationLock({ path });
  const second = new LifecycleMutationLock({ path });
  const lease = await first.acquire('restart');
  try {
    await expect(second.acquire('stop')).rejects.toEqual(
      new LifecycleBusyError('restart'),
    );
  } finally {
    await lease.release();
  }
  const next = await second.acquire('stop');
  await next.release();
});

test('never replaces an unsafe non-socket lock path', async () => {
  const path = await lockPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, 'user-data');
  const lock = new LifecycleMutationLock({ path });
  await expect(lock.acquire('restart')).rejects.toBeInstanceOf(LifecycleBusyError);
  expect(await readFile(path, 'utf8')).toBe('user-data');
});

test.skipIf(process.platform === 'win32')(
  'recovers an abandoned listener after its owner is killed',
  async () => {
    const path = await lockPath();
    const helper = fileURLToPath(
      new URL('../fixtures/lifecycle-lock-holder.js', import.meta.url),
    );
    const child = spawn(process.execPath, [helper, path], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await waitForReady(child);
      const contender = new LifecycleMutationLock({ path });
      await expect(contender.acquire('stop')).rejects.toBeInstanceOf(
        LifecycleBusyError,
      );
      child.kill('SIGKILL');
      await waitForExit(child);
      const recoveryAttempts = await Promise.allSettled(
        Array.from({ length: 12 }, () =>
          new LifecycleMutationLock({ path }).acquire('stop'),
        ),
      );
      const recovered = recoveryAttempts.filter(
        (attempt) => attempt.status === 'fulfilled',
      );
      expect(recovered).toHaveLength(1);
      expect(
        recoveryAttempts
          .filter((attempt) => attempt.status === 'rejected')
          .every((attempt) => attempt.reason instanceof LifecycleBusyError),
      ).toBe(true);
      await recovered[0]?.value.release();
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  },
);

async function lockPath() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-lock-'));
  directories.push(directory);
  return join(directory, 'runtime', 'lifecycle.sock');
}

/** @param {import('node:child_process').ChildProcess} child */
function waitForReady(child) {
  return new Promise((resolvePromise, reject) => {
    let output = '';
    const timer = setTimeout(
      () => reject(new Error('Lock holder did not start.')),
      3000,
    );
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      output += chunk;
      if (output.includes('ready\n')) {
        clearTimeout(timer);
        resolvePromise(undefined);
      }
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Lock holder exited before ready (${String(code ?? signal)}).`));
    });
  });
}

/** @param {import('node:child_process').ChildProcess} child */
function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolvePromise) => child.once('exit', resolvePromise));
}
