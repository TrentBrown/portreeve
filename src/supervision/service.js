// @ts-check

import { createLifecycleManager } from './factory.js';
import { PurgePreviewSchema, PurgeResultSchema } from './purge.js';
import {
  LifecycleMutationResultSchema,
  LifecycleOperationSchema,
  LifecycleStatusSchema,
  lifecycleError,
} from './schemas.js';

const REFUSED_ERROR_CODES = new Set(['conflict', 'incompatible_protocol', 'not_found']);

/**
 * Internal lifecycle application service shared by trusted adapters.
 *
 * The service owns lifecycle result semantics. Callers remain responsible for
 * their own presentation concerns, such as CLI exit codes or renderer-safe
 * view models.
 */
export class LifecycleService {
  /**
   * @param {{
   *   manager: ReturnType<typeof createLifecycleManager>,
   *   now?: () => Date
   * }} options
   */
  constructor(options) {
    this.manager = options.manager;
    this.now = options.now ?? (() => new Date());
  }

  async status() {
    return LifecycleStatusSchema.parse(await this.manager.status());
  }

  async install() {
    return this.mutate('install', async () => {
      await this.manager.install();
      return true;
    });
  }

  async uninstall() {
    return this.mutate('uninstall', async (before) => {
      await this.manager.uninstall();
      return (
        before.installation.state !== 'absent' ||
        before.supervisor.state !== 'unavailable'
      );
    });
  }

  async start() {
    return this.mutate('start', async (before) => {
      await this.manager.start();
      return before.mode !== 'supervised';
    });
  }

  async restart() {
    return this.mutate('restart', async () => {
      await this.manager.restart();
      return true;
    });
  }

  async stop() {
    return this.mutate('stop', async () => {
      const result = await this.manager.stop();
      return result.changed;
    });
  }

  async stopManual() {
    return this.mutate('stop-manual', async () => {
      const result = await this.manager.stopManual();
      return result.changed;
    });
  }

  async previewPurge() {
    return PurgePreviewSchema.parse(await this.manager.previewPurge());
  }

  /** @param {string} confirmationToken */
  async purge(confirmationToken) {
    return PurgeResultSchema.parse(await this.manager.purge(confirmationToken));
  }

  /**
   * @param {import('zod').infer<typeof LifecycleOperationSchema>} operation
   * @param {(
   *   before: import('zod').infer<typeof LifecycleStatusSchema>
   * ) => Promise<boolean>} mutate
   */
  async mutate(operation, mutate) {
    const parsedOperation = LifecycleOperationSchema.parse(operation);
    const before = await this.status();
    const startedAt = this.now().toISOString();
    try {
      const changed = await mutate(before);
      const after = await this.status();
      return LifecycleMutationResultSchema.parse({
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
      const after = await this.status();
      const changed = lifecycleStateChanged(before, after);
      const evidence = lifecycleError(error);
      return LifecycleMutationResultSchema.parse({
        operation: parsedOperation,
        outcome: REFUSED_ERROR_CODES.has(evidence.code)
          ? 'refused'
          : changed
            ? 'partial'
            : 'failed',
        changed,
        startedAt,
        completedAt: this.now().toISOString(),
        before,
        after,
        error: evidence,
      });
    }
  }
}

/**
 * @param {Parameters<typeof createLifecycleManager>[0] & {
 *   now?: () => Date,
 *   manager?: ReturnType<typeof createLifecycleManager>
 * }} [options]
 */
export function createLifecycleService(options = {}) {
  const { manager, now, ...managerOptions } = options;
  return new LifecycleService({
    manager: manager ?? createLifecycleManager(managerOptions),
    ...(now ? { now } : {}),
  });
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
