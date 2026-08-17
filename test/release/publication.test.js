// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desktopDmgName } from '../../scripts/desktop-release-lib.js';
import { finalizeDesktopDistribution } from '../../scripts/finalize-desktop-distribution.js';
import {
  createNativeVerification,
  mergeNativeVerifications,
} from '../../scripts/native-release-evidence.js';
import { publishPreparedRelease } from '../../scripts/publish-release.js';
import { RELEASE_TARGETS, sha256File } from '../../scripts/release-lib.js';
import {
  advanceReleaseRecord,
  createReleaseRecord,
  readReleaseRecord,
  registerReleaseArtifact,
  writeReleaseRecord,
} from '../../scripts/release-record.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('release publication', () => {
  test('requires explicit confirmation before adapter preflight or mutation', async () => {
    const recordPath = await finalizedRelease();
    /** @type {string[]} */
    const calls = [];
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: false, approvedBy: 'Trent Brown' },
        fakeAdapters(calls),
      ),
    ).rejects.toThrow('requires --confirm');
    expect(calls).toEqual([]);
    expect((await readReleaseRecord(recordPath)).state).toBe('prepared');
  });

  test('binds approval to the exact plan and publishes through independent adapters', async () => {
    const recordPath = await finalizedRelease();
    /** @type {string[]} */
    const calls = [];
    const result = await publishPreparedRelease(
      {
        recordPath,
        confirm: true,
        approvedBy: 'Trent Brown',
        now: () => new Date('2026-08-17T01:00:00.000Z'),
      },
      fakeAdapters(calls),
    );
    expect(calls).toEqual([
      'github:preflight',
      'homebrew:preflight',
      'desktopUpdate:preflight',
      'github:publish',
      'homebrew:publish',
      'desktopUpdate:publish',
    ]);
    expect(result.record).toMatchObject({
      state: 'published',
      publication: {
        state: 'published',
        tag: 'v0.1.0-preview.1',
        githubReleaseUrl: 'https://example.com/release',
        homebrewCommit: 'a'.repeat(40),
        desktopUpdateCommit: 'b'.repeat(40),
      },
    });
    expect(result.planSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  test('persists approval for safe retry after a partial adapter failure', async () => {
    const recordPath = await finalizedRelease();
    /** @type {string[]} */
    const calls = [];
    const failing = fakeAdapters(calls);
    failing.homebrew.publish = async () => {
      calls.push('homebrew:publish');
      throw new Error('simulated tap outage');
    };
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: true, approvedBy: 'Trent Brown' },
        failing,
      ),
    ).rejects.toThrow('simulated tap outage');
    expect((await readReleaseRecord(recordPath)).state).toBe('publication-approved');
    calls.length = 0;
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: true, approvedBy: 'Trent Brown' },
        fakeAdapters(calls),
      ),
    ).resolves.toMatchObject({ record: { state: 'published' } });
  });

  test('fails before approval when any publication target rejects preflight', async () => {
    const recordPath = await finalizedRelease();
    /** @type {string[]} */
    const calls = [];
    const adapters = fakeAdapters(calls);
    adapters.homebrew.preflight = async () => {
      calls.push('homebrew:preflight');
      throw new Error('tap authority unavailable');
    };
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: true, approvedBy: 'Trent Brown' },
        adapters,
      ),
    ).rejects.toThrow('tap authority unavailable');
    expect((await readReleaseRecord(recordPath)).state).toBe('prepared');
  });
});

/** @param {string[]} calls */
function fakeAdapters(calls) {
  return {
    github: {
      async preflight() {
        calls.push('github:preflight');
      },
      async publish() {
        calls.push('github:publish');
        return { url: 'https://example.com/release' };
      },
    },
    homebrew: {
      async preflight() {
        calls.push('homebrew:preflight');
      },
      async publish() {
        calls.push('homebrew:publish');
        return { commit: 'a'.repeat(40) };
      },
    },
    desktopUpdate: {
      async preflight() {
        calls.push('desktopUpdate:preflight');
      },
      async publish() {
        calls.push('desktopUpdate:publish');
        return { commit: 'b'.repeat(40) };
      },
    },
  };
}

async function finalizedRelease() {
  const root = await temporaryDirectory();
  await mkdir(join(root, 'artifacts'), { recursive: true });
  let record = createReleaseRecord({
    releaseVersion: '0.1.0-preview.1',
    source: {
      repository: 'https://github.com/TrentBrown/portreeve',
      commit: '8'.repeat(40),
    },
    versions: { server: '0.1.0', desktop: '0.1.0', client: '0.1.0' },
    policy: { maturity: 'alpha', channel: 'preview', desktopTrust: 'unsigned' },
    tools: { bun: '1.3.14' },
  });
  record = advanceReleaseRecord(record, 'source-pinned', {});
  record = advanceReleaseRecord(record, 'policy-resolved', {});
  record = advanceReleaseRecord(record, 'native-cli-built', {});
  for (const target of RELEASE_TARGETS) {
    const path = join(
      root,
      'artifacts',
      `portreeve-v0.1.0-${target.operatingSystem}-${target.architecture}`,
    );
    await Bun.write(path, `cli-${target.operatingSystem}-${target.architecture}`);
    record = await registerReleaseArtifact(record, {
      root,
      path,
      type: 'executable',
      provenanceStage: 'native-cli-built',
      operatingSystem: target.operatingSystem,
      architecture: target.architecture,
    });
  }
  const metadataArtifacts = /** @type {Array<[string, string]>} */ ([
    ['portreeve.rb', 'homebrew-formula'],
    ['portreeve-0.1.0.tgz', 'npm-package'],
  ]);
  for (const [filename, type] of metadataArtifacts) {
    const path = join(root, 'artifacts', filename);
    await Bun.write(path, filename);
    record = await registerReleaseArtifact(record, {
      root,
      path,
      type,
      provenanceStage: 'native-cli-built',
    });
  }
  record = advanceReleaseRecord(record, 'artifact-digests-established', {});
  record = mergeNativeVerifications(
    record,
    RELEASE_TARGETS.map((target) =>
      createNativeVerification(record, target, {
        name: 'fixture',
        operatingSystem: target.operatingSystem,
        architecture: target.architecture,
      }),
    ),
  );
  const recordPath = join(root, 'release-record.json');
  await writeReleaseRecord(recordPath, record);
  const evidencePaths = [];
  for (const architecture of /** @type {const} */ (['arm64', 'x64'])) {
    const filename = desktopDmgName('0.1.0', architecture);
    const dmgPath = join(root, 'artifacts', filename);
    await Bun.write(dmgPath, `dmg-${architecture}`);
    const cli = record.artifacts.find(
      (artifact) =>
        artifact.type === 'executable' &&
        artifact.operatingSystem === 'macos' &&
        artifact.architecture === architecture,
    );
    if (cli === undefined) throw new Error('Missing fixture CLI.');
    const evidence = {
      schemaVersion: 1,
      kind: 'desktop-package-verification',
      releaseId: record.releaseId,
      releaseVersion: record.releaseVersion,
      source: { ...record.source },
      target: { operatingSystem: 'macos', architecture },
      cliArtifact: {
        filename: cli.filename,
        bytes: cli.bytes,
        sha256: cli.sha256,
      },
      desktop: {
        version: '0.1.0',
        filename,
        bytes: (await stat(dmgPath)).size,
        sha256: await sha256File(dmgPath),
      },
      checks: {
        exactCliEmbedded: true,
        packageInspected: true,
        dmgVerified: true,
        dmgMounted: true,
        nativeSmoke: true,
      },
      runner: { operatingSystem: 'darwin', architecture },
      verifiedAt: new Date().toISOString(),
    };
    const evidencePath = join(root, 'evidence', `desktop-${architecture}.json`);
    await mkdir(join(root, 'evidence'), { recursive: true });
    await writeFile(evidencePath, JSON.stringify(evidence));
    evidencePaths.push(evidencePath);
  }
  await finalizeDesktopDistribution({ recordPath, evidencePaths });
  expect(await readFile(join(root, 'publication-plan.md'), 'utf8')).toContain(
    'npm: deferred',
  );
  return recordPath;
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-publication-test-'));
  directories.push(directory);
  return directory;
}
