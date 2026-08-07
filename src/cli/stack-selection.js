// @ts-check

import { stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { canonicalStackRoot } from '../../packages/client/src/index.js';
import { CliUsageError } from './exit.js';

export const DEFAULT_STACK_DEFINITION = 'portreeve.stack.json';

/**
 * Resolve the definition and root selected for an apply operation.
 *
 * @param {{file?: string, stackRoot?: string, cwd?: string}} options
 */
export async function selectStackDefinition(options) {
  const cwd = options.cwd ?? process.cwd();
  if (options.file && options.stackRoot) {
    throw new CliUsageError('--file and --stack-root cannot be used together.');
  }

  if (options.file) {
    const filename = resolve(cwd, options.file);
    return {
      filename,
      stackRoot: await canonicalStackRootForCli(dirname(filename)),
    };
  }

  if (options.stackRoot) {
    const stackRoot = await canonicalStackRootForCli(resolve(cwd, options.stackRoot));
    return {
      filename: join(stackRoot, DEFAULT_STACK_DEFINITION),
      stackRoot,
    };
  }

  const discovered = await findEnclosingStackDefinition(cwd);
  if (discovered !== null) return discovered;

  throw new CliUsageError(
    `No enclosing ${DEFAULT_STACK_DEFINITION} was found. Run from inside a stack or pass --file or --stack-root.`,
  );
}

/**
 * Find the nearest definition while walking from the current real directory to
 * the filesystem root. Git repository boundaries do not affect this search.
 *
 * @param {string} startPath
 * @returns {Promise<{filename: string, stackRoot: string} | null>}
 */
export async function findEnclosingStackDefinition(startPath) {
  let stackRoot = await canonicalStackRootForCli(startPath);
  while (true) {
    const filename = join(stackRoot, DEFAULT_STACK_DEFINITION);
    try {
      const entry = await stat(filename);
      if (!entry.isFile()) {
        throw new CliUsageError(`${filename} exists but is not a file.`);
      }
      return { filename, stackRoot };
    } catch (error) {
      if (!isMissingPathError(error)) {
        if (error instanceof CliUsageError) throw error;
        throw new CliUsageError(`Unable to inspect ${filename}: ${safeMessage(error)}`);
      }
    }

    const parent = dirname(stackRoot);
    if (parent === stackRoot) return null;
    stackRoot = parent;
  }
}

/**
 * Select the registered stack whose root contains the current real directory.
 * Valid Portreeve state permits at most one such root because registered roots
 * may not overlap.
 *
 * @template {{stackRoot: string}} T
 * @param {T[]} stacks
 * @param {string} currentDirectory
 * @returns {T | null}
 */
export function selectRegisteredEnclosingStack(stacks, currentDirectory) {
  const matches = stacks.filter(({ stackRoot }) =>
    containsPath(stackRoot, currentDirectory),
  );
  if (matches.length > 1) {
    throw new CliUsageError(
      `More than one registered stack root encloses ${currentDirectory}; Portreeve data violates the non-overlapping-root invariant.`,
    );
  }
  return matches[0] ?? null;
}

/** @param {string} root @param {string} candidate */
function containsPath(root, candidate) {
  const childPath = relative(root, candidate);
  return (
    childPath === '' ||
    (!isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`))
  );
}

/** @param {string} stackPath */
async function canonicalStackRootForCli(stackPath) {
  try {
    return await canonicalStackRoot(stackPath);
  } catch (error) {
    throw new CliUsageError(
      `Unable to use stack root ${stackPath}: ${safeMessage(error)}`,
    );
  }
}

/** @param {unknown} error */
function isMissingPathError(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

/** @param {unknown} error */
function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
