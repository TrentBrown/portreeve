// @ts-check

import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createLauncherDocument,
  readLauncherDocument,
  replaceLauncherDocument,
} from '../../src/launcher/document.js';

function definition(command = 'npm run start') {
  return {
    version: 1,
    operations: {
      start: { command },
      stop: { command: 'npm run stop' },
    },
  };
}

test('creates exclusively, fingerprints exact bytes, and replaces only a fresh revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-launcher-document-'));
  try {
    const created = await createLauncherDocument(root, definition());
    expect(created.definition.operations.start.command).toBe('npm run start');
    expect(created.sourceContent).toBe(created.canonicalContent);
    await expect(createLauncherDocument(root, definition())).rejects.toMatchObject({
      code: 'launcher_definition_exists',
    });

    await writeFile(created.filename, `${created.sourceContent} `);
    await expect(
      replaceLauncherDocument(root, definition('npm run dev'), created.revision),
    ).rejects.toMatchObject({ code: 'launcher_definition_changed' });

    const externallyChanged = await readLauncherDocument(root);
    const replaced = await replaceLauncherDocument(
      root,
      definition('npm run dev'),
      externallyChanged.revision,
    );
    expect(replaced.definition.operations.start.command).toBe('npm run dev');
    expect(JSON.parse(await readFile(replaced.filename, 'utf8'))).toEqual(
      replaced.definition,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects working directories that escape through symlinks and launcher symlinks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-document-'));
  const root = join(directory, 'stack');
  const outside = join(directory, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await symlink(outside, join(root, 'escaped'));
  try {
    await expect(
      createLauncherDocument(root, { ...definition(), workingDirectory: 'escaped' }),
    ).rejects.toMatchObject({ code: 'working_directory_outside_stack' });

    const external = join(outside, 'launcher.json');
    await writeFile(external, JSON.stringify(definition()));
    await symlink(external, join(root, 'portreeve.launcher.json'));
    await expect(readLauncherDocument(root)).rejects.toMatchObject({
      code: 'launcher_definition_not_regular',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
