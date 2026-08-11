// @ts-check

import { expect, test } from 'bun:test';
import { LifecycleConflictError } from '../../src/supervision/manager.js';
import { LifecycleBusyError } from '../../src/supervision/lock.js';
import { LifecycleService } from '../../src/supervision/service.js';

const timestamp = '2026-07-30T23:00:00.000Z';

test('owns canonical operation and changed-state semantics for every mutation', async () => {
  /** @type {string[]} */
  const calls = [];
  const service = new LifecycleService({
    manager: /** @type {any} */ ({
      status: async () => snapshot(),
      install: async () => calls.push('install'),
      uninstall: async () => calls.push('uninstall'),
      start: async () => calls.push('start'),
      restart: async () => calls.push('restart'),
      stop: async () => {
        calls.push('stop');
        return { changed: false, mode: null };
      },
      stopManual: async () => {
        calls.push('stop-manual');
        return { changed: true, mode: 'manual' };
      },
    }),
    lock: immediateLock(),
    now: () => new Date(timestamp),
  });

  expect(await service.install()).toMatchObject({
    operation: 'install',
    outcome: 'succeeded',
    changed: true,
  });
  expect(await service.uninstall()).toMatchObject({
    operation: 'uninstall',
    outcome: 'succeeded',
    changed: true,
  });
  expect(await service.start()).toMatchObject({
    operation: 'start',
    outcome: 'succeeded',
    changed: true,
  });
  expect(await service.restart()).toMatchObject({
    operation: 'restart',
    outcome: 'succeeded',
    changed: true,
  });
  expect(await service.stop()).toMatchObject({
    operation: 'stop',
    outcome: 'no-change',
    changed: false,
  });
  expect(await service.stopManual()).toMatchObject({
    operation: 'stop-manual',
    outcome: 'succeeded',
    changed: true,
  });
  expect(calls).toEqual([
    'install',
    'uninstall',
    'start',
    'restart',
    'stop',
    'stop-manual',
  ]);
});

test('returns structured refusal evidence without leaking adapter exit semantics', async () => {
  const before = snapshot();
  const service = serviceWithStatuses(before, before, {
    start: async () => {
      throw new LifecycleConflictError('A manual server is running.');
    },
  });

  expect(await service.start()).toMatchObject({
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

test('reports changed state as partial when a mutation fails', async () => {
  const before = snapshot();
  const after = snapshot({
    supervisor: {
      kind: 'launchd',
      state: 'active',
      mainPid: 4242,
      error: null,
    },
    mode: 'ambiguous',
    limitations: ['execution-mode-ambiguous'],
  });
  const service = serviceWithStatuses(before, after, {
    start: async () => {
      throw new Error('Health verification failed.');
    },
  });

  expect(await service.start()).toMatchObject({
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

test('reports unchanged state as failed when a mutation fails', async () => {
  const before = snapshot();
  const service = serviceWithStatuses(before, before, {
    restart: async () => {
      throw new Error('Supervisor command failed.');
    },
  });

  expect(await service.restart()).toMatchObject({
    operation: 'restart',
    outcome: 'failed',
    changed: false,
    before,
    after: before,
    error: {
      code: 'internal',
      message: 'Supervisor command failed.',
    },
  });
});

test('returns partial timeout evidence after a mutation changes host state', async () => {
  const before = snapshot();
  const after = snapshot({
    supervisor: {
      kind: 'launchd',
      state: 'active',
      mainPid: 4242,
      error: null,
    },
    mode: 'ambiguous',
    limitations: ['execution-mode-ambiguous'],
  });
  let current = before;
  const service = new LifecycleService({
    manager: /** @type {any} */ ({
      status: async () => current,
      start: async (
        /** @type {import('../../src/supervision/deadline.js').LifecycleDeadline} */ context,
      ) => {
        current = after;
        await context.wait(100, 'test-start');
      },
    }),
    lock: immediateLock(),
    operationTimeoutMilliseconds: 15,
    recoveryTimeoutMilliseconds: 100,
    now: () => new Date(timestamp),
  });

  expect(await service.start()).toMatchObject({
    operation: 'start',
    outcome: 'partial',
    changed: true,
    before,
    after,
    error: { code: 'lifecycle_timeout' },
  });
});

test('returns failed timeout evidence when expiry leaves host state unchanged', async () => {
  const before = snapshot();
  const service = new LifecycleService({
    manager: /** @type {any} */ ({
      status: async () => before,
      restart: async (
        /** @type {import('../../src/supervision/deadline.js').LifecycleDeadline} */ context,
      ) => {
        await context.wait(100, 'test-restart');
      },
    }),
    lock: immediateLock(),
    operationTimeoutMilliseconds: 15,
    recoveryTimeoutMilliseconds: 100,
    now: () => new Date(timestamp),
  });

  expect(await service.restart()).toMatchObject({
    operation: 'restart',
    outcome: 'failed',
    changed: false,
    before,
    after: before,
    error: { code: 'lifecycle_timeout' },
  });
});

test('returns prompt lifecycle-busy refusal without entering mutation', async () => {
  const before = snapshot();
  let starts = 0;
  const service = new LifecycleService({
    manager: /** @type {any} */ ({
      status: async () => before,
      start: async () => {
        starts += 1;
      },
    }),
    lock: /** @type {any} */ ({
      async acquire() {
        throw new LifecycleBusyError('install');
      },
    }),
    now: () => new Date(timestamp),
  });

  expect(await service.start()).toMatchObject({
    operation: 'start',
    outcome: 'refused',
    changed: false,
    before,
    after: before,
    error: {
      code: 'lifecycle_busy',
      message: 'Another PortReeve lifecycle mutation is active (install).',
    },
  });
  expect(starts).toBe(0);
});

test('keeps status and purge preview concurrent with an active mutation lock', async () => {
  const status = snapshot();
  const confirmationToken = 'a'.repeat(64);
  let acquisitions = 0;
  const service = new LifecycleService({
    manager: /** @type {any} */ ({
      status: async () => status,
      previewPurge: async () => ({
        operation: 'purge',
        dryRun: true,
        allowed: false,
        confirmationToken,
        root: '/tmp/portreeve',
        marker: null,
        status,
        paths: [],
        refused: [{ path: null, reason: 'test-preview' }],
      }),
    }),
    lock: /** @type {any} */ ({
      async acquire() {
        acquisitions += 1;
        throw new Error('Read operations must not acquire the mutation lock.');
      },
    }),
  });

  expect(await service.status()).toEqual(status);
  expect(await service.previewPurge()).toMatchObject({
    operation: 'purge',
    confirmationToken,
  });
  expect(acquisitions).toBe(0);
});

test('returns structured purge refusal when another mutation owns the lock', async () => {
  const status = snapshot();
  const service = new LifecycleService({
    manager: /** @type {any} */ ({ status: async () => status }),
    lock: /** @type {any} */ ({
      async acquire() {
        throw new LifecycleBusyError('restart');
      },
    }),
    now: () => new Date(timestamp),
  });

  expect(await service.purge('b'.repeat(64))).toMatchObject({
    operation: 'purge',
    outcome: 'refused',
    before: status,
    after: status,
    refused: [{ path: null, reason: 'lifecycle-busy' }],
    error: { code: 'lifecycle_busy' },
  });
});

test('returns partial purge timeout evidence after lifecycle state changes', async () => {
  const before = snapshot();
  const after = snapshot({
    installation: {
      state: 'absent',
      managedExecutablePath: '/tmp/portreeve',
      version: null,
      error: null,
    },
    versions: { cli: '0.1.0', managed: null, running: null },
  });
  let current = before;
  const service = new LifecycleService({
    manager: /** @type {any} */ ({
      status: async () => current,
      purge: async (
        /** @type {string} */ _token,
        /** @type {import('../../src/supervision/deadline.js').LifecycleDeadline} */ context,
      ) => {
        current = after;
        await context.wait(100, 'test-purge');
      },
    }),
    lock: immediateLock(),
    operationTimeoutMilliseconds: 15,
    recoveryTimeoutMilliseconds: 100,
    now: () => new Date(timestamp),
  });

  expect(await service.purge('c'.repeat(64))).toMatchObject({
    operation: 'purge',
    outcome: 'partial',
    before,
    after,
    error: { code: 'lifecycle_timeout' },
  });
});

/**
 * @param {ReturnType<typeof snapshot>} before
 * @param {ReturnType<typeof snapshot>} after
 * @param {Record<string, (...args: any[]) => Promise<unknown>>} operations
 */
function serviceWithStatuses(before, after, operations) {
  let count = 0;
  return new LifecycleService({
    manager: /** @type {any} */ ({
      status: async () => {
        count += 1;
        return count === 1 ? before : after;
      },
      ...operations,
    }),
    lock: immediateLock(),
    now: () => new Date(timestamp),
  });
}

function immediateLock() {
  return /** @type {any} */ ({
    async acquire() {
      return { release: async () => {} };
    },
  });
}

/** @param {Record<string, unknown>} [overrides] */
function snapshot(overrides = {}) {
  return {
    observedAt: timestamp,
    installation: {
      state: /** @type {'installed'} */ ('installed'),
      managedExecutablePath: '/tmp/portreeve',
      version: '0.1.0',
      error: null,
    },
    supervisor: {
      kind: 'launchd',
      state: /** @type {'inactive'} */ ('inactive'),
      mainPid: null,
      error: null,
    },
    socket: {
      path: '/tmp/portreeve.sock',
      state: /** @type {'unavailable'} */ ('unavailable'),
      server: null,
      error: { code: 'unavailable', message: 'Socket is unavailable.' },
    },
    mode: /** @type {'none'} */ ('none'),
    versions: {
      cli: '0.1.0',
      managed: '0.1.0',
      running: null,
    },
    limitations: [],
    ...overrides,
  };
}
