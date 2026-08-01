// @ts-check

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import { PortreeveClient } from 'portreeve';
import {
  resolveBundledReleaseCandidate,
  resolveLocalReleaseCandidate,
} from './artifact.js';
import { createLifecycleAdapter } from './cli-adapter.js';
import { createStateCoordinator } from './coordinator.js';
import { createInventoryAdapter } from './inventory-adapter.js';
import { registerDesktopIpc } from './ipc.js';
import { registerRendererProtocol } from './protocol.js';
import {
  bindWindowRefresh,
  browserWindowOptions,
  RENDERER_URL,
  secureWindowNavigation,
} from './window.js';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(desktopRoot, '..', '..');
/** @param {unknown[]} values */
const diagnose = (...values) => {
  if (process.env.PORTREEVE_DESKTOP_DIAGNOSTICS === '1') {
    console.error('[portreeve-desktop]', ...values);
  }
};

diagnose('main-entry');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);
app.enableSandbox();

app.whenReady().then(startDesktop).catch(reportStartupFailure);

app.on('window-all-closed', () => app.quit());

async function startDesktop() {
  diagnose('app-ready');
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  registerRendererProtocol(protocol, resolve(desktopRoot, 'renderer'));

  const artifact = app.isPackaged
    ? await resolveBundledReleaseCandidate({ resourcesRoot: process.resourcesPath })
    : await resolveLocalReleaseCandidate({
        workspaceRoot,
        ...(process.env.PORTREEVE_DESKTOP_CLI_PATH
          ? { overridePath: process.env.PORTREEVE_DESKTOP_CLI_PATH }
          : {}),
      });
  diagnose('artifact-verified', artifact.filename);
  const coordinator = createStateCoordinator({
    artifact,
    lifecycle: createLifecycleAdapter({ executablePath: artifact.executablePath }),
    inventory: createInventoryAdapter(new PortreeveClient()),
  });
  registerDesktopIpc({
    ipcMain,
    coordinator,
    windows: () => BrowserWindow.getAllWindows(),
  });

  const window = new BrowserWindow(
    browserWindowOptions(resolve(desktopRoot, 'preload', 'index.cjs')),
  );
  diagnose('window-created');
  secureWindowNavigation(window);
  bindWindowRefresh(window, coordinator);
  window.once('ready-to-show', () => window.show());
  await window.loadURL(RENDERER_URL);
  diagnose('renderer-loaded');
  await coordinator.refresh();
  if (window.isVisible() && !window.isMinimized()) coordinator.start();
}

/** @param {unknown} error */
function reportStartupFailure(error) {
  console.error(
    '[portreeve-desktop] startup failed:',
    error instanceof Error ? error.message : String(error),
  );
  app.quit();
}
