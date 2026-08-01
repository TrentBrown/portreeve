// @ts-check

import { DesktopSnapshotSchema, IPC_CHANNELS } from '../shared/schemas.js';
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
 *     subscribe(callback: (snapshot: unknown) => void): () => boolean
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
  return options.coordinator.subscribe((snapshot) => {
    const parsed = DesktopSnapshotSchema.parse(snapshot);
    for (const window of options.windows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.snapshotChanged, parsed);
      }
    }
  });
}
