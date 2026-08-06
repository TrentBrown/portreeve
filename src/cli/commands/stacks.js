// @ts-check

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  PortreeveClient,
  canonicalWorkspaceRoot,
} from '../../../packages/client/src/index.js';
import { IdentifierSchema } from '../../protocol/schemas.js';
import { EXIT_CODES } from '../../protocol/constants.js';
import { CliUsageError, setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';

export const DEFAULT_STACK_DEFINITION = 'portreeve.stack.json';

/** @param {{file?: string, socket?: string, json?: boolean}} options */
export async function applyStackCommand(options) {
  const filename = options.file
    ? resolve(options.file)
    : join(await canonicalWorkspaceRoot(process.cwd()), DEFAULT_STACK_DEFINITION);
  let definition;
  try {
    definition = JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    throw new CliUsageError(
      `Unable to read a valid stack definition from ${filename}: ${safeMessage(error)}`,
    );
  }
  const result = await clientFor(options.socket).applyStack({
    workspaceRoot: dirname(filename),
    definition,
  });
  if (!result.changed) setExitCode(EXIT_CODES.stateDifference);
  renderOutput(options.json ?? false, 'result', result, [
    `${result.changed ? 'Applied' : 'Unchanged'} ${stackLabel(result.stack)} at revision ${result.stack.currentRevision}.`,
  ]);
}

/** @param {{project?: string, workspace?: string, socket?: string, json?: boolean}} options */
export async function listStacksCommand(options) {
  const stacks = await clientFor(options.socket).listStacks({
    ...(options.project ? { project: options.project } : {}),
    ...(options.workspace ? { workspaceRoot: options.workspace } : {}),
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

/** @param {{project?: string, workspace?: string, socket?: string, json?: boolean}} options */
export async function stackStatusCommand(options) {
  const workspaceRoot = await canonicalWorkspaceRoot(
    options.workspace ?? process.cwd(),
  );
  const stacks = await clientFor(options.socket).listStacks({
    workspaceRoot,
    ...(options.project ? { project: options.project } : {}),
  });
  if (stacks.length === 0) {
    setExitCode(EXIT_CODES.stateDifference);
    renderOutput(options.json ?? false, 'stack', null, [
      `No Portreeve stack is registered for ${workspaceRoot}.`,
    ]);
    return;
  }
  if (stacks.length > 1) {
    throw new CliUsageError(
      'More than one project stack is registered for this worktree; specify --project.',
    );
  }
  const stack = stacks[0];
  if (stack === undefined) return;
  renderStack(stack, options.json ?? false);
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

/** @param {import('../../../packages/client/src/index.js').StackRecord} stack */
function stackLabel(stack) {
  return `${stack.project}/${stack.workspaceRoot}`;
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
