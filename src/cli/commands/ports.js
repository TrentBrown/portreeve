// @ts-check

import { PortreeveClient } from '../../../packages/client/src/index.js';
import {
  InventoryClassificationSchema,
  PortSchema,
  ReplacementPolicySchema,
} from '../../protocol/schemas.js';
import { EXIT_CODES } from '../../protocol/constants.js';
import { CliUsageError, setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';

/**
 * @param {{
 *   socket?: string,
 *   json?: boolean,
 *   status?: string,
 *   claimed?: boolean,
 *   unclaimed?: boolean,
 *   listening?: boolean,
 *   project?: string,
 *   workspace?: string,
 *   service?: string,
 *   component?: string,
 *   endpoint?: string,
 *   port?: string
 * }} options
 */
export async function listPortsCommand(options) {
  if (options.claimed && options.unclaimed) {
    throw new CliUsageError('--claimed and --unclaimed cannot be used together.');
  }
  const entries = await new PortreeveClient({
    ...(options.socket ? { socketPath: options.socket } : {}),
  }).listPorts({
    ...(options.status
      ? {
          classification: InventoryClassificationSchema.parse(options.status),
        }
      : {}),
    ...(options.claimed ? { claimed: true } : {}),
    ...(options.unclaimed ? { claimed: false } : {}),
    ...(options.listening ? { listening: true } : {}),
    ...(options.project ? { project: options.project } : {}),
    ...(options.workspace ? { workspace: options.workspace } : {}),
    ...(options.service ? { service: options.service } : {}),
    ...(options.component ? { component: options.component } : {}),
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.port ? { port: PortSchema.parse(Number(options.port)) } : {}),
  });

  renderOutput(
    options.json ?? false,
    'entries',
    entries,
    entries.length === 0
      ? ['No claimed or listening TCP ports.']
      : entries.map((entry) => {
          const identity = claimLabel(entry.claim);
          const processes = entry.listeners
            .map((listener) => `pid ${String(listener.pid)}`)
            .join(', ');
          return [
            String(entry.port).padStart(5),
            entry.classification.padEnd(11),
            identity,
            processes,
          ]
            .filter(Boolean)
            .join('  ');
        }),
  );
}

/**
 * @param {string} portArgument
 * @param {{socket?: string, json?: boolean}} options
 */
export async function inspectPortCommand(portArgument, options) {
  const port = PortSchema.parse(Number(portArgument));
  const entry = await new PortreeveClient({
    ...(options.socket ? { socketPath: options.socket } : {}),
  }).inspectPort(port);

  const lines = [`TCP port ${port}: ${entry.classification}`];
  const identity = claimLabel(entry.claim);
  if (identity) {
    lines.push(`Claim: ${identity}`);
  }
  for (const listener of entry.listeners) {
    const ownership =
      typeof listener.ownership === 'object' &&
      listener.ownership !== null &&
      'reason' in listener.ownership
        ? String(listener.ownership.reason)
        : 'unknown';
    lines.push(
      `Listener: pid ${String(listener.pid)} (${ownership}) ${String(listener.names)}`,
    );
  }
  renderOutput(options.json ?? false, 'entry', entry, lines);
}

/**
 * @param {string} portArgument
 * @param {{
 *   socket?: string,
 *   json?: boolean,
 *   policy: string,
 *   dryRun?: boolean
 * }} options
 */
export async function reclaimPortCommand(portArgument, options) {
  const port = PortSchema.parse(Number(portArgument));
  const result = await clientFor(options.socket).reclaimPort(port, {
    policy: ReplacementPolicySchema.parse(options.policy),
    dryRun: options.dryRun ?? false,
  });
  renderReclamation(result, options.json ?? false);
}

/**
 * @param {string} portArgument
 * @param {{
 *   socket?: string,
 *   json?: boolean,
 *   unsafeAnyOwner: boolean,
 *   forceAfterGrace?: boolean,
 *   dryRun?: boolean
 * }} options
 */
export async function unsafeEvictPortCommand(portArgument, options) {
  const port = PortSchema.parse(Number(portArgument));
  if (options.unsafeAnyOwner !== true) {
    throw new CliUsageError('Unsafe eviction requires --unsafe-any-owner.');
  }
  const result = await clientFor(options.socket).unsafeEvictPort(port, {
    unsafeAnyOwner: true,
    policy: options.forceAfterGrace ? 'force-after-grace' : 'graceful',
    dryRun: options.dryRun ?? false,
  });
  renderReclamation(result, options.json ?? false);
}

/**
 * @param {string | undefined} socketPath
 */
function clientFor(socketPath) {
  return new PortreeveClient({
    ...(socketPath ? { socketPath } : {}),
  });
}

/**
 * @param {import('../../../packages/client/src/index.js').ReclamationResult} result
 * @param {boolean} json
 */
function renderReclamation(result, json) {
  if (result.outcome === 'refused' || result.outcome === 'timeout') {
    setExitCode(EXIT_CODES.conflict);
  }
  const lines = [
    `TCP port ${String(result.port)}: ${result.outcome}${
      result.reason === null ? '' : ` (${result.reason})`
    }`,
  ];
  for (const target of result.targets) {
    lines.push(`Target: pid ${String(target.pid)}`);
  }
  for (const signal of result.signals) {
    lines.push(`Signal: ${signal.signal} -> pid ${String(signal.pid)}`);
  }
  renderOutput(json, 'result', result, lines);
}

/**
 * @param {Record<string, unknown> | null} claim
 */
function claimLabel(claim) {
  if (claim === null || typeof claim.identity !== 'object' || claim.identity === null) {
    return '';
  }
  const identity = /** @type {Record<string, unknown>} */ (claim.identity);
  const component =
    typeof identity.component === 'string' ? identity.component : identity.service;
  const endpoint = identity.endpoint === 'default' ? '' : identity.endpoint;
  return [identity.project, component, endpoint, identity.workspaceRoot]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .join('/');
}
