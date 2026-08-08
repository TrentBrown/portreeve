// @ts-check

import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMissingFile } from './errors.js';

/**
 * Replace one private file atomically, leaving no partial content behind.
 *
 * @param {string} path
 * @param {string} content
 * @param {number} [mode]
 */
export async function atomicWrite(path, content, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, content, { encoding: 'utf8', mode });
    await chmod(temporaryPath, mode);
    const handle = await open(temporaryPath, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
}

/**
 * @param {string} path
 */
export async function readOptionalFile(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * @param {string} path
 */
export async function fileExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isMissingFile(error)) {
      return false;
    }
    throw error;
  }
}

/**
 * Decide whether a recorded workspace or stack root is still present. Only
 * proof of absence reports `false`, so an unreadable path never invites
 * deletion of the records that reference it.
 *
 * @param {string} path
 */
export async function workspacePathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    return !isMissingFile(error);
  }
}
