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

  await prepareRuntimeDirectories({
    applicationDirectory,
    socketPath: join(socketDirectory, 'portreeve.sock'),
  });

  expect((await stat(applicationDirectory)).mode & 0o777).toBe(0o700);
  expect((await stat(socketDirectory)).mode & 0o777).toBe(0o700);
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
