// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { chmod, mkdtemp, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiagnosticLog } from '../../src/observability/diagnostic-log.js';

const directories = new Set();

afterEach(async () => {
  await Promise.all(
    [...directories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  directories.clear();
});

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-log-'));
  directories.add(directory);
  return directory;
}

test('rotates bounded private diagnostic logs and reads recent entries', async () => {
  const directory = await temporaryDirectory();
  const path = join(directory, 'portreeve.log');
  let sequence = 0;
  const log = new DiagnosticLog({
    path,
    settings: () => ({
      diagnosticLogMaximumBytes: 300,
      diagnosticLogFiles: 3,
    }),
    now: () => new Date(1_800_000_000_000 + sequence++),
  });

  for (let index = 0; index < 20; index += 1) {
    log.write('info', 'test', `entry-${String(index)}`, { index });
  }

  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect((await stat(`${path}.1`)).isFile()).toBe(true);
  expect((await stat(`${path}.2`)).isFile()).toBe(true);
  const entries = log.read(4);
  expect(entries.map(({ message }) => message)).toEqual([
    'entry-16',
    'entry-17',
    'entry-18',
    'entry-19',
  ]);
});

test('rejects unsafe existing diagnostic log paths', async () => {
  const directory = await temporaryDirectory();
  const path = join(directory, 'portreeve.log');
  await writeFile(path, '');
  await chmod(path, 0o644);
  expect(
    () =>
      new DiagnosticLog({
        path,
        settings: () => ({
          diagnosticLogMaximumBytes: 1_000,
          diagnosticLogFiles: 2,
        }),
      }),
  ).toThrow('not private');

  const target = join(directory, 'target.log');
  const link = join(directory, 'linked.log');
  await writeFile(target, '');
  await symlink(target, link);
  expect(
    () =>
      new DiagnosticLog({
        path: link,
        settings: () => ({
          diagnosticLogMaximumBytes: 1_000,
          diagnosticLogFiles: 2,
        }),
      }),
  ).toThrow('Unsafe');
});
