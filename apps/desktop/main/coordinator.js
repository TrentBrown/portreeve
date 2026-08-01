// @ts-check

import {
  DesktopLifecycleActionResultSchema,
  DesktopPurgePreviewSchema,
  DesktopPurgeResultSchema,
  DesktopSnapshotSchema,
  DesktopUpdateStateSchema,
} from '../shared/schemas.js';
import { NOT_CHECKED_UPDATE_STATE } from './update.js';
import { createDesktopSnapshot } from './view-model.js';

/**
 * @param {{artifact: {source: 'local-release-candidate'|'published', desktopVersion: string, version: string, filename: string, sha256: string}, lifecycle: any, inventory: {listPorts(): Promise<unknown[]>}, updates?: {check(): Promise<unknown>, openDownloadPage(): Promise<unknown>}, now?: () => Date, intervalMilliseconds?: number, schedule?: (callback: () => void, milliseconds: number) => any, cancel?: (timer: any) => void}} options
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
    const [lifecycleResult, inventoryResult] = await Promise.allSettled([
      options.lifecycle.status(),
      options.inventory.listPorts(),
    ]);
    /** @type {Array<{source: 'lifecycle'|'inventory', code: string, message: string, observedAt: string}>} */
    const errors = [];
    if (lifecycleResult.status === 'rejected') {
      errors.push(errorView('lifecycle', lifecycleResult.reason, observedAt));
    }
    if (inventoryResult.status === 'rejected') {
      errors.push(errorView('inventory', inventoryResult.reason, observedAt));
    }
    if (lifecycleResult.status === 'fulfilled') {
      lastLifecycle = lifecycleResult.value;
    }
    if (inventoryResult.status === 'fulfilled') {
      lastPorts = inventoryResult.value;
    }
    snapshot = createDesktopSnapshot({
      artifact: options.artifact,
      update: lastUpdate,
      lifecycle: lastLifecycle,
      ports: lastPorts,
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
      const result = await invoke();
      const finalSnapshot = await collect();
      return DesktopLifecycleActionResultSchema.parse({
        schemaVersion: 1,
        action,
        outcome: result.outcome,
        changed: result.changed,
        message: lifecycleMessage(action, result.outcome),
        errorCode: result.error?.code ?? null,
        steps: [reduceStep(result)],
        snapshot: finalSnapshot,
      });
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
          steps,
          snapshot: finalSnapshot,
        });
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
  };
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

/** @param {'lifecycle'|'inventory'} source @param {unknown} reason @param {string} observedAt */
function errorView(source, reason, observedAt) {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  return {
    source,
    code:
      'code' in error && typeof error.code === 'string' ? error.code : 'unavailable',
    message:
      source === 'lifecycle'
        ? 'Portreeve lifecycle status is unavailable.'
        : 'Portreeve port inventory is unavailable.',
    observedAt,
  };
}

/** @param {string} code @param {string} message */
function desktopCoordinatorError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
