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
  if (
    !hasExactKeys(result, [
      'schemaVersion',
      'action',
      'outcome',
      'changed',
      'message',
      'errorCode',
      'error',
      'failure',
      'steps',
      'snapshot',
    ]) ||
    !isLifecycleOperation(result.action) ||
    result.action === 'purge' ||
    typeof result.changed !== 'boolean' ||
    typeof result.message !== 'string' ||
    !(result.errorCode === null || isLifecycleErrorCode(result.errorCode)) ||
    !isLifecycleSafeError(result.error) ||
    !Array.isArray(result.steps) ||
    !result.steps.every(isLifecycleStep) ||
    !isLifecycleDiagnostic(result.failure)
  ) {
    throw new Error('The main process returned an invalid lifecycle result.');
  }
  requireSnapshot(result.snapshot);
  return result;
}

function hasExactKeys(value, keys) {
  if (typeof value !== 'object' || value === null) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
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
    hasExactKeys(value, [
      'operation',
      'layer',
      'outcome',
      'code',
      'message',
      'timedOut',
      'nativeExitCode',
      'before',
      'after',
      'recovery',
    ]) &&
    isLifecycleOperation(value.operation) &&
    [
      'controller',
      'install',
      'start',
      'stop',
      'stop-manual',
      'restart',
      'uninstall',
      'health-verification',
      'purge',
    ].includes(value.layer) &&
    ['refused', 'partial', 'failed'].includes(value.outcome) &&
    isLifecycleErrorCode(value.code) &&
    typeof value.message === 'string' &&
    typeof value.timedOut === 'boolean' &&
    (value.nativeExitCode === null || Number.isInteger(value.nativeExitCode)) &&
    isLifecycleEvidence(value.before) &&
    isLifecycleEvidence(value.after) &&
    Array.isArray(value.recovery) &&
    value.recovery.length >= 1 &&
    value.recovery.length <= 4 &&
    value.recovery.every((entry) => typeof entry === 'string')
  );
}

function isLifecycleSafeError(value) {
  if (value === null) return true;
  return (
    hasExactKeys(value, ['code', 'message']) &&
    isLifecycleErrorCode(value.code) &&
    typeof value.message === 'string'
  );
}

function isLifecycleEvidence(value) {
  if (value === null) return true;
  return (
    hasExactKeys(value, [
      'mode',
      'installation',
      'supervisor',
      'socket',
      'limitations',
    ]) &&
    ['none', 'manual', 'supervised', 'ambiguous'].includes(value.mode) &&
    ['absent', 'installed', 'invalid'].includes(value.installation) &&
    ['unavailable', 'inactive', 'starting', 'active', 'failed'].includes(
      value.supervisor,
    ) &&
    ['unavailable', 'healthy', 'unhealthy', 'incompatible'].includes(value.socket) &&
    Array.isArray(value.limitations) &&
    value.limitations.every((entry) => typeof entry === 'string')
  );
}

function isLifecycleStep(value) {
  return (
    hasExactKeys(value, [
      'operation',
      'outcome',
      'changed',
      'errorCode',
      'error',
      'startedAt',
      'completedAt',
      'before',
      'after',
    ]) &&
    ['install', 'start', 'stop', 'stop-manual', 'restart', 'uninstall'].includes(
      value.operation,
    ) &&
    ['succeeded', 'no-change', 'refused', 'partial', 'failed'].includes(
      value.outcome,
    ) &&
    typeof value.changed === 'boolean' &&
    (value.errorCode === null || isLifecycleErrorCode(value.errorCode)) &&
    isLifecycleSafeError(value.error) &&
    typeof value.startedAt === 'string' &&
    typeof value.completedAt === 'string' &&
    isLifecycleEvidence(value.before) &&
    isLifecycleEvidence(value.after)
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
    !hasExactKeys(value, ['schemaVersion', 'active']) ||
    !(
      value.active === null ||
      (typeof value.active === 'object' &&
        value.active !== null &&
        hasExactKeys(value.active, ['operation', 'startedAt']) &&
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
    !hasExactKeys(result, [
      'schemaVersion',
      'outcome',
      'message',
      'removed',
      'retained',
      'missing',
      'refused',
      'errorCode',
      'error',
      'failure',
      'snapshot',
    ]) ||
    typeof result.message !== 'string' ||
    !Array.isArray(result.removed) ||
    !Array.isArray(result.retained) ||
    !Array.isArray(result.missing) ||
    !Array.isArray(result.refused) ||
    !(result.errorCode === null || isLifecycleErrorCode(result.errorCode)) ||
    !isLifecycleSafeError(result.error) ||
    !isLifecycleDiagnostic(result.failure)
  ) {
    throw new Error('The main process returned an invalid purge result.');
  }
  requireSnapshot(result.snapshot);
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
    !hasExactKeys(value, ['schemaVersion', 'allowed', 'lifecycle', 'attached']) ||
    value.schemaVersion !== 1 ||
    typeof value.allowed !== 'boolean' ||
    !Array.isArray(value.attached) ||
    lifecycle.active !== value.lifecycle ||
    !value.attached.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        hasExactKeys(entry, ['stackId', 'project', 'stackRootName', 'startedAt']) &&
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
