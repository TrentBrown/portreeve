// @ts-check

import { createHash } from 'node:crypto';
import { lstat, readdir, rm, rmdir, unlink } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { z } from 'zod';
import {
  OwnershipMarkerSchema,
  readOwnershipMarker,
  validateApplicationRoot,
} from '../platform/ownership.js';
import { TimestampSchema } from '../protocol/schemas.js';
import {
  LifecycleErrorSchema,
  LifecycleStatusSchema,
  lifecycleError,
} from './schemas.js';

const PurgePathSchema = z
  .object({
    path: z.string().min(1),
    type: z.enum(['directory', 'file', 'socket', 'symlink', 'other']),
    uid: z.number().int().nonnegative(),
    mode: z.number().int().nonnegative(),
    size: z.number().int().nonnegative(),
    modifiedAt: TimestampSchema,
  })
  .strict();

const PurgeRefusalSchema = z
  .object({
    path: z.string().min(1).nullable(),
    reason: z.string().min(1),
  })
  .strict();

/** @typedef {z.infer<typeof PurgePathSchema>} PurgePath */
/** @typedef {z.infer<typeof PurgeRefusalSchema>} PurgeRefusal */

export const PurgePreviewSchema = z
  .object({
    operation: z.literal('purge'),
    dryRun: z.literal(true),
    allowed: z.boolean(),
    confirmationToken: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]+$/),
    root: z.string().min(1),
    marker: OwnershipMarkerSchema.nullable(),
    status: LifecycleStatusSchema,
    paths: z.array(PurgePathSchema),
    refused: z.array(PurgeRefusalSchema),
  })
  .strict();

export const PurgeResultSchema = z
  .object({
    operation: z.literal('purge'),
    outcome: z.enum(['succeeded', 'refused', 'partial']),
    confirmationToken: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]+$/),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema,
    before: LifecycleStatusSchema,
    after: LifecycleStatusSchema,
    removed: z.array(z.string().min(1)),
    retained: z.array(z.string().min(1)),
    missing: z.array(z.string().min(1)),
    refused: z.array(PurgeRefusalSchema),
    error: LifecycleErrorSchema.nullable(),
  })
  .strict();

/**
 * @param {{
 *   status(): Promise<import('zod').infer<typeof LifecycleStatusSchema>>,
 *   paths: {applicationDirectory: string},
 *   supervisor: import('./types.js').Supervisor,
 *   uid: number | undefined,
 *   waitUntilUnavailable(): Promise<void>
 * }} manager
 */
export async function previewPurge(manager) {
  const status = await manager.status();
  let ownership;
  /** @type {PurgeRefusal[]} */
  const markerRefusals = [];
  try {
    ownership = await readOwnershipMarker(manager.paths.applicationDirectory);
  } catch (error) {
    const root = await validateApplicationRoot(manager.paths.applicationDirectory);
    ownership = {
      path: `${root.canonicalPath}${sep}.portreeve-owner.json`,
      marker: null,
      canonicalApplicationDirectory: root.canonicalPath,
      ownerUid: root.uid,
    };
    markerRefusals.push({
      path: ownership.path,
      reason: `ownership-marker-invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
  const paths = await inspectTree(ownership.canonicalApplicationDirectory);
  const refused = [
    ...markerRefusals,
    ...refusalEvidence(status, paths, ownership.ownerUid),
  ];
  const definition = await inspectOptionalPath(manager.supervisor.definitionPath);
  if (definition !== null) {
    paths.push(definition);
    if (definition.type === 'symlink') {
      refused.push({
        path: definition.path,
        reason: 'supervisor-definition-is-symlink',
      });
    }
    if (definition.uid !== ownership.ownerUid) {
      refused.push({
        path: definition.path,
        reason: 'supervisor-definition-owner-mismatch',
      });
    }
    if (definition.type !== 'file') {
      refused.push({
        path: definition.path,
        reason: 'supervisor-definition-is-not-file',
      });
    }
    if ((definition.mode & 0o077) !== 0) {
      refused.push({
        path: definition.path,
        reason: 'supervisor-definition-is-not-private',
      });
    }
  }
  paths.sort((left, right) => left.path.localeCompare(right.path));
  refused.sort((left, right) =>
    `${left.path ?? ''}:${left.reason}`.localeCompare(
      `${right.path ?? ''}:${right.reason}`,
    ),
  );
  const confirmationToken = createHash('sha256')
    .update(
      JSON.stringify({
        root: ownership.canonicalApplicationDirectory,
        marker: ownership.marker,
        lifecycle: statusFingerprint(status),
        paths,
        refused,
      }),
    )
    .digest('hex');
  return PurgePreviewSchema.parse({
    operation: 'purge',
    dryRun: true,
    allowed: refused.length === 0,
    confirmationToken,
    root: ownership.canonicalApplicationDirectory,
    marker: ownership.marker,
    status,
    paths,
    refused,
  });
}

/**
 * @param {{
 *   status(): Promise<import('zod').infer<typeof LifecycleStatusSchema>>,
 *   paths: {applicationDirectory: string},
 *   supervisor: import('./types.js').Supervisor,
 *   uid: number | undefined,
 *   waitUntilUnavailable(): Promise<void>
 * }} manager
 * @param {string} confirmationToken
 */
export async function executePurge(manager, confirmationToken) {
  const startedAt = new Date().toISOString();
  const preview = await previewPurge(manager);
  if (!preview.allowed || preview.confirmationToken !== confirmationToken) {
    return PurgeResultSchema.parse({
      operation: 'purge',
      outcome: 'refused',
      confirmationToken,
      startedAt,
      completedAt: new Date().toISOString(),
      before: preview.status,
      after: await manager.status(),
      removed: [],
      retained: preview.paths.map(({ path }) => path),
      missing: [],
      refused:
        preview.confirmationToken === confirmationToken
          ? preview.refused
          : [{ path: preview.root, reason: 'preview-evidence-changed' }],
      error: null,
    });
  }

  /** @type {string[]} */
  const removed = [];
  /** @type {string[]} */
  const retained = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {PurgeRefusal[]} */
  const refused = [];
  let error = null;
  try {
    if (
      preview.status.supervisor.state === 'active' ||
      preview.status.supervisor.state === 'starting'
    ) {
      await manager.supervisor.stop();
      if (preview.status.mode === 'supervised') {
        await manager.waitUntilUnavailable();
      }
    }
    if (preview.status.supervisor.state !== 'unavailable') {
      await manager.supervisor.uninstall();
      removed.push(manager.supervisor.definitionPath);
    }

    const deletionPreview = await previewPurge(manager);
    if (!deletionPreview.allowed) {
      refused.push(...deletionPreview.refused);
      retained.push(...deletionPreview.paths.map(({ path }) => path));
    } else {
      const previewedPaths = new Set(preview.paths.map(({ path }) => path));
      const addedPaths = deletionPreview.paths.filter(
        ({ path }) => !previewedPaths.has(path),
      );
      if (addedPaths.length > 0) {
        refused.push(
          ...addedPaths.map(({ path }) => ({
            path,
            reason: 'path-added-after-preview',
          })),
        );
        retained.push(...deletionPreview.paths.map(({ path }) => path));
      } else {
        await deletePreviewedTree(deletionPreview, removed, retained, missing, refused);
      }
    }
  } catch (caught) {
    error = lifecycleError(caught);
    retained.push(
      ...(await remainingPaths(preview.root)).filter(
        (path) => !retained.includes(path),
      ),
    );
  }
  const after = await manager.status();
  const rootRemoved = await isMissing(preview.root);
  const lifecycleChanged =
    JSON.stringify(statusFingerprint(preview.status)) !==
    JSON.stringify(statusFingerprint(after));
  return PurgeResultSchema.parse({
    operation: 'purge',
    outcome:
      rootRemoved && refused.length === 0 && error === null
        ? 'succeeded'
        : error !== null || removed.length > 0 || lifecycleChanged
          ? 'partial'
          : 'refused',
    confirmationToken,
    startedAt,
    completedAt: new Date().toISOString(),
    before: preview.status,
    after,
    removed: uniqueSorted(removed),
    retained: uniqueSorted(retained),
    missing: uniqueSorted(missing),
    refused,
    error,
  });
}

/**
 * @param {import('zod').infer<typeof PurgePreviewSchema>} preview
 * @param {string[]} removed
 * @param {string[]} retained
 * @param {string[]} missing
 * @param {Array<{path: string | null, reason: string}>} refused
 */
async function deletePreviewedTree(preview, removed, retained, missing, refused) {
  const markerPath = preview.paths.find(
    ({ path }) => path === `${preview.root}${sep}.portreeve-owner.json`,
  )?.path;
  const topLevel = preview.paths
    .filter(({ path }) => {
      const name = relative(preview.root, path);
      return name.length > 0 && !name.includes(sep) && path !== markerPath;
    })
    .map(({ path }) => path);
  for (const path of topLevel) {
    try {
      await rm(path, { recursive: true });
      removed.push(
        ...preview.paths
          .filter(
            (entry) => entry.path === path || entry.path.startsWith(`${path}${sep}`),
          )
          .map((entry) => entry.path),
      );
    } catch (error) {
      if (isMissingError(error)) {
        missing.push(path);
      } else {
        retained.push(path);
        refused.push({
          path,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  if (retained.length > 0 || refused.length > 0) {
    retained.push(preview.root);
    if (markerPath !== undefined) {
      retained.push(markerPath);
    }
    return;
  }
  if (markerPath !== undefined) {
    await unlink(markerPath);
    removed.push(markerPath);
  }
  await rmdir(preview.root);
  removed.push(preview.root);
}

/**
 * @param {import('zod').infer<typeof LifecycleStatusSchema>} status
 * @param {Array<import('zod').infer<typeof PurgePathSchema>>} paths
 * @param {number} uid
 */
function refusalEvidence(status, paths, uid) {
  const refused = [];
  if (status.mode === 'manual') {
    refused.push({ path: status.socket.path, reason: 'manual-server-running' });
  }
  if (status.mode === 'ambiguous') {
    refused.push({ path: status.socket.path, reason: 'execution-mode-ambiguous' });
  }
  if (status.socket.state === 'incompatible') {
    refused.push({
      path: status.socket.path,
      reason: 'socket-server-incompatible',
    });
  }
  if (status.supervisor.state === 'failed') {
    refused.push({ path: null, reason: 'supervisor-evidence-failed' });
  }
  if (status.installation.state === 'invalid') {
    refused.push({ path: null, reason: 'managed-installation-invalid' });
  }
  for (const entry of paths) {
    if (entry.type === 'symlink') {
      refused.push({ path: entry.path, reason: 'symlink-in-deletion-tree' });
    }
    if (entry.uid !== uid) {
      refused.push({ path: entry.path, reason: 'owner-mismatch' });
    }
    if (entry.type !== 'symlink' && (entry.mode & 0o022) !== 0) {
      refused.push({
        path: entry.path,
        reason: 'path-writable-by-another-user',
      });
    }
  }
  return refused;
}

/**
 * @param {string} root
 * @returns {Promise<PurgePath[]>}
 */
async function inspectTree(root) {
  const paths = [await inspectPath(root)];
  const names = (await readdir(root)).sort();
  for (const name of names) {
    const path = `${root}${sep}${name}`;
    const evidence = await inspectPath(path);
    paths.push(evidence);
    if (evidence.type === 'directory') {
      paths.push(...(await inspectTreeChildren(path)));
    }
  }
  return paths;
}

/**
 * @param {string} root
 * @returns {Promise<PurgePath[]>}
 */
async function inspectTreeChildren(root) {
  /** @type {PurgePath[]} */
  const paths = [];
  for (const name of (await readdir(root)).sort()) {
    const path = `${root}${sep}${name}`;
    const evidence = await inspectPath(path);
    paths.push(evidence);
    if (evidence.type === 'directory') {
      paths.push(...(await inspectTreeChildren(path)));
    }
  }
  return paths;
}

/** @param {string} path */
async function inspectOptionalPath(path) {
  if (!path) {
    return null;
  }
  try {
    return await inspectPath(path);
  } catch (error) {
    if (isMissingError(error)) {
      return null;
    }
    throw error;
  }
}

/** @param {string} path */
async function inspectPath(path) {
  const information = await lstat(path);
  return PurgePathSchema.parse({
    path,
    type: information.isSymbolicLink()
      ? 'symlink'
      : information.isDirectory()
        ? 'directory'
        : information.isFile()
          ? 'file'
          : information.isSocket()
            ? 'socket'
            : 'other',
    uid: information.uid,
    mode: information.mode & 0o777,
    size: information.size,
    modifiedAt: information.mtime.toISOString(),
  });
}

/** @param {import('zod').infer<typeof LifecycleStatusSchema>} status */
function statusFingerprint(status) {
  return {
    installation: status.installation,
    supervisor: status.supervisor,
    socket: {
      path: status.socket.path,
      state: status.socket.state,
      server: status.socket.server,
      error: status.socket.error,
    },
    mode: status.mode,
    versions: status.versions,
    limitations: status.limitations,
  };
}

/** @param {string} root */
async function remainingPaths(root) {
  try {
    return (await inspectTree(root)).map(({ path }) => path);
  } catch (error) {
    return isMissingError(error) ? [] : [root];
  }
}

/** @param {string} path */
async function isMissing(path) {
  try {
    await lstat(path);
    return false;
  } catch (error) {
    if (isMissingError(error)) {
      return true;
    }
    throw error;
  }
}

/** @param {unknown} error */
function isMissingError(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: string}} */ (error).code === 'ENOENT'
  );
}

/** @param {string[]} values */
function uniqueSorted(values) {
  return [...new Set(values)].sort();
}
