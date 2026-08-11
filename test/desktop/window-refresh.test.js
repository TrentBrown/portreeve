// @ts-check

import { EventEmitter } from 'node:events';
import { expect, test } from 'bun:test';
import {
  bindApplicationCloseGuard,
  bindWindowCloseGuard,
  bindWindowRefresh,
} from '../../apps/desktop/main/window.js';
import { createStateCoordinator } from '../../apps/desktop/main/coordinator.js';
import { lifecycleSnapshot, provisionalArtifact, timestamp } from './fixtures.js';

test('refreshes on focus and pauses polling while hidden or minimized', async () => {
  const events = new EventEmitter();
  let visible = false;
  let minimized = false;
  /** @type {string[]} */
  const calls = [];
  const window = Object.assign(events, {
    isVisible: () => visible,
    isMinimized: () => minimized,
  });
  const coordinator = {
    async refresh() {
      calls.push('refresh');
    },
    start() {
      calls.push('start');
    },
    stop() {
      calls.push('stop');
    },
  };

  bindWindowRefresh(/** @type {any} */ (window), coordinator);
  events.emit('show');
  expect(calls).toEqual([]);

  visible = true;
  events.emit('show');
  events.emit('focus');
  expect(calls).toEqual(['start', 'refresh', 'start']);

  minimized = true;
  events.emit('minimize');
  events.emit('focus');
  expect(calls).toEqual(['start', 'refresh', 'start', 'stop']);

  minimized = false;
  events.emit('restore');
  events.emit('hide');
  expect(calls).toEqual([
    'start',
    'refresh',
    'start',
    'stop',
    'refresh',
    'start',
    'stop',
  ]);
});

test('blocks window close while an application-owned attached launcher is live', () => {
  const events = new EventEmitter();
  let attached = true;
  /** @type {unknown[]} */
  const blocked = [];
  bindWindowCloseGuard(
    /** @type {any} */ (events),
    {
      applicationCloseState() {
        return {
          schemaVersion: 1,
          allowed: !attached,
          lifecycle: null,
          attached: attached ? [{ project: 'caregiver' }] : [],
        };
      },
    },
    (state) => blocked.push(state),
  );
  let prevented = 0;
  const close = () =>
    events.emit('close', {
      preventDefault() {
        prevented += 1;
      },
    });
  close();
  expect(prevented).toBe(1);
  expect(blocked).toHaveLength(1);
  attached = false;
  close();
  expect(prevented).toBe(1);
});

test('blocks application quit while a lifecycle mutation is active', () => {
  const events = new EventEmitter();
  let active = true;
  /** @type {unknown[]} */
  const blocked = [];
  const unbind = bindApplicationCloseGuard(
    /** @type {any} */ (events),
    {
      applicationCloseState() {
        return {
          schemaVersion: 1,
          allowed: !active,
          lifecycle: active
            ? { operation: 'restart', startedAt: '2026-08-01T12:00:00.000Z' }
            : null,
          attached: [],
        };
      },
    },
    (state) => blocked.push(state),
  );
  let prevented = 0;
  const quit = () =>
    events.emit('before-quit', {
      preventDefault() {
        prevented += 1;
      },
    });
  quit();
  expect(prevented).toBe(1);
  expect(blocked).toHaveLength(1);
  active = false;
  quit();
  expect(prevented).toBe(1);
  unbind();
  expect(events.listenerCount('before-quit')).toBe(0);
});

test('binds both close guards to a real pending coordinator lifecycle mutation', async () => {
  /** @type {(value?: void) => void} */
  let releaseStart = () => {};
  const startGate = new Promise((resolvePromise) => {
    releaseStart = resolvePromise;
  });
  const coordinator = createStateCoordinator({
    artifact: provisionalArtifact(),
    lifecycle: {
      clearPurgePreview() {},
      async start() {
        await startGate;
        const status = lifecycleSnapshot();
        return {
          operation: 'start',
          outcome: 'succeeded',
          changed: true,
          startedAt: timestamp,
          completedAt: timestamp,
          before: status,
          after: status,
          error: null,
        };
      },
      status: async () => lifecycleSnapshot(),
    },
    inventory: { listPorts: async () => [] },
    now: () => new Date(timestamp),
  });
  const windowEvents = new EventEmitter();
  const applicationEvents = new EventEmitter();
  /** @type {unknown[]} */
  const blocked = [];
  bindWindowCloseGuard(/** @type {any} */ (windowEvents), coordinator, (state) =>
    blocked.push(state),
  );
  const unbindApplication = bindApplicationCloseGuard(
    /** @type {any} */ (applicationEvents),
    coordinator,
    (state) => blocked.push(state),
  );
  let prevented = 0;
  const event = {
    preventDefault() {
      prevented += 1;
    },
  };

  const mutation = coordinator.startService();
  await Bun.sleep(0);
  windowEvents.emit('close', event);
  applicationEvents.emit('before-quit', event);
  expect(prevented).toBe(2);
  expect(blocked).toHaveLength(2);
  expect(blocked).toEqual([
    {
      schemaVersion: 1,
      allowed: false,
      lifecycle: { operation: 'start', startedAt: timestamp },
      attached: [],
    },
    {
      schemaVersion: 1,
      allowed: false,
      lifecycle: { operation: 'start', startedAt: timestamp },
      attached: [],
    },
  ]);

  releaseStart();
  await mutation;
  windowEvents.emit('close', event);
  applicationEvents.emit('before-quit', event);
  expect(prevented).toBe(2);
  unbindApplication();
});
