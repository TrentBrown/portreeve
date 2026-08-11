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
  openStackDocument: 'portreeve:desktop:open-stack-document',
  openKnownStackDocument: 'portreeve:desktop:open-known-stack-document',
  saveStackDocument: 'portreeve:desktop:save-stack-document',
  retryStackDocumentApply: 'portreeve:desktop:retry-stack-document-apply',
  prepareStack: 'portreeve:desktop:prepare-stack',
  reconcileStack: 'portreeve:desktop:reconcile-stack',
  endStack: 'portreeve:desktop:end-stack',
  previewStackPrune: 'portreeve:desktop:preview-stack-prune',
  executeStackPrune: 'portreeve:desktop:execute-stack-prune',
  previewStackSnapshot: 'portreeve:desktop:preview-stack-snapshot',
  getLauncherSnapshot: 'portreeve:desktop:get-launcher-snapshot',
  openLauncherDocument: 'portreeve:desktop:open-launcher-document',
  saveLauncherDocument: 'portreeve:desktop:save-launcher-document',
  beginLauncherAction: 'portreeve:desktop:begin-launcher-action',
  getLauncherSession: 'portreeve:desktop:get-launcher-session',
  cancelLauncherSession: 'portreeve:desktop:cancel-launcher-session',
  terminateLauncherAttached: 'portreeve:desktop:terminate-launcher-attached',
  getLauncherOutput: 'portreeve:desktop:get-launcher-output',
  saveLauncherOutput: 'portreeve:desktop:save-launcher-output',
  launcherOutput: 'portreeve:desktop:launcher-output',
  launcherSessionChanged: 'portreeve:desktop:launcher-session-changed',
  lifecycleActivityChanged: 'portreeve:desktop:lifecycle-activity-changed',
  applicationCloseBlocked: 'portreeve:desktop:application-close-blocked',
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

function requireLifecycleMutationResult(value) {
  const result = requireMutationResult(value);
  if (!Array.isArray(result.steps) || !isLifecycleDiagnostic(result.failure)) {
    throw new Error('The main process returned an invalid lifecycle result.');
  }
  return result;
}

function isLifecycleOperation(value) {
  return [
    'install-and-start',
    'start',
    'stop',
    'stop-manual',
    'restart',
    'upgrade',
    'uninstall',
    'purge',
  ].includes(value);
}

function isLifecycleDiagnostic(value) {
  if (value === null) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    isLifecycleOperation(value.operation) &&
    typeof value.layer === 'string' &&
    ['refused', 'partial', 'failed'].includes(value.outcome) &&
    isLifecycleErrorCode(value.code) &&
    typeof value.message === 'string' &&
    typeof value.timedOut === 'boolean' &&
    (value.nativeExitCode === null || Number.isInteger(value.nativeExitCode)) &&
    Array.isArray(value.recovery) &&
    value.recovery.every((entry) => typeof entry === 'string') &&
    !('output' in value) &&
    !('stack' in value) &&
    !('arguments' in value)
  );
}

function isLifecycleErrorCode(value) {
  return [
    'lifecycle_busy',
    'lifecycle_timeout',
    'conflict',
    'incompatible_protocol',
    'not_found',
    'unsupported_platform',
    'controller_artifact_version_mismatch',
    'invalid_lifecycle_result',
    'invalid_lifecycle_status',
    'invalid_purge_preview',
    'invalid_purge_result',
    'purge_preview_required',
    'supervised_health_verification_failed',
    'unavailable',
    'lifecycle_unavailable',
    'internal',
  ].includes(value);
}

function requireLifecycleActivity(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !(
      value.active === null ||
      (typeof value.active === 'object' &&
        value.active !== null &&
        isLifecycleOperation(value.active.operation) &&
        typeof value.active.startedAt === 'string')
    )
  ) {
    throw new Error('The main process returned invalid lifecycle activity.');
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

function requirePurgeResult(value) {
  const result = requireMutationResult(value);
  if (
    !Array.isArray(result.removed) ||
    !Array.isArray(result.retained) ||
    !Array.isArray(result.missing) ||
    !Array.isArray(result.refused) ||
    !isLifecycleDiagnostic(result.failure)
  ) {
    throw new Error('The main process returned an invalid purge result.');
  }
  return result;
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

function requireStackDocumentOpenResult(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !['opened', 'cancelled'].includes(value.outcome) ||
    (value.outcome === 'opened' &&
      (typeof value.document !== 'object' || value.document === null))
  ) {
    throw new Error('The main process returned an invalid stack document.');
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

function requireLauncherSnapshot(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.launchers) ||
    !Array.isArray(value.errors)
  ) {
    throw new Error('The main process returned an invalid launcher snapshot.');
  }
  return value;
}

function requireLauncherDocument(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.documentId !== 'string' ||
    typeof value.stackId !== 'string'
  ) {
    throw new Error('The main process returned an invalid launcher document.');
  }
  return value;
}

function requireLauncherDocumentResult(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.documentId !== 'string' ||
    typeof value.outcome !== 'string'
  ) {
    throw new Error('The main process returned an invalid launcher document result.');
  }
  return value;
}

function requireLauncherSession(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.sessionId !== 'string' ||
    !['running', 'terminal'].includes(value.state)
  ) {
    throw new Error('The main process returned an invalid launcher session.');
  }
  return value;
}

function requireLauncherOutput(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.sessionId !== 'string' ||
    !Array.isArray(value.chunks)
  ) {
    throw new Error('The main process returned invalid launcher output.');
  }
  return value;
}

function requireLauncherOutputEvent(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.sessionId !== 'string' ||
    typeof value.chunk !== 'object' ||
    value.chunk === null
  ) {
    throw new Error('The main process returned an invalid launcher output event.');
  }
  return value;
}

function requireLauncherTermination(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.stackId !== 'string' ||
    typeof value.requested !== 'boolean'
  ) {
    throw new Error(
      'The main process returned an invalid launcher termination result.',
    );
  }
  return value;
}

function requireLauncherSaveOutput(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    !['saved', 'cancelled'].includes(value.outcome)
  ) {
    throw new Error('The main process returned an invalid output-save result.');
  }
  return value;
}

function requireApplicationCloseState(value) {
  const lifecycle = requireLifecycleActivity({
    schemaVersion: 1,
    active: value?.lifecycle,
  });
  if (
    typeof value !== 'object' ||
    value === null ||
    value.schemaVersion !== 1 ||
    typeof value.allowed !== 'boolean' ||
    !Array.isArray(value.attached) ||
    lifecycle.active !== value.lifecycle ||
    !value.attached.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.stackId === 'string' &&
        typeof entry.project === 'string' &&
        typeof entry.stackRootName === 'string' &&
        typeof entry.startedAt === 'string',
    )
  ) {
    throw new Error('The main process returned an invalid application-close state.');
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
      requireLifecycleMutationResult(
        await ipcRenderer.invoke(channels.installAndStart),
      ),
    start: async () =>
      requireLifecycleMutationResult(await ipcRenderer.invoke(channels.start)),
    stop: async () =>
      requireLifecycleMutationResult(await ipcRenderer.invoke(channels.stop)),
    stopManual: async () =>
      requireLifecycleMutationResult(await ipcRenderer.invoke(channels.stopManual)),
    restart: async () =>
      requireLifecycleMutationResult(await ipcRenderer.invoke(channels.restart)),
    upgrade: async () =>
      requireLifecycleMutationResult(await ipcRenderer.invoke(channels.upgrade)),
    uninstall: async () =>
      requireLifecycleMutationResult(await ipcRenderer.invoke(channels.uninstall)),
    previewPurge: async () =>
      requirePurgePreview(await ipcRenderer.invoke(channels.previewPurge)),
    executePurge: async (confirmation) =>
      requirePurgeResult(
        await ipcRenderer.invoke(channels.executePurge, { confirmation }),
      ),
    openDownloadPage: async () =>
      requireOpenDownloadResult(await ipcRenderer.invoke(channels.openDownloadPage)),
    applyStackDefinition: async () =>
      requireMutationResult(await ipcRenderer.invoke(channels.applyStackDefinition)),
    openStackDocument: async () =>
      requireStackDocumentOpenResult(
        await ipcRenderer.invoke(channels.openStackDocument),
      ),
    openKnownStackDocument: async (id) =>
      requireStackDocumentOpenResult(
        await ipcRenderer.invoke(channels.openKnownStackDocument, { id }),
      ),
    saveStackDocument: async (documentId, content, conflictToken = null) =>
      requireMutationResult(
        await ipcRenderer.invoke(channels.saveStackDocument, {
          documentId,
          content,
          conflictToken,
        }),
      ),
    retryStackDocumentApply: async (documentId) =>
      requireMutationResult(
        await ipcRenderer.invoke(channels.retryStackDocumentApply, { documentId }),
      ),
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
    getLauncherSnapshot: async () =>
      requireLauncherSnapshot(await ipcRenderer.invoke(channels.getLauncherSnapshot)),
    openLauncherDocument: async (stackId) =>
      requireLauncherDocument(
        await ipcRenderer.invoke(channels.openLauncherDocument, { stackId }),
      ),
    saveLauncherDocument: async (
      documentId,
      definition,
      overwrite = false,
      confirmDowngrade = false,
    ) =>
      requireLauncherDocumentResult(
        await ipcRenderer.invoke(channels.saveLauncherDocument, {
          documentId,
          definition,
          overwrite,
          confirmDowngrade,
        }),
      ),
    beginLauncherAction: async (
      stackId,
      operation,
      runStartAnyway = false,
      allowDegraded = false,
    ) =>
      requireLauncherSession(
        await ipcRenderer.invoke(channels.beginLauncherAction, {
          stackId,
          operation,
          runStartAnyway,
          allowDegraded,
        }),
      ),
    getLauncherSession: async (sessionId) =>
      requireLauncherSession(
        await ipcRenderer.invoke(channels.getLauncherSession, { sessionId }),
      ),
    cancelLauncherSession: async (sessionId) =>
      requireLauncherSession(
        await ipcRenderer.invoke(channels.cancelLauncherSession, { sessionId }),
      ),
    terminateLauncherAttached: async (stackId) =>
      requireLauncherTermination(
        await ipcRenderer.invoke(channels.terminateLauncherAttached, { stackId }),
      ),
    getLauncherOutput: async (sessionId) =>
      requireLauncherOutput(
        await ipcRenderer.invoke(channels.getLauncherOutput, { sessionId }),
      ),
    saveLauncherOutput: async (sessionId) =>
      requireLauncherSaveOutput(
        await ipcRenderer.invoke(channels.saveLauncherOutput, { sessionId }),
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
    subscribeLauncherOutput(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('Launcher output subscriber must be a function.');
      }
      const listener = (_event, value) => callback(requireLauncherOutputEvent(value));
      ipcRenderer.on(channels.launcherOutput, listener);
      return () => ipcRenderer.removeListener(channels.launcherOutput, listener);
    },
    subscribeLauncherSessions(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('Launcher session subscriber must be a function.');
      }
      const listener = (_event, value) => callback(requireLauncherSession(value));
      ipcRenderer.on(channels.launcherSessionChanged, listener);
      return () =>
        ipcRenderer.removeListener(channels.launcherSessionChanged, listener);
    },
    subscribeLifecycleActivity(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('Lifecycle activity subscriber must be a function.');
      }
      const listener = (_event, value) => callback(requireLifecycleActivity(value));
      ipcRenderer.on(channels.lifecycleActivityChanged, listener);
      return () =>
        ipcRenderer.removeListener(channels.lifecycleActivityChanged, listener);
    },
    subscribeApplicationCloseBlocked(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('Application-close subscriber must be a function.');
      }
      const listener = (_event, value) => callback(requireApplicationCloseState(value));
      ipcRenderer.on(channels.applicationCloseBlocked, listener);
      return () =>
        ipcRenderer.removeListener(channels.applicationCloseBlocked, listener);
    },
  }),
);
