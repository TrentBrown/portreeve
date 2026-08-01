// @ts-check

import { expect, test } from 'bun:test';
import { createStateCoordinator } from '../../apps/desktop/main/coordinator.js';
import {
  inventoryEntry,
  lifecycleSnapshot,
  provisionalArtifact,
  timestamp,
} from './fixtures.js';

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
