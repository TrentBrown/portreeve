// @ts-check

import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { canonicalStackRoot } from 'portreeve';
import {
  StackApplyResponseSchema,
  StackDefinitionSchema,
  StackListSchema,
  StackRecordSchema,
} from '../../../src/protocol/schemas.js';

export const STACK_DEFINITION_FILENAME = 'portreeve.stack.json';
export const MAX_STACK_DEFINITION_BYTES = 1_048_576;

/**
 * Own the fixed stack-definition path and every filesystem mutation in the
 * trusted main process. Renderer callers receive only opaque document and
 * conflict capabilities.
 *
 * @param {{
 *   listStacks(): Promise<unknown>,
 *   getStack(stackId: string): Promise<unknown>,
 *   applyStack(input: {stackRoot: string, definition: unknown}): Promise<unknown>
 * }} client
 * @param {{selectStackRoot(): Promise<string|null>, maxBytes?: number}} options
 */
export function createStackDocumentService(client, options) {
  const maxBytes = options.maxBytes ?? MAX_STACK_DEFINITION_BYTES;
  /** @type {Map<string, any>} */
  const sessions = new Map();
  /** @type {Map<string, ReturnType<typeof StackRecordSchema.parse>>} */
  const knownStacks = new Map();

  /** @param {unknown} value */
  function rememberStack(value) {
    const stack = StackRecordSchema.parse(value);
    knownStacks.set(stack.id, stack);
    return stack;
  }

  async function refreshKnownStacks() {
    try {
      const stacks = StackListSchema.parse(await client.listStacks());
      for (const stack of stacks) knownStacks.set(stack.id, stack);
    } catch {
      // File authoring remains available when the PortReeve daemon is absent.
    }
  }

  /** @param {string} selectedPath */
  async function resolveSelectedRoot(selectedPath) {
    const selectedRoot = await canonicalRoot(selectedPath);
    await refreshKnownStacks();
    const definitionRoot = await findEnclosingDefinitionRoot(selectedRoot);
    if (definitionRoot !== null) {
      return {
        stackRoot: definitionRoot,
        stack: stackAtRoot(knownStacks.values(), definitionRoot),
      };
    }
    const stack = enclosingStack(knownStacks.values(), selectedRoot);
    return {
      stackRoot: stack?.stackRoot ?? selectedRoot,
      stack,
    };
  }

  /** @param {string} stackId */
  async function resolveKnownStack(stackId) {
    try {
      return rememberStack(await client.getStack(stackId));
    } catch {
      const cached = knownStacks.get(stackId);
      if (cached !== undefined) return cached;
      throw documentError(
        'stack_definition_unavailable',
        'The selected stack definition is unavailable.',
      );
    }
  }

  /** @param {string} stackRoot @param {ReturnType<typeof StackRecordSchema.parse>|null} stack */
  async function openDocument(stackRoot, stack) {
    const filename = join(stackRoot, STACK_DEFINITION_FILENAME);
    const observed = await inspectDefinition(filename, maxBytes);
    const documentId = randomUUID();
    const loaded = parseObservedDefinition(observed);
    const definition = loaded.definition ?? (stack === null ? null : stack.definition);
    const seedSource =
      loaded.definition !== null ? 'file' : stack === null ? 'new' : 'applied';
    sessions.set(documentId, {
      documentId,
      stackRoot,
      filename,
      stackId: stack?.id ?? null,
      fileState: loaded.fileState,
      baselineEvidence: observed.evidence,
      pendingConflict: null,
      lastSaved: null,
    });
    return {
      schemaVersion: 1,
      documentId,
      stackId: stack?.id ?? null,
      stackRootName: basename(stackRoot),
      fileState: loaded.fileState,
      seedSource,
      definition,
      suggestedProject: basename(stackRoot),
      issues: loaded.issues,
    };
  }

  /** @param {string} documentId @param {string} content @param {string|null|undefined} conflictToken */
  async function save(documentId, content, conflictToken) {
    const session = requireSession(sessions, documentId);
    const candidate = parseCandidate(content, maxBytes);
    if (candidate.definition === null) {
      return mutationResult(session, {
        outcome: 'invalid',
        saved: false,
        applied: false,
        changed: null,
        message: 'The stack definition is not valid and was not saved.',
        issues: candidate.issues,
      });
    }

    let current = await inspectDefinition(session.filename, maxBytes);
    if (current.kind === 'non-regular' || current.kind === 'oversized') {
      return unsupportedTargetResult(session, current.kind);
    }
    const conflictReason = saveConflictReason(session, current.evidence);
    const authorized =
      conflictReason === null ||
      (session.pendingConflict !== null &&
        conflictToken === session.pendingConflict.token &&
        current.evidence === session.pendingConflict.evidence);
    if (!authorized) {
      return conflictResult(session, current.evidence, conflictReason);
    }

    try {
      if (current.kind === 'missing') {
        await exclusiveWrite(session.filename, content);
      } else {
        await atomicReplace(
          session.filename,
          content,
          current.mode ?? 0o644,
          current.evidence,
          maxBytes,
        );
      }
    } catch (error) {
      if (isCode(error, 'EEXIST')) {
        current = await inspectDefinition(session.filename, maxBytes);
        return conflictResult(session, current.evidence, 'appeared-after-open');
      }
      if (isCode(error, 'stack_definition_changed_during_save')) {
        current = await inspectDefinition(session.filename, maxBytes);
        return current.kind === 'non-regular' || current.kind === 'oversized'
          ? unsupportedTargetResult(session, current.kind)
          : conflictResult(
              session,
              current.evidence,
              saveConflictReason(session, current.evidence),
            );
      }
      return mutationResult(session, {
        outcome: 'failed',
        saved: false,
        applied: false,
        changed: null,
        message: 'The stack definition could not be saved.',
        error: {
          code: 'stack_definition_write_failed',
          message: 'The stack definition could not be saved.',
        },
      });
    }

    const written = await inspectDefinition(session.filename, maxBytes);
    if (written.kind !== 'regular' || written.evidence !== fingerprint(content)) {
      return mutationResult(session, {
        outcome: 'failed',
        saved: false,
        applied: false,
        changed: null,
        message: 'The saved stack definition could not be verified.',
        error: {
          code: 'stack_definition_verification_failed',
          message: 'The saved stack definition could not be verified.',
        },
      });
    }
    session.fileState = 'valid';
    session.baselineEvidence = written.evidence;
    session.pendingConflict = null;
    session.lastSaved = {
      evidence: written.evidence,
      definition: candidate.definition,
    };
    return applySaved(session, candidate.definition, 'saved-and-applied');
  }

  /** @param {string} documentId */
  async function retryApply(documentId) {
    const session = requireSession(sessions, documentId);
    if (session.lastSaved === null) {
      return mutationResult(session, {
        outcome: 'failed',
        saved: false,
        applied: false,
        changed: null,
        message: 'No saved stack definition is available to retry.',
        error: {
          code: 'no_saved_stack_definition',
          message: 'No saved stack definition is available to retry.',
        },
      });
    }
    const current = await inspectDefinition(session.filename, maxBytes);
    if (current.evidence !== session.lastSaved.evidence) {
      return mutationResult(session, {
        outcome: 'conflict',
        saved: true,
        applied: false,
        changed: null,
        message:
          'The stack definition changed after it was saved; reopen it before applying.',
        conflict: { reason: 'changed-before-retry', token: null },
      });
    }
    return applySaved(session, session.lastSaved.definition, 'applied');
  }

  /** @param {any} session @param {unknown} definition @param {'saved-and-applied'|'applied'} successOutcome */
  async function applySaved(session, definition, successOutcome) {
    try {
      const result = StackApplyResponseSchema.parse(
        await client.applyStack({ stackRoot: session.stackRoot, definition }),
      );
      session.stackId = result.stack.id;
      rememberStack(result.stack);
      return mutationResult(session, {
        outcome: successOutcome,
        saved: true,
        applied: true,
        changed: result.changed,
        stackId: result.stack.id,
        message:
          successOutcome === 'applied'
            ? result.changed
              ? 'Applied the previously saved stack definition.'
              : 'The previously saved stack definition is already applied.'
            : result.changed
              ? 'Saved and applied the stack definition.'
              : 'The saved stack definition is already applied.',
      });
    } catch (error) {
      return mutationResult(session, {
        outcome: 'saved-not-applied',
        saved: true,
        applied: false,
        changed: null,
        message: 'The stack definition was saved, but it could not be applied.',
        error: reduceError(error, 'stack_definition_apply_failed'),
      });
    }
  }

  return Object.freeze({
    rememberStack,
    async openSelected() {
      const selection = await options.selectStackRoot();
      if (selection === null) {
        return { schemaVersion: 1, outcome: 'cancelled', document: null };
      }
      const resolved = await resolveSelectedRoot(selection);
      return {
        schemaVersion: 1,
        outcome: 'opened',
        document: await openDocument(resolved.stackRoot, resolved.stack),
      };
    },
    /** @param {string} stackId */
    async openKnown(stackId) {
      const stack = await resolveKnownStack(stackId);
      return {
        schemaVersion: 1,
        outcome: 'opened',
        document: await openDocument(await canonicalRoot(stack.stackRoot), stack),
      };
    },
    /** @param {{documentId: string, content: string, conflictToken?: string|null}} request */
    save: (request) => save(request.documentId, request.content, request.conflictToken),
    /** @param {string} documentId */
    retryApply,
  });
}

/** @param {any} session @param {'non-regular'|'oversized'} kind */
function unsupportedTargetResult(session, kind) {
  const oversized = kind === 'oversized';
  return mutationResult(session, {
    outcome: 'failed',
    saved: false,
    applied: false,
    changed: null,
    message: oversized
      ? 'The existing stack definition is too large to replace safely.'
      : 'The stack definition path is not a regular file.',
    error: {
      code: oversized ? 'stack_definition_too_large' : 'stack_definition_not_regular',
      message: oversized
        ? 'The existing stack definition is too large to replace safely.'
        : 'The stack definition path is not a regular file.',
    },
  });
}

/** @param {any} session @param {string|null} currentEvidence */
function saveConflictReason(session, currentEvidence) {
  if (session.fileState === 'invalid') return 'invalid-file-replacement';
  if (session.baselineEvidence === null) {
    return currentEvidence === null ? null : 'appeared-after-open';
  }
  return currentEvidence === session.baselineEvidence ? null : 'changed-after-open';
}

/** @param {any} session @param {string|null} evidence @param {string|null} reason */
function conflictResult(session, evidence, reason) {
  const token = randomUUID();
  session.pendingConflict = { token, evidence };
  return mutationResult(session, {
    outcome: 'conflict',
    saved: false,
    applied: false,
    changed: null,
    message:
      reason === 'invalid-file-replacement'
        ? 'Replacing the invalid stack definition requires confirmation.'
        : 'The stack definition changed outside PortReeve; overwrite or cancel.',
    conflict: {
      reason: reason ?? 'changed-after-open',
      token,
    },
  });
}

/** @param {any} session @param {Record<string, any>} value */
function mutationResult(session, value) {
  return {
    schemaVersion: 1,
    documentId: session.documentId,
    outcome: value.outcome,
    saved: value.saved,
    applied: value.applied,
    changed: value.changed,
    stackId: value.stackId ?? session.stackId,
    message: value.message,
    conflict: value.conflict ?? null,
    issues: value.issues ?? [],
    error: value.error ?? null,
  };
}

/** @param {string} content @param {number} maxBytes */
function parseCandidate(content, maxBytes) {
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    return {
      definition: null,
      issues: [issue('definition_too_large', 'The stack definition is too large.')],
    };
  }
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    return {
      definition: null,
      issues: [issue('invalid_json', 'The stack definition is not valid JSON.')],
    };
  }
  const parsed = StackDefinitionSchema.safeParse(value);
  return parsed.success
    ? { definition: parsed.data, issues: [] }
    : {
        definition: null,
        issues: parsed.error.issues.map((entry) => ({
          code: 'invalid_definition',
          message: entry.message,
          path: entry.path,
        })),
      };
}

/** @param {Awaited<ReturnType<typeof inspectDefinition>>} observed */
function parseObservedDefinition(observed) {
  if (observed.kind === 'missing') {
    return { fileState: 'missing', definition: null, issues: [] };
  }
  if (observed.kind === 'non-regular') {
    return {
      fileState: 'invalid',
      definition: null,
      issues: [
        issue(
          'definition_not_regular',
          'The stack definition path is not a regular file.',
        ),
      ],
    };
  }
  if (observed.kind === 'oversized') {
    return {
      fileState: 'invalid',
      definition: null,
      issues: [issue('definition_too_large', 'The stack definition is too large.')],
    };
  }
  const parsed = parseCandidate(observed.content ?? '', Number.MAX_SAFE_INTEGER);
  return {
    ...parsed,
    fileState: parsed.definition === null ? 'invalid' : 'valid',
  };
}

/** @param {string} filename @param {number} maxBytes */
async function inspectDefinition(filename, maxBytes) {
  let entry;
  try {
    entry = await lstat(filename);
  } catch (error) {
    if (isCode(error, 'ENOENT')) {
      return { kind: /** @type {const} */ ('missing'), evidence: null, mode: null };
    }
    throw documentError(
      'stack_definition_read_failed',
      'The stack definition could not be inspected.',
    );
  }
  if (!entry.isFile()) {
    return {
      kind: /** @type {const} */ ('non-regular'),
      evidence: metadataFingerprint(entry),
      mode: entry.mode & 0o777,
    };
  }
  if (entry.size > maxBytes) {
    return {
      kind: /** @type {const} */ ('oversized'),
      evidence: metadataFingerprint(entry),
      mode: entry.mode & 0o777,
    };
  }
  let content;
  try {
    content = await readFile(filename, 'utf8');
  } catch {
    throw documentError(
      'stack_definition_read_failed',
      'The stack definition could not be read.',
    );
  }
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    return {
      kind: /** @type {const} */ ('oversized'),
      evidence: fingerprint(content),
      mode: entry.mode & 0o777,
    };
  }
  return {
    kind: /** @type {const} */ ('regular'),
    evidence: fingerprint(content),
    mode: entry.mode & 0o777,
    content,
  };
}

/** @param {string} filename @param {string} content */
async function exclusiveWrite(filename, content) {
  const temporary = join(dirname(filename), `.${randomUUID()}.tmp`);
  try {
    await writeSynced(temporary, content, 0o644);
    await link(temporary, filename);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

/**
 * @param {string} filename
 * @param {string} content
 * @param {number} mode
 * @param {string|null} expectedEvidence
 * @param {number} maxBytes
 */
async function atomicReplace(filename, content, mode, expectedEvidence, maxBytes) {
  const temporary = join(dirname(filename), `.${randomUUID()}.tmp`);
  try {
    await writeSynced(temporary, content, mode);
    const current = await inspectDefinition(filename, maxBytes);
    if (current.evidence !== expectedEvidence) {
      throw documentError(
        'stack_definition_changed_during_save',
        'The stack definition changed while it was being saved.',
      );
    }
    await rename(temporary, filename);
  } finally {
    await unlink(temporary).catch(() => {});
  }
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

/** @param {string} startRoot */
async function findEnclosingDefinitionRoot(startRoot) {
  let root = startRoot;
  while (true) {
    try {
      await lstat(join(root, STACK_DEFINITION_FILENAME));
      return root;
    } catch (error) {
      if (!isCode(error, 'ENOENT')) {
        throw documentError(
          'stack_definition_read_failed',
          'The stack definition could not be inspected.',
        );
      }
    }
    const parent = dirname(root);
    if (parent === root) return null;
    root = parent;
  }
}

/** @param {Iterable<ReturnType<typeof StackRecordSchema.parse>>} stacks @param {string} stackRoot */
function stackAtRoot(stacks, stackRoot) {
  for (const stack of stacks) {
    if (stack.stackRoot === stackRoot) return stack;
  }
  return null;
}

/** @param {Iterable<ReturnType<typeof StackRecordSchema.parse>>} stacks @param {string} selectedRoot */
function enclosingStack(stacks, selectedRoot) {
  const matches = [...stacks].filter((stack) =>
    containsPath(stack.stackRoot, selectedRoot),
  );
  if (matches.length > 1) {
    throw documentError(
      'overlapping_stack_roots',
      'More than one registered stack encloses the selected directory.',
    );
  }
  return matches[0] ?? null;
}

/** @param {string} root @param {string} candidate */
function containsPath(root, candidate) {
  const child = relative(root, candidate);
  return (
    child === '' ||
    (!isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`))
  );
}

/** @param {string} path */
async function canonicalRoot(path) {
  try {
    return await canonicalStackRoot(path);
  } catch {
    throw documentError(
      'invalid_stack_root',
      'The selected stack root is not an existing directory.',
    );
  }
}

/** @param {Map<string, any>} sessions @param {string} documentId */
function requireSession(sessions, documentId) {
  const session = sessions.get(documentId);
  if (session === undefined) {
    throw documentError(
      'unknown_stack_document',
      'The stack document is no longer open.',
    );
  }
  return session;
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
function issue(code, message) {
  return { code, message, path: [] };
}

/** @param {unknown} error @param {string} fallbackCode */
function reduceError(error, fallbackCode) {
  const code =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;
  if (code === 'unavailable') {
    return { code, message: 'The PortReeve server is unavailable.' };
  }
  return code === null
    ? { code: fallbackCode, message: 'The operation failed.' }
    : { code, message: safeMessage(error, 'The operation failed.') };
}

/** @param {unknown} error @param {string} fallback */
function safeMessage(error, fallback) {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : fallback;
}

/** @param {unknown} error @param {string} code */
function isCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code;
}

/** @param {string} code @param {string} message */
function documentError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
