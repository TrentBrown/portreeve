// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  HOMEBREW_SMOKE_CASK,
  HOMEBREW_SMOKE_FORMULA,
  stageHomebrewCandidate,
} from '../../scripts/smoke-homebrew-candidate.js';
import { desktopDmgName } from '../../scripts/desktop-release-lib.js';
import {
  artifactName,
  RELEASE_TARGETS,
  sha256File,
} from '../../scripts/release-lib.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

test('stages downloaded candidate copies for formula and cask smoke', async () => {
  const releaseRoot = await temporaryDirectory();
  const stagingRoot = await temporaryDirectory();
  const artifactsDirectory = join(releaseRoot, 'artifacts');
  await mkdir(artifactsDirectory, { recursive: true });
  /** @type {Array<Record<string, any>>} */
  const artifacts = [];

  for (const target of RELEASE_TARGETS) {
    const filename = artifactName('0.1.0-preview.1', target);
    const path = join(artifactsDirectory, filename);
    await writeFile(path, `native-${target.operatingSystem}-${target.architecture}`);
    await chmod(path, 0o644);
    artifacts.push({
      type: 'executable',
      filename,
      path: `artifacts/${filename}`,
      operatingSystem: target.operatingSystem,
      architecture: target.architecture,
      sha256: await sha256File(path),
    });
  }
  for (const architecture of /** @type {const} */ (['arm64', 'x64'])) {
    const filename = desktopDmgName('0.1.0-preview.1', architecture);
    const path = join(artifactsDirectory, filename);
    await writeFile(path, `dmg-${architecture}`);
    artifacts.push({
      type: 'desktop-dmg',
      filename,
      path: `artifacts/${filename}`,
      operatingSystem: 'macos',
      architecture,
      sha256: await sha256File(path),
    });
  }

  const result = await stageHomebrewCandidate({
    record: {
      releaseVersion: '0.1.0-preview.1',
      versions: {
        server: '0.1.0-preview.1',
        desktop: '0.1.0-preview.1',
      },
      artifacts,
    },
    releaseRoot,
    stagingRoot,
  });

  const source = join(artifactsDirectory, 'portreeve-v0.1.0-preview.1-macos-arm64');
  const staged = join(
    stagingRoot,
    'v0.1.0-preview.1',
    'portreeve-v0.1.0-preview.1-macos-arm64',
  );
  expect((await stat(source)).mode & 0o777).toBe(0o644);
  expect((await stat(staged)).mode & 0o777).toBe(0o755);
  expect(await readFile(source, 'utf8')).toBe(await readFile(staged, 'utf8'));
  expect(result.formula).toContain(
    'v0.1.0-preview.1/portreeve-v0.1.0-preview.1-macos-arm64',
  );
  expect(result.cask).toContain(
    'v0.1.0-preview.1/PortReeve-0.1.0-preview.1-macos-#{arch}.dmg',
  );
});

test('requires the complete formula and cask artifact set', async () => {
  const releaseRoot = await temporaryDirectory();
  const stagingRoot = await temporaryDirectory();
  await expect(
    stageHomebrewCandidate({
      record: {
        releaseVersion: '0.1.0-preview.1',
        versions: {
          server: '0.1.0-preview.1',
          desktop: '0.1.0-preview.1',
        },
        artifacts: [],
      },
      releaseRoot,
      stagingRoot,
    }),
  ).rejects.toThrow('exactly four native executables');
});

test('fully qualifies disposable formula and cask names', () => {
  expect(HOMEBREW_SMOKE_FORMULA).toBe('portreeve/smoke/portreeve');
  expect(HOMEBREW_SMOKE_CASK).toBe('portreeve/smoke/portreeve-app');
});

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-homebrew-test-'));
  directories.push(directory);
  return directory;
}
