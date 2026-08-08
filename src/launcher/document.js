// @ts-check

import { randomUUID } from 'node:crypto';
import {
  link,
  lstat,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  LAUNCHER_DEFINITION_FILENAME,
  MAX_LAUNCHER_DEFINITION_BYTES,
  launcherRevision,
  normalizeLauncherDefinition,
  validateLauncherTopology,
} from './definition.js';

/** @param {string} candidate */
export async function canonicalLauncherRoot(candidate) {
  const canonical = await realpath(candidate);
  const entry = await stat(canonical);
  if (!entry.isDirectory()) throw launcherDocumentError('invalid_stack_root');
  return canonical;
}

/** @param {string} stackRoot @param {string} workingDirectory */
export async function resolveLauncherWorkingDirectory(stackRoot, workingDirectory) {
  const canonicalRoot = await canonicalLauncherRoot(stackRoot);
  if (isAbsolute(workingDirectory)) {
    throw launcherDocumentError('working_directory_outside_stack');
  }
  const canonicalWorkingDirectory = await realpath(
    resolve(canonicalRoot, workingDirectory),
  );
  const entry = await stat(canonicalWorkingDirectory);
  if (!entry.isDirectory() || !containsPath(canonicalRoot, canonicalWorkingDirectory)) {
    throw launcherDocumentError('working_directory_outside_stack');
  }
  return canonicalWorkingDirectory;
}

/** @param {string} stackRoot @param {{stackDefinition?: unknown, maxBytes?: number}} [options] */
export async function readLauncherDocument(stackRoot, options = {}) {
  const canonicalRoot = await canonicalLauncherRoot(stackRoot);
  const filename = join(canonicalRoot, LAUNCHER_DEFINITION_FILENAME);
  const observed = await inspectLauncherFile(filename, options.maxBytes);
  if (observed.kind === 'missing') {
    throw launcherDocumentError('launcher_definition_missing');
  }
  if (observed.kind !== 'regular') {
    throw launcherDocumentError(`launcher_definition_${observed.kind}`);
  }
  let input;
  try {
    input = JSON.parse(observed.content);
  } catch {
    throw launcherDocumentError('invalid_launcher_json');
  }
  const normalized = normalizeLauncherDefinition(input);
  if (options.stackDefinition !== undefined) {
    validateLauncherTopology(normalized.definition, options.stackDefinition);
  }
  const workingDirectory = await resolveLauncherWorkingDirectory(
    canonicalRoot,
    normalized.definition.workingDirectory,
  );
  return Object.freeze({
    stackRoot: canonicalRoot,
    filename,
    workingDirectory,
    definition: normalized.definition,
    sourceContent: observed.content,
    canonicalContent: normalized.content,
    revision: launcherRevision(observed.content),
  });
}

/** @param {string} stackRoot @param {unknown} input @param {{stackDefinition?: unknown}} [options] */
export async function createLauncherDocument(stackRoot, input, options = {}) {
  const canonicalRoot = await canonicalLauncherRoot(stackRoot);
  const normalized = normalizeLauncherDefinition(input);
  if (options.stackDefinition !== undefined) {
    validateLauncherTopology(normalized.definition, options.stackDefinition);
  }
  await resolveLauncherWorkingDirectory(
    canonicalRoot,
    normalized.definition.workingDirectory,
  );
  const filename = join(canonicalRoot, LAUNCHER_DEFINITION_FILENAME);
  const temporary = join(dirname(filename), `.${randomUUID()}.tmp`);
  try {
    await writeSynced(temporary, normalized.content, 0o644);
    await link(temporary, filename);
  } catch (error) {
    if (hasCode(error, 'EEXIST'))
      throw launcherDocumentError('launcher_definition_exists');
    throw error;
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return readLauncherDocument(canonicalRoot);
}

/** @param {string} stackRoot @param {unknown} input @param {string} expectedRevision @param {{stackDefinition?: unknown}} [options] */
export async function replaceLauncherDocument(
  stackRoot,
  input,
  expectedRevision,
  options = {},
) {
  const canonicalRoot = await canonicalLauncherRoot(stackRoot);
  const normalized = normalizeLauncherDefinition(input);
  if (options.stackDefinition !== undefined) {
    validateLauncherTopology(normalized.definition, options.stackDefinition);
  }
  await resolveLauncherWorkingDirectory(
    canonicalRoot,
    normalized.definition.workingDirectory,
  );
  const filename = join(canonicalRoot, LAUNCHER_DEFINITION_FILENAME);
  const current = await inspectLauncherFile(filename);
  if (
    current.kind !== 'regular' ||
    launcherRevision(current.content) !== expectedRevision
  ) {
    throw launcherDocumentError('launcher_definition_changed');
  }
  const temporary = join(dirname(filename), `.${randomUUID()}.tmp`);
  try {
    await writeSynced(temporary, normalized.content, current.mode);
    const rechecked = await inspectLauncherFile(filename);
    if (
      rechecked.kind !== 'regular' ||
      launcherRevision(rechecked.content) !== expectedRevision
    ) {
      throw launcherDocumentError('launcher_definition_changed');
    }
    await rename(temporary, filename);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return readLauncherDocument(canonicalRoot);
}

/** @param {string} filename @param {number} [maxBytes] */
export async function inspectLauncherFile(
  filename,
  maxBytes = MAX_LAUNCHER_DEFINITION_BYTES,
) {
  let entry;
  try {
    entry = await lstat(filename);
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return { kind: /** @type {const} */ ('missing') };
    throw error;
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    return { kind: /** @type {const} */ ('not_regular') };
  }
  if (entry.size > maxBytes) return { kind: /** @type {const} */ ('too_large') };
  const content = await readFile(filename, 'utf8');
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    return { kind: /** @type {const} */ ('too_large') };
  }
  return { kind: /** @type {const} */ ('regular'), content, mode: entry.mode & 0o777 };
}

/** @param {string} root @param {string} candidate */
function containsPath(root, candidate) {
  const child = relative(root, candidate);
  return (
    child === '' ||
    (!isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`))
  );
}

/** @param {string} filename @param {string} content @param {number} mode */
async function writeSynced(filename, content, mode) {
  const handle = await open(filename, 'wx', mode);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** @param {string} code */
function launcherDocumentError(code) {
  /** @type {Record<string, string>} */
  const messages = {
    invalid_stack_root: 'The stack root must be an existing directory.',
    working_directory_outside_stack:
      'The launcher working directory must resolve inside the stack root.',
    launcher_definition_missing: 'The launcher definition does not exist.',
    launcher_definition_not_regular: 'The launcher definition is not a regular file.',
    launcher_definition_too_large: 'The launcher definition is too large.',
    launcher_definition_exists: 'The launcher definition already exists.',
    launcher_definition_changed: 'The launcher definition changed before it was saved.',
    invalid_launcher_json: 'The launcher definition is not valid JSON.',
  };
  const error = new Error(messages[code] ?? 'The launcher definition is invalid.');
  Object.assign(error, { code });
  return error;
}

/** @param {unknown} error @param {string} code */
function hasCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code;
}
