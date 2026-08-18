// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { packReleaseClient } from '../../scripts/release-build.js';
import {
  assertCoordinatedReleaseVersion,
  coordinatedReleaseVersionPlugin,
  semanticVersionCore,
} from '../../scripts/release-version.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('coordinated release version', () => {
  test('accepts prereleases of the checked-in core and rejects version drift', () => {
    expect(semanticVersionCore('0.1.0-preview.4')).toBe('0.1.0');
    expect(semanticVersionCore('0.1.0+build.2')).toBe('0.1.0');
    expect(
      assertCoordinatedReleaseVersion('0.1.0-preview.4', {
        server: '0.1.0',
        client: '0.1.0',
        Desktop: '0.1.0',
      }),
    ).toBe('0.1.0');
    expect(() =>
      assertCoordinatedReleaseVersion('0.2.0-preview.1', { server: '0.1.0' }),
    ).toThrow(
      'Release 0.2.0-preview.1 requires server source version 0.2.0; found 0.1.0.',
    );
  });

  test('injects one coordinated identity into server and client bundles', async () => {
    const directory = await temporaryDirectory();
    const entry = join(directory, 'entry.js');
    await writeFile(
      entry,
      `export { PORTREEVE_VERSION } from ${JSON.stringify(resolve('src/version.js'))};\nexport { PORTREEVE_CLIENT_VERSION } from ${JSON.stringify(resolve('packages/client/src/version.js'))};\n`,
    );
    const build = await Bun.build({
      entrypoints: [entry],
      outdir: directory,
      naming: 'bundle.js',
      target: 'bun',
      plugins: [
        coordinatedReleaseVersionPlugin({
          workspaceRoot: process.cwd(),
          releaseVersion: '0.1.0-preview.4',
        }),
      ],
    });
    expect(build.success, build.logs.map(({ message }) => message).join('\n')).toBe(
      true,
    );
    const output = build.outputs[0];
    if (output === undefined) throw new Error('Bun did not emit a version bundle.');
    const bundled = await output.text();
    expect(bundled).toContain('PORTREEVE_VERSION = "0.1.0-preview.4"');
    expect(bundled).toContain('PORTREEVE_CLIENT_VERSION = "0.1.0-preview.4"');
  });

  test('packs a prerelease client without mutating source metadata', async () => {
    const directory = await temporaryDirectory();
    const sourceMetadataPath = resolve('packages/client/package.json');
    const sourceVersionPath = resolve('packages/client/src/version.js');
    const before = await Promise.all([
      readFile(sourceMetadataPath, 'utf8'),
      readFile(sourceVersionPath, 'utf8'),
    ]);
    const packed = await packReleaseClient(process.cwd(), directory, '0.1.0-preview.4');
    expect(packed).toEqual({
      filename: 'portreeve-0.1.0-preview.4.tgz',
      package: 'portreeve',
      version: '0.1.0-preview.4',
    });
    expect(
      JSON.parse(
        await tarEntry(join(directory, packed.filename), 'package/package.json'),
      ).version,
    ).toBe('0.1.0-preview.4');
    expect(
      await tarEntry(join(directory, packed.filename), 'package/src/version.js'),
    ).toContain('PORTREEVE_CLIENT_VERSION = "0.1.0-preview.4"');
    expect(
      await Promise.all([
        readFile(sourceMetadataPath, 'utf8'),
        readFile(sourceVersionPath, 'utf8'),
      ]),
    ).toEqual(before);
  });
});

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-release-version-test-'));
  directories.push(directory);
  return directory;
}

/** @param {string} archive @param {string} entry */
async function tarEntry(archive, entry) {
  const child = Bun.spawn(['tar', '-xOf', archive, entry], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0) throw new Error(stderr);
  return stdout;
}
