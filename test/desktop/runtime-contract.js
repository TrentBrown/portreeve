// @ts-check

import assert from 'node:assert/strict';
import { createDesktopLifecycleController } from '../../apps/desktop/main/lifecycle-controller.js';
import { PORTREEVE_VERSION } from '../../src/version.js';
import { lifecycleSnapshot, timestamp } from './fixtures.js';

/** Execute the same direct-controller contract under Bun and Electron Node. */
export async function verifyDesktopRuntimeContract() {
  /** @type {string[]} */
  const calls = [];
  const token = 'a'.repeat(64);
  const service = {
    status: async () => (calls.push('status'), lifecycleSnapshot()),
    install: async () => (calls.push('install'), mutation('install')),
    start: async () => (calls.push('start'), mutation('start')),
    stop: async () => (calls.push('stop'), mutation('stop')),
    stopManual: async () => (calls.push('stop-manual'), mutation('stop-manual')),
    restart: async () => (calls.push('restart'), mutation('restart')),
    uninstall: async () => (calls.push('uninstall'), mutation('uninstall')),
    previewPurge: async () => ({
      operation: 'purge',
      dryRun: true,
      allowed: true,
      confirmationToken: token,
      root: '/isolated/portreeve',
      marker: null,
      status: lifecycleSnapshot(),
      paths: [],
      refused: [],
    }),
    /** @param {string} receivedToken */
    async purge(receivedToken) {
      assert.equal(receivedToken, token);
      calls.push('purge');
      return {
        operation: 'purge',
        outcome: 'succeeded',
        confirmationToken: token,
        startedAt: timestamp,
        completedAt: timestamp,
        before: lifecycleSnapshot(),
        after: lifecycleSnapshot(),
        removed: [],
        retained: [],
        missing: [],
        refused: [],
        error: null,
      };
    },
  };
  let serviceOptions;
  const controller = createDesktopLifecycleController(
    { version: PORTREEVE_VERSION, executablePath: '/verified/portreeve' },
    {
      createService(options) {
        serviceOptions = options;
        return /** @type {any} */ (service);
      },
    },
  );
  assert.deepEqual(controller.compatibility, {
    version: PORTREEVE_VERSION,
    mutationsEnabled: true,
    error: null,
  });
  assert.deepEqual(serviceOptions, { sourceExecutable: '/verified/portreeve' });
  assert.equal((await controller.status()).mode, 'supervised');
  await controller.install();
  await controller.start();
  await controller.stop();
  await controller.stopManual();
  await controller.restart();
  await controller.uninstall();
  assert.equal((await controller.previewPurge()).allowed, true);
  await controller.executePurge();
  await assert.rejects(controller.executePurge(), {
    code: 'purge_preview_required',
  });
  assert.deepEqual(calls, [
    'status',
    'install',
    'start',
    'stop',
    'stop-manual',
    'restart',
    'uninstall',
    'purge',
  ]);
  return {
    schemaVersion: 1,
    runtime: process.versions.electron
      ? `electron-${process.versions.electron}`
      : process.versions.bun
        ? `bun-${process.versions.bun}`
        : `node-${process.versions.node}`,
    controllerVersion: PORTREEVE_VERSION,
    operations: calls.length,
  };
}

/** @param {string} operation */
function mutation(operation) {
  const status = lifecycleSnapshot();
  return {
    operation,
    outcome: 'succeeded',
    changed: true,
    startedAt: status.observedAt,
    completedAt: status.observedAt,
    before: status,
    after: status,
    error: null,
  };
}
