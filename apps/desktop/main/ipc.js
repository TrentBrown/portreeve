// @ts-check

import {
  DesktopLifecycleActionResultSchema,
  DesktopPurgeExecutionRequestSchema,
  DesktopPurgePreviewSchema,
  DesktopPurgeResultSchema,
  DesktopSnapshotSchema,
  IPC_CHANNELS,
} from '../shared/schemas.js';
import { RENDERER_URL } from './window.js';

/** @param {Electron.IpcMainInvokeEvent} event */
export function isTrustedRenderer(event) {
  return (
    event.senderFrame === event.sender.mainFrame &&
    event.senderFrame?.url === RENDERER_URL
  );
}

/**
 * @param {{
 *   ipcMain: Electron.IpcMain,
 *   coordinator: {
 *     current(): unknown,
 *     refresh(): Promise<unknown>,
 *     subscribe(callback: (snapshot: unknown) => void): () => boolean,
 *     installAndStart(): Promise<unknown>, startService(): Promise<unknown>,
 *     stopService(): Promise<unknown>, stopManual(): Promise<unknown>,
 *     restartService(): Promise<unknown>, upgrade(): Promise<unknown>,
 *     uninstall(): Promise<unknown>, previewPurge(): Promise<unknown>,
 *     executePurge(): Promise<unknown>
 *   },
 *   windows: () => Electron.BrowserWindow[]
 * }} options
 */
export function registerDesktopIpc(options) {
  /** @param {Electron.IpcMainInvokeEvent} event */
  const requireTrusted = (event) => {
    if (!isTrustedRenderer(event)) {
      throw new Error('Untrusted renderer IPC request refused.');
    }
  };
  options.ipcMain.handle(IPC_CHANNELS.getSnapshot, async (event) => {
    requireTrusted(event);
    const current = options.coordinator.current();
    return DesktopSnapshotSchema.parse(
      current ?? (await options.coordinator.refresh()),
    );
  });
  options.ipcMain.handle(IPC_CHANNELS.refresh, async (event) => {
    requireTrusted(event);
    return DesktopSnapshotSchema.parse(await options.coordinator.refresh());
  });
  /** @type {Array<[string, () => Promise<unknown>]>} */
  const lifecycleHandlers = [
    [IPC_CHANNELS.installAndStart, () => options.coordinator.installAndStart()],
    [IPC_CHANNELS.start, () => options.coordinator.startService()],
    [IPC_CHANNELS.stop, () => options.coordinator.stopService()],
    [IPC_CHANNELS.stopManual, () => options.coordinator.stopManual()],
    [IPC_CHANNELS.restart, () => options.coordinator.restartService()],
    [IPC_CHANNELS.upgrade, () => options.coordinator.upgrade()],
    [IPC_CHANNELS.uninstall, () => options.coordinator.uninstall()],
  ];
  for (const [channel, invoke] of lifecycleHandlers) {
    options.ipcMain.handle(channel, async (event) => {
      requireTrusted(event);
      return DesktopLifecycleActionResultSchema.parse(await invoke());
    });
  }
  options.ipcMain.handle(IPC_CHANNELS.previewPurge, async (event) => {
    requireTrusted(event);
    return DesktopPurgePreviewSchema.parse(await options.coordinator.previewPurge());
  });
  options.ipcMain.handle(IPC_CHANNELS.executePurge, async (event, request) => {
    requireTrusted(event);
    DesktopPurgeExecutionRequestSchema.parse(request);
    return DesktopPurgeResultSchema.parse(await options.coordinator.executePurge());
  });
  return options.coordinator.subscribe((snapshot) => {
    const parsed = DesktopSnapshotSchema.parse(snapshot);
    for (const window of options.windows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.snapshotChanged, parsed);
      }
    }
  });
}
