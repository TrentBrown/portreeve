'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const channels = Object.freeze({
  getSnapshot: 'portreeve:desktop:get-snapshot',
  snapshotChanged: 'portreeve:desktop:snapshot-changed',
  refresh: 'portreeve:desktop:refresh',
});

function requireSnapshot(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.ports) ||
    !Array.isArray(value.errors)
  ) {
    throw new Error('The main process returned an invalid desktop snapshot.');
  }
  return value;
}

contextBridge.exposeInMainWorld(
  'portreeveDesktop',
  Object.freeze({
    getSnapshot: async () =>
      requireSnapshot(await ipcRenderer.invoke(channels.getSnapshot)),
    refresh: async () => requireSnapshot(await ipcRenderer.invoke(channels.refresh)),
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
