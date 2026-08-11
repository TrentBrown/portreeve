// @ts-check

import { writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  protocol,
  session,
  shell,
} from 'electron';
import { PortreeveClient } from 'portreeve';
import {
  resolveBundledReleaseCandidate,
  resolveLocalReleaseCandidate,
} from './artifact.js';
import { createDesktopLifecycleController } from './lifecycle-controller.js';
import { createStateCoordinator } from './coordinator.js';
import { createInventoryAdapter } from './inventory-adapter.js';
import { createLauncherAdapter } from './launcher-adapter.js';
import { createMcpSetupAdapter } from './mcp-setup-adapter.js';
import { createStackAdapter } from './stack-adapter.js';
import { createStackDocumentService } from './stack-document.js';
import { registerDesktopIpc } from './ipc.js';
import { registerRendererProtocol } from './protocol.js';
import { createUpdateAdapter } from './update.js';
import { desktopUpdateStatePath, desktopUserDataPath } from './user-data.js';
import { createLauncherRuntime } from '../../../src/launcher/runtime.js';
import { resolveRuntimePaths } from '../../../src/platform/paths.js';
import { IPC_CHANNELS } from '../shared/schemas.js';
import {
  bindApplicationCloseGuard,
  bindWindowCloseGuard,
  bindWindowRefresh,
  browserWindowOptions,
  RENDERER_URL,
  secureWindowNavigation,
} from './window.js';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(desktopRoot, '..', '..');
const desktopSmoke = process.env.PORTREEVE_DESKTOP_SMOKE === '1';
/** @param {unknown[]} values */
const diagnose = (...values) => {
  if (process.env.PORTREEVE_DESKTOP_DIAGNOSTICS === '1') {
    console.error('[portreeve-desktop]', ...values);
  }
};

diagnose('main-entry');

const userDataPath =
  desktopSmoke && process.env.PORTREEVE_DESKTOP_SMOKE_USER_DATA
    ? resolve(process.env.PORTREEVE_DESKTOP_SMOKE_USER_DATA)
    : desktopUserDataPath(app.getPath('appData'));
app.setPath('userData', userDataPath);

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
  registerRendererProtocol(protocol, {
    rendererRoot: resolve(desktopRoot, 'renderer'),
    brandingRoot: resolve(desktopRoot, 'assets', 'branding'),
  });

  const artifact = app.isPackaged
    ? await resolveBundledReleaseCandidate({ resourcesRoot: process.resourcesPath })
    : await resolveLocalReleaseCandidate({
        workspaceRoot,
        ...(process.env.PORTREEVE_DESKTOP_CLI_PATH
          ? { overridePath: process.env.PORTREEVE_DESKTOP_CLI_PATH }
          : {}),
      });
  diagnose('artifact-verified', artifact.filename);
  const lifecycle = createDesktopLifecycleController(artifact);
  if (desktopSmoke) {
    const status = await lifecycle.status();
    console.log(
      `PORTREEVE_DESKTOP_SMOKE ${JSON.stringify({
        schemaVersion: 1,
        desktopVersion: app.getVersion(),
        controllerVersion: lifecycle.compatibility.version,
        artifactVersion: artifact.version,
        mode: status.mode,
        installation: status.installation.state,
        supervisor: status.supervisor.state,
        socket: status.socket.state,
      })}`,
    );
    app.quit();
    return;
  }
  const client = new PortreeveClient();
  const launcherRuntime = await createLauncherRuntime();
  const launchers = createLauncherAdapter({
    client: launcherRuntime.client,
    runtime: launcherRuntime,
    async saveOutput({ suggestedFilename, content }) {
      const selection = await dialog.showSaveDialog({
        title: 'Save PortReeve launcher output',
        defaultPath: suggestedFilename,
        filters: [{ name: 'Log files', extensions: ['log', 'txt'] }],
      });
      if (selection.canceled || selection.filePath === undefined) {
        return { schemaVersion: 1, outcome: 'cancelled', filename: null };
      }
      await writeFile(selection.filePath, content, { encoding: 'utf8', mode: 0o600 });
      return {
        schemaVersion: 1,
        outcome: 'saved',
        filename: basename(selection.filePath),
      };
    },
  });
  const documents = createStackDocumentService(client, {
    async selectStackRoot() {
      const selection = await dialog.showOpenDialog({
        title: 'Create or edit a PortReeve stack',
        buttonLabel: 'Choose stack root',
        properties: ['openDirectory'],
      });
      return selection.canceled ? null : (selection.filePaths[0] ?? null);
    },
  });
  const coordinator = createStateCoordinator({
    artifact: {
      ...artifact,
      desktopVersion: app.getVersion(),
      controller: lifecycle.compatibility,
    },
    lifecycle,
    inventory: createInventoryAdapter(client),
    stacks: createStackAdapter(client, {
      documents,
      async selectDefinitionFile() {
        const selection = await dialog.showOpenDialog({
          title: 'Apply a PortReeve stack definition',
          buttonLabel: 'Apply definition',
          properties: ['openFile'],
          filters: [{ name: 'JSON stack definitions', extensions: ['json'] }],
        });
        return selection.canceled ? null : (selection.filePaths[0] ?? null);
      },
    }),
    launchers,
    updates: createUpdateAdapter({
      desktopVersion: app.getVersion(),
      statePath: desktopUpdateStatePath(app.getPath('userData')),
      openExternal: (url) => shell.openExternal(url),
    }),
  });
  registerDesktopIpc({
    ipcMain,
    coordinator,
    windows: () => BrowserWindow.getAllWindows(),
    writeClipboard: (text) => clipboard.writeText(text),
    mcpSetup: createMcpSetupAdapter({
      exactExecutablePath: resolveRuntimePaths().managedExecutablePath,
    }),
  });

  const window = new BrowserWindow(
    browserWindowOptions(resolve(desktopRoot, 'preload', 'index.cjs')),
  );
  diagnose('window-created');
  secureWindowNavigation(window);
  bindWindowRefresh(window, coordinator);
  /** @param {unknown} state */
  const reportBlockedClose = (state) => {
    window.webContents.send(IPC_CHANNELS.applicationCloseBlocked, state);
  };
  bindWindowCloseGuard(window, coordinator, reportBlockedClose);
  bindApplicationCloseGuard(app, coordinator, reportBlockedClose);
  window.once('ready-to-show', () => window.show());
  await window.loadURL(RENDERER_URL);
  diagnose('renderer-loaded');
  await coordinator.refresh();
  void coordinator.checkForUpdates();
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
