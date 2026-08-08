// @ts-check

import { chmod, copyFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileExists } from '../platform/files.js';

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
