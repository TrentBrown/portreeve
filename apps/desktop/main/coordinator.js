// @ts-check

import {
  DesktopLifecycleActionResultSchema,
  DesktopPurgePreviewSchema,
  DesktopPurgeResultSchema,
  DesktopSnapshotSchema,
  DesktopStackActionResultSchema,
  DesktopStackDocumentMutationResultSchema,
  DesktopStackDocumentOpenResultSchema,
  DesktopStackEndpointSnapshotSchema,
  DesktopStackPrunePreviewSchema,
  DesktopStackPruneResultSchema,
  DesktopUpdateStateSchema,
} from '../shared/schemas.js';
import { NOT_CHECKED_UPDATE_STATE } from './update.js';
import { createDesktopSnapshot, reduceStackEndpointSnapshot } from './view-model.js';
import { basename } from 'node:path';

/**
 * @param {{artifact: {source: 'local-release-candidate'|'published', desktopVersion: string, version: string, filename: string, sha256: string}, lifecycle: any, inventory: {listPorts(): Promise<unknown[]>}, stacks?: any, updates?: {check(): Promise<unknown>, openDownloadPage(): Promise<unknown>}, now?: () => Date, intervalMilliseconds?: number, schedule?: (callback: () => void, milliseconds: number) => any, cancel?: (timer: any) => void}} options
 */
export function createStateCoordinator(options) {
  const now = options.now ?? (() => new Date());
  const intervalMilliseconds = options.intervalMilliseconds ?? 5_000;
  const schedule = options.schedule ?? setInterval;
  const cancel = options.cancel ?? clearInterval;
  /** @type {ReturnType<typeof createDesktopSnapshot>|null} */
  let snapshot = null;
  /** @type {unknown} */
  let lastLifecycle = null;
  /** @type {unknown[]} */
  let lastPorts = [];
  /** @type {unknown[]} */
  let lastStacks = [];
  let lastUpdate = DesktopUpdateStateSchema.parse(NOT_CHECKED_UPDATE_STATE);
  /** @type {Promise<unknown>|null} */
  let active = null;
  /** @type {'refresh'|'mutation'|null} */
  let activeKind = null;
  /** @type {Promise<ReturnType<typeof DesktopUpdateStateSchema.parse>>|null} */
  let updateActive = null;
  /** @type {any} */
  let timer = null;
  /** @type {Set<(snapshot: ReturnType<typeof createDesktopSnapshot>) => void>} */
  const subscribers = new Set();

  /** @returns {Promise<ReturnType<typeof createDesktopSnapshot>>} */
  const refresh = () => {
    if (activeKind === 'refresh') {
      return /** @type {Promise<ReturnType<typeof createDesktopSnapshot>>} */ (active);
    }
    if (activeKind === 'mutation') {
      const pending = /** @type {Promise<unknown>} */ (active);
      return pending.then((result) => {
        const candidate =
          typeof result === 'object' && result !== null && 'snapshot' in result
            ? result.snapshot
            : null;
        const parsed = DesktopSnapshotSchema.safeParse(candidate);
        return parsed.success ? parsed.data : refresh();
      }, refresh);
    }
    return begin('refresh', collect);
  };

  /** @param {() => Promise<any>} work */
  function mutate(work) {
    if (activeKind === 'mutation') {
      throw desktopCoordinatorError(
        'desktop_busy',
        'Another Portreeve operation is already in progress.',
      );
    }
    const prior = active;
    return begin('mutation', async () => {
      if (prior !== null) await prior.catch(() => undefined);
      try {
        return await work();
      } catch (error) {
        await collect();
        throw error;
      }
    });
  }

  /** @param {'refresh'|'mutation'} kind @param {() => Promise<any>} work */
  function begin(kind, work) {
    const operation = Promise.resolve().then(work);
    active = operation;
    activeKind = kind;
    const clear = () => {
      if (active === operation) {
        active = null;
        activeKind = null;
      }
    };
    void operation.then(clear, clear);
    return operation;
  }

  async function collect() {
    const observedAt = now().toISOString();
    const [lifecycleResult, inventoryResult, stackResult] = await Promise.allSettled([
      options.lifecycle.status(),
      options.inventory.listPorts(),
      options.stacks?.list() ?? Promise.resolve([]),
    ]);
    /** @type {Array<{source: 'lifecycle'|'inventory'|'stacks', code: string, message: string, observedAt: string}>} */
    const errors = [];
    if (lifecycleResult.status === 'rejected') {
      errors.push(errorView('lifecycle', lifecycleResult.reason, observedAt));
    }
    if (inventoryResult.status === 'rejected') {
      errors.push(errorView('inventory', inventoryResult.reason, observedAt));
    }
    if (stackResult.status === 'rejected') {
      errors.push(errorView('stacks', stackResult.reason, observedAt));
    }
    if (lifecycleResult.status === 'fulfilled') {
      lastLifecycle = lifecycleResult.value;
    }
    if (inventoryResult.status === 'fulfilled') {
      lastPorts = inventoryResult.value;
    }
    if (stackResult.status === 'fulfilled') {
      lastStacks = stackResult.value;
    }
    snapshot = createDesktopSnapshot({
      artifact: options.artifact,
      update: lastUpdate,
      lifecycle: lastLifecycle,
      ports: lastPorts,
      stacks: lastStacks,
      errors,
      refreshedAt: observedAt,
      stale: errors.length > 0,
      lastSuccessfulAt:
        errors.length === 0 ? observedAt : (snapshot?.lastSuccessfulAt ?? null),
    });
    publish(snapshot);
    return snapshot;
  }

  function checkForUpdates() {
    if (updateActive !== null) return updateActive;
    if (options.updates === undefined) return Promise.resolve(lastUpdate);
    const operation = options.updates.check().then(
      (value) => DesktopUpdateStateSchema.parse(value),
      () =>
        DesktopUpdateStateSchema.parse({
          status: 'unavailable',
          checkedAt: now().toISOString(),
          latestVersion: null,
        }),
    );
    updateActive = operation;
    /** @param {ReturnType<typeof DesktopUpdateStateSchema.parse>} value */
    const settle = (value) => {
      lastUpdate = value;
      if (snapshot !== null) {
        snapshot = DesktopSnapshotSchema.parse({ ...snapshot, update: lastUpdate });
        publish(snapshot);
      }
      if (updateActive === operation) updateActive = null;
      return value;
    };
    return operation.then(settle, (error) => {
      if (updateActive === operation) updateActive = null;
      throw error;
    });
  }

  /** @param {ReturnType<typeof createDesktopSnapshot>} value */
  function publish(value) {
    for (const subscriber of subscribers) subscriber(value);
  }

  /**
   * @param {'start'|'stop'|'stop-manual'|'restart'|'upgrade'|'uninstall'} action
   * @param {() => Promise<any>} invoke
   */
  function oneStep(action, invoke) {
    return mutate(async () => {
      options.lifecycle.clearPurgePreview();
      try {
        const result = await invoke();
        const finalSnapshot = await collect();
        return DesktopLifecycleActionResultSchema.parse({
          schemaVersion: 1,
          action,
          outcome: result.outcome,
          changed: result.changed,
          message: lifecycleMessage(action, result.outcome),
          errorCode: result.error?.code ?? null,
          error:
            result.error === null || result.error === undefined
              ? null
              : safeError(result.error),
          steps: [reduceStep(result)],
          snapshot: finalSnapshot,
        });
      } catch (error) {
        return lifecycleFailure(action, error, await collect());
      }
    });
  }

  /** @param {'apply'|'prepare'|'reconcile'|'end'} action @param {() => Promise<{outcome: string, changed: boolean, message: string}>} invoke */
  function stackMutation(action, invoke) {
    return mutate(async () => {
      try {
        const result = await invoke();
        return DesktopStackActionResultSchema.parse({
          schemaVersion: 1,
          action,
          ...result,
          error: null,
          snapshot: await collect(),
        });
      } catch (error) {
        const reduced = safeError(error);
        return DesktopStackActionResultSchema.parse({
          schemaVersion: 1,
          action,
          outcome: 'failed',
          changed: false,
          message: `Stack ${action} failed without completing.`,
          error: reduced,
          snapshot: await collect(),
        });
      }
    });
  }

  /** @param {string} documentId @param {() => Promise<any>} invoke */
  function stackDocumentMutation(documentId, invoke) {
    return mutate(async () => {
      try {
        const result = await invoke();
        return DesktopStackDocumentMutationResultSchema.parse({
          ...result,
          snapshot: await collect(),
        });
      } catch (error) {
        return DesktopStackDocumentMutationResultSchema.parse({
          schemaVersion: 1,
          documentId,
          outcome: 'failed',
          saved: false,
          applied: false,
          changed: null,
          stackId: null,
          message: 'The stack definition operation failed without completing.',
          conflict: null,
          issues: [],
          error: safeError(error),
          snapshot: await collect(),
        });
      }
    });
  }

  return Object.freeze({
    refresh,
    checkForUpdates,
    current: () => snapshot,
    /** @param {(snapshot: ReturnType<typeof createDesktopSnapshot>) => void} subscriber */
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    startPolling() {
      if (timer === null) timer = schedule(() => void refresh(), intervalMilliseconds);
    },
    stopPolling() {
      if (timer !== null) cancel(timer);
      timer = null;
    },
    async installAndStart() {
      return mutate(async () => {
        options.lifecycle.clearPurgePreview();
        try {
          const install = await options.lifecycle.install();
          const steps = [reduceStep(install)];
          let start = null;
          if (
            ['succeeded', 'no-change'].includes(install.outcome) &&
            install.after.installation.state === 'installed'
          ) {
            start = await options.lifecycle.start();
            steps.push(reduceStep(start));
          }
          const finalSnapshot = await collect();
          const healthy = isHealthySupervised(finalSnapshot.lifecycle);
          const outcome = installAndStartOutcome(install, start, healthy);
          return DesktopLifecycleActionResultSchema.parse({
            schemaVersion: 1,
            action: 'install-and-start',
            outcome,
            changed: steps.some(({ changed }) => changed),
            message: lifecycleMessage('install-and-start', outcome),
            errorCode:
              start?.error?.code ??
              install.error?.code ??
              (healthy ? null : 'supervised_health_verification_failed'),
            error:
              start?.error !== null && start?.error !== undefined
                ? safeError(start.error)
                : install.error !== null && install.error !== undefined
                  ? safeError(install.error)
                  : healthy
                    ? null
                    : {
                        code: 'supervised_health_verification_failed',
                        message:
                          'Portreeve was installed, but the supervised server did not report matching healthy evidence.',
                      },
            steps,
            snapshot: finalSnapshot,
          });
        } catch (error) {
          return lifecycleFailure('install-and-start', error, await collect());
        }
      });
    },
    startService: () => oneStep('start', () => options.lifecycle.start()),
    stopService: () => oneStep('stop', () => options.lifecycle.stop()),
    stopManual: () => oneStep('stop-manual', () => options.lifecycle.stopManual()),
    restartService: () => oneStep('restart', () => options.lifecycle.restart()),
    upgrade: () => oneStep('upgrade', () => options.lifecycle.install()),
    uninstall: () => oneStep('uninstall', () => options.lifecycle.uninstall()),
    previewPurge() {
      return mutate(async () => {
        const preview = await options.lifecycle.previewPurge();
        return DesktopPurgePreviewSchema.parse({ schemaVersion: 1, ...preview });
      });
    },
    executePurge() {
      return mutate(async () => {
        const result = await options.lifecycle.executePurge();
        const finalSnapshot = await collect();
        return DesktopPurgeResultSchema.parse({
          schemaVersion: 1,
          outcome: result.outcome,
          message: purgeMessage(result.outcome),
          removed: result.removed,
          retained: result.retained,
          missing: result.missing,
          refused: result.refused,
          snapshot: finalSnapshot,
        });
      });
    },
    applyStackDefinition() {
      return stackMutation('apply', async () => {
        const selected = await requireStacks(options).applySelectedDefinition();
        if (selected.cancelled) {
          return {
            outcome: 'cancelled',
            changed: false,
            message: 'Stack definition selection was cancelled.',
          };
        }
        return {
          outcome: selected.result.changed ? 'succeeded' : 'no-change',
          changed: selected.result.changed,
          message: selected.result.changed
            ? `Applied the ${selected.result.stack.project} stack definition.`
            : `The ${selected.result.stack.project} stack definition is already current.`,
        };
      });
    },
    openStackDocument() {
      return mutate(async () =>
        DesktopStackDocumentOpenResultSchema.parse(
          await requireStacks(options).openStackDocument(),
        ),
      );
    },
    /** @param {string} stackId */
    openKnownStackDocument(stackId) {
      return mutate(async () =>
        DesktopStackDocumentOpenResultSchema.parse(
          await requireStacks(options).openKnownStackDocument(stackId),
        ),
      );
    },
    /** @param {{documentId: string, content: string, conflictToken?: string|null}} request */
    saveStackDocument(request) {
      return stackDocumentMutation(request.documentId, () =>
        requireStacks(options).saveStackDocument(request),
      );
    },
    /** @param {string} documentId */
    retryStackDocumentApply(documentId) {
      return stackDocumentMutation(documentId, () =>
        requireStacks(options).retryStackDocumentApply(documentId),
      );
    },
    /** @param {string} stackId */
    prepareStack(stackId) {
      return stackMutation('prepare', async () => {
        const result = await requireStacks(options).prepare(stackId);
        return {
          outcome: result.reused ? 'no-change' : 'succeeded',
          changed: !result.reused,
          message: result.reused
            ? 'The current stack generation is already prepared.'
            : 'Prepared a new stack generation and allocated its ports.',
        };
      });
    },
    /** @param {string} activationId */
    reconcileStack(activationId) {
      return stackMutation('reconcile', async () => {
        const result = await requireStacks(options).reconcile(activationId);
        return {
          outcome: result.changed ? 'succeeded' : 'no-change',
          changed: result.changed,
          message: result.changed
            ? `Reconciled stack activation evidence; its state is now ${result.activation.state}.`
            : `Stack activation evidence is current (${result.activation.state}).`,
        };
      });
    },
    /** @param {string} activationId */
    endStack(activationId) {
      return stackMutation('end', async () => {
        const result = await requireStacks(options).end(activationId);
        return {
          outcome: result.changed ? 'succeeded' : 'no-change',
          changed: result.changed,
          message: result.changed
            ? 'Ended the stack activation after verifying provider evidence.'
            : 'The stack activation was already ended.',
        };
      });
    },
    previewStackPrune() {
      return mutate(async () => {
        const result = await requireStacks(options).previewPrune();
        return DesktopStackPrunePreviewSchema.parse({
          schemaVersion: 1,
          olderThanDays: 7,
          candidates: result.candidates.map((/** @type {any} */ candidate) => ({
            stackId: candidate.stack.id,
            project: candidate.stack.project,
            stackRootName: basename(candidate.stack.stackRoot),
            claimCount: candidate.claimIds.length,
            reason: candidate.reason,
          })),
          blocked: result.blocked.map((/** @type {any} */ blocker) => ({
            stackId: blocker.stack.id,
            project: blocker.stack.project,
            stackRootName: basename(blocker.stack.stackRoot),
            reasons: blocker.reasons,
          })),
        });
      });
    },
    executeStackPrune() {
      return mutate(async () => {
        const result = await requireStacks(options).executePrune();
        const finalSnapshot = await collect();
        const outcome =
          result.skipped.length > 0
            ? 'partial'
            : result.deletedStackIds.length === 0
              ? 'no-change'
              : 'succeeded';
        return DesktopStackPruneResultSchema.parse({
          schemaVersion: 1,
          outcome,
          message:
            outcome === 'succeeded'
              ? 'Pruned stale stack records and their claims.'
              : outcome === 'partial'
                ? 'Stack pruning completed only partially.'
                : 'No stale stacks required pruning.',
          deletedStacks: result.deletedStackIds.length,
          deletedClaims: result.deletedClaimIds.length,
          skipped: result.skipped,
          snapshot: finalSnapshot,
        });
      });
    },
    /** @param {string} activationId @param {string} component @param {string} gatewayHost */
    async previewStackSnapshot(activationId, component, gatewayHost) {
      const result = await requireStacks(options).previewSnapshot(
        activationId,
        component,
        gatewayHost,
      );
      return DesktopStackEndpointSnapshotSchema.parse(
        reduceStackEndpointSnapshot(result),
      );
    },
    async openDownloadPage() {
      if (options.updates === undefined || lastUpdate.status !== 'available') {
        throw desktopCoordinatorError(
          'desktop_update_not_available',
          'No newer Portreeve Desktop release is currently available.',
        );
      }
      return options.updates.openDownloadPage();
    },
    start() {
      this.startPolling();
    },
    stop() {
      this.stopPolling();
    },
  });
}

/** @param {any} result */
function reduceStep(result) {
  return {
    operation: result.operation,
    outcome: result.outcome,
    changed: result.changed,
    errorCode: result.error?.code ?? null,
    error:
      result.error === null || result.error === undefined
        ? null
        : safeError(result.error),
  };
}

/** @param {string} action @param {unknown} error @param {unknown} snapshot */
function lifecycleFailure(action, error, snapshot) {
  const reduced = safeError(error);
  return DesktopLifecycleActionResultSchema.parse({
    schemaVersion: 1,
    action,
    outcome: 'failed',
    changed: false,
    message: lifecycleMessage(action, 'failed'),
    errorCode: reduced.code,
    error: reduced,
    steps: [],
    snapshot,
  });
}

/** @param {any} lifecycle */
function isHealthySupervised(lifecycle) {
  return (
    lifecycle !== null &&
    lifecycle.mode === 'supervised' &&
    lifecycle.supervisor.state === 'active' &&
    lifecycle.socket.state === 'healthy' &&
    lifecycle.supervisor.mainPid !== null &&
    lifecycle.supervisor.mainPid === lifecycle.socket.serverPid
  );
}

/** @param {any} install @param {any} start @param {boolean} healthy */
function installAndStartOutcome(install, start, healthy) {
  if (!['succeeded', 'no-change'].includes(install.outcome)) return install.outcome;
  if (start === null) return install.changed ? 'partial' : 'failed';
  if (!['succeeded', 'no-change'].includes(start.outcome)) {
    return install.changed || start.changed ? 'partial' : start.outcome;
  }
  if (!healthy) return install.changed || start.changed ? 'partial' : 'failed';
  return install.changed || start.changed ? 'succeeded' : 'no-change';
}

/** @param {string} action @param {string} outcome */
function lifecycleMessage(action, outcome) {
  const label = action.replaceAll('-', ' ');
  if (outcome === 'succeeded') return `Portreeve ${label} completed.`;
  if (outcome === 'no-change') return `Portreeve ${label} required no change.`;
  if (outcome === 'refused') return `Portreeve ${label} was safely refused.`;
  if (outcome === 'partial') return `Portreeve ${label} completed only partially.`;
  return `Portreeve ${label} failed without completing.`;
}

/** @param {'succeeded'|'refused'|'partial'} outcome */
function purgeMessage(outcome) {
  if (outcome === 'succeeded') return 'All Portreeve service data was deleted.';
  if (outcome === 'partial') {
    return 'Portreeve service data was only partially deleted.';
  }
  return 'Portreeve service data deletion was safely refused.';
}

/** @param {'lifecycle'|'inventory'|'stacks'} source @param {unknown} reason @param {string} observedAt */
function errorView(source, reason, observedAt) {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  return {
    source,
    code:
      'code' in error && typeof error.code === 'string' ? error.code : 'unavailable',
    message:
      source === 'lifecycle'
        ? 'Portreeve lifecycle status is unavailable.'
        : source === 'inventory'
          ? 'Portreeve port inventory is unavailable.'
          : 'Portreeve stack evidence is unavailable.',
    observedAt,
  };
}

/** @param {unknown} error */
function safeError(error) {
  const candidate =
    typeof error === 'object' && error !== null ? error : { message: String(error) };
  const hasSafeContract =
    'code' in candidate &&
    typeof candidate.code === 'string' &&
    candidate.code.trim() !== '';
  const message =
    'message' in candidate && typeof candidate.message === 'string'
      ? candidate.message
      : '';
  return {
    code: hasSafeContract ? candidate.code : 'unavailable',
    message:
      hasSafeContract && message.trim() !== ''
        ? message
        : 'The operation failed without additional safe details.',
  };
}

/** @param {{stacks?: any}} options */
function requireStacks(options) {
  if (options.stacks !== undefined) return options.stacks;
  throw desktopCoordinatorError(
    'desktop_stacks_unavailable',
    'Stack management is unavailable in this desktop build.',
  );
}

/** @param {string} code @param {string} message */
function desktopCoordinatorError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
