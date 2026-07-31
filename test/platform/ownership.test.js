// @ts-check

import { afterEach, expect, test } from 'bun:test';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OWNERSHIP_MARKER_FILENAME,
  ensureOwnershipMarker,
  readOwnershipMarker,
  validateApplicationRoot,
} from '../../src/platform/ownership.js';

const directories = new Set();

afterEach(async () => {
  await Promise.all(
    [...directories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  directories.clear();
});

test('creates and validates a private ownership marker for an empty home', async () => {
  const applicationDirectory = await directory();
  const evidence = await ensureOwnershipMarker({ applicationDirectory });
  const information = await lstat(evidence.path);

  expect(information.mode & 0o777).toBe(0o600);
  expect(evidence.marker).toMatchObject({
    schemaVersion: 1,
    product: 'portreeve',
    canonicalApplicationDirectory: evidence.canonicalApplicationDirectory,
    ownerUid: typeof process.getuid === 'function' ? process.getuid() : information.uid,
  });
  expect(await readOwnershipMarker(applicationDirectory)).toEqual(evidence);
});

test('migrates recognized pre-marker state and refuses unrelated entries', async () => {
  const recognized = await directory();
  await writeFile(join(recognized, 'registry.sqlite'), '');
  await chmod(join(recognized, 'registry.sqlite'), 0o600);
  await ensureOwnershipMarker({ applicationDirectory: recognized });
  expect(
    JSON.parse(await readFile(join(recognized, OWNERSHIP_MARKER_FILENAME), 'utf8')),
  ).toMatchObject({ product: 'portreeve' });

  const unrelated = await directory();
  await writeFile(join(unrelated, 'family-photo.jpg'), 'not Portreeve state');
  await expect(
    ensureOwnershipMarker({ applicationDirectory: unrelated }),
  ).rejects.toThrow('unrelated entries: family-photo.jpg');

  const nestedUnrelated = await directory();
  await mkdir(join(nestedUnrelated, 'bin'), { mode: 0o700 });
  await writeFile(join(nestedUnrelated, 'bin', 'notes.txt'), 'not Portreeve');
  await expect(
    ensureOwnershipMarker({
      applicationDirectory: nestedUnrelated,
      binaryDirectory: join(nestedUnrelated, 'bin'),
      socketPath: join(nestedUnrelated, 'portreeve.sock'),
    }),
  ).rejects.toThrow('bin directory containing unrelated entries');
});

test('refuses symlinked, malformed, and mismatched ownership markers', async () => {
  const symlinked = await directory();
  const externalMarker = join(await directory(), 'marker.json');
  await writeFile(externalMarker, '{}');
  await symlink(externalMarker, join(symlinked, OWNERSHIP_MARKER_FILENAME));
  await expect(readOwnershipMarker(symlinked)).rejects.toThrow(
    'Unsafe Portreeve ownership marker',
  );

  const malformed = await directory();
  await writeFile(join(malformed, OWNERSHIP_MARKER_FILENAME), '{}', {
    mode: 0o600,
  });
  await expect(readOwnershipMarker(malformed)).rejects.toThrow();

  const mismatched = await directory();
  await writeFile(
    join(mismatched, OWNERSHIP_MARKER_FILENAME),
    JSON.stringify({
      schemaVersion: 1,
      product: 'portreeve',
      canonicalApplicationDirectory: '/tmp/not-this-home',
      ownerUid: typeof process.getuid === 'function' ? process.getuid() : 501,
      createdAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
  await expect(readOwnershipMarker(mismatched)).rejects.toThrow(
    'does not match its application home',
  );
});

test('refuses filesystem root and the user home as application roots', async () => {
  await expect(validateApplicationRoot('/')).rejects.toThrow(
    'Refusing unsafe Portreeve application directory root',
  );
  await expect(validateApplicationRoot(homedir())).rejects.toThrow(
    'Refusing unsafe Portreeve application directory root',
  );
});

async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'portreeve-ownership-'));
  directories.add(path);
  return path;
}
