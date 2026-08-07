// @ts-check

import {
  DesktopLifecycleActionResultSchema,
  DesktopOpenDownloadResultSchema,
  DesktopPurgeExecutionRequestSchema,
  DesktopPurgePreviewSchema,
  DesktopPurgeResultSchema,
  DesktopSnapshotSchema,
  DesktopStackActionRequestSchema,
  DesktopStackActionResultSchema,
  DesktopStackEndpointSnapshotSchema,
  DesktopStackPruneExecutionRequestSchema,
  DesktopStackPrunePreviewSchema,
  DesktopStackPruneResultSchema,
  DesktopStackSnapshotRequestSchema,
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
 *     executePurge(): Promise<unknown>, openDownloadPage(): Promise<unknown>,
 *     applyStackDefinition(): Promise<unknown>, prepareStack(id: string): Promise<unknown>,
 *     reconcileStack(id: string): Promise<unknown>, endStack(id: string): Promise<unknown>,
 *     previewStackPrune(): Promise<unknown>, executeStackPrune(): Promise<unknown>,
 *     previewStackSnapshot(activationId: string, component: string, gatewayHost: string): Promise<unknown>
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
  options.ipcMain.handle(
    IPC_CHANNELS.openDownloadPage,
    async (event, ...arguments_) => {
      requireTrusted(event);
      if (arguments_.length > 0) {
        throw new Error('Download-page navigation does not accept arguments.');
      }
      return DesktopOpenDownloadResultSchema.parse(
        await options.coordinator.openDownloadPage(),
      );
    },
  );
  options.ipcMain.handle(
    IPC_CHANNELS.applyStackDefinition,
    async (event, ...arguments_) => {
      requireTrusted(event);
      requireNoArguments('Stack definition selection', arguments_);
      return DesktopStackActionResultSchema.parse(
        await options.coordinator.applyStackDefinition(),
      );
    },
  );
  /** @type {Array<[string, (id: string) => Promise<unknown>]>} */
  const stackHandlers = [
    [IPC_CHANNELS.prepareStack, (id) => options.coordinator.prepareStack(id)],
    [IPC_CHANNELS.reconcileStack, (id) => options.coordinator.reconcileStack(id)],
    [IPC_CHANNELS.endStack, (id) => options.coordinator.endStack(id)],
  ];
  for (const [channel, invoke] of stackHandlers) {
    options.ipcMain.handle(channel, async (event, request) => {
      requireTrusted(event);
      const { id } = DesktopStackActionRequestSchema.parse(request);
      return DesktopStackActionResultSchema.parse(await invoke(id));
    });
  }
  options.ipcMain.handle(
    IPC_CHANNELS.previewStackPrune,
    async (event, ...arguments_) => {
      requireTrusted(event);
      requireNoArguments('Stack prune preview', arguments_);
      return DesktopStackPrunePreviewSchema.parse(
        await options.coordinator.previewStackPrune(),
      );
    },
  );
  options.ipcMain.handle(IPC_CHANNELS.executeStackPrune, async (event, request) => {
    requireTrusted(event);
    DesktopStackPruneExecutionRequestSchema.parse(request);
    return DesktopStackPruneResultSchema.parse(
      await options.coordinator.executeStackPrune(),
    );
  });
  options.ipcMain.handle(IPC_CHANNELS.previewStackSnapshot, async (event, request) => {
    requireTrusted(event);
    const input = DesktopStackSnapshotRequestSchema.parse(request);
    return DesktopStackEndpointSnapshotSchema.parse(
      await options.coordinator.previewStackSnapshot(
        input.activationId,
        input.component,
        input.gatewayHost,
      ),
    );
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

/** @param {string} capability @param {unknown[]} arguments_ */
function requireNoArguments(capability, arguments_) {
  if (arguments_.length > 0) {
    throw new Error(`${capability} does not accept renderer arguments.`);
  }
}
