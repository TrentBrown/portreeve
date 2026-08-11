// @ts-check

import { createHash, randomUUID } from 'node:crypto';
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
import { basename, dirname, join } from 'node:path';
import { StackDefinitionSchema } from '../protocol/schemas.js';
import { normalizeStackDefinition } from './definition.js';

export const STACK_DEFINITION_FILENAME = 'portreeve.stack.json';
export const MAX_STACK_DEFINITION_BYTES = 1_048_576;

export class StackDocumentError extends Error {
  /** @param {string} code @param {string} message @param {Record<string, unknown>} [details] */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StackDocumentError';
    this.code = code;
    this.details = details;
  }
}

/** @param {string} input */
export async function canonicalStackDocumentRoot(input) {
  try {
    const root = await realpath(input);
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory');
    return root;
  } catch {
    throw new StackDocumentError(
      'invalid_stack_root',
      'The stack root must be an existing directory.',
      { stackRoot: input },
    );
  }
}

/** @param {string} stackRoot */
export function stackDocumentPath(stackRoot) {
  return join(stackRoot, STACK_DEFINITION_FILENAME);
}

/** @param {unknown} value */
export function validateStackDefinition(value) {
  const parsed = StackDefinitionSchema.safeParse(value);
  if (!parsed.success) {
    return {
      valid: false,
      definition: null,
      revision: null,
      issues: parsed.error.issues.map((entry) => ({
        code: 'invalid_definition',
        message: entry.message,
        path: entry.path.map(String),
      })),
    };
  }
  const normalized = normalizeStackDefinition(parsed.data);
  return {
    valid: true,
    definition: normalized.definition,
    revision: normalized.revision,
    issues: [],
  };
}

/** @param {string} content @param {number} [maxBytes] */
export function parseStackDocument(content, maxBytes = MAX_STACK_DEFINITION_BYTES) {
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    return invalidDocument(
      'definition_too_large',
      'The stack definition is too large.',
    );
  }
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    return invalidDocument('invalid_json', 'The stack definition is not valid JSON.');
  }
  return validateStackDefinition(value);
}

/**
 * Inspect only the fixed canonical stack document. lstat deliberately refuses
 * symlinks and other non-regular targets.
 *
 * @param {string} requestedRoot
 * @param {number} [maxBytes]
 */
export async function inspectStackDocument(
  requestedRoot,
  maxBytes = MAX_STACK_DEFINITION_BYTES,
) {
  const stackRoot = await canonicalStackDocumentRoot(requestedRoot);
  const path = stackDocumentPath(stackRoot);
  const observed = await inspectPath(path, maxBytes);
  if (observed.kind !== 'regular') {
    return {
      stackRoot,
      stackRootName: basename(stackRoot),
      path,
      ...observed,
      definition: null,
      revision: null,
      issues:
        observed.kind === 'missing'
          ? []
          : [
              {
                code:
                  observed.kind === 'oversized'
                    ? 'definition_too_large'
                    : 'definition_not_regular',
                message:
                  observed.kind === 'oversized'
                    ? 'The stack definition is too large.'
                    : 'The stack definition path is not a regular file.',
                path: [],
              },
            ],
    };
  }
  const parsed = parseStackDocument(observed.content, maxBytes);
  return {
    stackRoot,
    stackRootName: basename(stackRoot),
    path,
    ...observed,
    definition: parsed.definition,
    revision: parsed.revision,
    issues: parsed.issues,
  };
}

/**
 * Atomically create or replace the fixed stack document after exact fingerprint
 * comparison. A null expected fingerprint means the path must still be absent.
 *
 * @param {{stackRoot: string, content: string, expectedFingerprint: string|null, maxBytes?: number}} input
 */
export async function writeStackDocument(input) {
  const maxBytes = input.maxBytes ?? MAX_STACK_DEFINITION_BYTES;
  const parsed = parseStackDocument(input.content, maxBytes);
  if (!parsed.valid) {
    throw new StackDocumentError(
      'invalid_stack_definition',
      'The stack definition is invalid.',
      { issues: parsed.issues },
    );
  }
  const before = await inspectStackDocument(input.stackRoot, maxBytes);
  if (before.kind === 'non-regular' || before.kind === 'oversized') {
    throw new StackDocumentError(
      before.kind === 'oversized'
        ? 'stack_definition_too_large'
        : 'stack_definition_not_regular',
      before.kind === 'oversized'
        ? 'The existing stack definition is too large to replace safely.'
        : 'The stack definition path is not a regular file.',
      { path: before.path },
    );
  }
  if (before.fingerprint !== input.expectedFingerprint) {
    throw new StackDocumentError(
      'stack_definition_changed',
      'The stack definition changed after preview.',
      {
        expectedFingerprint: input.expectedFingerprint,
        actualFingerprint: before.fingerprint,
      },
    );
  }
  if (before.kind === 'missing') {
    await exclusiveWrite(before.path, input.content);
  } else {
    await atomicReplace(
      before.path,
      input.content,
      before.mode ?? 0o644,
      before.fingerprint,
      maxBytes,
    );
  }
  const after = await inspectStackDocument(before.stackRoot, maxBytes);
  const expected = fingerprint(input.content);
  if (after.kind !== 'regular' || after.fingerprint !== expected) {
    throw new StackDocumentError(
      'stack_definition_verification_failed',
      'The saved stack definition could not be verified.',
      { path: before.path },
    );
  }
  return after;
}

/** @param {string} path @param {number} maxBytes */
async function inspectPath(path, maxBytes) {
  let entry;
  try {
    entry = await lstat(path);
  } catch (error) {
    if (isCode(error, 'ENOENT')) {
      return {
        kind: /** @type {const} */ ('missing'),
        fingerprint: null,
        mode: null,
      };
    }
    throw new StackDocumentError(
      'stack_definition_read_failed',
      'The stack definition could not be inspected.',
      { path },
    );
  }
  if (!entry.isFile()) {
    return {
      kind: /** @type {const} */ ('non-regular'),
      fingerprint: metadataFingerprint(entry),
      mode: entry.mode & 0o777,
    };
  }
  if (entry.size > maxBytes) {
    return {
      kind: /** @type {const} */ ('oversized'),
      fingerprint: metadataFingerprint(entry),
      mode: entry.mode & 0o777,
    };
  }
  let content;
  try {
    content = await readFile(path, 'utf8');
  } catch {
    throw new StackDocumentError(
      'stack_definition_read_failed',
      'The stack definition could not be read.',
      { path },
    );
  }
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    return {
      kind: /** @type {const} */ ('oversized'),
      fingerprint: fingerprint(content),
      mode: entry.mode & 0o777,
    };
  }
  return {
    kind: /** @type {const} */ ('regular'),
    fingerprint: fingerprint(content),
    mode: entry.mode & 0o777,
    content,
  };
}

/** @param {string} path @param {string} content */
async function exclusiveWrite(path, content) {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeSynced(temporary, content, 0o644);
    try {
      await link(temporary, path);
    } catch (error) {
      if (isCode(error, 'EEXIST')) {
        throw new StackDocumentError(
          'stack_definition_changed',
          'The stack definition appeared while it was being saved.',
          { expectedFingerprint: null },
        );
      }
      throw error;
    }
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

/** @param {string} path @param {string} content @param {number} mode @param {string|null} expectedFingerprint @param {number} maxBytes */
async function atomicReplace(path, content, mode, expectedFingerprint, maxBytes) {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeSynced(temporary, content, mode);
    const current = await inspectPath(path, maxBytes);
    if (current.fingerprint !== expectedFingerprint) {
      throw new StackDocumentError(
        'stack_definition_changed',
        'The stack definition changed while it was being saved.',
        { expectedFingerprint, actualFingerprint: current.fingerprint },
      );
    }
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

/** @param {string} path @param {string} content @param {number} mode */
async function writeSynced(path, content, mode) {
  const handle = await open(path, 'wx', mode);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** @param {string} content */
export function fingerprintStackDocument(content) {
  return fingerprint(content);
}

/** @param {string} content */
function fingerprint(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** @param {{dev: number|bigint, ino: number|bigint, mode: number, size: number|bigint, mtimeMs: number}} entry */
function metadataFingerprint(entry) {
  return `metadata:${String(entry.dev)}:${String(entry.ino)}:${String(entry.mode)}:${String(entry.size)}:${String(entry.mtimeMs)}`;
}

/** @param {string} code @param {string} message */
function invalidDocument(code, message) {
  return {
    valid: false,
    definition: null,
    revision: null,
    issues: [{ code, message, path: [] }],
  };
}

/** @param {unknown} error @param {string} code */
function isCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code;
}
