// @ts-check

import { createLifecycleManager } from './factory.js';
import {
  DEFAULT_LIFECYCLE_OPERATION_TIMEOUT_MILLISECONDS,
  DEFAULT_LIFECYCLE_READ_TIMEOUT_MILLISECONDS,
  DEFAULT_LIFECYCLE_RECOVERY_TIMEOUT_MILLISECONDS,
  LifecycleDeadline,
} from './deadline.js';
import { LifecycleBusyError, LifecycleMutationLock } from './lock.js';
import { PurgePreviewSchema, PurgeResultSchema } from './purge.js';
import {
  LifecycleMutationResultSchema,
  LifecycleOperationSchema,
  LifecycleStatusSchema,
  lifecycleError,
} from './schemas.js';

const REFUSED_ERROR_CODES = new Set([
  'conflict',
  'incompatible_protocol',
  'not_found',
  'lifecycle_busy',
]);

/**
 * Internal lifecycle application service shared by trusted adapters.
 *
 * The service owns lifecycle result semantics, deadlines, and cross-process
 * mutation exclusion. Callers remain responsible for presentation concerns,
 * such as CLI exit codes or renderer-safe view models.
 */
export class LifecycleService {
  /**
   * @param {{
   *   manager: ReturnType<typeof createLifecycleManager>,
   *   lock?: LifecycleMutationLock,
   *   now?: () => Date,
   *   deadlineFactory?: (options: {timeoutMilliseconds: number, layer: string}) => LifecycleDeadline,
   *   operationTimeoutMilliseconds?: number,
   *   readTimeoutMilliseconds?: number,
   *   recoveryTimeoutMilliseconds?: number
   * }} options
   */
  constructor(options) {
    this.manager = options.manager;
    const lockPath = options.manager.paths?.lifecycleLockPath;
    if (options.lock === undefined && typeof lockPath !== 'string') {
      throw new TypeError('LifecycleService requires a mutation lock.');
    }
    this.lock =
      options.lock ??
      new LifecycleMutationLock({
        path: /** @type {string} */ (lockPath),
        ...(options.manager.uid === undefined ? {} : { uid: options.manager.uid }),
      });
    this.now = options.now ?? (() => new Date());
    this.deadlineFactory =
      options.deadlineFactory ??
      ((deadlineOptions) => new LifecycleDeadline(deadlineOptions));
    this.operationTimeoutMilliseconds =
      options.operationTimeoutMilliseconds ??
      DEFAULT_LIFECYCLE_OPERATION_TIMEOUT_MILLISECONDS;
    this.readTimeoutMilliseconds =
      options.readTimeoutMilliseconds ?? DEFAULT_LIFECYCLE_READ_TIMEOUT_MILLISECONDS;
    this.recoveryTimeoutMilliseconds =
      options.recoveryTimeoutMilliseconds ??
      DEFAULT_LIFECYCLE_RECOVERY_TIMEOUT_MILLISECONDS;
  }

  async status() {
    const context = this.deadline('status', this.readTimeoutMilliseconds);
    try {
      return await this.observe(context);
    } finally {
      context.finish();
    }
  }

  async install() {
    return this.mutate('install', async (_before, context) => {
      await this.manager.install(context);
      return true;
    });
  }

  async uninstall() {
    return this.mutate('uninstall', async (before, context) => {
      await this.manager.uninstall(context);
      return (
        before.installation.state !== 'absent' ||
        before.supervisor.state !== 'unavailable'
      );
    });
  }

  async start() {
    return this.mutate('start', async (before, context) => {
      await this.manager.start(context);
      return before.mode !== 'supervised';
    });
  }

  async restart() {
    return this.mutate('restart', async (_before, context) => {
      await this.manager.restart(context);
      return true;
    });
  }

  async stop() {
    return this.mutate('stop', async (_before, context) => {
      const result = await this.manager.stop(context);
      return result.changed;
    });
  }

  async stopManual() {
    return this.mutate('stop-manual', async (_before, context) => {
      const result = await this.manager.stopManual(context);
      return result.changed;
    });
  }

  async previewPurge() {
    const context = this.deadline('purge-preview', this.readTimeoutMilliseconds);
    try {
      return PurgePreviewSchema.parse(await this.manager.previewPurge(context));
    } finally {
      context.finish();
    }
  }

  /** @param {string} confirmationToken */
  async purge(confirmationToken) {
    const startedAt = this.now().toISOString();
    const context = this.deadline('purge', this.operationTimeoutMilliseconds);
    let lease;
    try {
      lease = await this.lock.acquire('purge');
      context.assertActive('purge');
    } catch (error) {
      context.finish();
      if (!(error instanceof LifecycleBusyError)) throw error;
      const observed = await this.recoverStatus();
      return this.purgeFailure(confirmationToken, startedAt, observed, observed, error);
    }

    let before;
    try {
      before = await this.observe(context);
      return PurgeResultSchema.parse(
        await this.manager.purge(confirmationToken, context),
      );
    } catch (error) {
      const after = await this.recoverStatus();
      return this.purgeFailure(
        confirmationToken,
        startedAt,
        before ?? after,
        after,
        error,
      );
    } finally {
      context.finish();
      await lease.release();
    }
  }

  /**
   * @param {import('zod').infer<typeof LifecycleOperationSchema>} operation
   * @param {(
   *   before: import('zod').infer<typeof LifecycleStatusSchema>,
   *   context: LifecycleDeadline
   * ) => Promise<boolean>} mutate
   */
  async mutate(operation, mutate) {
    const parsedOperation = LifecycleOperationSchema.parse(operation);
    const startedAt = this.now().toISOString();
    const context = this.deadline(parsedOperation, this.operationTimeoutMilliseconds);
    let lease;
    try {
      lease = await this.lock.acquire(parsedOperation);
      context.assertActive(parsedOperation);
    } catch (error) {
      context.finish();
      if (!(error instanceof LifecycleBusyError)) throw error;
      const observed = await this.recoverStatus();
      return mutationResult({
        operation: parsedOperation,
        outcome: 'refused',
        changed: false,
        startedAt,
        completedAt: this.now().toISOString(),
        before: observed,
        after: observed,
        error: lifecycleError(error),
      });
    }

    let before;
    try {
      before = await this.observe(context);
      const changed = await mutate(before, context);
      context.assertActive(parsedOperation);
      const after = await this.observe(context);
      return mutationResult({
        operation: parsedOperation,
        outcome: changed ? 'succeeded' : 'no-change',
        changed,
        startedAt,
        completedAt: this.now().toISOString(),
        before,
        after,
        error: null,
      });
    } catch (error) {
      const after = await this.recoverStatus();
      const stableBefore = before ?? after;
      const changed = lifecycleStateChanged(stableBefore, after);
      const evidence = lifecycleError(error);
      return mutationResult({
        operation: parsedOperation,
        outcome: REFUSED_ERROR_CODES.has(evidence.code)
          ? 'refused'
          : changed
            ? 'partial'
            : 'failed',
        changed,
        startedAt,
        completedAt: this.now().toISOString(),
        before: stableBefore,
        after,
        error: evidence,
      });
    } finally {
      context.finish();
      await lease.release();
    }
  }

  /** @param {LifecycleDeadline} context */
  async observe(context) {
    return LifecycleStatusSchema.parse(await this.manager.status(context));
  }

  async recoverStatus() {
    const context = this.deadline(
      'recovery-evidence',
      this.recoveryTimeoutMilliseconds,
    );
    try {
      return await this.observe(context);
    } finally {
      context.finish();
    }
  }

  /** @param {string} layer @param {number} timeoutMilliseconds */
  deadline(layer, timeoutMilliseconds) {
    return this.deadlineFactory({ layer, timeoutMilliseconds });
  }

  /**
   * @param {string} confirmationToken
   * @param {string} startedAt
   * @param {import('zod').infer<typeof LifecycleStatusSchema>} before
   * @param {import('zod').infer<typeof LifecycleStatusSchema>} after
   * @param {unknown} error
   */
  purgeFailure(confirmationToken, startedAt, before, after, error) {
    const changed = lifecycleStateChanged(before, after);
    const evidence = lifecycleError(error);
    return PurgeResultSchema.parse({
      operation: 'purge',
      outcome:
        evidence.code === 'lifecycle_busy' ? 'refused' : changed ? 'partial' : 'failed',
      confirmationToken,
      startedAt,
      completedAt: this.now().toISOString(),
      before,
      after,
      removed: [],
      retained: [],
      missing: [],
      refused:
        evidence.code === 'lifecycle_busy'
          ? [{ path: null, reason: 'lifecycle-busy' }]
          : [],
      error: evidence,
    });
  }
}

/**
 * @param {Parameters<typeof createLifecycleManager>[0] & {
 *   now?: () => Date,
 *   manager?: ReturnType<typeof createLifecycleManager>,
 *   lock?: LifecycleMutationLock,
 *   deadlineFactory?: (options: {timeoutMilliseconds: number, layer: string}) => LifecycleDeadline,
 *   operationTimeoutMilliseconds?: number,
 *   readTimeoutMilliseconds?: number,
 *   recoveryTimeoutMilliseconds?: number
 * }} [options]
 */
export function createLifecycleService(options = {}) {
  const {
    manager,
    lock,
    now,
    deadlineFactory,
    operationTimeoutMilliseconds,
    readTimeoutMilliseconds,
    recoveryTimeoutMilliseconds,
    ...managerOptions
  } = options;
  const resolvedManager = manager ?? createLifecycleManager(managerOptions);
  return new LifecycleService({
    manager: resolvedManager,
    ...(lock ? { lock } : {}),
    ...(now ? { now } : {}),
    ...(deadlineFactory ? { deadlineFactory } : {}),
    ...(operationTimeoutMilliseconds === undefined
      ? {}
      : { operationTimeoutMilliseconds }),
    ...(readTimeoutMilliseconds === undefined ? {} : { readTimeoutMilliseconds }),
    ...(recoveryTimeoutMilliseconds === undefined
      ? {}
      : { recoveryTimeoutMilliseconds }),
  });
}

/** @param {Record<string, unknown>} input */
function mutationResult(input) {
  return LifecycleMutationResultSchema.parse(input);
}

/**
 * @param {import('zod').infer<typeof LifecycleStatusSchema>} before
 * @param {import('zod').infer<typeof LifecycleStatusSchema>} after
 */
function lifecycleStateChanged(before, after) {
  return (
    JSON.stringify(stateFingerprint(before)) !== JSON.stringify(stateFingerprint(after))
  );
}

/** @param {import('zod').infer<typeof LifecycleStatusSchema>} status */
function stateFingerprint(status) {
  return {
    installation: {
      state: status.installation.state,
      version: status.installation.version,
    },
    supervisor: {
      state: status.supervisor.state,
      mainPid: status.supervisor.mainPid,
    },
    socket: {
      state: status.socket.state,
      pid: status.socket.server?.pid ?? null,
    },
    mode: status.mode,
    versions: status.versions,
  };
}
