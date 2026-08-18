// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desktopDmgName } from '../../scripts/desktop-release-lib.js';
import { finalizeDesktopDistribution } from '../../scripts/finalize-desktop-distribution.js';
import { inspectReleaseCandidate } from '../../scripts/inspect-release-candidate.js';
import {
  createNativeVerification,
  mergeNativeVerifications,
} from '../../scripts/native-release-evidence.js';
import {
  createPublicationCompletion,
  publishPreparedRelease,
} from '../../scripts/publish-release.js';
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
  test('inspects a complete candidate without changing publication state', async () => {
    const recordPath = await finalizedRelease();
    const result = await inspectReleaseCandidate({ recordPath });
    expect(result).toMatchObject({
      status: 'ready-for-publication-review',
      releaseVersion: '0.1.0-preview.1',
      state: 'prepared',
      publicationState: 'unpublished',
      nativeTargets: ['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'],
      desktopArchitectures: ['arm64', 'x64'],
      publicMutationPerformed: false,
    });
    expect(result.publicationPlanSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect((await readReleaseRecord(recordPath)).state).toBe('prepared');
  });

  test('rejects a candidate whose review plan no longer matches its record', async () => {
    const recordPath = await finalizedRelease();
    await writeFile(join(recordPath, '..', 'publication-plan.md'), 'changed plan\n');
    await expect(inspectReleaseCandidate({ recordPath })).rejects.toThrow(
      'publication plan does not match',
    );
  });

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
        transport: 'github-pull-request-v1',
        homebrewPullRequestUrl: 'https://github.com/example/tap/pull/1',
        homebrewCommit: 'a'.repeat(40),
        desktopUpdatePullRequestUrl: 'https://github.com/example/portreeve/pull/2',
        desktopUpdateCommit: 'b'.repeat(40),
      },
    });
    expect(result.planSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(createPublicationCompletion(result)).toMatchObject({
      schemaVersion: 2,
      releaseId: 'portreeve-v0.1.0-preview.1',
      planSha256: result.planSha256,
      publication: {
        transport: 'github-pull-request-v1',
        homebrewPullRequestUrl: 'https://github.com/example/tap/pull/1',
        desktopUpdatePullRequestUrl: 'https://github.com/example/portreeve/pull/2',
      },
    });
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

  test('keeps a release approved when Desktop publication fails after Homebrew', async () => {
    const recordPath = await finalizedRelease();
    /** @type {string[]} */
    const calls = [];
    const partial = fakeAdapters(calls);
    partial.desktopUpdate.publish = async () => {
      calls.push('desktopUpdate:publish');
      throw new Error('simulated Desktop metadata outage');
    };
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: true, approvedBy: 'Trent Brown' },
        partial,
      ),
    ).rejects.toThrow('simulated Desktop metadata outage');
    expect(await readReleaseRecord(recordPath)).toMatchObject({
      state: 'publication-approved',
      publication: {
        state: 'approved',
        transport: 'github-pull-request-v1',
      },
    });
    calls.length = 0;
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: true, approvedBy: 'Trent Brown' },
        fakeAdapters(calls),
      ),
    ).resolves.toMatchObject({ record: { state: 'published' } });
    expect(calls).toEqual([
      'github:preflight',
      'homebrew:preflight',
      'desktopUpdate:preflight',
      'github:publish',
      'homebrew:publish',
      'desktopUpdate:publish',
    ]);
  });

  test('refuses to invent PR provenance for a legacy partial approval', async () => {
    const recordPath = await finalizedRelease();
    let record = await readReleaseRecord(recordPath);
    record = advanceReleaseRecord(record, 'publication-approved', {
      approvedBy: 'Trent Brown',
      approvedAt: '2026-08-16T21:00:00.000Z',
      planSha256: await sha256File(join(recordPath, '..', 'publication-plan.md')),
    });
    await writeReleaseRecord(recordPath, record);
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: true, approvedBy: 'Trent Brown' },
        fakeAdapters([]),
      ),
    ).rejects.toThrow('Legacy publication approval');
    expect((await readReleaseRecord(recordPath)).state).toBe('publication-approved');
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

  test('does not publish terminal evidence when an adapter omits PR provenance', async () => {
    const recordPath = await finalizedRelease();
    /** @type {string[]} */
    const calls = [];
    const adapters = fakeAdapters(calls);
    // @ts-expect-error The malformed adapter result is the refusal under test.
    adapters.homebrew.publish = async () => ({ commit: 'a'.repeat(40) });
    await expect(
      publishPreparedRelease(
        { recordPath, confirm: true, approvedBy: 'Trent Brown' },
        adapters,
      ),
    ).rejects.toThrow('Homebrew pull request URL is missing');
    expect((await readReleaseRecord(recordPath)).state).toBe('publication-approved');
    expect(calls).not.toContain('desktopUpdate:publish');
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
        return {
          commit: 'a'.repeat(40),
          pullRequestUrl: 'https://github.com/example/tap/pull/1',
        };
      },
    },
    desktopUpdate: {
      async preflight() {
        calls.push('desktopUpdate:preflight');
      },
      async publish() {
        calls.push('desktopUpdate:publish');
        return {
          commit: 'b'.repeat(40),
          pullRequestUrl: 'https://github.com/example/portreeve/pull/2',
        };
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
  const publicationPlan = await readFile(join(root, 'publication-plan.md'), 'utf8');
  expect(publicationPlan).toContain('npm: deferred');
  expect(publicationPlan).toContain('**Alpha Preview**');
  expect(publicationPlan).toContain('**unsigned**');
  expect(publicationPlan).toContain(
    'https://github.com/TrentBrown/portreeve/blob/main/docs/installation.md',
  );
  expect(publicationPlan).toContain('deterministic pull requests');
  expect(publicationPlan).toContain('independent review remains open for recovery');
  return recordPath;
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-publication-test-'));
  directories.push(directory);
  return directory;
}
