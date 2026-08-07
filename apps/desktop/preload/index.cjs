'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const channels = Object.freeze({
  getSnapshot: 'portreeve:desktop:get-snapshot',
  snapshotChanged: 'portreeve:desktop:snapshot-changed',
  refresh: 'portreeve:desktop:refresh',
  installAndStart: 'portreeve:desktop:install-and-start',
  start: 'portreeve:desktop:start',
  stop: 'portreeve:desktop:stop',
  stopManual: 'portreeve:desktop:stop-manual',
  restart: 'portreeve:desktop:restart',
  upgrade: 'portreeve:desktop:upgrade',
  uninstall: 'portreeve:desktop:uninstall',
  previewPurge: 'portreeve:desktop:preview-purge',
  executePurge: 'portreeve:desktop:execute-purge',
  openDownloadPage: 'portreeve:desktop:open-download-page',
  applyStackDefinition: 'portreeve:desktop:apply-stack-definition',
  prepareStack: 'portreeve:desktop:prepare-stack',
  reconcileStack: 'portreeve:desktop:reconcile-stack',
  endStack: 'portreeve:desktop:end-stack',
  previewStackPrune: 'portreeve:desktop:preview-stack-prune',
  executeStackPrune: 'portreeve:desktop:execute-stack-prune',
  previewStackSnapshot: 'portreeve:desktop:preview-stack-snapshot',
  copyText: 'portreeve:desktop:copy-text',
});

function requireSnapshot(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.ports) ||
    !Array.isArray(value.stacks) ||
    !Array.isArray(value.errors)
  ) {
    throw new Error('The main process returned an invalid desktop snapshot.');
  }
  return value;
}

function requireMutationResult(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.outcome !== 'string'
  ) {
    throw new Error('The main process returned an invalid operation result.');
  }
  return value;
}

function requirePurgePreview(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.allowed !== 'boolean' ||
    !Array.isArray(value.paths)
  ) {
    throw new Error('The main process returned an invalid purge preview.');
  }
  return value;
}

function requireOpenDownloadResult(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    value.opened !== true
  ) {
    throw new Error('The main process returned an invalid navigation result.');
  }
  return value;
}

function requireCopyTextResult(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    value.copied !== true
  ) {
    throw new Error('The main process returned an invalid clipboard result.');
  }
  return value;
}

function requireStackSnapshot(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.own) ||
    !Array.isArray(value.dependencies)
  ) {
    throw new Error('The main process returned an invalid stack snapshot.');
  }
  return value;
}

function requireStackPrunePreview(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.candidates) ||
    !Array.isArray(value.blocked)
  ) {
    throw new Error('The main process returned an invalid stack prune preview.');
  }
  return value;
}

contextBridge.exposeInMainWorld(
  'portreeveDesktop',
  Object.freeze({
    getSnapshot: async () =>
      requireSnapshot(await ipcRenderer.invoke(channels.getSnapshot)),
    refresh: async () => requireSnapshot(await ipcRenderer.invoke(channels.refresh)),
    installAndStart: async () =>
      requireMutationResult(await ipcRenderer.invoke(channels.installAndStart)),
    start: async () => requireMutationResult(await ipcRenderer.invoke(channels.start)),
    stop: async () => requireMutationResult(await ipcRenderer.invoke(channels.stop)),
    stopManual: async () =>
      requireMutationResult(await ipcRenderer.invoke(channels.stopManual)),
    restart: async () =>
      requireMutationResult(await ipcRenderer.invoke(channels.restart)),
    upgrade: async () =>
      requireMutationResult(await ipcRenderer.invoke(channels.upgrade)),
    uninstall: async () =>
      requireMutationResult(await ipcRenderer.invoke(channels.uninstall)),
    previewPurge: async () =>
      requirePurgePreview(await ipcRenderer.invoke(channels.previewPurge)),
    executePurge: async (confirmation) =>
      requireMutationResult(
        await ipcRenderer.invoke(channels.executePurge, { confirmation }),
      ),
    openDownloadPage: async () =>
      requireOpenDownloadResult(await ipcRenderer.invoke(channels.openDownloadPage)),
    applyStackDefinition: async () =>
      requireMutationResult(await ipcRenderer.invoke(channels.applyStackDefinition)),
    prepareStack: async (id) =>
      requireMutationResult(await ipcRenderer.invoke(channels.prepareStack, { id })),
    reconcileStack: async (id) =>
      requireMutationResult(await ipcRenderer.invoke(channels.reconcileStack, { id })),
    endStack: async (id) =>
      requireMutationResult(await ipcRenderer.invoke(channels.endStack, { id })),
    previewStackPrune: async () =>
      requireStackPrunePreview(await ipcRenderer.invoke(channels.previewStackPrune)),
    executeStackPrune: async (confirmation) =>
      requireMutationResult(
        await ipcRenderer.invoke(channels.executeStackPrune, { confirmation }),
      ),
    previewStackSnapshot: async (activationId, component, gatewayHost) =>
      requireStackSnapshot(
        await ipcRenderer.invoke(channels.previewStackSnapshot, {
          activationId,
          component,
          gatewayHost,
        }),
      ),
    copyText: async (text) =>
      requireCopyTextResult(await ipcRenderer.invoke(channels.copyText, { text })),
    subscribe(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('Snapshot subscriber must be a function.');
      }
      const listener = (_event, value) => callback(requireSnapshot(value));
      ipcRenderer.on(channels.snapshotChanged, listener);
      return () => ipcRenderer.removeListener(channels.snapshotChanged, listener);
    },
  }),
);
