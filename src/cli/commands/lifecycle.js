// @ts-check

import { EXIT_CODES } from '../../protocol/constants.js';
import { PurgeConfirmationTokenSchema } from '../../supervision/purge.js';
import { createLifecycleService } from '../../supervision/service.js';
import { CliUsageError, exitCodeForErrorCode, setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';

/**
 * @typedef {{home?: string, socket?: string, json?: boolean}} LifecycleOptions
 */

/** @param {LifecycleOptions} options */
export async function installCommand(options) {
  await runMutation(options, (service) => service.install());
}

/** @param {LifecycleOptions} options */
export async function uninstallCommand(options) {
  await runMutation(options, (service) => service.uninstall());
}

/** @param {LifecycleOptions} options */
export async function startCommand(options) {
  await runMutation(options, (service) => service.start());
}

/** @param {LifecycleOptions} options */
export async function restartCommand(options) {
  await runMutation(options, (service) => service.restart());
}

/** @param {LifecycleOptions} options */
export async function stopCommand(options) {
  await runMutation(options, (service) => service.stop());
}

/** @param {LifecycleOptions} options */
export async function stopManualCommand(options) {
  await runMutation(options, (service) => service.stopManual());
}

/** @param {LifecycleOptions} options */
export async function lifecycleStatusCommand(options) {
  const status = await serviceFor(options).status();
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
  const service = serviceFor(options);
  if (options.dryRun) {
    const preview = await service.previewPurge();
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
  const result = await service.purge(token.data);
  if (result.outcome === 'refused') {
    setExitCode(EXIT_CODES.conflict);
  } else if (result.outcome === 'partial') {
    setExitCode(EXIT_CODES.internal);
  }
  renderOutput(options.json ?? false, 'result', result, purgeResultLines(result));
}

/**
 * @param {LifecycleOptions} options
 * @param {(
 *   service: ReturnType<typeof serviceFor>
 * ) => ReturnType<ReturnType<typeof serviceFor>['install']>} mutate
 */
async function runMutation(options, mutate) {
  const result = await mutate(serviceFor(options));
  if (result.error !== null) {
    setExitCode(exitCodeForErrorCode(result.error.code));
  }
  renderMutation(options.json ?? false, result);
}

/**
 * @param {boolean} json
 * @param {Awaited<ReturnType<ReturnType<typeof serviceFor>['install']>>} result
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
 * @param {Awaited<ReturnType<ReturnType<typeof serviceFor>['status']>>} status
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
 * @param {Awaited<ReturnType<ReturnType<typeof serviceFor>['previewPurge']>>} preview
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
 * @param {Awaited<ReturnType<ReturnType<typeof serviceFor>['purge']>>} result
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
 * @param {Awaited<ReturnType<ReturnType<typeof serviceFor>['status']>>} status
 */
function statusSummary(status) {
  return `${status.installation.state} installation, ${status.supervisor.state} supervisor, ${status.socket.state} socket, ${status.mode} mode`;
}

/** @param {{home?: string, socket?: string}} options */
function serviceFor(options) {
  return createLifecycleService({
    ...(options.home ? { home: options.home } : {}),
    ...(options.socket ? { socket: options.socket } : {}),
  });
}
