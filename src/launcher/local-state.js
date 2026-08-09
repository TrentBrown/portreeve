// @ts-check

import { randomUUID } from 'node:crypto';
import { chmod, lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { StackRecordSchema, TimestampSchema } from '../protocol/schemas.js';

const RevisionSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const LauncherCachedEndpointSchema = z
  .object({
    component: z.string().min(1).max(128),
    endpoint: z.string().min(1).max(128),
    hostPort: z.number().int().min(1).max(65_535),
    required: z.boolean(),
  })
  .strict();
export const LauncherEnvironmentCacheSchema = z
  .object({
    revision: RevisionSchema,
    resolvedAt: TimestampSchema,
    stackId: z.uuid(),
    generationId: z.uuid(),
    activationId: z.uuid().nullable(),
    socketPath: z.string().min(1),
    stack: StackRecordSchema.optional(),
    environment: z.record(z.string(), z.string()),
    endpoints: z.array(LauncherCachedEndpointSchema).default([]),
  })
  .strict();
const EntrySchema = z
  .object({
    stackRoot: z.string().min(1),
    trustedRevision: RevisionSchema.nullable(),
    trustedAt: TimestampSchema.nullable(),
    cache: LauncherEnvironmentCacheSchema.nullable(),
  })
  .strict();
export const LauncherLocalStateSchema = z
  .object({ version: z.literal(1), launchers: z.array(EntrySchema) })
  .strict();

const EMPTY_STATE = Object.freeze({ version: /** @type {const} */ (1), launchers: [] });

/** @param {{path: string, now?: () => Date}} options */
export function createLauncherLocalStateStore(options) {
  const now = options.now ?? (() => new Date());

  async function read() {
    await validateParent(dirname(options.path));
    let content;
    try {
      await validatePrivateFile(options.path);
      content = await readFile(options.path, 'utf8');
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return structuredClone(EMPTY_STATE);
      throw error;
    }
    return LauncherLocalStateSchema.parse(JSON.parse(content));
  }

  /** @param {(state: z.infer<typeof LauncherLocalStateSchema>) => void} mutate */
  async function update(mutate) {
    const lockPath = `${options.path}.lock`;
    const lock = await acquireLock(lockPath, now());
    try {
      const state = await read();
      mutate(state);
      state.launchers.sort((left, right) =>
        left.stackRoot.localeCompare(right.stackRoot),
      );
      await writeState(options.path, LauncherLocalStateSchema.parse(state));
      return state;
    } finally {
      await lock.handle.close();
      await releaseLock(lockPath, lock.token);
    }
  }

  return Object.freeze({
    read,
    /** @param {string} stackRoot @param {string} revision */
    async trust(stackRoot, revision) {
      RevisionSchema.parse(revision);
      return update((state) => {
        const entry = requireEntry(state, stackRoot);
        entry.trustedRevision = revision;
        entry.trustedAt = now().toISOString();
      });
    },
    /** @param {string} stackRoot @param {string} revision */
    async isTrusted(stackRoot, revision) {
      RevisionSchema.parse(revision);
      const entry = (await read()).launchers.find(
        (item) => item.stackRoot === stackRoot,
      );
      return entry?.trustedRevision === revision;
    },
    /** @param {string} stackRoot @param {z.input<typeof LauncherEnvironmentCacheSchema>} cache */
    async cache(stackRoot, cache) {
      const parsed = LauncherEnvironmentCacheSchema.parse(cache);
      return update((state) => {
        requireEntry(state, stackRoot).cache = parsed;
      });
    },
    /** @param {string} stackRoot @param {string} revision */
    async cached(stackRoot, revision) {
      const entry = (await read()).launchers.find(
        (item) => item.stackRoot === stackRoot,
      );
      return entry?.cache?.revision === revision ? entry.cache : null;
    },
    /** @param {string} stackRoot */
    async remove(stackRoot) {
      return update((state) => {
        state.launchers = state.launchers.filter(
          (item) => item.stackRoot !== stackRoot,
        );
      });
    },
  });
}

/** @param {string} lockPath @param {Date} observedAt */
async function acquireLock(lockPath, observedAt) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      const token = randomUUID();
      await handle.writeFile(token, 'utf8');
      await handle.sync();
      return { handle, token };
    } catch (error) {
      if (!hasCode(error, 'EEXIST')) throw error;
      const entry = await lstat(lockPath).catch((inspectionError) => {
        if (hasCode(inspectionError, 'ENOENT')) return null;
        throw inspectionError;
      });
      if (entry === null) continue;
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        (typeof process.getuid === 'function' && entry.uid !== process.getuid()) ||
        (entry.mode & 0o077) !== 0
      ) {
        throw stateError('unsafe_launcher_state');
      }
      if (observedAt.getTime() - entry.mtimeMs <= 60_000) {
        throw stateError('launcher_state_busy');
      }
      const stalePath = `${lockPath}.${randomUUID()}.stale`;
      try {
        await rename(lockPath, stalePath);
        await unlink(stalePath);
      } catch (replacementError) {
        if (!hasCode(replacementError, 'ENOENT')) throw replacementError;
      }
    }
  }
  throw stateError('launcher_state_busy');
}

/** @param {string} lockPath @param {string} token */
async function releaseLock(lockPath, token) {
  try {
    if ((await readFile(lockPath, 'utf8')) === token) await unlink(lockPath);
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) throw error;
  }
}

/** @param {z.infer<typeof LauncherLocalStateSchema>} state @param {string} stackRoot */
function requireEntry(state, stackRoot) {
  let entry = state.launchers.find((item) => item.stackRoot === stackRoot);
  if (entry === undefined) {
    entry = { stackRoot, trustedRevision: null, trustedAt: null, cache: null };
    state.launchers.push(entry);
  }
  return entry;
}

/** @param {string} filename @param {z.infer<typeof LauncherLocalStateSchema>} state */
async function writeState(filename, state) {
  const temporary = join(dirname(filename), `.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, filename);
    await chmod(filename, 0o600);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

/** @param {string} directory */
async function validateParent(directory) {
  const entry = await lstat(directory);
  if (!entry.isDirectory() || entry.isSymbolicLink())
    throw stateError('unsafe_launcher_state');
  if (typeof process.getuid === 'function' && entry.uid !== process.getuid()) {
    throw stateError('unsafe_launcher_state');
  }
  if ((entry.mode & 0o077) !== 0) throw stateError('unsafe_launcher_state');
}

/** @param {string} filename */
async function validatePrivateFile(filename) {
  const entry = await lstat(filename);
  if (!entry.isFile() || entry.isSymbolicLink())
    throw stateError('unsafe_launcher_state');
  if (typeof process.getuid === 'function' && entry.uid !== process.getuid()) {
    throw stateError('unsafe_launcher_state');
  }
  if ((entry.mode & 0o077) !== 0) throw stateError('unsafe_launcher_state');
}

/** @param {string} code */
function stateError(code) {
  const error = new Error(
    code === 'launcher_state_busy'
      ? 'Launcher state is being updated by another PortReeve client.'
      : 'Launcher state storage is unsafe.',
  );
  Object.assign(error, { code });
  return error;
}

/** @param {unknown} error @param {string} code */
function hasCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code;
}
