// @ts-check

import { expect, test } from 'bun:test';
import { createDesktopLifecycleController } from '../../apps/desktop/main/lifecycle-controller.js';
import { lifecycleSnapshot, timestamp } from './fixtures.js';

const executablePath = '/exact/resources/portreeve';

/** @param {string} operation @param {Record<string, unknown>} [overrides] */
function mutationResult(operation, overrides = {}) {
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
    ...overrides,
  };
}

test('binds the direct service to the exact verified artifact and maps every operation', async () => {
  /** @type {unknown[]} */
  const calls = [];
  /** @type {unknown} */
  let serviceOptions;
  const service = {
    status: async () => (calls.push('status'), lifecycleSnapshot()),
    install: async () => (calls.push('install'), mutationResult('install')),
    start: async () => (calls.push('start'), mutationResult('start')),
    stop: async () => (calls.push('stop'), mutationResult('stop')),
    stopManual: async () => (calls.push('stop-manual'), mutationResult('stop-manual')),
    restart: async () => (calls.push('restart'), mutationResult('restart')),
    uninstall: async () => (calls.push('uninstall'), mutationResult('uninstall')),
    previewPurge: async () => {
      throw new Error('not used');
    },
    purge: async () => {
      throw new Error('not used');
    },
  };
  const controller = createDesktopLifecycleController(
    { version: '0.1.0', executablePath },
    {
      createService(options) {
        serviceOptions = options;
        return /** @type {any} */ (service);
      },
    },
  );

  expect(controller.compatibility).toEqual({
    version: '0.1.0',
    mutationsEnabled: true,
    error: null,
  });
  expect(serviceOptions).toEqual({ sourceExecutable: executablePath });
  await controller.status();
  await controller.install();
  await controller.start();
  await controller.stop();
  await controller.stopManual();
  await controller.restart();
  await controller.uninstall();
  expect(calls).toEqual([
    'status',
    'install',
    'start',
    'stop',
    'stop-manual',
    'restart',
    'uninstall',
  ]);
});

test('keeps compatible reads available while visibly blocking every mutation on version mismatch', async () => {
  let mutations = 0;
  const service = {
    status: async () => lifecycleSnapshot(),
    install: async () => (mutations += 1),
    start: async () => (mutations += 1),
    stop: async () => (mutations += 1),
    stopManual: async () => (mutations += 1),
    restart: async () => (mutations += 1),
    uninstall: async () => (mutations += 1),
    previewPurge: async () => purgePreview('c'.repeat(64)),
    purge: async () => (mutations += 1),
  };
  const controller = createDesktopLifecycleController(
    { version: '0.2.0', executablePath },
    {
      controllerVersion: '0.1.0',
      createService: () => /** @type {any} */ (service),
    },
  );

  expect((await controller.status()).mode).toBe('supervised');
  expect((await controller.previewPurge()).allowed).toBe(true);
  expect(controller.compatibility).toEqual({
    version: '0.1.0',
    mutationsEnabled: false,
    error: {
      code: 'controller_artifact_version_mismatch',
      message:
        'PortReeve lifecycle controller 0.1.0 does not match bundled artifact 0.2.0. Lifecycle mutations are disabled.',
    },
  });
  for (const invoke of [
    () => controller.install(),
    () => controller.start(),
    () => controller.stop(),
    () => controller.stopManual(),
    () => controller.restart(),
    () => controller.uninstall(),
    () => controller.executePurge(),
  ]) {
    await expect(invoke()).rejects.toMatchObject({
      code: 'controller_artifact_version_mismatch',
    });
  }
  expect(mutations).toBe(0);
});

test('confines purge tokens to one main-process preview and consumes them once', async () => {
  const token = 'b'.repeat(64);
  /** @type {string[]} */
  const receivedTokens = [];
  const service = {
    status: async () => lifecycleSnapshot(),
    previewPurge: async () => purgePreview(token),
    /** @param {string} receivedToken */
    async purge(receivedToken) {
      receivedTokens.push(receivedToken);
      return {
        operation: 'purge',
        outcome: 'succeeded',
        confirmationToken: token,
        startedAt: timestamp,
        completedAt: timestamp,
        before: lifecycleSnapshot(),
        after: lifecycleSnapshot(),
        removed: ['/Users/example/Library/Application Support/Portreeve'],
        retained: [],
        missing: [],
        refused: [],
        error: null,
      };
    },
  };
  const controller = createDesktopLifecycleController(
    { version: '0.1.0', executablePath },
    { createService: () => /** @type {any} */ (service) },
  );

  expect(JSON.stringify(await controller.previewPurge())).not.toContain(token);
  expect(JSON.stringify(await controller.executePurge())).not.toContain(token);
  expect(receivedTokens).toEqual([token]);
  await expect(controller.executePurge()).rejects.toMatchObject({
    code: 'purge_preview_required',
  });
});

/** @param {string} confirmationToken */
function purgePreview(confirmationToken) {
  return {
    operation: 'purge',
    dryRun: true,
    allowed: true,
    confirmationToken,
    root: '/Users/example/Library/Application Support/Portreeve',
    marker: null,
    status: lifecycleSnapshot(),
    paths: [
      {
        path: '/Users/example/Library/Application Support/Portreeve',
        type: 'directory',
        uid: 501,
        mode: 448,
        size: 96,
        modifiedAt: timestamp,
      },
    ],
    refused: [],
  };
}
