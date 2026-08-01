// @ts-check

import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';
import { isTrustedRenderer } from '../../apps/desktop/main/ipc.js';
import { browserWindowOptions, RENDERER_URL } from '../../apps/desktop/main/window.js';

test('pins the renderer to explicit isolation and sandbox settings', () => {
  const options = browserWindowOptions('/exact/preload.cjs');
  expect(options.webPreferences).toMatchObject({
    preload: '/exact/preload.cjs',
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    webviewTag: false,
  });
  expect(RENDERER_URL).toBe('app://portreeve/index.html');
});

test('accepts IPC only from the main local renderer frame', () => {
  const mainFrame = { url: RENDERER_URL };
  expect(
    isTrustedRenderer(
      /** @type {any} */ ({ sender: { mainFrame }, senderFrame: mainFrame }),
    ),
  ).toBe(true);
  expect(
    isTrustedRenderer(
      /** @type {any} */ ({
        sender: { mainFrame },
        senderFrame: { url: RENDERER_URL },
      }),
    ),
  ).toBe(false);
  expect(
    isTrustedRenderer(
      /** @type {any} */ ({
        sender: { mainFrame },
        senderFrame: { url: 'https://example.com/' },
      }),
    ),
  ).toBe(false);
});

test('keeps server, storage, generic shell, and PATH lookup out of desktop code', async () => {
  const files = [
    'apps/desktop/main/index.js',
    'apps/desktop/main/cli-adapter.js',
    'apps/desktop/main/inventory-adapter.js',
    'apps/desktop/main/update.js',
    'apps/desktop/preload/index.cjs',
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join(
    '\n',
  );
  expect(source).not.toMatch(/src\/(?:server|storage)|sqlite|openDatabase/i);
  expect(source).not.toMatch(/(?<!\.)\bexec(?:Sync)?\s*\(/);
  expect(source.match(/shell\.openExternal/g)).toHaveLength(1);
  expect(source).toContain('shell: false');
  expect(source).toContain('new PortreeveClient()');
  expect(source).toContain('executablePath: artifact.executablePath');
  expect(source).toContain('openDownloadPage: async () =>');
  expect(source).not.toContain('openDownloadPage: async (url) =>');
});

test('sets a distinct Electron user-data root before startup', async () => {
  const source = await readFile('apps/desktop/main/index.js', 'utf8');
  expect(source).toContain("app.setPath('userData'");
  expect(source).toContain("app.getPath('appData')");
});
