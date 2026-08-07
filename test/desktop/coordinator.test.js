// @ts-check

import { expect, test } from 'bun:test';
import { createStateCoordinator } from '../../apps/desktop/main/coordinator.js';
import {
  inventoryEntry,
  lifecycleSnapshot,
  provisionalArtifact,
  stackStatus,
  timestamp,
} from './fixtures.js';

/** @param {string} operation @param {Record<string, unknown>} [overrides] */
function mutationResult(operation, overrides = {}) {
  const status = lifecycleSnapshot();
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

test('coalesces overlapping refreshes and preserves successful evidence as stale', async () => {
  let lifecycleCalls = 0;
  let inventoryCalls = 0;
  /** @type {() => void} */
  let releaseFirst = () => {};
  /** @type {Promise<void>} */
  const firstGate = new Promise((resolvePromise) => {
    releaseFirst = resolvePromise;
  });
  const lifecycle = {
    async status() {
      lifecycleCalls += 1;
      if (lifecycleCalls === 1) await firstGate;
      if (lifecycleCalls === 2)
        throw Object.assign(new Error('secret lifecycle path'), { code: 'offline' });
      return lifecycleSnapshot();
    },
  };
  const inventory = {
    async listPorts() {
      inventoryCalls += 1;
      if (inventoryCalls === 2) throw new Error('secret socket path');
      return [inventoryEntry()];
    },
  };
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle,
    inventory,
    now: () => new Date(timestamp),
  });
  const first = coordinator.refresh();
  const overlapping = coordinator.refresh();
  expect(first).toBe(overlapping);
  releaseFirst();
  expect((await first).stale).toBe(false);
  expect(lifecycleCalls).toBe(1);

  const stale = await coordinator.refresh();
  expect(stale.stale).toBe(true);
  expect(stale.lifecycle?.mode).toBe('supervised');
  expect(stale.ports).toHaveLength(1);
  expect(stale.errors.map(({ source }) => source)).toEqual(['lifecycle', 'inventory']);
  expect(JSON.stringify(stale.errors)).not.toContain('secret');
  expect(stale.errors.map(({ message }) => message)).toEqual([
    'Portreeve lifecycle status is unavailable.',
    'Portreeve port inventory is unavailable.',
  ]);
});

test('polls every five seconds without installing duplicate timers', async () => {
  let lifecycleCalls = 0;
  let inventoryCalls = 0;
  const scheduledState = {
    callback: /** @type {(() => void)|null} */ (null),
  };
  let scheduledDelay = 0;
  /** @type {unknown} */
  let canceled = null;
  const timer = Symbol('timer');
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      async status() {
        lifecycleCalls += 1;
        return lifecycleSnapshot();
      },
    },
    inventory: {
      async listPorts() {
        inventoryCalls += 1;
        return [];
      },
    },
    schedule(callback, milliseconds) {
      scheduledState.callback = callback;
      scheduledDelay = milliseconds;
      return timer;
    },
    cancel(value) {
      canceled = value;
    },
  });

  coordinator.start();
  coordinator.start();
  expect(scheduledDelay).toBe(5_000);
  expect(scheduledState.callback).not.toBeNull();
  scheduledState.callback?.();
  await Bun.sleep(0);
  expect({ lifecycleCalls, inventoryCalls }).toEqual({
    lifecycleCalls: 1,
    inventoryCalls: 1,
  });
  coordinator.stop();
  expect(canceled).toBe(timer);
});

test('serializes mutations with refresh and returns the mutation final snapshot', async () => {
  let mutating = false;
  let statusCalls = 0;
  /** @type {() => void} */
  let releaseStart = () => {};
  /** @type {Promise<void>} */
  const gate = new Promise((resolvePromise) => {
    releaseStart = resolvePromise;
  });
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      clearPurgePreview() {},
      async start() {
        mutating = true;
        await gate;
        mutating = false;
        return mutationResult('start');
      },
      async status() {
        expect(mutating).toBe(false);
        statusCalls += 1;
        return lifecycleSnapshot();
      },
    },
    inventory: {
      async listPorts() {
        return [];
      },
    },
    now: () => new Date(timestamp),
  });
  const mutation = coordinator.startService();
  await Bun.sleep(0);
  const refresh = coordinator.refresh();
  expect(statusCalls).toBe(0);
  expect(() => coordinator.stopService()).toThrow(
    'Another Portreeve operation is already in progress.',
  );
  releaseStart();
  const result = await mutation;
  expect(await refresh).toEqual(result.snapshot);
  expect(statusCalls).toBe(1);
});

test('reports install success followed by failed health verification as partial', async () => {
  const base = lifecycleSnapshot();
  const mismatched = lifecycleSnapshot({
    socket: {
      ...base.socket,
      server: { ...base.socket.server, pid: 9999 },
    },
  });
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      clearPurgePreview() {},
      async install() {
        return mutationResult('install');
      },
      async start() {
        return mutationResult('start');
      },
      async status() {
        return mismatched;
      },
    },
    inventory: {
      async listPorts() {
        return [];
      },
    },
    now: () => new Date(timestamp),
  });
  const result = await coordinator.installAndStart();
  expect(result).toMatchObject({
    outcome: 'partial',
    changed: true,
    errorCode: 'supervised_health_verification_failed',
  });
  expect(result.steps.map((/** @type {any} */ { operation }) => operation)).toEqual([
    'install',
    'start',
  ]);
});

test('preserves safe lifecycle error codes and messages for the renderer', async () => {
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      clearPurgePreview() {},
      async restart() {
        return mutationResult('restart', {
          outcome: 'failed',
          changed: false,
          error: {
            code: 'internal',
            message: 'Portreeve runtime file is not private; change its mode to 0600.',
          },
        });
      },
      async status() {
        return lifecycleSnapshot();
      },
    },
    inventory: {
      async listPorts() {
        return [];
      },
    },
    now: () => new Date(timestamp),
  });
  expect(await coordinator.restartService()).toMatchObject({
    outcome: 'failed',
    errorCode: 'internal',
    error: {
      code: 'internal',
      message: 'Portreeve runtime file is not private; change its mode to 0600.',
    },
    steps: [
      {
        operation: 'restart',
        error: {
          code: 'internal',
          message: 'Portreeve runtime file is not private; change its mode to 0600.',
        },
      },
    ],
  });
});

test('returns actionable safe details and refreshes after an adapter-level mutation failure', async () => {
  let statusCalls = 0;
  let published = 0;
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      clearPurgePreview() {},
      async start() {
        throw Object.assign(new Error('private executable failure'), {
          code: 'lifecycle_unavailable',
        });
      },
      async status() {
        statusCalls += 1;
        return lifecycleSnapshot();
      },
    },
    inventory: {
      async listPorts() {
        return [];
      },
    },
    now: () => new Date(timestamp),
  });
  coordinator.subscribe(() => {
    published += 1;
  });
  expect(await coordinator.startService()).toMatchObject({
    outcome: 'failed',
    error: {
      code: 'lifecycle_unavailable',
      message: 'private executable failure',
    },
  });
  expect(statusCalls).toBe(1);
  expect(published).toBe(1);
  expect(coordinator.current()?.lifecycle?.mode).toBe('supervised');
});

test('collects stack evidence and serializes stack mutations with other desktop work', async () => {
  let prepared = 0;
  const status = stackStatus();
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      async status() {
        return lifecycleSnapshot();
      },
    },
    inventory: {
      async listPorts() {
        return [];
      },
    },
    stacks: {
      async list() {
        return [status];
      },
      /** @param {string} stackId */
      async prepare(stackId) {
        expect(stackId).toBe(status.stack.id);
        prepared += 1;
        return { reused: false, generation: status.generation };
      },
      async previewPrune() {
        return {
          candidates: [
            {
              stack: status.stack,
              claimIds: ['11111111-1111-4111-8111-111111111111'],
              reason: 'stack-root-missing',
            },
          ],
          blocked: [],
        };
      },
    },
    now: () => new Date(timestamp),
  });
  const initial = await coordinator.refresh();
  expect(initial.stacks[0]).toMatchObject({
    project: 'caregiver',
    stackRootName: 'caregiver-secret-worktree',
    activation: { state: 'confirmed' },
  });
  const result = await coordinator.prepareStack(status.stack.id);
  expect(result).toMatchObject({
    action: 'prepare',
    outcome: 'succeeded',
    changed: true,
  });
  expect(prepared).toBe(1);
  expect(result.snapshot.stacks).toHaveLength(1);
  expect(await coordinator.previewStackPrune()).toEqual({
    schemaVersion: 1,
    olderThanDays: 7,
    candidates: [
      {
        stackId: status.stack.id,
        project: 'caregiver',
        stackRootName: 'caregiver-secret-worktree',
        claimCount: 1,
        reason: 'stack-root-missing',
      },
    ],
    blocked: [],
  });
});

test('publishes update discovery independently without delaying local refresh', async () => {
  /** @type {(value: unknown) => void} */
  let releaseUpdate = () => {};
  const updateGate = new Promise((resolvePromise) => {
    releaseUpdate = resolvePromise;
  });
  /** @type {any[]} */
  const published = [];
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      async status() {
        return lifecycleSnapshot();
      },
    },
    inventory: {
      async listPorts() {
        return [];
      },
    },
    updates: {
      async check() {
        await updateGate;
        return {
          status: 'available',
          checkedAt: timestamp,
          latestVersion: '0.2.0',
        };
      },
      async openDownloadPage() {
        return { schemaVersion: 1, opened: true };
      },
    },
    now: () => new Date(timestamp),
  });
  coordinator.subscribe((value) => published.push(value));

  const local = await coordinator.refresh();
  expect(local.update.status).toBe('not-checked');
  const checking = coordinator.checkForUpdates();
  expect((await coordinator.refresh()).lifecycle?.mode).toBe('supervised');
  expect(coordinator.current()?.update.status).toBe('not-checked');
  releaseUpdate(undefined);
  expect(await checking).toEqual({
    status: 'available',
    checkedAt: timestamp,
    latestVersion: '0.2.0',
  });
  expect(coordinator.current()?.update.status).toBe('available');
  expect(published.at(-1)?.update.status).toBe('available');
  expect(await coordinator.openDownloadPage()).toEqual({
    schemaVersion: 1,
    opened: true,
  });
});
