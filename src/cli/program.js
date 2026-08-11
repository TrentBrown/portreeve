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
import { mcpServeCommand, mcpSetupCommand } from './commands/mcp.js';
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
  initLauncherCommand,
  restartLauncherCommand,
  startLauncherCommand,
  statusLauncherCommand,
  stopLauncherCommand,
  trustLauncherCommand,
  validateLauncherCommand,
} from './commands/launcher.js';
import {
  abandonStackEndpointCommand,
  applyStackCommand,
  beginStackActivationCommand,
  confirmDockerStackEndpointCommand,
  confirmStackEndpointCommand,
  endStackActivationCommand,
  listStacksCommand,
  prepareStackCommand,
  pruneStacksCommand,
  reconcileStackActivationCommand,
  renewStackActivationCommand,
  resolveStackEndpointsCommand,
  showStackCommand,
  showStackActivationCommand,
  showStackGenerationCommand,
  skipStackEndpointCommand,
  snapshotStackEndpointsCommand,
  stackStatusCommand,
} from './commands/stacks.js';

/**
 * Create the PortReeve command tree.
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
    .description('Run the PortReeve server in the foreground')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .action(serveCommand);

  const mcp = program
    .command('mcp')
    .description('Expose PortReeve tools to MCP clients');

  mcp
    .command('serve')
    .description('Run the local stdio MCP bridge')
    .option('--socket <path>', 'override the PortReeve Unix socket path')
    .option('--label <label>', 'attach a diagnostic label to this bridge run')
    .action(mcpServeCommand);

  mcp
    .command('setup')
    .description('Generate MCP host configuration without changing host settings')
    .requiredOption(
      '--host <host>',
      'configuration format: generic, codex, or claude-code',
    )
    .option('--portable', 'use bare portreeve and require it on PATH')
    .option('--label <label>', 'attach a diagnostic label to bridge runs')
    .option('--json', 'emit versioned JSON output')
    .action(mcpSetupCommand);

  program
    .command('status')
    .description('Report server and native supervision state')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(lifecycleStatusCommand);

  program
    .command('purge')
    .description('Preview or execute complete PortReeve removal')
    .option('--home <path>', 'override the PortReeve application directory')
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
      'Remove native supervision while preserving PortReeve data',
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
      .option('--home <path>', 'override the PortReeve application directory')
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
    .description('Reclaim a port from its verified PortReeve run')
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
      'explicitly authorize bypassing PortReeve claim ownership',
    )
    .option('--force-after-grace', 'authorize SIGKILL after the grace period')
    .option('--dry-run', 'show the evidence-bound target plan without signaling')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit the versioned JSON response')
    .action(unsafeEvictPortCommand);

  const claims = program
    .command('claims')
    .description('Administer durable PortReeve claims');

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
    .description('Coordinate stack-root definitions and endpoints');

  stacks
    .command('apply')
    .description('Validate and apply a stack-root definition')
    .option('--file <path>', 'select an explicit stack definition file')
    .option('--stack-root <path>', 'select a root containing portreeve.stack.json')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(applyStackCommand);

  stacks
    .command('list')
    .description('List registered stacks')
    .option('--project <name>', 'filter by project namespace')
    .option('--stack-root <path>', 'filter by canonical stack root')
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
    .description('Show the enclosing or explicitly selected registered stack')
    .option('--project <name>', 'select a project namespace')
    .option('--stack-root <path>', 'select an explicit stack root')
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
    .option(
      '--docker-component <name...>',
      'bind named components through Docker for this activation',
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
    .command('confirm-docker <activation-id>')
    .description(
      'Confirm one Docker endpoint with fresh listener and container evidence',
    )
    .requiredOption('--lease-file <path>', 'private JSON lease credential')
    .requiredOption('--container-id <id>', 'Docker container ID lookup key')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(confirmDockerStackEndpointCommand);

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
    .description('End an activation only after every provider has stopped')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(endStackActivationCommand);

  stacks
    .command('reconcile <activation-id>')
    .description('Reconcile one activation from fresh process and Docker evidence')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(reconcileStackActivationCommand);

  stacks
    .command('prune')
    .description('Delete old missing-stack-root records with no live provider evidence')
    .option(
      '--older-than <duration>',
      'minimum age such as 12h or 7d',
      DEFAULT_PRUNE_AGE,
    )
    .option('--dry-run', 'report eligible and blocked stacks without mutation')
    .option('--yes', 'execute without an interactive confirmation')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(pruneStacksCommand);

  stacks
    .command('resolve <activation-id>')
    .description('Resolve one component own endpoints and declared dependencies')
    .requiredOption('--component <name>', 'consumer component name')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(resolveStackEndpointsCommand);

  stacks
    .command('snapshot <activation-id>')
    .description('Write one redacted sandbox endpoint discovery document atomically')
    .requiredOption('--component <name>', 'sandbox consumer component name')
    .requiredOption('--gateway-host <host>', 'launcher-rendered sandbox gateway host')
    .requiredOption('--file <path>', 'destination JSON document')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(snapshotStackEndpointsCommand);

  const launcher = program
    .command('launcher')
    .description('Configure and run a stack-linked project launcher');

  launcher
    .command('init')
    .description('Interactively create and trust an absent launcher definition')
    .option('--stack-root <path>', 'select an explicit applied stack root')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(initLauncherCommand);

  launcher
    .command('validate')
    .description('Validate a launcher against its local stack definition')
    .option('--stack-root <path>', 'select an explicit stack root')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(validateLauncherCommand);

  launcher
    .command('trust')
    .description('Review and trust the exact current launcher revision')
    .option('--stack-root <path>', 'select an explicit applied stack root')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(trustLauncherCommand);

  launcher
    .command('start')
    .description('Start the selected stack through its trusted launcher')
    .option('--stack-root <path>', 'select an explicit applied stack root')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option(
      '--run-start-anyway',
      'explicitly repair a partially observed non-conflicting stack',
    )
    .option('--json', 'emit versioned JSON output')
    .action(startLauncherCommand);

  launcher
    .command('stop')
    .description('Stop the selected stack through its trusted project command')
    .option('--stack-root <path>', 'select an explicit applied stack root')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option(
      '--allow-degraded',
      'explicitly run Stop from cached context without daemon coordination',
    )
    .option('--json', 'emit versioned JSON output')
    .action(stopLauncherCommand);

  launcher
    .command('restart')
    .description('Restart the selected stack through its trusted launcher')
    .option('--stack-root <path>', 'select an explicit applied stack root')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(restartLauncherCommand);

  launcher
    .command('status')
    .description('Run advisory project Status and report authoritative evidence')
    .option('--stack-root <path>', 'select an explicit applied stack root')
    .option('--home <path>', 'override the PortReeve application directory')
    .option('--socket <path>', 'override the Unix socket path')
    .option('--json', 'emit versioned JSON output')
    .action(statusLauncherCommand);

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
