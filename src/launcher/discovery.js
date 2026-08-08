// @ts-check

import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { StackDefinitionSchema } from '../protocol/schemas.js';

const OPERATIONS = /** @type {const} */ (['start', 'stop', 'restart', 'status']);
const PACKAGE_LOCKS = Object.freeze([
  ['bun.lock', 'bun run'],
  ['bun.lockb', 'bun run'],
  ['package-lock.json', 'npm run'],
  ['pnpm-lock.yaml', 'pnpm run'],
  ['yarn.lock', 'yarn run'],
]);
const COMPOSE_FILES = Object.freeze([
  'compose.yaml',
  'compose.yml',
  'docker-compose.yaml',
  'docker-compose.yml',
]);

/** @param {string} workingDirectory */
export async function discoverLauncherCommands(workingDirectory) {
  /** @type {Record<(typeof OPERATIONS)[number], any[]>} */
  const candidates = { start: [], stop: [], restart: [], status: [] };
  const inspectedFiles = [];

  const packageFilename = join(workingDirectory, 'package.json');
  const packageContent = await optionalFile(packageFilename);
  if (packageContent !== null) {
    inspectedFiles.push(packageFilename);
    let packageDefinition = null;
    try {
      packageDefinition = JSON.parse(packageContent);
    } catch {
      // An invalid manifest is visible through inspectedFiles but never executed or guessed.
    }
    if (packageDefinition !== null) {
      const runner = await packageRunner(workingDirectory, packageDefinition);
      for (const operation of OPERATIONS) {
        if (
          typeof packageDefinition.scripts?.[operation] === 'string' &&
          packageDefinition.scripts[operation].trim() !== ''
        ) {
          candidates[operation].push(
            suggestion(
              `${runner} ${operation}`,
              'package-script',
              packageFilename,
              operation,
            ),
          );
        }
      }
    }
  }

  for (const makefile of ['Makefile', 'makefile']) {
    const filename = join(workingDirectory, makefile);
    const content = await optionalFile(filename);
    if (content === null) continue;
    inspectedFiles.push(filename);
    const targets = exactMakeTargets(content);
    for (const operation of OPERATIONS) {
      if (targets.has(operation)) {
        candidates[operation].push(
          suggestion(`make ${operation}`, 'make-target', filename, operation),
        );
      }
    }
    break;
  }

  for (const composeFile of COMPOSE_FILES) {
    const filename = join(workingDirectory, composeFile);
    if (!(await isFile(filename))) continue;
    inspectedFiles.push(filename);
    const commands = {
      start: 'docker compose up -d',
      stop: 'docker compose down',
      restart: 'docker compose restart',
      status: 'docker compose ps',
    };
    for (const operation of OPERATIONS) {
      candidates[operation].push(
        suggestion(commands[operation], 'docker-compose', filename, operation),
      );
    }
  }

  return Object.freeze({
    inspectedFiles: inspectedFiles.sort(),
    operations: {
      start: operationResult(candidates.start),
      stop: operationResult(candidates.stop),
      restart: operationResult(candidates.restart),
      status: operationResult(candidates.status),
    },
  });
}

/** @param {unknown} stackInput */
export function suggestLauncherEnvironment(stackInput) {
  const stack = StackDefinitionSchema.parse(stackInput);
  const mappings = [];
  const names = new Set();
  for (const [componentName, component] of Object.entries(stack.components)) {
    for (const [endpointName, endpoint] of Object.entries(component.endpoints)) {
      if (!endpoint.publish) continue;
      const name = environmentName(componentName, endpointName);
      if (names.has(name)) {
        throw discoveryError(
          `Endpoint environment suggestions collide at ${name}; rename the mappings explicitly.`,
        );
      }
      names.add(name);
      mappings.push({
        name,
        endpoint: { component: componentName, endpoint: endpointName },
        value: /** @type {const} */ ('host-port'),
      });
    }
  }
  return mappings;
}

/** @param {string} component @param {string} endpoint */
export function environmentName(component, endpoint) {
  const parts = endpoint === 'default' ? [component] : [component, endpoint];
  return `${parts.map(normalizeNamePart).join('_')}_PORT`;
}

/** @param {string} value */
function normalizeNamePart(value) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return normalized === '' || /^\d/.test(normalized) ? `_${normalized}` : normalized;
}

/** @param {string} directory @param {any} packageDefinition */
async function packageRunner(directory, packageDefinition) {
  const declared =
    typeof packageDefinition.packageManager === 'string'
      ? packageDefinition.packageManager.split('@')[0]
      : null;
  if (['bun', 'npm', 'pnpm', 'yarn'].includes(declared)) return `${declared} run`;
  const present = [];
  for (const entry of PACKAGE_LOCKS) {
    const filename = entry[0];
    const runner = entry[1];
    if (filename === undefined || runner === undefined) continue;
    if (await isFile(join(directory, filename))) present.push(runner);
  }
  return new Set(present).size === 1 ? (present[0] ?? 'npm run') : 'npm run';
}

/** @param {any[]} candidates */
function operationResult(candidates) {
  return {
    suggestion: candidates.length === 1 ? candidates[0] : null,
    candidates,
  };
}

/** @param {string} content */
function exactMakeTargets(content) {
  const targets = new Set();
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_.-]+)\s*:(?![=])/.exec(line);
    if (match?.[1] !== undefined && !match[1].includes('%')) targets.add(match[1]);
  }
  return targets;
}

/** @param {string} command @param {string} kind @param {string} filename @param {string} detail */
function suggestion(command, kind, filename, detail) {
  return Object.freeze({
    command,
    provenance: { kind, filename: basename(filename), detail },
  });
}

/** @param {string} filename */
async function optionalFile(filename) {
  try {
    return await readFile(filename, 'utf8');
  } catch (error) {
    if (hasCode(error, 'ENOENT') || hasCode(error, 'ENOTDIR')) return null;
    throw error;
  }
}

/** @param {string} filename */
async function isFile(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch (error) {
    if (hasCode(error, 'ENOENT') || hasCode(error, 'ENOTDIR')) return false;
    throw error;
  }
}

/** @param {string} message */
function discoveryError(message) {
  const error = new Error(message);
  Object.assign(error, { code: 'launcher_environment_name_collision' });
  return error;
}

/** @param {unknown} error @param {string} code */
function hasCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code;
}
