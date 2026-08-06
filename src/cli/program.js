// @ts-check

import { Command } from 'commander';
import { PORTREEVE_VERSION } from '../version.js';
import {
  DEFAULT_PRUNE_AGE,
  deleteClaimCommand,
  listClaimsCommand,
  pruneClaimsCommand,
  reassignClaimCommand,
  showClaimCommand,
} from './commands/claims.js';
import { getConfigCommand, setConfigCommand } from './commands/config.js';
import { historyCommand, logsCommand } from './commands/observability.js';
import {
  installCommand,
  lifecycleStatusCommand,
  purgeCommand,
  restartCommand,
  startCommand,
  stopCommand,
  stopManualCommand,
  uninstallCommand,
} from './commands/lifecycle.js';
import {
  inspectPortCommand,
  listPortsCommand,
  reclaimPortCommand,
  unsafeEvictPortCommand,
} from './commands/ports.js';
import { serveCommand } from './commands/serve.js';
import {
  abandonStackEndpointCommand,
  applyStackCommand,
  beginStackActivationCommand,
  confirmStackEndpointCommand,
  endStackActivationCommand,
  listStacksCommand,
  prepareStackCommand,
  renewStackActivationCommand,
  showStackCommand,
  showStackActivationCommand,
  showStackGenerationCommand,
  skipStackEndpointCommand,
  stackStatusCommand,
} from './commands/stacks.js';

/**
 * Create the Portreeve command tree.
 *
 * Keeping construction separate from execution lets tests exercise the public
 * CLI contract without mutating global process state.
 *
 * @returns {Command}
 */
export function createProgram() {
  const program = new Command()
    .name('portreeve')
    .description('The local authority for development ports')
    .version(PORTREEVE_VERSION);

  program
    .command('serve')
    .description('Run the Portreeve server in the foreground')
    .option('--home <path>', 'override the Portreeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .action(serveCommand);

  program
    .command('status')
    .description('Report server and native supervision state')
    .option('--home <path>', 'override the Portreeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(lifecycleStatusCommand);

  program
    .command('purge')
    .description('Preview or execute complete Portreeve removal')
    .option('--home <path>', 'override the Portreeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--dry-run', 'inspect the exact deletion evidence without mutation')
    .option(
      '--confirm <preview-token>',
      'execute only when current evidence matches this preview token',
    )
    .option('--json', 'emit versioned JSON output')
    .action(purgeCommand);

  /** @type {Array<[string, string, (options: {home?: string, socket?: string, json?: boolean}) => Promise<void>]>} */
  const lifecycleCommands = [
    [
      'install',
      'Install or atomically upgrade native per-user supervision',
      installCommand,
    ],
    [
      'uninstall',
      'Remove native supervision while preserving Portreeve data',
      uninstallCommand,
    ],
    ['start', 'Start the installed supervised server', startCommand],
    ['stop', 'Stop the installed supervised server', stopCommand],
    [
      'stop-manual',
      'Explicitly stop a server running outside native supervision',
      stopManualCommand,
    ],
    ['restart', 'Restart the installed supervised server', restartCommand],
  ];
  for (const [name, description, action] of lifecycleCommands) {
    program
      .command(name)
      .description(description)
      .option('--home <path>', 'override the Portreeve application directory')
      .option('--socket <path>', 'override the Unix socket path')
      .option('--json', 'emit versioned JSON output')
      .action(action);
  }

  const ports = program.command('ports').description('Inspect development ports');

  ports
    .command('list')
    .description('List every claimed or listening TCP port')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit the versioned JSON response')
    .option('--status <classification>', 'filter by reconciliation status')
    .option('--claimed', 'show ports with durable claims')
    .option('--unclaimed', 'show ports without durable claims')
    .option('--listening', 'show ports with live listeners')
    .option('--project <name>', 'filter by project namespace')
    .option('--workspace <path>', 'filter by canonical workspace root')
    .option('--service <name>', 'filter by service name')
    .option('--component <name>', 'filter by component name')
    .option('--endpoint <name>', 'filter by endpoint name')
    .option('--port <number>', 'filter by exact TCP port')
    .action(listPortsCommand);

  ports
    .command('inspect <port>')
    .description('Inspect durable and live evidence for one TCP port')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit the versioned JSON response')
    .action(inspectPortCommand);

  ports
    .command('reclaim <port>')
    .description('Reclaim a port from its verified Portreeve run')
    .option('--socket <path>', 'override the Unix socket path')
    .option(
      '--policy <policy>',
      'replacement policy: never, graceful, or force-after-grace',
      'graceful',
    )
    .option('--dry-run', 'show the evidence-bound target plan without signaling')
    .option('--json', 'emit the versioned JSON response')
    .action(reclaimPortCommand);

  ports
    .command('unsafe-evict <port>')
    .description('Dangerously evict any observable listener from an exact port')
    .requiredOption(
      '--unsafe-any-owner',
      'explicitly authorize bypassing Portreeve claim ownership',
    )
    .option('--force-after-grace', 'authorize SIGKILL after the grace period')
    .option('--dry-run', 'show the evidence-bound target plan without signaling')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit the versioned JSON response')
    .action(unsafeEvictPortCommand);

  const claims = program
    .command('claims')
    .description('Administer durable Portreeve claims');

  claims
    .command('list')
    .description('List durable claims')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(listClaimsCommand);

  claims
    .command('show <claim-id>')
    .description('Show one durable claim')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(showClaimCommand);

  claims
    .command('reassign <claim-id>')
    .description('Assign a new idle port to a claim')
    .option('--preferred-port <port>', 'prefer this port, then permit fallback')
    .option('--exact-port <port>', 'require this exact port without fallback')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(reassignClaimCommand);

  claims
    .command('delete <claim-id>')
    .description('Delete an idle claim and return its assignment to the pool')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(deleteClaimCommand);

  claims
    .command('prune')
    .description('Delete old claims whose workspace paths no longer exist')
    .option(
      '--older-than <duration>',
      'minimum age such as 12h or 7d',
      DEFAULT_PRUNE_AGE,
    )
    .option('--dry-run', 'report eligible claims without mutation')
    .option('--yes', 'execute without an interactive confirmation')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(pruneClaimsCommand);

  const stacks = program
    .command('stacks')
    .description('Coordinate worktree stack definitions and endpoints');

  stacks
    .command('apply')
    .description('Validate and apply a worktree stack definition')
    .option('--file <path>', 'override portreeve.stack.json')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(applyStackCommand);

  stacks
    .command('list')
    .description('List registered worktree stacks')
    .option('--project <name>', 'filter by project namespace')
    .option('--workspace <path>', 'filter by canonical workspace root')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(listStacksCommand);

  stacks
    .command('show <stack-id>')
    .description('Show one registered stack and its current definition')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(showStackCommand);

  stacks
    .command('status')
    .description('Show the stack registered for a canonical worktree')
    .option('--project <name>', 'select a project namespace')
    .option('--workspace <path>', 'override the current worktree path')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(stackStatusCommand);

  stacks
    .command('prepare <stack-id>')
    .description('Create or reuse a complete immutable allocation generation')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(prepareStackCommand);

  stacks
    .command('begin <generation-id>')
    .description('Begin one exclusive activation and atomically lease its endpoints')
    .option(
      '--required-endpoint <component.endpoint...>',
      'promote optional endpoints; JSON objects preserve names containing dots',
    )
    .option(
      '--skip-endpoint <component.endpoint...>',
      'skip optional endpoints; JSON objects preserve names containing dots',
    )
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output including private lease tokens')
    .action(beginStackActivationCommand);

  stacks
    .command('activation <activation-id>')
    .description('Inspect one activation and its endpoint outcomes')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(showStackActivationCommand);

  stacks
    .command('generation <generation-id>')
    .description('Inspect one immutable allocation generation')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(showStackGenerationCommand);

  stacks
    .command('renew <activation-id>')
    .description('Renew pending activation leases from a private JSON file')
    .requiredOption('--leases-file <path>', 'JSON array of lease IDs and tokens')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(renewStackActivationCommand);

  stacks
    .command('confirm <activation-id>')
    .description('Confirm one bound process endpoint with fresh listener evidence')
    .requiredOption('--lease-file <path>', 'private JSON lease credential')
    .requiredOption('--root-pid <pid>', 'root process PID for lineage verification')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(confirmStackEndpointCommand);

  stacks
    .command('abandon <activation-id>')
    .description('Fail one pending activation endpoint')
    .requiredOption('--lease-file <path>', 'private JSON lease credential')
    .option(
      '--reason <reason>',
      'address-in-use, startup-error, or client-cancelled',
      'startup-error',
    )
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(abandonStackEndpointCommand);

  stacks
    .command('skip <activation-id>')
    .description('Skip one optional pending activation endpoint')
    .requiredOption('--lease-file <path>', 'private JSON lease credential')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(skipStackEndpointCommand);

  stacks
    .command('end <activation-id>')
    .description('End an activation only after its process listeners have stopped')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(endStackActivationCommand);

  const config = program
    .command('config')
    .description('Read or update validated server settings');

  config
    .command('get [key]')
    .description('Read all settings or one setting')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(getConfigCommand);

  config
    .command('set <key> <json-value>')
    .description('Update one setting with a JSON value')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(setConfigCommand);

  program
    .command('history')
    .description('Query structured operational history')
    .option('--limit <count>', 'maximum recent events', '100')
    .option('--event-type <type>', 'filter by exact event type')
    .option('--entity-type <type>', 'filter by exact entity type')
    .option('--entity-id <id>', 'filter by exact entity ID')
    .option('--since <timestamp>', 'filter from an ISO-8601 timestamp')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(historyCommand);

  program
    .command('logs')
    .description('Show recent bounded local diagnostic logs')
    .option('--limit <count>', 'maximum recent entries', '100')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(logsCommand);

  return program;
}
