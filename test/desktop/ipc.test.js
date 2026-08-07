// @ts-check

import { expect, test } from 'bun:test';
import { registerDesktopIpc } from '../../apps/desktop/main/ipc.js';
import { RENDERER_URL } from '../../apps/desktop/main/window.js';
import { IPC_CHANNELS } from '../../apps/desktop/shared/schemas.js';

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
