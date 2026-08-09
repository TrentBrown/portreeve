// @ts-check

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PortreeveClientError } from '../../packages/client/src/index.js';
import { canonicalLauncherRoot } from '../launcher/document.js';
import { normalizeStackDefinition } from '../stacks/definition.js';
import { CliUsageError } from './exit.js';
import {
  DEFAULT_STACK_DEFINITION,
  findEnclosingStackDefinition,
} from './stack-selection.js';

/** @param {{stackRoot?: string, cwd?: string}} options */
export async function selectLauncherRoot(options) {
  if (options.stackRoot !== undefined) {
    try {
      return await canonicalLauncherRoot(
        resolve(options.cwd ?? process.cwd(), options.stackRoot),
      );
    } catch (error) {
      throw usageFrom(error, `Unable to use stack root ${options.stackRoot}`);
    }
  }
  const discovered = await findEnclosingStackDefinition(options.cwd ?? process.cwd());
  if (discovered !== null) return discovered.stackRoot;
  throw new CliUsageError(
    `No enclosing ${DEFAULT_STACK_DEFINITION} was found. Run from inside a stack or pass --stack-root.`,
  );
}

/** @param {string} stackRoot */
export async function readLocalStackDefinition(stackRoot) {
  const filename = resolve(stackRoot, DEFAULT_STACK_DEFINITION);
  try {
    const input = JSON.parse(await readFile(filename, 'utf8'));
    return { filename, ...normalizeStackDefinition(input) };
  } catch (error) {
    throw usageFrom(error, `Unable to read a valid stack definition from ${filename}`);
  }
}

/**
 * Resolve the one applied stack. A fresh CLI may fall back to a cached nonsecret
 * StackRecord only after the daemon is proven unavailable.
 *
 * @param {string} stackRoot
 * @param {{listStacks: Function}} client
 * @param {{read: Function}} stateStore
 * @param {{allowCached?: boolean}} [options]
 */
export async function selectAppliedLauncherStack(
  stackRoot,
  client,
  stateStore,
  options = {},
) {
  try {
    const stacks = await client.listStacks({ stackRoot });
    if (stacks.length === 0) {
      throw new CliUsageError(
        `No applied PortReeve stack is registered for ${stackRoot}. Apply the stack before using its launcher.`,
      );
    }
    if (stacks.length > 1) {
      throw new CliUsageError(
        `More than one applied stack is registered for ${stackRoot}; launcher selection is ambiguous.`,
      );
    }
    return { stack: stacks[0], source: /** @type {const} */ ('daemon') };
  } catch (error) {
    if (!isUnavailable(error) || options.allowCached !== true) throw error;
    const entry = (await stateStore.read()).launchers.find(
      (/** @type {any} */ candidate) => candidate.stackRoot === stackRoot,
    );
    if (entry?.cache?.stack === undefined) {
      throw new PortreeveClientError(
        `The PortReeve service is unavailable and no cached applied-stack snapshot exists for ${stackRoot}. Restore the service and run a launcher operation once to establish degraded context.`,
        {
          code: 'unavailable',
          retryable: true,
          details: { cause: 'launcher_cached_stack_missing', stackRoot },
        },
      );
    }
    return { stack: entry.cache.stack, source: /** @type {const} */ ('cache') };
  }
}

/** @param {unknown} error @param {string} prefix */
function usageFrom(error, prefix) {
  return new CliUsageError(
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
    error !== null && typeof error === 'object' && 'code' in error
      ? { cause: error.code }
      : {},
  );
}

/** @param {unknown} error */
function isUnavailable(error) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'unavailable'
  );
}
