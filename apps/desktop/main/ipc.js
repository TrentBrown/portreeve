// @ts-check

import {
  DesktopCopyTextRequestSchema,
  DesktopCopyTextResultSchema,
  DesktopLifecycleActionResultSchema,
  DesktopLauncherActionRequestSchema,
  DesktopLauncherDocumentMutationResultSchema,
  DesktopLauncherDocumentOpenRequestSchema,
  DesktopLauncherDocumentSaveRequestSchema,
  DesktopLauncherOutputEventSchema,
  DesktopLauncherOutputSchema,
  DesktopLauncherSaveOutputResultSchema,
  DesktopLauncherSessionEventSchema,
  DesktopLauncherSessionRequestSchema,
  DesktopLauncherSessionSchema,
  DesktopLauncherSnapshotSchema,
  DesktopLauncherStackRequestSchema,
  DesktopLauncherTerminationResultSchema,
  DesktopOpenDownloadResultSchema,
  DesktopPurgeExecutionRequestSchema,
  DesktopPurgePreviewSchema,
  DesktopPurgeResultSchema,
  DesktopSnapshotSchema,
  DesktopStackActionRequestSchema,
  DesktopStackActionResultSchema,
  DesktopStackDocumentMutationResultSchema,
  DesktopStackDocumentOpenResultSchema,
  DesktopStackDocumentRetryRequestSchema,
  DesktopStackDocumentSaveRequestSchema,
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
 *     openStackDocument(): Promise<unknown>, openKnownStackDocument(id: string): Promise<unknown>,
 *     saveStackDocument(request: unknown): Promise<unknown>, retryStackDocumentApply(id: string): Promise<unknown>,
 *     reconcileStack(id: string): Promise<unknown>, endStack(id: string): Promise<unknown>,
 *     previewStackPrune(): Promise<unknown>, executeStackPrune(): Promise<unknown>,
 *     previewStackSnapshot(activationId: string, component: string, gatewayHost: string): Promise<unknown>,
 *     launcherSnapshot(): Promise<unknown>, openLauncherDocument(stackId: string): Promise<unknown>,
 *     saveLauncherDocument(request: unknown): Promise<unknown>, beginLauncherAction(request: unknown): Promise<unknown>,
 *     launcherSession(sessionId: string): Promise<unknown>|unknown, cancelLauncherSession(sessionId: string): Promise<unknown>|unknown,
 *     terminateLauncherAttached(stackId: string): Promise<unknown>, launcherOutput(sessionId: string): Promise<unknown>|unknown,
 *     saveLauncherOutput(sessionId: string): Promise<unknown>,
 *     subscribeLauncherOutput?(callback: (event: unknown) => void): () => boolean,
 *     subscribeLauncherSessions?(callback: (event: unknown) => void): () => boolean
 *   },
 *   windows: () => Electron.BrowserWindow[]
 *   writeClipboard?: (text: string) => void
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
    IPC_CHANNELS.openStackDocument,
    async (event, ...arguments_) => {
      requireTrusted(event);
      requireNoArguments('Stack document selection', arguments_);
      return DesktopStackDocumentOpenResultSchema.parse(
        await options.coordinator.openStackDocument(),
      );
    },
  );
  options.ipcMain.handle(
    IPC_CHANNELS.openKnownStackDocument,
    async (event, request) => {
      requireTrusted(event);
      const { id } = DesktopStackActionRequestSchema.parse(request);
      return DesktopStackDocumentOpenResultSchema.parse(
        await options.coordinator.openKnownStackDocument(id),
      );
    },
  );
  options.ipcMain.handle(IPC_CHANNELS.saveStackDocument, async (event, request) => {
    requireTrusted(event);
    const input = DesktopStackDocumentSaveRequestSchema.parse(request);
    return DesktopStackDocumentMutationResultSchema.parse(
      await options.coordinator.saveStackDocument(input),
    );
  });
  options.ipcMain.handle(
    IPC_CHANNELS.retryStackDocumentApply,
    async (event, request) => {
      requireTrusted(event);
      const { documentId } = DesktopStackDocumentRetryRequestSchema.parse(request);
      return DesktopStackDocumentMutationResultSchema.parse(
        await options.coordinator.retryStackDocumentApply(documentId),
      );
    },
  );
  options.ipcMain.handle(IPC_CHANNELS.copyText, async (event, request) => {
    requireTrusted(event);
    const { text } = DesktopCopyTextRequestSchema.parse(request);
    if (options.writeClipboard === undefined) {
      throw new Error('Clipboard integration is unavailable.');
    }
    options.writeClipboard(text);
    return DesktopCopyTextResultSchema.parse({ schemaVersion: 1, copied: true });
  });
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
  options.ipcMain.handle(
    IPC_CHANNELS.getLauncherSnapshot,
    async (event, ...arguments_) => {
      requireTrusted(event);
      requireNoArguments('Launcher snapshot', arguments_);
      return DesktopLauncherSnapshotSchema.parse(
        await options.coordinator.launcherSnapshot(),
      );
    },
  );
  options.ipcMain.handle(IPC_CHANNELS.openLauncherDocument, async (event, request) => {
    requireTrusted(event);
    const { stackId } = DesktopLauncherDocumentOpenRequestSchema.parse(request);
    return options.coordinator.openLauncherDocument(stackId);
  });
  options.ipcMain.handle(IPC_CHANNELS.saveLauncherDocument, async (event, request) => {
    requireTrusted(event);
    const input = DesktopLauncherDocumentSaveRequestSchema.parse(request);
    return DesktopLauncherDocumentMutationResultSchema.parse(
      await options.coordinator.saveLauncherDocument(input),
    );
  });
  options.ipcMain.handle(IPC_CHANNELS.beginLauncherAction, async (event, request) => {
    requireTrusted(event);
    const input = DesktopLauncherActionRequestSchema.parse(request);
    return DesktopLauncherSessionSchema.parse(
      await options.coordinator.beginLauncherAction(input),
    );
  });
  /** @type {Array<[string, (id: string) => Promise<unknown>|unknown]>} */
  const launcherSessionHandlers = [
    [IPC_CHANNELS.getLauncherSession, (id) => options.coordinator.launcherSession(id)],
    [
      IPC_CHANNELS.cancelLauncherSession,
      (id) => options.coordinator.cancelLauncherSession(id),
    ],
  ];
  for (const [channel, invoke] of launcherSessionHandlers) {
    options.ipcMain.handle(channel, async (event, request) => {
      requireTrusted(event);
      const { sessionId } = DesktopLauncherSessionRequestSchema.parse(request);
      return DesktopLauncherSessionSchema.parse(await invoke(sessionId));
    });
  }
  options.ipcMain.handle(
    IPC_CHANNELS.terminateLauncherAttached,
    async (event, request) => {
      requireTrusted(event);
      const { stackId } = DesktopLauncherStackRequestSchema.parse(request);
      return DesktopLauncherTerminationResultSchema.parse(
        await options.coordinator.terminateLauncherAttached(stackId),
      );
    },
  );
  options.ipcMain.handle(IPC_CHANNELS.getLauncherOutput, async (event, request) => {
    requireTrusted(event);
    const { sessionId } = DesktopLauncherSessionRequestSchema.parse(request);
    return DesktopLauncherOutputSchema.parse(
      await options.coordinator.launcherOutput(sessionId),
    );
  });
  options.ipcMain.handle(IPC_CHANNELS.saveLauncherOutput, async (event, request) => {
    requireTrusted(event);
    const { sessionId } = DesktopLauncherSessionRequestSchema.parse(request);
    return DesktopLauncherSaveOutputResultSchema.parse(
      await options.coordinator.saveLauncherOutput(sessionId),
    );
  });

  /** @type {Array<() => boolean>} */
  const unsubscribers = [];
  unsubscribers.push(
    options.coordinator.subscribe((snapshot) => {
      const parsed = DesktopSnapshotSchema.parse(snapshot);
      for (const window of options.windows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(IPC_CHANNELS.snapshotChanged, parsed);
        }
      }
    }),
  );
  if (options.coordinator.subscribeLauncherOutput !== undefined) {
    unsubscribers.push(
      options.coordinator.subscribeLauncherOutput((event) => {
        const parsed = DesktopLauncherOutputEventSchema.parse(event);
        sendToWindows(options.windows(), IPC_CHANNELS.launcherOutput, parsed);
      }),
    );
  }
  if (options.coordinator.subscribeLauncherSessions !== undefined) {
    unsubscribers.push(
      options.coordinator.subscribeLauncherSessions((event) => {
        const parsed = DesktopLauncherSessionEventSchema.parse(event);
        sendToWindows(options.windows(), IPC_CHANNELS.launcherSessionChanged, parsed);
      }),
    );
  }
  return () => {
    let removed = true;
    for (const unsubscribe of unsubscribers) removed = unsubscribe() && removed;
    return removed;
  };
}

/** @param {Electron.BrowserWindow[]} windows @param {string} channel @param {unknown} value */
function sendToWindows(windows, channel, value) {
  for (const window of windows) {
    if (!window.isDestroyed()) window.webContents.send(channel, value);
  }
}

/** @param {string} capability @param {unknown[]} arguments_ */
function requireNoArguments(capability, arguments_) {
  if (arguments_.length > 0) {
    throw new Error(`${capability} does not accept renderer arguments.`);
  }
}
