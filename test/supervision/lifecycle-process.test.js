// @ts-check

import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLifecycleService } from '../../src/supervision/service.js';
import { lifecycleSnapshot, timestamp } from '../desktop/fixtures.js';

test.skipIf(process.platform === 'win32')(
  'refuses a real process contender, keeps reads live, and recovers after SIGKILL',
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'portreeve-service-process-'));
    const lockPath = join(directory, 'runtime', 'lifecycle.sock');
    const helper = fileURLToPath(
      new URL('../fixtures/lifecycle-service-holder.js', import.meta.url),
    );
    const holder = spawn(process.execPath, [helper, lockPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await waitForOutput(holder, 'mutating\n');
      let enteredStop = false;
      const contender = serviceFor(lockPath, {
        async stop() {
          enteredStop = true;
          return { changed: true };
        },
      });
      const startedAt = performance.now();
      const refused = await contender.stop();
      expect(performance.now() - startedAt).toBeLessThan(1_000);
      expect(enteredStop).toBe(false);
      expect(refused).toMatchObject({
        operation: 'stop',
        outcome: 'refused',
        changed: false,
        error: { code: 'lifecycle_busy' },
      });
      expect((await contender.status()).mode).toBe('supervised');
      expect(await contender.previewPurge()).toMatchObject({
        operation: 'purge',
        dryRun: true,
        allowed: true,
      });

      holder.kill('SIGKILL');
      await waitForExit(holder);

      let enteredRestart = false;
      const nextLaunch = serviceFor(lockPath, {
        async restart() {
          enteredRestart = true;
        },
      });
      expect(await nextLaunch.restart()).toMatchObject({
        operation: 'restart',
        outcome: 'succeeded',
        changed: true,
        error: null,
      });
      expect(enteredRestart).toBe(true);
      expect((await nextLaunch.status()).mode).toBe('supervised');
    } finally {
      if (holder.exitCode === null && holder.signalCode === null) {
        holder.kill('SIGKILL');
        await waitForExit(holder);
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
);

/** @param {string} lockPath @param {Record<string, unknown>} operations */
function serviceFor(lockPath, operations) {
  return createLifecycleService({
    manager: /** @type {any} */ ({
      paths: { lifecycleLockPath: lockPath },
      status: async () => lifecycleSnapshot(),
      previewPurge: async () => ({
        operation: 'purge',
        dryRun: true,
        allowed: true,
        confirmationToken: 'a'.repeat(64),
        root: '/isolated/portreeve',
        marker: null,
        status: lifecycleSnapshot(),
        paths: [],
        refused: [],
      }),
      ...operations,
    }),
    operationTimeoutMilliseconds: 5_000,
    readTimeoutMilliseconds: 2_000,
    recoveryTimeoutMilliseconds: 2_000,
    now: () => new Date(timestamp),
  });
}

/** @param {import('node:child_process').ChildProcess} child @param {string} expected */
function waitForOutput(child, expected) {
  return new Promise((resolvePromise, reject) => {
    let output = '';
    let settled = false;
    const timeout = setTimeout(
      () => reject(new Error(`Lifecycle holder did not emit ${expected.trim()}.`)),
      3_000,
    );
    /** @param {() => void} callback */
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener('exit', onExit);
      callback();
    };
    /** @param {number|null} code @param {NodeJS.Signals|null} signal */
    const onExit = (code, signal) =>
      settle(() =>
        reject(
          new Error(
            `Lifecycle holder exited before readiness (${String(code ?? signal)}).`,
          ),
        ),
      );
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      output += chunk;
      if (output.includes(expected)) settle(() => resolvePromise(undefined));
    });
    child.once('exit', onExit);
  });
}

/** @param {import('node:child_process').ChildProcess} child */
function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolvePromise) => child.once('exit', resolvePromise));
}
