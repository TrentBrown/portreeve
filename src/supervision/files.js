// @ts-check

import {
  chmod,
  copyFile,
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

/**
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
 * Atomically replace a managed executable while retaining one rollback copy.
 *
 * @param {string} source
 * @param {string} destination
 * @param {string} rollback
 */
export async function promoteExecutable(source, destination, rollback) {
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const staged = join(dirname(destination), `.${randomUUID()}.staged`);
  const previous = join(dirname(destination), `.${randomUUID()}.previous`);
  const existing = await fileExists(destination);
  try {
    await copyFile(source, staged);
    await chmod(staged, 0o700);
    if (existing) {
      await copyFile(destination, previous);
      await chmod(previous, 0o700);
      await rename(previous, rollback);
    }
    await rename(staged, destination);
  } finally {
    await unlink(staged).catch(() => {});
    await unlink(previous).catch(() => {});
  }
  return { hadPrevious: existing };
}

/**
 * @param {string} destination
 * @param {string} rollback
 * @param {boolean} hadPrevious
 */
export async function restoreExecutable(destination, rollback, hadPrevious) {
  if (!hadPrevious) {
    await unlink(destination).catch(() => {});
    return;
  }
  const staged = join(dirname(destination), `.${randomUUID()}.restore`);
  try {
    await copyFile(rollback, staged);
    await chmod(staged, 0o700);
    await rename(staged, destination);
  } finally {
    await unlink(staged).catch(() => {});
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
 * @param {unknown} error
 */
export function isMissingFile(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: string}} */ (error).code === 'ENOENT'
  );
}
