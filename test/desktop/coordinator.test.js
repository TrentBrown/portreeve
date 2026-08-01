// @ts-check

import { expect, test } from 'bun:test';
import { createStateCoordinator } from '../../apps/desktop/main/coordinator.js';
import {
  inventoryEntry,
  lifecycleSnapshot,
  provisionalArtifact,
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

test('refreshes and publishes evidence after an adapter-level mutation failure', async () => {
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
  await expect(coordinator.startService()).rejects.toMatchObject({
    code: 'lifecycle_unavailable',
  });
  expect(statusCalls).toBe(1);
  expect(published).toBe(1);
  expect(coordinator.current()?.lifecycle?.mode).toBe('supervised');
});
