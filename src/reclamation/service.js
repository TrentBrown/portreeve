// @ts-check

import { randomUUID } from 'node:crypto';
import {
  ProcessFingerprintSchema,
  sameProcessInstance,
} from '../inspection/processes.js';
import {
  IdentifierSchema,
  PortSchema,
  ReclaimRequestSchema,
  ReclamationResultSchema,
  UnsafeEvictionRequestSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { InventoryService } from '../reconciliation/inventory.js';
import { RegistryError } from '../storage/registry.js';

const POLL_INTERVAL_MILLISECONDS = 50;

export class ReclamationService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   inventoryService?: InventoryService,
   *   signalProcess?: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => void,
   *   sleep?: (milliseconds: number) => Promise<void>,
   *   now?: () => Date
   * }} dependencies
   */
  constructor({
    registry,
    inventoryService = new InventoryService({ registry }),
    signalProcess = (pid, signal) => process.kill(pid, signal),
    sleep = (milliseconds) =>
      new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
    now = () => new Date(),
  }) {
    this.registry = registry;
    this.inventoryService = inventoryService;
    this.signalProcess = signalProcess;
    this.sleep = sleep;
    this.now = now;
  }

  /**
   * Reclaim a listener only when every current process belongs to the
   * PortReeve-confirmed run for this port.
   *
   * @param {number} requestedPort
   * @param {unknown} input
   */
  async reclaim(requestedPort, input) {
    const port = PortSchema.parse(requestedPort);
    const request = ReclaimRequestSchema.parse(input);
    assertCompatible(request.client);
    return this.#execute({
      operation: 'reclaim',
      port,
      policy: request.policy,
      dryRun: request.dryRun,
      requireOwnership: true,
      request: {
        policy: request.policy,
        dryRun: request.dryRun,
      },
    });
  }

  /**
   * Observe the exact listener and ownership evidence used by a normal reclaim
   * without auditing, releasing a run, or signaling a process.
   *
   * @param {number} requestedPort
   * @param {unknown} input
   */
  async previewReclaim(requestedPort, input) {
    const port = PortSchema.parse(requestedPort);
    const request = ReclaimRequestSchema.parse(input);
    assertCompatible(request.client);
    const snapshot = await this.#snapshot(port, true);
    const containerIds = snapshot.entry.docker?.containers.map(({ id }) => id) ?? [];
    const completion =
      snapshot.entry.listeners.length === 0
        ? { outcome: 'already-free', reason: null, launcherAction: null }
        : !snapshot.valid
          ? {
              outcome:
                snapshot.reason === 'docker-managed-listener'
                  ? 'launcher-action-required'
                  : 'refused',
              reason: snapshot.reason,
              launcherAction:
                containerIds.length === 0
                  ? null
                  : { kind: 'docker', action: 'stop-container', containerIds },
            }
          : request.policy === 'never'
            ? {
                outcome: 'refused',
                reason: 'replacement-policy-never',
                launcherAction: null,
              }
            : { outcome: 'would-terminate', reason: null, launcherAction: null };
    return {
      port,
      policy: request.policy,
      ...completion,
      targets: snapshot.entry.listeners,
      inventory: snapshot.entry,
    };
  }

  /**
   * Evict any observable listener on one exact port. Explicit unsafe intent
   * bypasses claim ownership only; it never bypasses process-instance binding.
   *
   * @param {number} requestedPort
   * @param {unknown} input
   */
  async unsafeEvict(requestedPort, input) {
    const port = PortSchema.parse(requestedPort);
    const request = UnsafeEvictionRequestSchema.parse(input);
    assertCompatible(request.client);
    return this.#execute({
      operation: 'unsafe-eviction',
      port,
      policy: request.policy,
      dryRun: request.dryRun,
      requireOwnership: false,
      request: {
        unsafeAnyOwner: request.unsafeAnyOwner,
        policy: request.policy,
        dryRun: request.dryRun,
      },
    });
  }

  /**
   * @param {{
   *   operation: 'reclaim' | 'unsafe-eviction',
   *   port: number,
   *   policy: 'never' | 'graceful' | 'force-after-grace',
   *   dryRun: boolean,
   *   requireOwnership: boolean,
   *   request: Record<string, unknown>
   * }} options
   */
  async #execute(options) {
    const operationId = randomUUID();
    /** @type {Array<{pid: number, signal: 'SIGTERM' | 'SIGKILL', at: string}>} */
    const signals = [];
    const initial = await this.#snapshot(options.port, options.requireOwnership);
    const targets = initial.entry.listeners;
    const expectedRunId =
      options.requireOwnership &&
      initial.entry.run !== null &&
      typeof initial.entry.run.id === 'string'
        ? initial.entry.run.id
        : null;
    const rootPid =
      initial.entry.run !== null && typeof initial.entry.run.rootPid === 'number'
        ? initial.entry.run.rootPid
        : null;
    /**
     * @param {{
     *   outcome: 'already-free' | 'would-terminate' | 'terminated' | 'refused' | 'timeout' | 'launcher-action-required',
     *   reason: string | null,
     *   launcherAction?: {kind: 'docker', action: 'stop-container', containerIds: string[]} | null
     * }} completion
     */
    const complete = (completion) => {
      if (
        options.operation === 'reclaim' &&
        (completion.outcome === 'terminated' ||
          completion.outcome === 'already-free') &&
        initial.entry.run !== null &&
        IdentifierSchema.safeParse(initial.entry.run.id).success
      ) {
        this.registry.releaseRun(String(initial.entry.run.id), this.now());
      }
      return this.#complete(options, operationId, targets, signals, completion);
    };

    this.#audit(operationId, 'requested', {
      operation: options.operation,
      port: options.port,
      request: options.request,
      evidence: initial.entry,
    });

    if (targets.length === 0) {
      return complete({
        outcome: 'already-free',
        reason: null,
      });
    }
    if (!initial.valid) {
      const containerIds = initial.entry.docker?.containers.map(({ id }) => id) ?? [];
      return complete({
        outcome:
          initial.reason === 'docker-managed-listener'
            ? 'launcher-action-required'
            : 'refused',
        reason: initial.reason,
        launcherAction:
          containerIds.length === 0
            ? null
            : { kind: 'docker', action: 'stop-container', containerIds },
      });
    }
    if (options.policy === 'never') {
      return complete({
        outcome: 'refused',
        reason: 'replacement-policy-never',
      });
    }
    if (options.dryRun) {
      return complete({
        outcome: 'would-terminate',
        reason: null,
      });
    }

    const beforeTerm = await this.#revalidate(
      options.port,
      targets,
      options.requireOwnership,
      false,
      expectedRunId,
    );
    if (!beforeTerm.valid) {
      return complete({
        outcome: 'refused',
        reason: beforeTerm.reason,
      });
    }

    const termFailure = await this.#signal(
      operationId,
      options.port,
      targets,
      listenerTargetsRootLast(beforeTerm.entry.listeners, rootPid),
      options.requireOwnership,
      expectedRunId,
      'SIGTERM',
      signals,
    );
    if (termFailure !== null) {
      return complete({
        outcome: 'refused',
        reason: termFailure,
      });
    }

    const graceMilliseconds = this.registry.getSettings().gracefulShutdownMilliseconds;
    const afterTerm = await this.#waitForListeners(
      options.port,
      targets,
      options.requireOwnership,
      graceMilliseconds,
      expectedRunId,
    );
    if (!afterTerm.valid) {
      return complete({
        outcome: 'refused',
        reason: afterTerm.reason,
      });
    }
    if (afterTerm.entry.listeners.length === 0) {
      return complete({
        outcome: 'terminated',
        reason: null,
      });
    }
    if (options.policy === 'graceful') {
      return complete({
        outcome: 'timeout',
        reason: 'grace-period-expired',
      });
    }

    const beforeKill = await this.#revalidate(
      options.port,
      targets,
      options.requireOwnership,
      true,
      expectedRunId,
    );
    if (!beforeKill.valid) {
      return complete({
        outcome: 'refused',
        reason: beforeKill.reason,
      });
    }

    const killFailure = await this.#signal(
      operationId,
      options.port,
      targets,
      listenerTargetsRootLast(beforeKill.entry.listeners, rootPid),
      options.requireOwnership,
      expectedRunId,
      'SIGKILL',
      signals,
    );
    if (killFailure !== null) {
      return complete({
        outcome: 'refused',
        reason: killFailure,
      });
    }

    const afterKill = await this.#waitForListeners(
      options.port,
      targets,
      options.requireOwnership,
      graceMilliseconds,
      expectedRunId,
    );
    if (!afterKill.valid) {
      return complete({
        outcome: 'refused',
        reason: afterKill.reason,
      });
    }
    return complete({
      outcome: afterKill.entry.listeners.length === 0 ? 'terminated' : 'timeout',
      reason:
        afterKill.entry.listeners.length === 0 ? null : 'forced-termination-timeout',
    });
  }

  /**
   * @param {number} port
   * @param {boolean} requireOwnership
   */
  async #snapshot(port, requireOwnership) {
    const entry = await this.inventoryService.inspect(port);
    if ((entry.docker?.containers?.length ?? 0) > 0) {
      return { valid: false, reason: 'docker-managed-listener', entry };
    }
    if (entry.run?.bindingKind === 'docker') {
      return { valid: false, reason: 'docker-evidence-unavailable', entry };
    }
    const unobservable = entry.listeners.some(
      ({ process }) => !ProcessFingerprintSchema.safeParse(process).success,
    );
    if (unobservable) {
      return { valid: false, reason: 'process-unobservable', entry };
    }
    if (
      requireOwnership &&
      entry.listeners.length > 0 &&
      (entry.run === null ||
        entry.classification !== 'verified' ||
        entry.listeners.some(({ ownership }) => !ownership.verified))
    ) {
      return { valid: false, reason: 'ownership-unverified', entry };
    }
    return { valid: true, reason: null, entry };
  }

  /**
   * @param {number} port
   * @param {Array<import('zod').infer<typeof import('../protocol/schemas.js').ListenerEvidenceSchema>>} targets
   * @param {boolean} requireOwnership
   * @param {boolean} [allowSubset]
   * @param {string | null} [expectedRunId]
   */
  async #revalidate(
    port,
    targets,
    requireOwnership,
    allowSubset = false,
    expectedRunId = null,
  ) {
    const current = await this.#snapshot(port, requireOwnership);
    if (!current.valid) {
      return current;
    }
    if (
      requireOwnership &&
      (expectedRunId === null ||
        current.entry.run === null ||
        current.entry.run.id !== expectedRunId)
    ) {
      return { ...current, valid: false, reason: 'ownership-context-changed' };
    }
    const currentListeners = current.entry.listeners;
    if (!allowSubset && currentListeners.length !== targets.length) {
      return { ...current, valid: false, reason: 'target-set-changed' };
    }
    if (
      currentListeners.length > targets.length ||
      currentListeners.some(
        ({ process }) =>
          !targets.some((target) => sameProcessInstance(target.process, process)),
      )
    ) {
      return { ...current, valid: false, reason: 'target-set-changed' };
    }
    return current;
  }

  /**
   * @param {number} port
   * @param {Array<import('zod').infer<typeof import('../protocol/schemas.js').ListenerEvidenceSchema>>} targets
   * @param {boolean} requireOwnership
   * @param {number} maximumMilliseconds
   * @param {string | null} expectedRunId
   */
  async #waitForListeners(
    port,
    targets,
    requireOwnership,
    maximumMilliseconds,
    expectedRunId,
  ) {
    let elapsed = 0;
    let current = await this.#revalidate(
      port,
      targets,
      requireOwnership,
      true,
      expectedRunId,
    );
    while (
      current.valid &&
      current.entry.listeners.length > 0 &&
      elapsed < maximumMilliseconds
    ) {
      const interval = Math.min(
        POLL_INTERVAL_MILLISECONDS,
        maximumMilliseconds - elapsed,
      );
      await this.sleep(interval);
      elapsed += interval;
      current = await this.#revalidate(
        port,
        targets,
        requireOwnership,
        true,
        expectedRunId,
      );
    }
    return current;
  }

  /**
   * @param {string} operationId
   * @param {number} port
   * @param {Array<import('zod').infer<typeof import('../protocol/schemas.js').ListenerEvidenceSchema>>} allTargets
   * @param {Array<import('zod').infer<typeof import('../protocol/schemas.js').ListenerEvidenceSchema>>} phaseTargets
   * @param {boolean} requireOwnership
   * @param {string | null} expectedRunId
   * @param {'SIGTERM' | 'SIGKILL'} signal
   * @param {Array<{pid: number, signal: 'SIGTERM' | 'SIGKILL', at: string}>} signals
   */
  async #signal(
    operationId,
    port,
    allTargets,
    phaseTargets,
    requireOwnership,
    expectedRunId,
    signal,
    signals,
  ) {
    for (const target of phaseTargets) {
      const current = await this.#revalidate(
        port,
        allTargets,
        requireOwnership,
        true,
        expectedRunId,
      );
      if (!current.valid) {
        return current.reason;
      }
      const freshTarget = current.entry.listeners.find(({ process }) =>
        sameProcessInstance(target.process, process),
      );
      if (freshTarget === undefined) {
        continue;
      }
      this.#audit(operationId, 'signal-authorized', {
        pid: freshTarget.pid,
        signal,
        fingerprint: freshTarget.process,
      });
      try {
        this.signalProcess(freshTarget.pid, signal);
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          /** @type {{code?: string}} */ (error).code === 'ESRCH'
        ) {
          continue;
        }
        return `signal-failed:${errorCode(error)}`;
      }
      const signalEvent = {
        pid: freshTarget.pid,
        signal,
        at: this.now().toISOString(),
      };
      signals.push(signalEvent);
      this.#audit(operationId, 'signal-sent', signalEvent);
    }
    return null;
  }

  /**
   * @param {{
   *   operation: 'reclaim' | 'unsafe-eviction',
   *   port: number,
   *   policy: 'never' | 'graceful' | 'force-after-grace',
   *   dryRun: boolean
   * }} options
   * @param {string} operationId
   * @param {Array<import('zod').infer<typeof import('../protocol/schemas.js').ListenerEvidenceSchema>>} targets
   * @param {Array<{pid: number, signal: 'SIGTERM' | 'SIGKILL', at: string}>} signals
   * @param {{
   *   outcome: 'already-free' | 'would-terminate' | 'terminated' | 'refused' | 'timeout' | 'launcher-action-required',
   *   reason: string | null,
   *   launcherAction?: {kind: 'docker', action: 'stop-container', containerIds: string[]} | null
   * }} completion
   */
  #complete(options, operationId, targets, signals, completion) {
    const result = ReclamationResultSchema.parse({
      operationId,
      operation: options.operation,
      port: options.port,
      policy: options.policy,
      dryRun: options.dryRun,
      outcome: completion.outcome,
      reason: completion.reason,
      launcherAction: completion.launcherAction ?? null,
      targets,
      signals,
    });
    this.#audit(operationId, 'completed', result);
    return result;
  }

  /**
   * @param {string} operationId
   * @param {string} stage
   * @param {Record<string, unknown>} payload
   */
  #audit(operationId, stage, payload) {
    this.registry.appendHistoryEvent(
      {
        eventType: `reclamation.${stage}`,
        entityType: 'reclamation',
        entityId: operationId,
        payload,
      },
      this.now(),
    );
  }
}

/**
 * @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client
 */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, client.requiredCapabilities);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and server protocol capabilities are incompatible.',
      result,
    );
  }
}

/**
 * @param {unknown} error
 */
function errorCode(error) {
  return error instanceof Error && 'code' in error
    ? String(/** @type {{code?: unknown}} */ (error).code ?? error.name)
    : 'unknown';
}

/**
 * A listener that is also the confirmed root is signaled last so its still-live
 * identity can continue proving descendant ownership during the phase.
 *
 * @param {Array<import('zod').infer<typeof import('../protocol/schemas.js').ListenerEvidenceSchema>>} targets
 * @param {number | null} rootPid
 */
function listenerTargetsRootLast(targets, rootPid) {
  return [...targets].sort(
    (left, right) => Number(left.pid === rootPid) - Number(right.pid === rootPid),
  );
}
