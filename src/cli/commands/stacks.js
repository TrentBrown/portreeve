// @ts-check

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import {
  PortreeveClient,
  canonicalStackRoot,
  writeEndpointSnapshot,
} from '../../../packages/client/src/index.js';
import {
  IdentifierSchema,
  StackEndpointReferenceSchema,
} from '../../protocol/schemas.js';
import { EXIT_CODES } from '../../protocol/constants.js';
import { CliUsageError, setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';
import {
  findEnclosingStackDefinition,
  selectRegisteredEnclosingStack,
  selectStackDefinition,
} from '../stack-selection.js';
import { DEFAULT_PRUNE_AGE, parseDuration, pruneConsentMode } from './claims.js';

/** @param {{file?: string, stackRoot?: string, socket?: string, json?: boolean}} options */
export async function applyStackCommand(options) {
  const selection = await selectStackDefinition(options);
  let definition;
  try {
    definition = JSON.parse(await readFile(selection.filename, 'utf8'));
  } catch (error) {
    throw new CliUsageError(
      `Unable to read a valid stack definition from ${selection.filename}: ${safeMessage(error)}`,
    );
  }
  const result = await clientFor(options.socket).applyStack({
    stackRoot: selection.stackRoot,
    definition,
  });
  if (!result.changed) setExitCode(EXIT_CODES.stateDifference);
  renderOutput(options.json ?? false, 'result', result, [
    `${result.changed ? 'Applied' : 'Unchanged'} ${stackLabel(result.stack)} at revision ${result.stack.currentRevision}.`,
  ]);
}

/** @param {{project?: string, stackRoot?: string, socket?: string, json?: boolean}} options */
export async function listStacksCommand(options) {
  const stacks = await clientFor(options.socket).listStacks({
    ...(options.project ? { project: options.project } : {}),
    ...(options.stackRoot ? { stackRoot: options.stackRoot } : {}),
  });
  renderOutput(
    options.json ?? false,
    'stacks',
    stacks,
    stacks.length === 0
      ? ['No Portreeve stacks.']
      : stacks.map(
          (stack) =>
            `${stack.id}  ${stackLabel(stack)}  ${stack.currentRevision.slice(0, 12)}`,
        ),
  );
}

/** @param {string} stackIdArgument @param {{socket?: string, json?: boolean}} options */
export async function showStackCommand(stackIdArgument, options) {
  const stack = await clientFor(options.socket).getStack(
    IdentifierSchema.parse(stackIdArgument),
  );
  renderStack(stack, options.json ?? false);
}

/** @param {string} stackIdArgument @param {{socket?: string, json?: boolean}} options */
export async function prepareStackCommand(stackIdArgument, options) {
  const result = await clientFor(options.socket).prepareStack(
    IdentifierSchema.parse(stackIdArgument),
  );
  if (result.reused) setExitCode(EXIT_CODES.stateDifference);
  renderOutput(options.json ?? false, 'result', result, [
    `${result.reused ? 'Reused' : 'Prepared'} generation ${result.generation.id}.`,
    ...result.generation.endpoints.map(
      (endpoint) =>
        `${endpoint.component}.${endpoint.endpoint}  ${endpoint.host}:${endpoint.port}${endpoint.required ? '  required' : '  optional'}`,
    ),
  ]);
}

/**
 * @param {string} generationIdArgument
 * @param {{requiredEndpoint?: string[], skipEndpoint?: string[], dockerComponent?: string[], socket?: string, json?: boolean}} options
 */
export async function beginStackActivationCommand(generationIdArgument, options) {
  const result = await clientFor(options.socket).beginStackActivation(
    IdentifierSchema.parse(generationIdArgument),
    {
      requiredEndpoints: (options.requiredEndpoint ?? []).map(parseEndpointReference),
      skippedEndpoints: (options.skipEndpoint ?? []).map(parseEndpointReference),
      bindings: Object.fromEntries(
        (options.dockerComponent ?? []).map((component) => [component, 'docker']),
      ),
    },
  );
  renderOutput(
    options.json ?? false,
    'result',
    result,
    [
      `Began activation ${result.activation.id} in state ${result.activation.state}.`,
      ...result.leases.map(
        (lease) =>
          `${lease.component}.${lease.endpoint}  ${lease.port}  ${lease.bindingKind}  lease ${lease.leaseId} expires ${lease.expiresAt}`,
      ),
      options.json
        ? ''
        : 'Lease tokens are emitted only by --json; keep them private and renew them during startup.',
    ].filter(Boolean),
  );
}

/** @param {string} activationIdArgument @param {{socket?: string, json?: boolean}} options */
export async function showStackActivationCommand(activationIdArgument, options) {
  const activation = await clientFor(options.socket).getStackActivation(
    IdentifierSchema.parse(activationIdArgument),
  );
  renderActivation(activation, options.json ?? false);
}

/** @param {string} generationIdArgument @param {{socket?: string, json?: boolean}} options */
export async function showStackGenerationCommand(generationIdArgument, options) {
  const generation = await clientFor(options.socket).getStackGeneration(
    IdentifierSchema.parse(generationIdArgument),
  );
  renderOutput(options.json ?? false, 'generation', generation, [
    `Generation: ${generation.id}`,
    `Revision: ${generation.revision}`,
    `State: ${generation.state}`,
    ...generation.endpoints.map(
      (endpoint) =>
        `${endpoint.component}.${endpoint.endpoint}  ${endpoint.host}:${endpoint.port}${endpoint.required ? '  required' : '  optional'}`,
    ),
  ]);
}

/**
 * @param {string} activationIdArgument
 * @param {{leasesFile: string, socket?: string, json?: boolean}} options
 */
export async function renewStackActivationCommand(activationIdArgument, options) {
  const leases = await readJson(options.leasesFile);
  if (!Array.isArray(leases)) {
    throw new CliUsageError('The leases file must contain a JSON array.');
  }
  const result = await clientFor(options.socket).renewStackActivation(
    IdentifierSchema.parse(activationIdArgument),
    leases,
  );
  renderOutput(options.json ?? false, 'result', result, [
    `Renewed ${result.leases.length} leases for activation ${result.activation.id}.`,
  ]);
}

/**
 * @param {string} activationIdArgument
 * @param {{leaseFile: string, rootPid: string, socket?: string, json?: boolean}} options
 */
export async function confirmStackEndpointCommand(activationIdArgument, options) {
  const credential = await readLeaseCredential(options.leaseFile);
  const activation = await clientFor(options.socket).confirmStackEndpoint(
    IdentifierSchema.parse(activationIdArgument),
    {
      ...credential,
      rootPid: parsePositiveInteger(options.rootPid, '--root-pid'),
    },
  );
  renderActivation(activation, options.json ?? false);
}

/**
 * @param {string} activationIdArgument
 * @param {{leaseFile: string, containerId: string, socket?: string, json?: boolean}} options
 */
export async function confirmDockerStackEndpointCommand(activationIdArgument, options) {
  const credential = await readLeaseCredential(options.leaseFile);
  const activation = await clientFor(options.socket).confirmStackEndpoint(
    IdentifierSchema.parse(activationIdArgument),
    {
      ...credential,
      bindingKind: 'docker',
      containerId: options.containerId,
    },
  );
  renderActivation(activation, options.json ?? false);
}

/**
 * @param {string} activationIdArgument
 * @param {{leaseFile: string, reason: 'address-in-use'|'startup-error'|'client-cancelled', socket?: string, json?: boolean}} options
 */
export async function abandonStackEndpointCommand(activationIdArgument, options) {
  const credential = await readLeaseCredential(options.leaseFile);
  const activation = await clientFor(options.socket).abandonStackEndpoint(
    IdentifierSchema.parse(activationIdArgument),
    { ...credential, reason: options.reason },
  );
  renderActivation(activation, options.json ?? false);
}

/**
 * @param {string} activationIdArgument
 * @param {{leaseFile: string, socket?: string, json?: boolean}} options
 */
export async function skipStackEndpointCommand(activationIdArgument, options) {
  const credential = await readLeaseCredential(options.leaseFile);
  const activation = await clientFor(options.socket).skipStackEndpoint(
    IdentifierSchema.parse(activationIdArgument),
    credential,
  );
  renderActivation(activation, options.json ?? false);
}

/** @param {string} activationIdArgument @param {{socket?: string, json?: boolean}} options */
export async function endStackActivationCommand(activationIdArgument, options) {
  const result = await clientFor(options.socket).endStackActivation(
    IdentifierSchema.parse(activationIdArgument),
  );
  if (!result.changed) setExitCode(EXIT_CODES.stateDifference);
  renderOutput(options.json ?? false, 'result', result, [
    `${result.changed ? 'Ended' : 'Already ended'} activation ${result.activation.id}.`,
  ]);
}

/** @param {string} activationIdArgument @param {{socket?: string, json?: boolean}} options */
export async function reconcileStackActivationCommand(activationIdArgument, options) {
  const result = await clientFor(options.socket).reconcileStackActivation(
    IdentifierSchema.parse(activationIdArgument),
  );
  if (!result.changed) setExitCode(EXIT_CODES.stateDifference);
  renderOutput(options.json ?? false, 'result', result, [
    `${result.changed ? 'Reconciled' : 'Inspected'} activation ${result.activation.id}: ${result.activation.state}.`,
    ...result.providers.map(
      (provider) =>
        `${provider.component}.${provider.endpoint}  ${provider.bindingKind}  ${provider.status}  ${provider.reason}`,
    ),
  ]);
}

/**
 * @param {{socket?: string, json?: boolean, olderThan?: string, dryRun?: boolean, yes?: boolean}} options
 */
export async function pruneStacksCommand(options) {
  const consentMode = pruneConsentMode(
    { dryRun: options.dryRun ?? false, yes: options.yes ?? false },
    process.stdin.isTTY === true,
    'stack',
  );
  const olderThanMilliseconds = parseDuration(options.olderThan ?? DEFAULT_PRUNE_AGE);
  const client = clientFor(options.socket);
  if (consentMode === 'dry-run') {
    renderStackPrune(
      await client.pruneStacks({ olderThanMilliseconds, dryRun: true }),
      options.json ?? false,
    );
    return;
  }
  if (consentMode === 'prompt') {
    const plan = await client.pruneStacks({ olderThanMilliseconds, dryRun: true });
    if (plan.candidates.length === 0) {
      renderStackPrune(plan, options.json ?? false);
      return;
    }
    if (!options.json) renderStackPrune(plan, false);
    if (!(await confirmStackPrune(plan.candidates.length, options.json))) {
      setExitCode(EXIT_CODES.stateDifference);
      renderOutput(options.json ?? false, 'result', { cancelled: true, plan }, [
        'Stack prune cancelled.',
      ]);
      return;
    }
  }
  renderStackPrune(
    await client.pruneStacks({ olderThanMilliseconds, dryRun: false }),
    options.json ?? false,
  );
}

/**
 * @param {string} activationIdArgument
 * @param {{component: string, socket?: string, json?: boolean}} options
 */
export async function resolveStackEndpointsCommand(activationIdArgument, options) {
  const resolution = await clientFor(options.socket).resolveStackEndpoints(
    IdentifierSchema.parse(activationIdArgument),
    options.component,
  );
  renderOutput(options.json ?? false, 'resolution', resolution, [
    `Activation: ${resolution.activationId}`,
    `Generation: ${resolution.generationId}`,
    `Component: ${resolution.component}`,
    ...Object.entries(resolution.own).map(
      ([endpoint, value]) =>
        `own.${endpoint}  ${formatAddress(value.host)}${formatDockerAddress(value.dockerNetwork)}`,
    ),
    ...Object.entries(resolution.dependencies).map(
      ([alias, value]) =>
        `dependency.${alias} -> ${value.component}.${value.endpoint}  ${formatAddress(value.host)}${formatDockerAddress(value.dockerNetwork)}`,
    ),
  ]);
}

/**
 * @param {string} activationIdArgument
 * @param {{component: string, gatewayHost: string, file: string, socket?: string, json?: boolean}} options
 */
export async function snapshotStackEndpointsCommand(activationIdArgument, options) {
  const snapshot = await clientFor(options.socket).createStackEndpointSnapshot(
    IdentifierSchema.parse(activationIdArgument),
    { component: options.component, gatewayHost: options.gatewayHost },
  );
  const filename = await writeEndpointSnapshot(options.file, snapshot);
  renderOutput(options.json ?? false, 'result', { filename, snapshot }, [
    `Wrote endpoint snapshot ${filename}.`,
    `Activation: ${snapshot.activationId}`,
    `Generation: ${snapshot.generationId}`,
    `Component: ${snapshot.component}`,
  ]);
}

/** @param {{project?: string, stackRoot?: string, socket?: string, json?: boolean}} options */
export async function stackStatusCommand(options) {
  const client = clientFor(options.socket);
  let stackRoot;
  let stacks;
  if (options.stackRoot) {
    stackRoot = await canonicalStackRoot(options.stackRoot);
    stacks = await client.listStacks({
      stackRoot,
      ...(options.project ? { project: options.project } : {}),
    });
  } else {
    const currentDirectory = await canonicalStackRoot(process.cwd());
    const definition = await findEnclosingStackDefinition(currentDirectory);
    if (definition !== null) {
      stackRoot = definition.stackRoot;
      stacks = await client.listStacks({
        stackRoot,
        ...(options.project ? { project: options.project } : {}),
      });
    } else {
      const registered = selectRegisteredEnclosingStack(
        await client.listStacks({
          ...(options.project ? { project: options.project } : {}),
        }),
        currentDirectory,
      );
      stackRoot = registered?.stackRoot ?? currentDirectory;
      stacks = registered === null ? [] : [registered];
    }
  }
  if (stacks.length === 0) {
    setExitCode(EXIT_CODES.stateDifference);
    renderOutput(options.json ?? false, 'stack', null, [
      `No Portreeve stack is registered for ${stackRoot}.`,
    ]);
    return;
  }
  if (stacks.length > 1) {
    throw new CliUsageError(
      'More than one project stack is registered for this stack root; specify --project.',
    );
  }
  const stack = stacks[0];
  if (stack === undefined) return;
  renderStackStatus(await client.getStackStatus(stack.id), options.json ?? false);
}

/** @param {import('../../../packages/client/src/index.js').StackRecord} stack @param {boolean} json */
function renderStack(stack, json) {
  renderOutput(json, 'stack', stack, [
    `Stack: ${stack.id}`,
    `Identity: ${stackLabel(stack)}`,
    `Revision: ${stack.currentRevision}`,
    `Components: ${String(Object.keys(stack.definition.components).length)}`,
  ]);
}

/** @param {import('../../../packages/client/src/index.js').StackStatus} status @param {boolean} json */
function renderStackStatus(status, json) {
  renderOutput(json, 'status', status, [
    `Stack: ${status.stack.id}`,
    `Identity: ${stackLabel(status.stack)}`,
    `Revision: ${status.stack.currentRevision}`,
    `Generation: ${status.generation?.id ?? 'none'}${status.generation ? ` (${status.generation.state})` : ''}`,
    `Activation: ${status.activation?.id ?? 'none'}${status.activation ? ` (${status.activation.state})` : ''}`,
    ...status.providers.map(
      (provider) =>
        `${provider.component}.${provider.endpoint}  ${provider.port}  ${provider.bindingKind}  ${provider.status}  ${provider.reason}`,
    ),
  ]);
}

/** @param {import('../../../packages/client/src/index.js').StackActivation} activation @param {boolean} json */
function renderActivation(activation, json) {
  renderOutput(json, 'activation', activation, [
    `Activation: ${activation.id}`,
    `Generation: ${activation.generationId}`,
    `State: ${activation.state}`,
    ...activation.endpoints.map(
      (endpoint) =>
        `${endpoint.component}.${endpoint.endpoint}  ${endpoint.port}  ${endpoint.state}${endpoint.required ? '  required' : '  optional'}`,
    ),
  ]);
}

/** @param {import('../../../packages/client/src/index.js').StackPruneResult} result @param {boolean} json */
function renderStackPrune(result, json) {
  const lines = [];
  if (result.candidates.length === 0) {
    lines.push('No missing-stack-root stacks are eligible.');
  } else {
    lines.push(
      `${result.dryRun ? 'Would prune' : 'Eligible'} ${String(result.candidates.length)} stack(s):`,
    );
    for (const { stack } of result.candidates) {
      lines.push(`  ${stack.id}  ${stackLabel(stack)}  ${stack.stackRoot}`);
    }
  }
  for (const blocker of result.blocked) {
    lines.push(`Blocked ${stackLabel(blocker.stack)}: ${blocker.reasons.join(', ')}`);
  }
  if (!result.dryRun) {
    lines.push(`Deleted ${String(result.deletedStackIds.length)} stack(s).`);
    if (result.skipped.length > 0) {
      lines.push(`Skipped ${String(result.skipped.length)} changed stack(s).`);
    }
  }
  renderOutput(json, 'result', result, lines);
}

/** @param {number} count @param {boolean | undefined} json */
async function confirmStackPrune(count, json) {
  const terminal = createInterface({
    input: process.stdin,
    output: json ? process.stderr : process.stdout,
  });
  try {
    const answer = await terminal.question(
      `Delete ${String(count)} eligible stack(s)? [y/N] `,
    );
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    terminal.close();
  }
}

/** @param {import('../../../packages/client/src/index.js').StackRecord} stack */
function stackLabel(stack) {
  return `${stack.project}/${stack.stackRoot}`;
}

/** @param {{transport: 'tcp', host: string, port: number}} address */
function formatAddress(address) {
  return `${address.host}:${address.port}`;
}

/** @param {{transport: 'tcp', host: string, port: number} | null} address */
function formatDockerAddress(address) {
  return address === null ? '' : `  docker ${formatAddress(address)}`;
}

/** @param {string | undefined} socketPath */
function clientFor(socketPath) {
  return new PortreeveClient({
    ...(socketPath ? { socketPath } : {}),
  });
}

/** @param {unknown} error */
function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {string} value */
function parseEndpointReference(value) {
  if (value.startsWith('{')) {
    try {
      return StackEndpointReferenceSchema.parse(JSON.parse(value));
    } catch (error) {
      throw new CliUsageError(
        `Invalid JSON endpoint reference ${value}: ${safeMessage(error)}`,
      );
    }
  }
  const separator = value.indexOf('.');
  const component = separator < 0 ? value : value.slice(0, separator);
  const endpoint = separator < 0 ? 'default' : value.slice(separator + 1);
  if (component.length === 0 || endpoint.length === 0) {
    throw new CliUsageError(`Invalid endpoint reference: ${value}.`);
  }
  return StackEndpointReferenceSchema.parse({ component, endpoint });
}

/** @param {string} filename */
async function readJson(filename) {
  const resolved = resolve(filename);
  try {
    return JSON.parse(await readFile(resolved, 'utf8'));
  } catch (error) {
    throw new CliUsageError(
      `Unable to read valid JSON from ${resolved}: ${safeMessage(error)}`,
    );
  }
}

/** @param {string} filename */
async function readLeaseCredential(filename) {
  const value = await readJson(filename);
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.leaseId !== 'string' ||
    typeof value.leaseToken !== 'string'
  ) {
    throw new CliUsageError(
      'The lease file must contain leaseId and leaseToken strings.',
    );
  }
  return { leaseId: value.leaseId, leaseToken: value.leaseToken };
}

/** @param {string} value @param {string} option */
function parsePositiveInteger(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
    throw new CliUsageError(`${option} must be a positive integer.`);
  }
  return parsed;
}
