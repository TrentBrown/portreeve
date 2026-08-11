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
    'apps/desktop/main/lifecycle-controller.js',
    'apps/desktop/main/inventory-adapter.js',
    'apps/desktop/main/launcher-adapter.js',
    'apps/desktop/main/mcp-setup-adapter.js',
    'apps/desktop/main/stack-adapter.js',
    'apps/desktop/main/stack-document.js',
    'apps/desktop/main/update.js',
    'apps/desktop/preload/index.cjs',
    'apps/desktop/renderer/renderer.js',
    'apps/desktop/renderer/stack-editor-model.js',
    'apps/desktop/renderer/stack-editor-view.js',
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join(
    '\n',
  );
  expect(source).not.toMatch(/src\/(?:server|storage)|sqlite|openDatabase/i);
  expect(source).not.toMatch(/(?<!\.)\bexec(?:Sync)?\s*\(/);
  expect(source.match(/shell\.openExternal/g)).toHaveLength(1);
  expect(source).toContain('new PortreeveClient()');
  expect(source).toContain('sourceExecutable: artifact.executablePath');
  expect(source).toContain('openDownloadPage: async () =>');
  expect(source).not.toContain('openDownloadPage: async (url) =>');
  expect(source.match(/clipboard\.writeText/g)).toHaveLength(1);
  expect(source).not.toContain('navigator.clipboard');
  expect(source).not.toMatch(/\.codex\/config\.toml|\.claude\.json|mcpServers.*write/i);
});

test('constructs one fixed in-process lifecycle controller without a CLI subprocess path', async () => {
  const [entry, controller] = await Promise.all([
    readFile('apps/desktop/main/index.js', 'utf8'),
    readFile('apps/desktop/main/lifecycle-controller.js', 'utf8'),
  ]);
  const lifecycleSource = `${entry}\n${controller}`;
  expect(entry).toContain('createDesktopLifecycleController(artifact)');
  expect(controller).toContain('sourceExecutable: artifact.executablePath');
  expect(lifecycleSource).not.toMatch(/node:child_process|\bspawn\s*\(|\bexec\s*\(/);
  expect(lifecycleSource).not.toContain('cli-adapter');
  expect(controller).not.toMatch(/PORTREEVE_(?:HOME|SOCKET|SUPERVISOR)/);
});

test('keeps stack file paths and evidence out of the preload document API', async () => {
  const preload = await readFile('apps/desktop/preload/index.cjs', 'utf8');
  expect(preload).toContain('openStackDocument: async () =>');
  expect(preload).toContain('saveStackDocument: async (documentId, content');
  expect(preload).not.toMatch(/saveStackDocument:\s*async\s*\([^)]*path/i);
  expect(preload).not.toContain('fingerprint');
  expect(preload).not.toContain('readFile');
  expect(preload).not.toContain('writeFile');
  expect(preload).toContain('openLauncherDocument: async (stackId) =>');
  expect(preload).toContain('saveLauncherDocument: async (');
  expect(preload).not.toMatch(/openLauncherDocument:\s*async\s*\([^)]*path/i);
  expect(preload).not.toMatch(/saveLauncherOutput:\s*async\s*\([^)]*path/i);
  expect(preload).not.toContain('processGroupId');
});

test('sets a distinct Electron user-data root before startup', async () => {
  const source = await readFile('apps/desktop/main/index.js', 'utf8');
  expect(source).toContain("app.setPath('userData'");
  expect(source).toContain("app.getPath('appData')");
});
