// @ts-check

import { EXIT_CODES } from '../../protocol/constants.js';
import { createLifecycleManager } from '../../supervision/factory.js';
import {
  LifecycleMutationResultSchema,
  LifecycleOperationSchema,
  lifecycleError,
} from '../../supervision/schemas.js';
import { PurgeConfirmationTokenSchema } from '../../supervision/purge.js';
import { CliUsageError, exitCodeForError, setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';

/**
 * @typedef {{home?: string, socket?: string, json?: boolean}} LifecycleOptions
 */

/** @param {LifecycleOptions} options */
export async function installCommand(options) {
  await runMutation(options, 'install', async (manager) => {
    await manager.install();
    return true;
  });
}

/** @param {LifecycleOptions} options */
export async function uninstallCommand(options) {
  await runMutation(options, 'uninstall', async (manager, before) => {
    await manager.uninstall();
    return (
      before.installation.state !== 'absent' ||
      before.supervisor.state !== 'unavailable'
    );
  });
}

/** @param {LifecycleOptions} options */
export async function startCommand(options) {
  await runMutation(options, 'start', async (manager, before) => {
    await manager.start();
    return before.mode !== 'supervised';
  });
}

/** @param {LifecycleOptions} options */
export async function restartCommand(options) {
  await runMutation(options, 'restart', async (manager) => {
    await manager.restart();
    return true;
  });
}

/** @param {LifecycleOptions} options */
export async function stopCommand(options) {
  await runMutation(options, 'stop', async (manager) => {
    const result = await manager.stop();
    return result.changed;
  });
}

/** @param {LifecycleOptions} options */
export async function stopManualCommand(options) {
  await runMutation(options, 'stop-manual', async (manager) => {
    const result = await manager.stopManual();
    return result.changed;
  });
}

/** @param {LifecycleOptions} options */
export async function lifecycleStatusCommand(options) {
  const status = await managerFor(options).status();
  if (status.socket.state !== 'healthy' || status.mode === 'ambiguous') {
    setExitCode(EXIT_CODES.stateDifference);
  }
  renderOutput(options.json ?? false, 'status', status, statusLines(status));
}

/**
 * @param {LifecycleOptions & {dryRun?: boolean, confirm?: string}} options
 */
export async function purgeCommand(options) {
  if ((options.dryRun ?? false) === (options.confirm !== undefined)) {
    throw new CliUsageError(
      'Purge requires exactly one of --dry-run or --confirm <preview-token>.',
    );
  }
  const manager = managerFor(options);
  if (options.dryRun) {
    const preview = await manager.previewPurge();
    if (!preview.allowed) {
      setExitCode(EXIT_CODES.conflict);
    }
    renderOutput(options.json ?? false, 'preview', preview, purgePreviewLines(preview));
    return;
  }
  const token = PurgeConfirmationTokenSchema.safeParse(options.confirm);
  if (!token.success) {
    throw new CliUsageError(
      'Purge confirmation token must be the 64-character lowercase hexadecimal token returned by --dry-run.',
    );
  }
  const result = await manager.purge(token.data);
  if (result.outcome === 'refused') {
    setExitCode(EXIT_CODES.conflict);
  } else if (result.outcome === 'partial') {
    setExitCode(EXIT_CODES.internal);
  }
  renderOutput(options.json ?? false, 'result', result, purgeResultLines(result));
}

/**
 * @param {LifecycleOptions} options
 * @param {import('zod').infer<typeof LifecycleOperationSchema>} operation
 * @param {(
 *   manager: ReturnType<typeof managerFor>,
 *   before: Awaited<ReturnType<ReturnType<typeof managerFor>['status']>>
 * ) => Promise<boolean>} mutate
 */
async function runMutation(options, operation, mutate) {
  const manager = managerFor(options);
  const execution = await executeLifecycleMutation(manager, operation, mutate);
  if (execution.exitCode !== EXIT_CODES.success) {
    setExitCode(execution.exitCode);
  }
  renderMutation(options.json ?? false, execution.result);
}

/**
 * Execute one lifecycle mutation while preserving before/after evidence even
 * when the operation refuses or fails.
 *
 * @param {ReturnType<typeof managerFor>} manager
 * @param {import('zod').infer<typeof LifecycleOperationSchema>} operation
 * @param {(
 *   manager: ReturnType<typeof managerFor>,
 *   before: Awaited<ReturnType<ReturnType<typeof managerFor>['status']>>
 * ) => Promise<boolean>} mutate
 * @param {() => Date} [now]
 */
export async function executeLifecycleMutation(
  manager,
  operation,
  mutate,
  now = () => new Date(),
) {
  const parsedOperation = LifecycleOperationSchema.parse(operation);
  const before = await manager.status();
  const startedAt = now().toISOString();
  try {
    const changed = await mutate(manager, before);
    const after = await manager.status();
    const result = LifecycleMutationResultSchema.parse({
      operation: parsedOperation,
      outcome: changed ? 'succeeded' : 'no-change',
      changed,
      startedAt,
      completedAt: now().toISOString(),
      before,
      after,
      error: null,
    });
    return { result, exitCode: EXIT_CODES.success };
  } catch (error) {
    const after = await manager.status();
    const changed = lifecycleStateChanged(before, after);
    const exitCode = exitCodeForError(error);
    const refused =
      exitCode === EXIT_CODES.conflict || exitCode === EXIT_CODES.incompatible;
    const result = LifecycleMutationResultSchema.parse({
      operation: parsedOperation,
      outcome: refused ? 'refused' : changed ? 'partial' : 'failed',
      changed,
      startedAt,
      completedAt: now().toISOString(),
      before,
      after,
      error: lifecycleError(error),
    });
    return { result, exitCode };
  }
}

/**
 * @param {boolean} json
 * @param {import('zod').infer<typeof LifecycleMutationResultSchema>} result
 */
function renderMutation(json, result) {
  const lines = [
    `PortReeve ${result.operation}: ${result.outcome}.`,
    `Before: ${statusSummary(result.before)}.`,
    `After: ${statusSummary(result.after)}.`,
    ...(result.error === null ? [] : [`${result.error.code}: ${result.error.message}`]),
  ];
  renderOutput(json, 'result', result, lines);
}

/**
 * @param {Awaited<ReturnType<ReturnType<typeof managerFor>['status']>>} status
 */
function statusLines(status) {
  return [
    `PortReeve mode: ${status.mode}; observed ${status.observedAt}.`,
    `Installation: ${status.installation.state}; managed version ${status.versions.managed ?? 'unavailable'}.`,
    `Supervisor: ${status.supervisor.state} (${status.supervisor.kind}); pid ${status.supervisor.mainPid ?? 'unavailable'}.`,
    `Socket: ${status.socket.state} at ${status.socket.path}; running version ${status.versions.running ?? 'unavailable'}.`,
    ...(status.limitations.length === 0
      ? []
      : [`Evidence limitations: ${status.limitations.join(', ')}.`]),
  ];
}

/**
 * @param {Awaited<ReturnType<ReturnType<typeof managerFor>['previewPurge']>>} preview
 */
function purgePreviewLines(preview) {
  return [
    `Purge preview: ${preview.allowed ? 'allowed' : 'refused'}.`,
    `Application home: ${preview.root}`,
    `Paths: ${String(preview.paths.length)}.`,
    `Confirmation token: ${preview.confirmationToken}`,
    ...preview.refused.map(
      ({ path, reason }) => `Refused: ${path ?? 'lifecycle'} (${reason})`,
    ),
  ];
}

/**
 * @param {Awaited<ReturnType<ReturnType<typeof managerFor>['purge']>>} result
 */
function purgeResultLines(result) {
  return [
    `PortReeve purge: ${result.outcome}.`,
    `Removed: ${String(result.removed.length)}; retained: ${String(
      result.retained.length,
    )}; missing: ${String(result.missing.length)}.`,
    ...result.refused.map(
      ({ path, reason }) => `Refused: ${path ?? 'lifecycle'} (${reason})`,
    ),
    ...(result.error === null ? [] : [`${result.error.code}: ${result.error.message}`]),
  ];
}

/**
 * @param {Awaited<ReturnType<ReturnType<typeof managerFor>['status']>>} status
 */
function statusSummary(status) {
  return `${status.installation.state} installation, ${status.supervisor.state} supervisor, ${status.socket.state} socket, ${status.mode} mode`;
}

/**
 * @param {Awaited<ReturnType<ReturnType<typeof managerFor>['status']>>} before
 * @param {Awaited<ReturnType<ReturnType<typeof managerFor>['status']>>} after
 */
function lifecycleStateChanged(before, after) {
  return (
    JSON.stringify(stateFingerprint(before)) !== JSON.stringify(stateFingerprint(after))
  );
}

/**
 * @param {Awaited<ReturnType<ReturnType<typeof managerFor>['status']>>} status
 */
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

/** @param {{home?: string, socket?: string}} options */
function managerFor(options) {
  return createLifecycleManager({
    ...(options.home ? { home: options.home } : {}),
    ...(options.socket ? { socket: options.socket } : {}),
  });
}
