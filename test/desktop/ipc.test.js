// @ts-check

import { expect, test } from 'bun:test';
import { registerDesktopIpc } from '../../apps/desktop/main/ipc.js';
import { createDesktopSnapshot } from '../../apps/desktop/main/view-model.js';
import { RENDERER_URL } from '../../apps/desktop/main/window.js';
import { IPC_CHANNELS } from '../../apps/desktop/shared/schemas.js';
import { lifecycleSnapshot, provisionalArtifact, timestamp } from './fixtures.js';

test('opens only the fixed download capability with no renderer arguments', async () => {
  /** @type {Map<string, (event: any, ...arguments_: any[]) => Promise<any>>} */
  const handlers = new Map();
  let opens = 0;
  registerDesktopIpc({
    ipcMain: /** @type {any} */ ({
      /**
       * @param {string} channel
       * @param {(event: any, ...arguments_: any[]) => Promise<any>} handler
       */
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    }),
    coordinator: /** @type {any} */ ({
      subscribe() {
        return () => true;
      },
      async openDownloadPage() {
        opens += 1;
        return { schemaVersion: 1, opened: true };
      },
    }),
    windows: () => [],
  });
  const mainFrame = { url: RENDERER_URL };
  const event = { sender: { mainFrame }, senderFrame: mainFrame };
  const handler = handlers.get(IPC_CHANNELS.openDownloadPage);
  expect(handler).toBeDefined();
  expect(await handler?.(event)).toEqual({ schemaVersion: 1, opened: true });
  expect(opens).toBe(1);
  await expect(handler?.(event, 'https://example.com/')).rejects.toThrow(
    'does not accept arguments',
  );
  expect(opens).toBe(1);
  await expect(
    handler?.({
      sender: { mainFrame },
      senderFrame: { url: 'https://example.com/' },
    }),
  ).rejects.toThrow('Untrusted renderer');
});

test('validates stack identifiers before invoking a named main-process capability', async () => {
  /** @type {Map<string, (event: any, ...arguments_: any[]) => Promise<any>>} */
  const handlers = new Map();
  let prepares = 0;
  registerDesktopIpc({
    ipcMain: /** @type {any} */ ({
      /** @param {string} channel @param {(event: any, ...arguments_: any[]) => Promise<any>} handler */
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    }),
    coordinator: /** @type {any} */ ({
      subscribe() {
        return () => true;
      },
      async prepareStack() {
        prepares += 1;
      },
      async applyStackDefinition() {},
    }),
    windows: () => [],
  });
  const mainFrame = { url: RENDERER_URL };
  const event = { sender: { mainFrame }, senderFrame: mainFrame };
  await expect(
    handlers.get(IPC_CHANNELS.prepareStack)?.(event, { id: '../../secret' }),
  ).rejects.toThrow();
  expect(prepares).toBe(0);
  await expect(
    handlers.get(IPC_CHANNELS.applyStackDefinition)?.(event, '/tmp/stack.json'),
  ).rejects.toThrow('does not accept renderer arguments');
});

test('exposes only a bounded text clipboard capability to the trusted renderer', async () => {
  /** @type {Map<string, (event: any, ...arguments_: any[]) => Promise<any>>} */
  const handlers = new Map();
  /** @type {string[]} */
  const copied = [];
  registerDesktopIpc({
    ipcMain: /** @type {any} */ ({
      /** @param {string} channel @param {(event: any, ...arguments_: any[]) => Promise<any>} handler */
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    }),
    coordinator: /** @type {any} */ ({
      subscribe() {
        return () => true;
      },
    }),
    windows: () => [],
    writeClipboard(text) {
      copied.push(text);
    },
  });
  const mainFrame = { url: RENDERER_URL };
  const event = { sender: { mainFrame }, senderFrame: mainFrame };
  expect(
    await handlers.get(IPC_CHANNELS.copyText)?.(event, { text: '127.0.0.1:4100' }),
  ).toEqual({ schemaVersion: 1, copied: true });
  expect(copied).toEqual(['127.0.0.1:4100']);
  await expect(
    handlers.get(IPC_CHANNELS.copyText)?.(event, { text: 'x'.repeat(65_537) }),
  ).rejects.toThrow();
  expect(copied).toHaveLength(1);
});

test('validates bounded MCP setup choices before main-process generation', async () => {
  /** @type {Map<string, (event: any, ...arguments_: any[]) => Promise<any>>} */
  const handlers = new Map();
  /** @type {unknown[]} */
  const requests = [];
  registerDesktopIpc({
    ipcMain: /** @type {any} */ ({
      /** @param {string} channel @param {(event: any, ...arguments_: any[]) => Promise<any>} handler */
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    }),
    coordinator: /** @type {any} */ ({
      subscribe() {
        return () => true;
      },
    }),
    mcpSetup: {
      /** @param {unknown} request */
      generate(request) {
        requests.push(request);
        return {
          schemaVersion: 1,
          host: 'codex',
          hostLabel: 'Codex CLI and desktop',
          executableMode: 'exact',
          command: '/managed/bin/portreeve',
          args: ['mcp', 'serve', '--label', 'codex-local'],
          clientLabel: 'codex-local',
          configurationLanguage: 'toml',
          configuration: '[mcp_servers.portreeve]',
          setupCommand: 'codex mcp add portreeve -- /managed/bin/portreeve',
          notes: ['No settings changed.'],
        };
      },
    },
    windows: () => [],
  });
  const mainFrame = { url: RENDERER_URL };
  const event = { sender: { mainFrame }, senderFrame: mainFrame };
  const handler = handlers.get(IPC_CHANNELS.generateMcpSetup);
  expect(
    await handler?.(event, {
      host: 'codex',
      portable: false,
      label: 'codex-local',
    }),
  ).toMatchObject({ host: 'codex', command: '/managed/bin/portreeve' });
  expect(requests).toEqual([{ host: 'codex', portable: false, label: 'codex-local' }]);
  await expect(
    handler?.(event, {
      host: 'codex',
      portable: false,
      executablePath: '/tmp/injected',
    }),
  ).rejects.toThrow();
  await expect(handler?.(event, { host: 'other', portable: false })).rejects.toThrow();
  expect(requests).toHaveLength(1);
});

test('validates opaque stack-document capabilities without accepting filesystem paths', async () => {
  /** @type {Map<string, (event: any, ...arguments_: any[]) => Promise<any>>} */
  const handlers = new Map();
  /** @type {unknown[]} */
  const saves = [];
  /** @type {string[]} */
  const knownDocuments = [];
  /** @type {string[]} */
  const retries = [];
  const documentId = '99999999-9999-4999-8999-999999999999';
  const stackId = '44444444-4444-4444-8444-444444444444';
  const snapshot = createDesktopSnapshot({
    artifact: provisionalArtifact(),
    lifecycle: lifecycleSnapshot(),
    ports: [],
    stacks: [],
    refreshedAt: timestamp,
  });
  registerDesktopIpc({
    ipcMain: /** @type {any} */ ({
      /** @param {string} channel @param {(event: any, ...arguments_: any[]) => Promise<any>} handler */
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    }),
    coordinator: /** @type {any} */ ({
      subscribe() {
        return () => true;
      },
      async openStackDocument() {
        return { schemaVersion: 1, outcome: 'cancelled', document: null };
      },
      /** @param {string} id */
      async openKnownStackDocument(id) {
        knownDocuments.push(id);
        return { schemaVersion: 1, outcome: 'cancelled', document: null };
      },
      /** @param {unknown} request */
      async saveStackDocument(request) {
        saves.push(request);
        return documentMutation(documentId, snapshot);
      },
      /** @param {string} id */
      async retryStackDocumentApply(id) {
        retries.push(id);
        return documentMutation(id, snapshot);
      },
    }),
    windows: () => [],
  });
  const mainFrame = { url: RENDERER_URL };
  const event = { sender: { mainFrame }, senderFrame: mainFrame };

  expect(await handlers.get(IPC_CHANNELS.openStackDocument)?.(event)).toMatchObject({
    outcome: 'cancelled',
  });
  await expect(
    handlers.get(IPC_CHANNELS.openStackDocument)?.(event, '/tmp/stack'),
  ).rejects.toThrow('does not accept renderer arguments');
  await expect(
    handlers.get(IPC_CHANNELS.openKnownStackDocument)?.(event, { id: '../../secret' }),
  ).rejects.toThrow();
  expect(knownDocuments).toHaveLength(0);
  expect(
    await handlers.get(IPC_CHANNELS.openKnownStackDocument)?.(event, { id: stackId }),
  ).toMatchObject({ outcome: 'cancelled' });
  expect(knownDocuments).toEqual([stackId]);

  await expect(
    handlers.get(IPC_CHANNELS.saveStackDocument)?.(event, {
      documentId,
      content: '{}',
      path: '/tmp/portreeve.stack.json',
    }),
  ).rejects.toThrow();
  await expect(
    handlers.get(IPC_CHANNELS.saveStackDocument)?.(event, {
      documentId,
      content: 'x'.repeat(1_048_577),
    }),
  ).rejects.toThrow();
  expect(saves).toHaveLength(0);
  expect(
    await handlers.get(IPC_CHANNELS.saveStackDocument)?.(event, {
      documentId,
      content: '{}',
      conflictToken: null,
    }),
  ).toMatchObject({ documentId, outcome: 'saved-and-applied' });
  expect(saves).toEqual([{ documentId, content: '{}', conflictToken: null }]);

  await expect(
    handlers.get(IPC_CHANNELS.retryStackDocumentApply)?.(event, {
      documentId: '/tmp/stack',
    }),
  ).rejects.toThrow();
  expect(retries).toHaveLength(0);
  expect(
    await handlers.get(IPC_CHANNELS.retryStackDocumentApply)?.(event, { documentId }),
  ).toMatchObject({ documentId, outcome: 'saved-and-applied' });
  expect(retries).toEqual([documentId]);
});

test('validates launcher capabilities and forwards only reduced session events', async () => {
  /** @type {Map<string, (event: any, ...arguments_: any[]) => Promise<any>>} */
  const handlers = new Map();
  const outputSubscription = {
    callback: /** @type {((event: unknown) => void)|null} */ (null),
  };
  /** @type {unknown[]} */
  const sent = [];
  const stackId = '44444444-4444-4444-8444-444444444444';
  const sessionId = '99999999-9999-4999-8999-999999999999';
  const session = launcherSession(stackId, sessionId);
  registerDesktopIpc({
    ipcMain: /** @type {any} */ ({
      /** @param {string} channel @param {(event: any, ...arguments_: any[]) => Promise<any>} handler */
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    }),
    coordinator: /** @type {any} */ ({
      subscribe() {
        return () => true;
      },
      /** @param {(event: unknown) => void} callback */
      subscribeLauncherOutput(callback) {
        outputSubscription.callback = callback;
        return () => true;
      },
      subscribeLauncherSessions() {
        return () => true;
      },
      /** @param {unknown} request */
      async beginLauncherAction(request) {
        expect(request).toEqual({
          stackId,
          operation: 'start',
          runStartAnyway: false,
          allowDegraded: false,
        });
        return session;
      },
      /** @param {string} id */
      launcherOutput(id) {
        expect(id).toBe(sessionId);
        return session.output;
      },
    }),
    windows: () => [
      /** @type {any} */ ({
        isDestroyed: () => false,
        webContents: {
          /** @param {string} channel @param {unknown} value */
          send: (channel, value) => sent.push({ channel, value }),
        },
      }),
    ],
  });
  const mainFrame = { url: RENDERER_URL };
  const event = { sender: { mainFrame }, senderFrame: mainFrame };

  await expect(
    handlers.get(IPC_CHANNELS.beginLauncherAction)?.(event, {
      stackId: '/private/stack',
      operation: 'start',
    }),
  ).rejects.toThrow();
  expect(
    await handlers.get(IPC_CHANNELS.beginLauncherAction)?.(event, {
      stackId,
      operation: 'start',
    }),
  ).toMatchObject({ sessionId, state: 'running' });
  await expect(
    handlers.get(IPC_CHANNELS.getLauncherOutput)?.(event, {
      sessionId,
      path: '/tmp/output.log',
    }),
  ).rejects.toThrow();
  expect(
    await handlers.get(IPC_CHANNELS.getLauncherOutput)?.(event, { sessionId }),
  ).toEqual(session.output);

  outputSubscription.callback?.({
    schemaVersion: 1,
    sessionId,
    stackId,
    operation: 'start',
    chunk: { sequence: 0, stream: 'stdout', text: 'ready\n' },
  });
  expect(sent).toEqual([
    {
      channel: IPC_CHANNELS.launcherOutput,
      value: expect.objectContaining({ sessionId, stackId }),
    },
  ]);
  expect(JSON.stringify(sent)).not.toMatch(/path|processGroupId|credential/);
});

test('forwards only strict lifecycle activity events to renderer windows', () => {
  const activitySubscription = {
    callback: /** @type {((event: unknown) => void)|null} */ (null),
  };
  /** @type {unknown[]} */
  const sent = [];
  registerDesktopIpc({
    ipcMain: /** @type {any} */ ({ handle() {} }),
    coordinator: /** @type {any} */ ({
      subscribe() {
        return () => true;
      },
      /** @param {(event: unknown) => void} callback */
      subscribeLifecycleActivity(callback) {
        activitySubscription.callback = callback;
        return () => true;
      },
    }),
    windows: () => [
      /** @type {any} */ ({
        isDestroyed: () => false,
        webContents: {
          /** @param {string} channel @param {unknown} value */
          send: (channel, value) => sent.push({ channel, value }),
        },
      }),
    ],
  });
  activitySubscription.callback?.({
    schemaVersion: 1,
    active: { operation: 'restart', startedAt: timestamp },
  });
  expect(sent).toEqual([
    {
      channel: IPC_CHANNELS.lifecycleActivityChanged,
      value: {
        schemaVersion: 1,
        active: { operation: 'restart', startedAt: timestamp },
      },
    },
  ]);
  expect(() =>
    activitySubscription.callback?.({
      schemaVersion: 1,
      active: {
        operation: 'restart',
        startedAt: timestamp,
        path: '/private/controller',
      },
    }),
  ).toThrow();
});

/** @param {string} documentId @param {unknown} snapshot */
function documentMutation(documentId, snapshot) {
  return {
    schemaVersion: 1,
    documentId,
    outcome: 'saved-and-applied',
    saved: true,
    applied: true,
    changed: true,
    stackId: '44444444-4444-4444-8444-444444444444',
    message: 'Saved and applied the stack definition.',
    conflict: null,
    issues: [],
    error: null,
    snapshot,
  };
}

/** @param {string} stackId @param {string} sessionId */
function launcherSession(stackId, sessionId) {
  return {
    schemaVersion: 1,
    sessionId,
    stackId,
    operation: 'start',
    state: 'running',
    startedAt: timestamp,
    completedAt: null,
    result: null,
    output: {
      schemaVersion: 1,
      sessionId,
      stackId,
      operation: 'start',
      chunks: [],
      truncated: false,
      retainedBytes: 0,
      totalBytes: 0,
    },
  };
}
