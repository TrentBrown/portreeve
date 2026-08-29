// @ts-check

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import {
  resolveBundledReleaseCandidate,
  resolveLocalReleaseCandidate,
} from '../../apps/desktop/main/artifact.js';

test('resolves only the manifest-selected local artifact after checksum verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-desktop-artifact-'));
  const release = join(root, 'dist', 'release');
  await mkdir(release, { recursive: true });
  const filename = 'portreeve-v0.1.0-macos-x64';
  const content = Buffer.from('verified provisional executable');
  const sha256 = createHash('sha256').update(content).digest('hex');
  await writeFile(join(release, filename), content);
  await writeFile(
    join(release, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      softwareVersion: '0.1.0',
      artifacts: [
        {
          type: 'executable',
          filename,
          operatingSystem: 'macos',
          architecture: 'x64',
          sha256,
        },
      ],
    }),
  );

  expect(
    await resolveLocalReleaseCandidate({
      workspaceRoot: root,
      platform: 'darwin',
      architecture: 'x64',
    }),
  ).toMatchObject({
    source: 'local-release-candidate',
    version: '0.1.0',
    filename,
    sha256,
  });

  await writeFile(join(release, filename), 'changed');
  await expect(
    resolveLocalReleaseCandidate({
      workspaceRoot: root,
      platform: 'darwin',
      architecture: 'x64',
    }),
  ).rejects.toThrow('checksum does not match');

  await writeFile(
    join(release, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      softwareVersion: '0.1.0',
      artifacts: [
        {
          type: 'executable',
          filename: `../${filename}`,
          operatingSystem: 'macos',
          architecture: 'x64',
          sha256,
        },
      ],
    }),
  );
  await expect(
    resolveLocalReleaseCandidate({
      workspaceRoot: root,
      platform: 'darwin',
      architecture: 'x64',
    }),
  ).rejects.toThrow('filename is unsafe');
});

test('resolves a bundled manifest only against flat Contents/Helpers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-desktop-bundle-'));
  const resources = join(root, 'PortReeve.app', 'Contents', 'Resources');
  const helpers = join(root, 'PortReeve.app', 'Contents', 'Helpers');
  const manifestRoot = join(resources, 'portreeve');
  await mkdir(manifestRoot, { recursive: true });
  await mkdir(helpers, { recursive: true });
  const filename = 'portreeve-v1.0.0-macos-arm64';
  const content = Buffer.from('authoritative signed helper');
  const sha256 = createHash('sha256').update(content).digest('hex');
  await writeFile(join(helpers, filename), content);
  await writeFile(
    join(manifestRoot, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      softwareVersion: '1.0.0',
      artifacts: [
        {
          type: 'executable',
          filename,
          operatingSystem: 'macos',
          architecture: 'arm64',
          sha256,
        },
      ],
    }),
  );
  expect(
    await resolveBundledReleaseCandidate({
      resourcesRoot: resources,
      platform: 'darwin',
      architecture: 'arm64',
    }),
  ).toMatchObject({ filename, sha256 });
  await writeFile(join(manifestRoot, filename), content);
  await rm(join(helpers, filename));
  await expect(
    resolveBundledReleaseCandidate({
      resourcesRoot: resources,
      platform: 'darwin',
      architecture: 'arm64',
    }),
  ).rejects.toThrow();
  await rm(root, { recursive: true, force: true });
});
