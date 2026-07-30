// @ts-check

import { chmod, lstat, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { OWNERSHIP_MARKER_FILENAME, ensureOwnershipMarker } from './ownership.js';

/**
 * @param {NodeJS.ProcessEnv} [environment]
 */
export function resolveRuntimePaths(environment = process.env) {
  const applicationDirectory = resolve(
    environment.PORTREEVE_HOME ??
      (process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Application Support', 'Portreeve')
        : join(
            environment.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'),
            'portreeve',
          )),
  );

  return Object.freeze({
    applicationDirectory,
    ownershipMarkerPath: join(applicationDirectory, OWNERSHIP_MARKER_FILENAME),
    binaryDirectory: join(applicationDirectory, 'bin'),
    managedExecutablePath: join(applicationDirectory, 'bin', 'portreeve'),
    rollbackExecutablePath: join(applicationDirectory, 'bin', 'portreeve.previous'),
    databasePath: join(applicationDirectory, 'registry.sqlite'),
    diagnosticLogPath: join(applicationDirectory, 'portreeve.log'),
    supervisorStandardOutputPath: join(applicationDirectory, 'supervisor.stdout.log'),
    supervisorStandardErrorPath: join(applicationDirectory, 'supervisor.stderr.log'),
    socketPath: resolve(
      environment.PORTREEVE_SOCKET ?? join(applicationDirectory, 'portreeve.sock'),
    ),
  });
}

/**
 * @param {{applicationDirectory: string, socketPath: string}} paths
 */
export async function prepareRuntimeDirectories(paths) {
  await ensurePrivateDirectory(paths.applicationDirectory);
  await ensureOwnershipMarker(paths);
  if ('binaryDirectory' in paths && typeof paths.binaryDirectory === 'string') {
    await ensurePrivateDirectory(paths.binaryDirectory);
  }
  const socketDirectory = dirname(paths.socketPath);
  if (socketDirectory !== paths.applicationDirectory) {
    await ensurePrivateDirectory(socketDirectory);
  }
}

/**
 * @param {string} databasePath
 */
export async function validateExistingDatabase(databasePath) {
  let information;
  try {
    information = await lstat(databasePath);
  } catch (error) {
    if (isMissingFile(error)) {
      return;
    }
    throw error;
  }

  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`Unsafe Portreeve database path: ${databasePath}`);
  }
  if (typeof process.getuid === 'function' && information.uid !== process.getuid()) {
    throw new Error(`Portreeve database has another owner: ${databasePath}`);
  }
  if ((information.mode & 0o077) !== 0) {
    throw new Error(
      `Portreeve database is not private: ${databasePath} (mode ${(information.mode & 0o777).toString(8)})`,
    );
  }
}

/**
 * @param {string} directory
 */
async function ensurePrivateDirectory(directory) {
  let existed = true;
  let information;
  try {
    information = await lstat(directory);
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
    existed = false;
    await mkdir(directory, { mode: 0o700, recursive: true });
    await chmod(directory, 0o700);
    information = await lstat(directory);
  }
  if (!information.isDirectory() || information.isSymbolicLink()) {
    throw new Error(`Unsafe Portreeve runtime directory: ${directory}`);
  }
  if (typeof process.getuid === 'function' && information.uid !== process.getuid()) {
    throw new Error(`Portreeve runtime directory has another owner: ${directory}`);
  }
  if ((information.mode & 0o077) !== 0) {
    throw new Error(
      `Portreeve runtime directory is not private: ${directory} (mode ${(information.mode & 0o777).toString(8)})`,
    );
  }
  if (existed && (information.mode & 0o700) !== 0o700) {
    throw new Error(`Portreeve runtime directory lacks owner access: ${directory}`);
  }
}

/**
 * @param {unknown} error
 */
function isMissingFile(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: string}} */ (error).code === 'ENOENT'
  );
}
