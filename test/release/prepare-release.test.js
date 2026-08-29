// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareRelease } from '../../scripts/prepare-release.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('release preparation', () => {
  test('writes a non-publishing, resumable workspace from a clean source', async () => {
    const outputRoot = await temporaryDirectory();
    const result = await prepareRelease(
      {
        channel: 'preview',
        version: '0.1.0-preview.1',
        workspaceRoot: process.cwd(),
        outputRoot,
      },
      {
        sourceIdentity: async () => ({
          repository: 'https://github.com/TrentBrown/portreeve',
          commit: '3'.repeat(40),
          clean: true,
        }),
        build: fakeBuild,
        now: () => new Date('2026-08-16T20:00:00.000Z'),
      },
    );
    expect(result.record).toMatchObject({
      releaseVersion: '0.1.0-preview.1',
      versions: {
        server: '0.1.0-preview.1',
        desktop: '0.1.0-preview.1',
        client: '0.1.0-preview.1',
      },
      state: 'preparing',
      policy: { maturity: 'alpha', channel: 'preview', desktopTrust: 'unsigned' },
      publication: { state: 'unpublished' },
    });
    expect(result.record.stages.map(({ name }) => name)).toEqual([
      'source-pinned',
      'policy-resolved',
      'native-cli-built',
      'artifact-digests-established',
      'candidate-qualified',
    ]);
    expect(result.record.artifacts.map(({ filename }) => filename)).toEqual([
      'portreeve-v0.1.0-preview.1-macos-arm64',
      'portreeve-v0.1.0-preview.1-macos-x64',
      'portreeve-v0.1.0-preview.1-linux-arm64',
      'portreeve-v0.1.0-preview.1-linux-x64',
      'portreeve.rb',
      'manifest.json',
      'SHA256SUMS',
    ]);
    const plan = await readFile(
      join(result.releaseRoot, 'publication-plan.md'),
      'utf8',
    );
    expect(plan).toContain('This preparation has not created a Git tag or release');
    expect(plan).toContain('Explicit human publication approval');
  });

  test('refuses a dirty checkout before building', async () => {
    const outputRoot = await temporaryDirectory();
    let built = false;
    await expect(
      prepareRelease(
        {
          channel: 'preview',
          version: '0.1.0-preview.2',
          workspaceRoot: process.cwd(),
          outputRoot,
        },
        {
          sourceIdentity: async () => ({
            repository: 'https://github.com/TrentBrown/portreeve',
            commit: '4'.repeat(40),
            clean: false,
          }),
          build: async (options) => {
            built = true;
            return fakeBuild(options);
          },
        },
      ),
    ).rejects.toThrow('requires a clean source checkout');
    expect(built).toBe(false);
  });

  test('refuses a release whose semantic core differs from source packages', async () => {
    const outputRoot = await temporaryDirectory();
    await expect(
      prepareRelease(
        {
          channel: 'preview',
          version: '0.2.0-preview.1',
          workspaceRoot: process.cwd(),
          outputRoot,
        },
        {
          sourceIdentity: async () => ({
            repository: 'https://github.com/TrentBrown/portreeve',
            commit: '4'.repeat(40),
            clean: true,
          }),
          build: fakeBuild,
        },
      ),
    ).rejects.toThrow(
      'Release 0.2.0-preview.1 requires server source version 0.2.0; found 0.1.0.',
    );
  });

  test('refuses to replace an existing release identity', async () => {
    const outputRoot = await temporaryDirectory();
    const dependencies = {
      sourceIdentity: async () => ({
        repository: 'https://github.com/TrentBrown/portreeve',
        commit: '5'.repeat(40),
        clean: true,
      }),
      build: fakeBuild,
    };
    const options = {
      channel: /** @type {const} */ ('preview'),
      version: '0.1.0-preview.3',
      workspaceRoot: process.cwd(),
      outputRoot,
    };
    await prepareRelease(options, dependencies);
    await expect(prepareRelease(options, dependencies)).rejects.toThrow(
      'Release workspace already exists',
    );
    await expect(
      prepareRelease({ ...options, resume: true }, dependencies),
    ).rejects.toThrow('progressed beyond the resumable build boundary');
  });

  test('resumes an interrupted build only for the exact recorded source and policy', async () => {
    const outputRoot = await temporaryDirectory();
    const source = {
      repository: 'https://github.com/TrentBrown/portreeve',
      commit: '6'.repeat(40),
      clean: true,
    };
    const options = {
      channel: /** @type {const} */ ('preview'),
      version: '0.1.0-preview.4',
      workspaceRoot: process.cwd(),
      outputRoot,
    };
    await expect(
      prepareRelease(options, {
        sourceIdentity: async () => source,
        build: async () => {
          throw new Error('simulated build interruption');
        },
      }),
    ).rejects.toThrow('simulated build interruption');

    await expect(
      prepareRelease(
        { ...options, resume: true },
        {
          sourceIdentity: async () => ({ ...source, commit: '7'.repeat(40) }),
          build: fakeBuild,
        },
      ),
    ).rejects.toThrow('does not match this source or policy');

    const resumed = await prepareRelease(
      { ...options, resume: true },
      { sourceIdentity: async () => source, build: fakeBuild },
    );
    expect(resumed.record.stages.at(-1)?.name).toBe('candidate-qualified');
  });
});

/** @param {{destination: string, releaseVersion: string}} options */
async function fakeBuild(options) {
  await mkdir(options.destination, { recursive: true });
  const executables = [
    { operatingSystem: 'macos', architecture: 'arm64' },
    { operatingSystem: 'macos', architecture: 'x64' },
    { operatingSystem: 'linux', architecture: 'arm64' },
    { operatingSystem: 'linux', architecture: 'x64' },
  ].map((target) => ({
    type: 'executable',
    filename: `portreeve-v${options.releaseVersion}-${target.operatingSystem}-${target.architecture}`,
    ...target,
  }));
  for (const executable of executables) {
    await Bun.write(join(options.destination, executable.filename), 'native bytes');
  }
  await Bun.write(join(options.destination, 'portreeve.rb'), 'formula');
  await writeFile(join(options.destination, 'manifest.json'), '{}\n');
  await writeFile(join(options.destination, 'SHA256SUMS'), 'checksums\n');
  return {
    releaseDirectory: options.destination,
    manifest: {
      releaseVersion: options.releaseVersion,
      artifacts: [
        ...executables,
        { type: 'homebrew-formula', filename: 'portreeve.rb' },
      ],
    },
  };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-prepare-test-'));
  directories.push(directory);
  return directory;
}
