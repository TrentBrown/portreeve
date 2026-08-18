// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RELEASE_STAGES,
  advanceReleaseRecord,
  createReleaseRecord,
  readReleaseRecord,
  registerReleaseArtifact,
  validateReleasePolicy,
  verifyReleaseArtifacts,
  writeReleaseRecord,
} from '../../scripts/release-record.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('release record', () => {
  test('separates release identity, component versions, channel, maturity, and trust', () => {
    const record = previewRecord();
    expect(record).toMatchObject({
      schemaVersion: 1,
      releaseId: 'portreeve-v0.1.0-preview.1',
      releaseVersion: '0.1.0-preview.1',
      versions: { server: '0.1.0', desktop: '0.1.0', client: '0.1.0' },
      policy: { maturity: 'alpha', channel: 'preview', desktopTrust: 'unsigned' },
      state: 'initialized',
      stages: [],
      artifacts: [],
      publication: { state: 'unpublished' },
    });
  });

  test('enforces preview and stable policy independently', () => {
    expect(() =>
      validateReleasePolicy('0.1.0', {
        maturity: 'alpha',
        channel: 'preview',
        desktopTrust: 'unsigned',
      }),
    ).toThrow('Preview releases require a semantic prerelease version.');
    expect(() =>
      validateReleasePolicy('1.0.0', {
        maturity: 'stable',
        channel: 'stable',
        desktopTrust: 'unsigned',
      }),
    ).toThrow('Stable Desktop releases require Developer ID notarization.');
    expect(() =>
      validateReleasePolicy('1.0.0-preview.1', {
        maturity: 'stable',
        channel: 'stable',
        desktopTrust: 'developer-id-notarized',
      }),
    ).toThrow('Stable releases require a semantic version without a prerelease.');
    expect(() =>
      validateReleasePolicy('1.0.0', {
        maturity: 'stable',
        channel: 'stable',
        desktopTrust: 'developer-id-notarized',
      }),
    ).not.toThrow();
  });

  test('permits only ordered transitions and requires policy-specific trust evidence', () => {
    let preview = previewRecord();
    expect(() => advanceReleaseRecord(preview, 'policy-resolved', {})).toThrow(
      'expected source-pinned',
    );
    preview = advanceThroughDesktopPackaging(preview);
    expect(() =>
      advanceReleaseRecord(preview, 'desktop-trust-verified', { status: 'signed' }),
    ).toThrow('unsigned preview');
    preview = advanceReleaseRecord(preview, 'desktop-trust-verified', {
      status: 'unsigned-preview',
    });
    expect(preview.stages.at(-1)?.name).toBe('desktop-trust-verified');

    let stable = stableRecord();
    stable = advanceThroughDesktopPackaging(stable);
    expect(() => advanceReleaseRecord(stable, 'desktop-trust-verified', {})).toThrow(
      'Desktop trust evidence signatureIdentity is required.',
    );
    stable = advanceReleaseRecord(stable, 'desktop-trust-verified', {
      signatureIdentity: 'Developer ID Application: PortReeve',
      hardenedRuntime: true,
      secureTimestamp: true,
      notarizationId: 'notary-request-id',
      stapled: true,
      gatekeeperAssessment: 'accepted',
      nativeArchitectures: ['arm64', 'x64'],
    });
    expect(stable.stages.at(-1)?.name).toBe('desktop-trust-verified');
  });

  test('binds publication approval to one exact plan digest', () => {
    let record = previewRecord();
    record = advanceThroughDesktopPackaging(record);
    record = advanceReleaseRecord(record, 'desktop-trust-verified', {
      status: 'unsigned-preview',
    });
    record = advanceReleaseRecord(record, 'distribution-finalized', {});
    expect(record.state).toBe('prepared');
    expect(() => advanceReleaseRecord(record, 'publication-approved', {})).toThrow(
      'publication approver is required',
    );
    record = advanceReleaseRecord(record, 'publication-approved', {
      approvedBy: 'Trent Brown',
      approvedAt: '2026-08-16T21:00:00.000Z',
      planSha256: 'a'.repeat(64),
      transport: 'github-pull-request-v1',
    });
    expect(record.publication).toEqual({
      state: 'approved',
      approvedBy: 'Trent Brown',
      approvedAt: '2026-08-16T21:00:00.000Z',
      planSha256: 'a'.repeat(64),
      transport: 'github-pull-request-v1',
    });
  });

  test('requires PR evidence for new transport while retaining honest legacy history', () => {
    let modern = publicationReadyRecord();
    modern = advanceReleaseRecord(modern, 'publication-approved', {
      approvedBy: 'Trent Brown',
      approvedAt: '2026-08-16T21:00:00.000Z',
      planSha256: 'a'.repeat(64),
      transport: 'github-pull-request-v1',
    });
    expect(() =>
      advanceReleaseRecord(modern, 'published', legacyPublishedEvidence()),
    ).toThrow('transport differs');
    modern = advanceReleaseRecord(modern, 'published', {
      ...legacyPublishedEvidence(),
      transport: 'github-pull-request-v1',
      homebrewPullRequestUrl: 'https://github.com/example/tap/pull/1',
      desktopUpdatePullRequestUrl: 'https://github.com/example/portreeve/pull/2',
    });
    expect(modern.publication).toMatchObject({
      transport: 'github-pull-request-v1',
      homebrewPullRequestUrl: 'https://github.com/example/tap/pull/1',
      desktopUpdatePullRequestUrl: 'https://github.com/example/portreeve/pull/2',
    });

    let legacy = publicationReadyRecord();
    legacy = advanceReleaseRecord(legacy, 'publication-approved', {
      approvedBy: 'Trent Brown',
      approvedAt: '2026-08-16T21:00:00.000Z',
      planSha256: 'b'.repeat(64),
    });
    legacy = advanceReleaseRecord(legacy, 'published', legacyPublishedEvidence());
    expect(legacy.publication).not.toHaveProperty('transport');
    expect(legacy.publication).not.toHaveProperty('homebrewPullRequestUrl');
  });

  test('reads legacy completed evidence without adding PR identity', async () => {
    const root = await temporaryDirectory();
    const path = join(root, 'legacy-release-record.json');
    let legacy = publicationReadyRecord();
    legacy = advanceReleaseRecord(legacy, 'publication-approved', {
      approvedBy: 'Trent Brown',
      approvedAt: '2026-08-16T21:00:00.000Z',
      planSha256: 'b'.repeat(64),
    });
    legacy = advanceReleaseRecord(legacy, 'published', legacyPublishedEvidence());
    await writeReleaseRecord(path, legacy);
    const restored = await readReleaseRecord(path);
    expect(restored.publication).toEqual({
      state: 'published',
      ...legacyPublishedEvidence(),
    });
    expect(restored.publication).not.toHaveProperty('homebrewPullRequestUrl');
  });

  test('records workspace-relative artifact identity and rejects tampering', async () => {
    const root = await temporaryDirectory();
    const artifactPath = join(root, 'artifacts', 'portreeve');
    await mkdir(join(root, 'artifacts'));
    await Bun.write(artifactPath, 'original bytes');
    let record = advanceReleaseRecord(previewRecord(), 'source-pinned', {});
    record = advanceReleaseRecord(record, 'policy-resolved', {});
    record = advanceReleaseRecord(record, 'native-cli-built', {});
    record = await registerReleaseArtifact(record, {
      root,
      path: artifactPath,
      type: 'executable',
      provenanceStage: 'native-cli-built',
      operatingSystem: 'macos',
      architecture: 'arm64',
    });
    expect(record.artifacts[0]).toMatchObject({
      filename: 'portreeve',
      path: 'artifacts/portreeve',
      bytes: 14,
      operatingSystem: 'macos',
      architecture: 'arm64',
    });
    await expect(verifyReleaseArtifacts(record, root)).resolves.toBeUndefined();
    await writeFile(artifactPath, 'changed bytes');
    await expect(verifyReleaseArtifacts(record, root)).rejects.toThrow(
      'Recorded artifact identity changed',
    );
  });

  test('atomically persists and validates a release record', async () => {
    const root = await temporaryDirectory();
    const path = join(root, 'release-record.json');
    const record = previewRecord();
    await writeReleaseRecord(path, record);
    expect(await readReleaseRecord(path)).toEqual(record);
    await writeFile(path, '{"schemaVersion":999}\n');
    await expect(readReleaseRecord(path)).rejects.toThrow(
      'Unsupported release record schema',
    );
  });

  test('rejects hand-edited identity, state, path, and publication fields', async () => {
    const root = await temporaryDirectory();
    const path = join(root, 'release-record.json');
    const record = previewRecord();
    for (const mutate of [
      (/** @type {Record<string, any>} */ value) => {
        value.releaseId = 'portreeve-v9.9.9';
      },
      (/** @type {Record<string, any>} */ value) => {
        value.state = 'prepared';
      },
      (/** @type {Record<string, any>} */ value) => {
        value.publication.state = 'approved';
      },
      (/** @type {Record<string, any>} */ value) => {
        value.stages = [
          { name: 'source-pinned', completedAt: record.createdAt, evidence: {} },
        ];
        value.state = 'preparing';
        value.artifacts = [
          {
            type: 'executable',
            filename: 'portreeve',
            path: '../portreeve',
            bytes: 1,
            sha256: 'a'.repeat(64),
            provenanceStage: 'source-pinned',
          },
        ];
      },
    ]) {
      const altered = structuredClone(record);
      mutate(altered);
      await writeFile(path, JSON.stringify(altered));
      await expect(readReleaseRecord(path)).rejects.toThrow();
    }
  });
});

function previewRecord() {
  return createReleaseRecord({
    releaseVersion: '0.1.0-preview.1',
    source: {
      repository: 'https://github.com/TrentBrown/portreeve',
      commit: '1'.repeat(40),
    },
    versions: { server: '0.1.0', desktop: '0.1.0', client: '0.1.0' },
    policy: { maturity: 'alpha', channel: 'preview', desktopTrust: 'unsigned' },
    tools: { bun: '1.3.14', node: '22.20.0' },
    now: () => new Date('2026-08-16T20:00:00.000Z'),
  });
}

function stableRecord() {
  return createReleaseRecord({
    releaseVersion: '1.0.0',
    source: {
      repository: 'https://github.com/TrentBrown/portreeve',
      commit: '2'.repeat(40),
    },
    versions: { server: '1.0.0', desktop: '1.0.0', client: '1.0.0' },
    policy: {
      maturity: 'stable',
      channel: 'stable',
      desktopTrust: 'developer-id-notarized',
    },
    tools: { bun: '1.3.14', node: '22.20.0' },
  });
}

function publicationReadyRecord() {
  let record = advanceThroughDesktopPackaging(previewRecord());
  record = advanceReleaseRecord(record, 'desktop-trust-verified', {
    status: 'unsigned-preview',
  });
  return advanceReleaseRecord(record, 'distribution-finalized', {});
}

function legacyPublishedEvidence() {
  return {
    tag: 'v0.1.0-preview.1',
    githubReleaseUrl:
      'https://github.com/TrentBrown/portreeve/releases/tag/v0.1.0-preview.1',
    homebrewCommit: 'a'.repeat(40),
    desktopUpdateCommit: 'b'.repeat(40),
    publishedAt: '2026-08-16T22:00:00.000Z',
  };
}

/** @param {ReturnType<typeof previewRecord>} record */
function advanceThroughDesktopPackaging(record) {
  for (const stage of RELEASE_STAGES.slice(0, 3)) {
    record = advanceReleaseRecord(record, stage, {});
  }
  /** @type {Array<['macos'|'linux', 'arm64'|'x64']>} */
  const targets = [
    ['macos', 'arm64'],
    ['macos', 'x64'],
    ['linux', 'arm64'],
    ['linux', 'x64'],
  ];
  record.artifacts = targets.map(([operatingSystem, architecture], index) => ({
    type: 'executable',
    filename: `portreeve-${operatingSystem}-${architecture}`,
    path: `artifacts/portreeve-${operatingSystem}-${architecture}`,
    bytes: index + 1,
    sha256: String(index + 1).repeat(64),
    provenanceStage: 'native-cli-built',
    operatingSystem,
    architecture,
  }));
  record = advanceReleaseRecord(record, 'artifact-digests-established', {});
  const verifications = record.artifacts.map((artifact) => ({
    schemaVersion: /** @type {const} */ (1),
    kind: /** @type {const} */ ('native-cli-verification'),
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    target: {
      operatingSystem: artifact.operatingSystem,
      architecture: artifact.architecture,
    },
    artifact: {
      filename: artifact.filename,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
    },
    checks: {
      executableFormat: /** @type {const} */ (true),
      executableVersion: /** @type {const} */ (true),
      manualServer: /** @type {const} */ (true),
      supervisedLifecycle: /** @type {const} */ (true),
    },
    runner: {
      name: 'fixture',
      operatingSystem: String(artifact.operatingSystem),
      architecture: String(artifact.architecture),
    },
    verifiedAt: record.updatedAt,
  }));
  record = advanceReleaseRecord(record, 'native-cli-verified', {
    targets: targets.map(
      ([operatingSystem, architecture]) => `${operatingSystem}-${architecture}`,
    ),
    verificationCount: 4,
    verifications,
  });
  return advanceReleaseRecord(record, 'desktop-packaged', {
    packages: /** @type {Array<Record<string, unknown>>} */ ([
      {
        architecture: 'arm64',
        filename: 'PortReeve-arm64.dmg',
        sha256: 'a'.repeat(64),
        cliSha256: 'b'.repeat(64),
      },
      {
        architecture: 'x64',
        filename: 'PortReeve-x64.dmg',
        sha256: 'c'.repeat(64),
        cliSha256: 'd'.repeat(64),
      },
    ]),
  });
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-release-record-test-'));
  directories.push(directory);
  return directory;
}
