// @ts-check

import { lstat, open, readFile, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { z } from 'zod';
import { isAlreadyExists, isMissingFile } from './errors.js';

export const OWNERSHIP_MARKER_FILENAME = '.portreeve-owner.json';

export const OwnershipMarkerSchema = z
  .object({
    schemaVersion: z.literal(1),
    product: z.literal('portreeve'),
    canonicalApplicationDirectory: z.string().min(1),
    ownerUid: z.number().int().nonnegative(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/**
 * @param {{applicationDirectory: string} & Record<string, unknown>} paths
 */
export async function ensureOwnershipMarker(paths) {
  const root = await validateApplicationRoot(paths.applicationDirectory);
  const markerPath = join(root.canonicalPath, OWNERSHIP_MARKER_FILENAME);
  try {
    return await readOwnershipMarker(root.canonicalPath);
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
  }

  const entries = await readdir(root.canonicalPath);
  const allowedEntries = recognizedEntryNames(paths, root.canonicalPath);
  const unrelated = entries.filter((entry) => !allowedEntries.has(entry));
  if (unrelated.length > 0) {
    throw new Error(
      `Refusing to claim a Portreeve application directory containing unrelated entries: ${unrelated.join(
        ', ',
      )}`,
    );
  }
  await validateRecognizedState(entries, paths, root);

  const marker = OwnershipMarkerSchema.parse({
    schemaVersion: 1,
    product: 'portreeve',
    canonicalApplicationDirectory: root.canonicalPath,
    ownerUid: root.uid,
    createdAt: new Date().toISOString(),
  });
  let handle;
  try {
    handle = await open(markerPath, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(marker, null, 2)}\n`, 'utf8');
    await handle.sync();
  } catch (error) {
    if (isAlreadyExists(error)) {
      return readOwnershipMarker(root.canonicalPath);
    }
    throw error;
  } finally {
    await handle?.close();
  }
  return readOwnershipMarker(root.canonicalPath);
}

/**
 * @param {string} applicationDirectory
 */
export async function readOwnershipMarker(applicationDirectory) {
  const root = await validateApplicationRoot(applicationDirectory);
  const markerPath = join(root.canonicalPath, OWNERSHIP_MARKER_FILENAME);
  const information = await lstat(markerPath);
  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`Unsafe Portreeve ownership marker: ${markerPath}`);
  }
  if (information.uid !== root.uid) {
    throw new Error(`Portreeve ownership marker has another owner: ${markerPath}`);
  }
  if ((information.mode & 0o077) !== 0) {
    throw new Error(`Portreeve ownership marker is not private: ${markerPath}`);
  }
  const marker = OwnershipMarkerSchema.parse(
    JSON.parse(await readFile(markerPath, 'utf8')),
  );
  if (
    marker.canonicalApplicationDirectory !== root.canonicalPath ||
    marker.ownerUid !== root.uid
  ) {
    throw new Error('Portreeve ownership marker does not match its application home.');
  }
  return {
    path: markerPath,
    marker,
    canonicalApplicationDirectory: root.canonicalPath,
    ownerUid: root.uid,
  };
}

/**
 * @param {string} applicationDirectory
 */
export async function validateApplicationRoot(applicationDirectory) {
  const requestedPath = resolve(applicationDirectory);
  const information = await lstat(requestedPath);
  if (!information.isDirectory() || information.isSymbolicLink()) {
    throw new Error(`Unsafe Portreeve application directory: ${requestedPath}`);
  }
  const canonicalPath = await realpath(requestedPath);
  const canonicalHome = await realpath(homedir());
  if (canonicalPath === parse(canonicalPath).root || canonicalPath === canonicalHome) {
    throw new Error(
      `Refusing unsafe Portreeve application directory root: ${canonicalPath}`,
    );
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : information.uid;
  if (information.uid !== uid) {
    throw new Error(
      `Portreeve application directory has another owner: ${requestedPath}`,
    );
  }
  if ((information.mode & 0o077) !== 0 || (information.mode & 0o700) !== 0o700) {
    throw new Error(`Portreeve application directory is not private: ${requestedPath}`);
  }
  return { requestedPath, canonicalPath, uid };
}

/**
 * A pre-marker application home may be claimed only when its recognized names
 * also have the types, ownership, and nested contents Portreeve itself creates.
 *
 * @param {string[]} entries
 * @param {Record<string, unknown>} paths
 * @param {{requestedPath: string, canonicalPath: string, uid: number}} root
 */
async function validateRecognizedState(entries, paths, root) {
  const binaryEntry = childEntryName(paths.binaryDirectory, root) ?? 'bin';
  const socketEntry = childEntryName(paths.socketPath, root) ?? 'portreeve.sock';
  for (const entry of entries) {
    const path = join(root.canonicalPath, entry);
    const information = await lstat(path);
    if (information.isSymbolicLink()) {
      throw new Error(`Refusing to claim symlinked Portreeve state: ${path}`);
    }
    if (information.uid !== root.uid) {
      throw new Error(
        `Refusing to claim Portreeve state owned by another user: ${path}`,
      );
    }
    if ((information.mode & 0o022) !== 0) {
      throw new Error(
        `Refusing to claim Portreeve state writable by another user: ${path}`,
      );
    }
    if (entry === binaryEntry) {
      if (!information.isDirectory()) {
        throw new Error(
          `Refusing to claim a non-directory Portreeve bin path: ${path}`,
        );
      }
      await validateRecognizedBinaryState(path, root.uid);
    } else if (entry === socketEntry) {
      if (!information.isSocket()) {
        throw new Error(
          `Refusing to claim a non-socket Portreeve socket path: ${path}`,
        );
      }
    } else if (!information.isFile()) {
      throw new Error(`Refusing to claim non-file Portreeve state: ${path}`);
    }
  }
}

/**
 * @param {unknown} value
 * @param {{requestedPath: string, canonicalPath: string}} root
 */
function childEntryName(value, root) {
  if (typeof value !== 'string') {
    return null;
  }
  const path = resolve(value);
  return dirname(path) === root.requestedPath || dirname(path) === root.canonicalPath
    ? basename(path)
    : null;
}

/**
 * @param {string} binaryDirectory
 * @param {number} uid
 */
async function validateRecognizedBinaryState(binaryDirectory, uid) {
  const temporaryExecutable = /^\.[0-9a-f-]+\.(?:previous|restore|staged)$/i;
  for (const entry of await readdir(binaryDirectory)) {
    if (
      entry !== 'portreeve' &&
      entry !== 'portreeve.previous' &&
      !temporaryExecutable.test(entry)
    ) {
      throw new Error(
        `Refusing to claim a Portreeve bin directory containing unrelated entries: ${entry}`,
      );
    }
    const path = join(binaryDirectory, entry);
    const information = await lstat(path);
    if (
      !information.isFile() ||
      information.isSymbolicLink() ||
      information.uid !== uid ||
      (information.mode & 0o022) !== 0
    ) {
      throw new Error(`Refusing to claim unsafe Portreeve executable state: ${path}`);
    }
  }
}

/**
 * @param {Record<string, unknown>} paths
 * @param {string} applicationDirectory
 */
function recognizedEntryNames(paths, applicationDirectory) {
  const entries = new Set([
    OWNERSHIP_MARKER_FILENAME,
    'bin',
    'registry.sqlite',
    'registry.sqlite-shm',
    'registry.sqlite-wal',
    'portreeve.log',
    'portreeve.log.1',
    'portreeve.log.2',
    'supervisor.stdout.log',
    'supervisor.stderr.log',
    'portreeve.sock',
  ]);
  for (const value of Object.values(paths)) {
    if (
      typeof value === 'string' &&
      dirname(resolve(value)) === resolve(applicationDirectory)
    ) {
      entries.add(basename(value));
    }
  }
  return entries;
}
