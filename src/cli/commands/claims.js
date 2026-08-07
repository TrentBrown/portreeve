// @ts-check

import { createInterface } from 'node:readline/promises';
import { PortreeveClient } from '../../../packages/client/src/index.js';
import { EXIT_CODES } from '../../protocol/constants.js';
import { IdentifierSchema, PortSchema } from '../../protocol/schemas.js';
import { CliUsageError, setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';

export const DEFAULT_PRUNE_AGE = '7d';

/**
 * @param {{socket?: string, json?: boolean}} options
 */
export async function listClaimsCommand(options) {
  const claims = await clientFor(options.socket).listClaims();
  renderOutput(
    options.json ?? false,
    'claims',
    claims,
    claims.length === 0
      ? ['No Portreeve claims.']
      : claims.map(
          (claim) =>
            `${claim.id}  ${claim.identity.project}/${claim.identity.service}  ${
              claim.assignedPort === null ? 'unassigned' : String(claim.assignedPort)
            }  ${claim.identity.workspaceRoot}`,
        ),
  );
}

/**
 * @param {string} claimIdArgument
 * @param {{socket?: string, json?: boolean}} options
 */
export async function showClaimCommand(claimIdArgument, options) {
  const claimId = IdentifierSchema.parse(claimIdArgument);
  const claim = await clientFor(options.socket).getClaim(claimId);
  renderOutput(options.json ?? false, 'claim', claim, [
    `Claim: ${claim.id}`,
    `Identity: ${claim.identity.project}/${claim.identity.service}`,
    `Workspace: ${claim.identity.workspaceRoot}`,
    `Mode: ${claim.mode}`,
    `Assigned port: ${
      claim.assignedPort === null ? 'unassigned' : String(claim.assignedPort)
    }`,
  ]);
}

/**
 * @param {string} claimIdArgument
 * @param {{
 *   socket?: string,
 *   json?: boolean,
 *   preferredPort?: string,
 *   exactPort?: string
 * }} options
 */
export async function reassignClaimCommand(claimIdArgument, options) {
  if (options.preferredPort !== undefined && options.exactPort !== undefined) {
    throw new CliUsageError(
      '--preferred-port and --exact-port are mutually exclusive.',
    );
  }
  const claimId = IdentifierSchema.parse(claimIdArgument);
  const claim = await clientFor(options.socket).reassignClaim(claimId, {
    ...(options.preferredPort === undefined
      ? {}
      : { preferredPort: parsePort(options.preferredPort) }),
    ...(options.exactPort === undefined
      ? {}
      : { exactPort: parsePort(options.exactPort) }),
  });
  renderOutput(options.json ?? false, 'claim', claim, [
    `Reassigned ${claim.identity.project}/${claim.identity.service} to TCP port ${String(claim.assignedPort)}.`,
  ]);
}

/**
 * @param {string} claimIdArgument
 * @param {{socket?: string, json?: boolean}} options
 */
export async function deleteClaimCommand(claimIdArgument, options) {
  const claimId = IdentifierSchema.parse(claimIdArgument);
  const result = await clientFor(options.socket).deleteClaim(claimId);
  if (!result.changed) {
    setExitCode(EXIT_CODES.stateDifference);
  }
  renderOutput(options.json ?? false, 'result', result, [
    result.changed ? `Deleted claim ${claimId}.` : `Claim ${claimId} was unchanged.`,
  ]);
}

/**
 * @param {{
 *   socket?: string,
 *   json?: boolean,
 *   olderThan?: string,
 *   dryRun?: boolean,
 *   yes?: boolean
 * }} options
 */
export async function pruneClaimsCommand(options) {
  const consentMode = pruneConsentMode(
    {
      dryRun: options.dryRun ?? false,
      yes: options.yes ?? false,
    },
    process.stdin.isTTY === true,
  );
  const olderThanMilliseconds = parseDuration(options.olderThan ?? DEFAULT_PRUNE_AGE);
  const client = clientFor(options.socket);

  if (consentMode === 'dry-run') {
    const result = await client.pruneClaims({
      olderThanMilliseconds,
      dryRun: true,
    });
    renderPrune(result, options.json ?? false);
    return;
  }

  if (consentMode === 'prompt') {
    const plan = await client.pruneClaims({
      olderThanMilliseconds,
      dryRun: true,
    });
    if (plan.candidates.length === 0) {
      renderPrune(plan, options.json ?? false);
      return;
    }
    if (!options.json) {
      renderPrune(plan, false);
    }
    const confirmed = await confirmPrune(
      plan.candidates.length,
      options.json ? process.stderr : process.stdout,
    );
    if (!confirmed) {
      setExitCode(EXIT_CODES.stateDifference);
      renderOutput(options.json ?? false, 'result', { cancelled: true, plan }, [
        'Prune cancelled.',
      ]);
      return;
    }
  }

  const result = await client.pruneClaims({
    olderThanMilliseconds,
    dryRun: false,
  });
  renderPrune(result, options.json ?? false);
}

/**
 * @param {{dryRun: boolean, yes: boolean}} options
 * @param {boolean} interactive
 * @param {string} [noun]
 */
export function pruneConsentMode(options, interactive, noun = 'claim') {
  if (options.dryRun && options.yes) {
    throw new CliUsageError('--dry-run and --yes cannot be used together.');
  }
  if (options.dryRun) {
    return /** @type {const} */ ('dry-run');
  }
  if (options.yes) {
    return /** @type {const} */ ('execute');
  }
  if (interactive) {
    return /** @type {const} */ ('prompt');
  }
  throw new CliUsageError(
    `Noninteractive ${noun} pruning requires --yes. Use --dry-run to inspect candidates.`,
  );
}

/**
 * @param {import('../../../packages/client/src/index.js').ClaimPruneResult} result
 * @param {boolean} json
 */
function renderPrune(result, json) {
  const lines = [];
  if (result.candidates.length === 0) {
    lines.push('No missing-workspace claims are eligible.');
  } else {
    lines.push(
      `${result.dryRun ? 'Would prune' : 'Eligible'} ${String(
        result.candidates.length,
      )} claim(s):`,
    );
    for (const { claim } of result.candidates) {
      lines.push(
        `  ${claim.id}  ${claim.identity.project}/${claim.identity.service}  ${claim.identity.workspaceRoot}`,
      );
    }
  }
  if (!result.dryRun) {
    lines.push(`Deleted ${String(result.deletedClaimIds.length)} claim(s).`);
    if (result.skipped.length > 0) {
      lines.push(`Skipped ${String(result.skipped.length)} changed claim(s).`);
    }
  }
  renderOutput(json, 'result', result, lines);
}

/**
 * @param {number} count
 * @param {NodeJS.WritableStream} output
 */
async function confirmPrune(count, output) {
  const terminal = createInterface({
    input: process.stdin,
    output,
  });
  try {
    const answer = await terminal.question(
      `Delete ${String(count)} eligible claim(s)? [y/N] `,
    );
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } finally {
    terminal.close();
  }
}

/**
 * @param {string} value
 */
export function parseDuration(value) {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d+)(ms|s|m|h|d|w)?$/);
  if (match === null) {
    throw new CliUsageError(
      `Invalid duration "${value}". Use values such as 0, 12h, or 7d.`,
    );
  }
  const amount = Number.parseInt(match[1] ?? '', 10);
  const multiplier =
    {
      ms: 1,
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
    }[match[2] ?? 'ms'] ?? 1;
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(milliseconds) || milliseconds > 315_576_000_000) {
    throw new CliUsageError(`Duration "${value}" is outside the supported range.`);
  }
  return milliseconds;
}

/**
 * @param {string} value
 */
function parsePort(value) {
  return PortSchema.parse(Number(value));
}

/**
 * @param {string | undefined} socketPath
 */
function clientFor(socketPath) {
  return new PortreeveClient({
    ...(socketPath ? { socketPath } : {}),
  });
}
