// @ts-check

import { createDesktopSnapshot } from './view-model.js';

/**
 * @param {{artifact: {source: 'local-release-candidate'|'published', version: string, filename: string, sha256: string}, lifecycle: {status(): Promise<unknown>}, inventory: {listPorts(): Promise<unknown[]>}, now?: () => Date, intervalMilliseconds?: number, schedule?: (callback: () => void, milliseconds: number) => any, cancel?: (timer: any) => void}} options
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
  /** @type {Promise<ReturnType<typeof createDesktopSnapshot>>|null} */
  let inFlight = null;
  /** @type {any} */
  let timer = null;
  /** @type {Set<(snapshot: ReturnType<typeof createDesktopSnapshot>) => void>} */
  const subscribers = new Set();

  const refresh = () => {
    if (inFlight !== null) return inFlight;
    inFlight = collect().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  async function collect() {
    const observedAt = now().toISOString();
    const [lifecycleResult, inventoryResult] = await Promise.allSettled([
      options.lifecycle.status(),
      options.inventory.listPorts(),
    ]);
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
      lifecycle: lastLifecycle,
      ports: lastPorts,
      errors,
      refreshedAt: observedAt,
      stale: errors.length > 0,
      lastSuccessfulAt:
        errors.length === 0 ? observedAt : (snapshot?.lastSuccessfulAt ?? null),
    });
    for (const subscriber of subscribers) subscriber(snapshot);
    return snapshot;
  }

  return Object.freeze({
    refresh,
    current: () => snapshot,
    /** @param {(snapshot: ReturnType<typeof createDesktopSnapshot>) => void} subscriber */
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    start() {
      if (timer === null) timer = schedule(() => void refresh(), intervalMilliseconds);
    },
    stop() {
      if (timer !== null) cancel(timer);
      timer = null;
    },
  });
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
