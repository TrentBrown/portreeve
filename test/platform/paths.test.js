// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  prepareRuntimeDirectories,
  validateExistingDatabase,
} from '../../src/platform/paths.js';

const directories = new Set();

afterEach(async () => {
  await Promise.all(
    [...directories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  directories.clear();
});

async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'portreeve-paths-'));
  directories.add(path);
  return path;
}

test('creates private application and socket directories', async () => {
  const root = await directory();
  const applicationDirectory = join(root, 'data');
  const socketDirectory = join(root, 'runtime');
  const supervisorStandardOutputPath = join(
    applicationDirectory,
    'supervisor.stdout.log',
  );
  const supervisorStandardErrorPath = join(
    applicationDirectory,
    'supervisor.stderr.log',
  );

  await prepareRuntimeDirectories({
    applicationDirectory,
    socketPath: join(socketDirectory, 'portreeve.sock'),
    supervisorStandardOutputPath,
    supervisorStandardErrorPath,
  });

  expect((await stat(applicationDirectory)).mode & 0o777).toBe(0o700);
  expect((await stat(socketDirectory)).mode & 0o777).toBe(0o700);
  expect((await stat(supervisorStandardOutputPath)).mode & 0o777).toBe(0o600);
  expect((await stat(supervisorStandardErrorPath)).mode & 0o777).toBe(0o600);
});

test('rejects unsafe existing supervisor logs rather than repairing them', async () => {
  const root = await directory();
  const applicationDirectory = join(root, 'data');
  const supervisorStandardOutputPath = join(
    applicationDirectory,
    'supervisor.stdout.log',
  );
  await mkdir(applicationDirectory);
  await chmod(applicationDirectory, 0o700);
  await writeFile(supervisorStandardOutputPath, '');
  await chmod(supervisorStandardOutputPath, 0o664);

  await expect(
    prepareRuntimeDirectories({
      applicationDirectory,
      socketPath: join(applicationDirectory, 'portreeve.sock'),
      supervisorStandardOutputPath,
    }),
  ).rejects.toThrow(/not private|writable by another user/u);
  expect((await stat(supervisorStandardOutputPath)).mode & 0o777).toBe(0o664);
});

test('rejects rather than repairs an unsafe existing directory', async () => {
  const root = await directory();
  const applicationDirectory = join(root, 'data');
  await mkdir(applicationDirectory);
  await chmod(applicationDirectory, 0o755);

  await expect(
    prepareRuntimeDirectories({
      applicationDirectory,
      socketPath: join(applicationDirectory, 'portreeve.sock'),
    }),
  ).rejects.toThrow('not private');
  expect((await stat(applicationDirectory)).mode & 0o777).toBe(0o755);
});

test('rejects symbolic-link runtime directories', async () => {
  const root = await directory();
  const target = join(root, 'target');
  await mkdir(target);
  const applicationDirectory = join(root, 'data');
  await symlink(target, applicationDirectory);

  await expect(
    prepareRuntimeDirectories({
      applicationDirectory,
      socketPath: join(applicationDirectory, 'portreeve.sock'),
    }),
  ).rejects.toThrow('Unsafe');
});

test('rejects an existing database with unsafe permissions', async () => {
  const root = await directory();
  const databasePath = join(root, 'registry.sqlite');
  await writeFile(databasePath, '');
  await chmod(databasePath, 0o644);

  await expect(validateExistingDatabase(databasePath)).rejects.toThrow('not private');
});
