// @ts-check

import { expect, test } from 'bun:test';
import {
  executeLifecycleMutation,
  purgeCommand,
} from '../../src/cli/commands/lifecycle.js';
import { CliUsageError } from '../../src/cli/exit.js';
import { LifecycleConflictError } from '../../src/supervision/manager.js';

const timestamp = '2026-07-30T23:00:00.000Z';

test('lifecycle mutation execution returns structured refusal evidence', async () => {
  const before = snapshot();
  const manager = managerWithStatuses(before, before);
  const execution = await executeLifecycleMutation(
    /** @type {any} */ (manager),
    'start',
    async () => {
      throw new LifecycleConflictError('A manual server is running.');
    },
    () => new Date(timestamp),
  );

  expect(execution.exitCode).toBe(20);
  expect(execution.result).toMatchObject({
    operation: 'start',
    outcome: 'refused',
    changed: false,
    before,
    after: before,
    error: {
      code: 'conflict',
      message: 'A manual server is running.',
    },
  });
});

test('lifecycle mutation execution reports changed state as partial on failure', async () => {
  const before = snapshot();
  const after = snapshot({
    supervisor: {
      kind: 'launchd',
      state: 'active',
      mainPid: 4242,
      error: null,
    },
    socket: {
      path: '/tmp/portreeve.sock',
      state: 'unavailable',
      server: null,
      error: { code: 'unavailable', message: 'Socket is unavailable.' },
    },
    mode: 'ambiguous',
    limitations: ['execution-mode-ambiguous'],
  });
  const manager = managerWithStatuses(before, after);
  const execution = await executeLifecycleMutation(
    /** @type {any} */ (manager),
    'start',
    async () => {
      throw new Error('Health verification failed.');
    },
    () => new Date(timestamp),
  );

  expect(execution.exitCode).toBe(70);
  expect(execution.result).toMatchObject({
    operation: 'start',
    outcome: 'partial',
    changed: true,
    before,
    after,
    error: {
      code: 'internal',
      message: 'Health verification failed.',
    },
  });
});

test('purge requires exactly one preview or evidence-bound execution mode', async () => {
  await expect(purgeCommand({ json: true })).rejects.toBeInstanceOf(CliUsageError);
  await expect(
    purgeCommand({ dryRun: true, confirm: 'token', json: true }),
  ).rejects.toBeInstanceOf(CliUsageError);
});

/**
 * @param {ReturnType<typeof snapshot>} before
 * @param {ReturnType<typeof snapshot>} after
 */
function managerWithStatuses(before, after) {
  let count = 0;
  return {
    status() {
      count += 1;
      return Promise.resolve(count === 1 ? before : after);
    },
  };
}

/**
 * @param {Record<string, unknown>} [overrides]
 */
function snapshot(overrides = {}) {
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
    versions: {
      cli: '0.1.0',
      managed: '0.1.0',
      running: null,
    },
    limitations: [],
    ...overrides,
  };
}
