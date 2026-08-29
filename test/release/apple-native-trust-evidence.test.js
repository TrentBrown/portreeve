// @ts-check

import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  aggregateAppleNativeTrustEvidence,
  assertAppleNativeTrustEvidence,
  verifyQuarantinedNativeCli,
} from '../../scripts/apple-native-trust-evidence.js';
import {
  APPLE_SIGNING_IDENTITY,
  APPLE_TEAM_ID,
} from '../../scripts/apple-trust-contract.js';
import { createNativeVerification } from '../../scripts/native-release-evidence.js';
import { RELEASE_TARGETS } from '../../scripts/release-lib.js';
import {
  advanceReleaseRecord,
  createReleaseRecord,
} from '../../scripts/release-record.js';

describe('Apple native trust evidence', () => {
  test('requires exactly one current native ARM64 and Intel authority', () => {
    const { record, producer } = trustedAuthorityFixture();
    const arm64 = nativeEvidence(record, producer, 'arm64');
    const x64 = nativeEvidence(record, producer, 'x64');
    expect(() => assertAppleNativeTrustEvidence(arm64)).not.toThrow();
    const result = aggregateAppleNativeTrustEvidence(record, producer, [x64, arm64]);
    expect(result.ordered.map(({ target }) => target.architecture)).toEqual([
      'arm64',
      'x64',
    ]);
    expect(result.trustEvidence).toMatchObject({
      signatureIdentity: APPLE_SIGNING_IDENTITY,
      teamId: APPLE_TEAM_ID,
      hardenedRuntime: true,
      secureTimestamp: true,
      stapled: true,
      gatekeeperAssessment: 'accepted',
      nativeArchitectures: ['arm64', 'x64'],
    });
    expect(() =>
      aggregateAppleNativeTrustEvidence(record, producer, [arm64, arm64]),
    ).toThrow('Duplicate');
    expect(() => aggregateAppleNativeTrustEvidence(record, producer, [arm64])).toThrow(
      'requires ARM64 and Intel',
    );
  });

  test('rejects translated, stale, incomplete, and cross-architecture evidence', () => {
    const { record, producer } = trustedAuthorityFixture();
    const valid = nativeEvidence(record, producer, 'arm64');
    const translated = structuredClone(valid);
    translated.runner.architecture = 'x64';
    expect(() => assertAppleNativeTrustEvidence(translated)).toThrow('runner');
    const incomplete = structuredClone(valid);
    incomplete.checks.embeddedCliEqual = false;
    expect(() => assertAppleNativeTrustEvidence(incomplete)).toThrow(
      'embeddedCliEqual',
    );
    const forgedIdentity = structuredClone(valid);
    forgedIdentity.cli.codesign.identity = 'Developer ID Application: Somebody Else';
    expect(() => assertAppleNativeTrustEvidence(forgedIdentity)).toThrow(
      'identity checks',
    );
    expect(valid.cli.gatekeeper).toBeUndefined();
    const missingQuarantineSmoke = /** @type {Record<string, any>} */ (
      structuredClone(valid)
    );
    delete missingQuarantineSmoke.checks.quarantinedCliSmoke;
    expect(() => assertAppleNativeTrustEvidence(missingQuarantineSmoke)).toThrow(
      'quarantinedCliSmoke',
    );
    const omittedGatekeeperOrigin = /** @type {Record<string, any>} */ (
      structuredClone(valid)
    );
    delete omittedGatekeeperOrigin.dmg.gatekeeper.origin;
    expect(() => assertAppleNativeTrustEvidence(omittedGatekeeperOrigin)).not.toThrow();
    const forgedGatekeeperOrigin = structuredClone(valid);
    forgedGatekeeperOrigin.dmg.gatekeeper.origin =
      'Developer ID Application: Somebody Else (AAAAAAAAAA)';
    expect(() => assertAppleNativeTrustEvidence(forgedGatekeeperOrigin)).toThrow(
      'identity checks',
    );
    const missingRuntime = structuredClone(valid);
    missingRuntime.application.codesign.hardenedRuntime = false;
    expect(() => assertAppleNativeTrustEvidence(missingRuntime)).toThrow(
      'executable hardened-runtime',
    );
    const stale = structuredClone(valid);
    stale.source.commit = '9'.repeat(40);
    expect(() =>
      aggregateAppleNativeTrustEvidence(record, producer, [
        stale,
        nativeEvidence(record, producer, 'x64'),
      ]),
    ).toThrow('stale');
    const crossed = structuredClone(valid);
    const x64Transformation = producer.transformations[1];
    if (x64Transformation === undefined) {
      throw new Error('Missing x64 transformation fixture.');
    }
    crossed.cli.sha256 = x64Transformation.signed.sha256;
    expect(() =>
      aggregateAppleNativeTrustEvidence(record, producer, [
        crossed,
        nativeEvidence(record, producer, 'x64'),
      ]),
    ).toThrow('stale');
  });

  test('executes an exact quarantined CLI probe without app-policy assessment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-quarantine-test-'));
    const cliPath = join(root, 'portreeve-v0.1.0-preview.10-macos-arm64');
    await writeFile(cliPath, 'fixture');
    /** @type {string[][]} */
    const commands = [];
    try {
      await verifyQuarantinedNativeCli({
        cliPath,
        releaseVersion: '0.1.0-preview.10',
        run: async (command, args) => {
          commands.push([command, ...args]);
          if (command === 'xattr' && args[0] === '-p') {
            return {
              exitCode: 0,
              stdout: '0081;00000000;PortReeve;00000000-0000-0000-0000-000000000000\n',
              stderr: '',
            };
          }
          if (command === 'xattr') {
            return { exitCode: 0, stdout: '', stderr: '' };
          }
          return { exitCode: 0, stdout: '0.1.0-preview.10\n', stderr: '' };
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    expect(commands.some(([command]) => command === 'spctl')).toBe(false);
    expect(commands.filter(([command]) => command === 'xattr')).toHaveLength(2);
    expect(commands.at(-1)?.at(-1)).toBe('--version');
  });

  test('rejects a quarantined CLI probe with the wrong release identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-quarantine-test-'));
    const cliPath = join(root, 'portreeve-v0.1.0-preview.10-macos-arm64');
    await writeFile(cliPath, 'fixture');
    try {
      await expect(
        verifyQuarantinedNativeCli({
          cliPath,
          releaseVersion: '0.1.0-preview.10',
          run: async (command, args) => {
            if (command === 'xattr' && args[0] === '-p') {
              return {
                exitCode: 0,
                stdout:
                  '0081;00000000;PortReeve;00000000-0000-0000-0000-000000000000\n',
                stderr: '',
              };
            }
            if (command === 'xattr') {
              return { exitCode: 0, stdout: '', stderr: '' };
            }
            return { exitCode: 0, stdout: '0.1.0-preview.9\n', stderr: '' };
          },
        }),
      ).rejects.toThrow('unexpected release version');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function trustedAuthorityFixture() {
  let record = createReleaseRecord({
    releaseVersion: '0.1.0-preview.5',
    source: {
      repository: 'https://github.com/TrentBrown/portreeve',
      commit: '8'.repeat(40),
    },
    versions: {
      server: '0.1.0-preview.5',
      desktop: '0.1.0-preview.5',
      client: '0.1.0-preview.5',
    },
    policy: {
      maturity: 'alpha',
      channel: 'preview',
      desktopTrust: 'developer-id-notarized',
    },
    tools: { bun: '1.3.14' },
  });
  record = advanceReleaseRecord(record, 'source-pinned', {});
  record = advanceReleaseRecord(record, 'policy-resolved', {});
  record = advanceReleaseRecord(record, 'native-cli-built', {});
  record.artifacts = RELEASE_TARGETS.map((target, index) => ({
    type: 'executable',
    filename: `portreeve-v0.1.0-preview.5-${target.operatingSystem}-${target.architecture}`,
    path: `artifacts/portreeve-v0.1.0-preview.5-${target.operatingSystem}-${target.architecture}`,
    bytes: 100 + index,
    sha256: String(index + 1).repeat(64),
    provenanceStage: 'native-cli-built',
    operatingSystem: target.operatingSystem,
    architecture: target.architecture,
  }));
  record = advanceReleaseRecord(record, 'artifact-digests-established', {
    artifactCount: 4,
  });
  record = advanceReleaseRecord(record, 'candidate-qualified', {
    artifactCount: 4,
    credentialAccess: false,
  });
  const verifications = RELEASE_TARGETS.map((target) =>
    createNativeVerification(record, target, {
      name: `native-${target.operatingSystem}-${target.architecture}`,
      operatingSystem: target.operatingSystem,
      architecture: target.architecture,
    }),
  );
  const transformations = ['arm64', 'x64'].map((architecture, index) => {
    const artifact = record.artifacts.find(
      (entry) =>
        entry.operatingSystem === 'macos' && entry.architecture === architecture,
    );
    if (artifact === undefined) throw new Error('Missing macOS fixture artifact.');
    const predecessor = { bytes: artifact.bytes, sha256: artifact.sha256 };
    const signed = { bytes: artifact.bytes + 20, sha256: `${index + 7}`.repeat(64) };
    artifact.bytes = signed.bytes;
    artifact.sha256 = signed.sha256;
    return { architecture, filename: artifact.filename, predecessor, signed };
  });
  record = advanceReleaseRecord(record, 'macos-cli-authority-established', {
    mode: 'developer-id-signed',
    architectures: ['arm64', 'x64'],
    targets: ['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'],
    verificationCount: 4,
    verifications,
    transformations,
  });
  const packages = transformations.map((transformation, index) => ({
    architecture: transformation.architecture,
    cliSha256: transformation.signed.sha256,
    application: {
      filename: 'PortReeve.app',
      seal: { bytes: 500 + index, sha256: `${index + 3}`.repeat(64) },
      codesign: codesign(),
    },
    dmg: {
      filename: `PortReeve-0.1.0-preview.5-macos-${transformation.architecture}.dmg`,
      bytes: 800 + index,
      sha256: `${index + 5}`.repeat(64),
      codesign: codesign(false),
      notarization: {
        requestId: `${index + 1}1111111-2222-4333-8444-555555555555`,
        status: 'Accepted',
      },
      stapler: { stapled: true, validated: true },
      gatekeeper: gatekeeper(),
    },
  }));
  return {
    record,
    producer: {
      schemaVersion: 1,
      kind: 'portreeve-apple-trust-producer',
      releaseId: record.releaseId,
      source: { ...record.source },
      transformations,
      packages,
      publicationAuthority: false,
    },
  };
}

/**
 * @param {Record<string, any>} record
 * @param {Record<string, any>} producer
 * @param {'arm64' | 'x64'} architecture
 */
function nativeEvidence(record, producer, architecture) {
  const transformation = producer.transformations.find(
    (/** @type {Record<string, any>} */ entry) => entry.architecture === architecture,
  );
  const packageEntry = producer.packages.find(
    (/** @type {Record<string, any>} */ entry) => entry.architecture === architecture,
  );
  if (transformation === undefined || packageEntry === undefined) {
    throw new Error('Missing architecture fixture.');
  }
  return {
    schemaVersion: 1,
    kind: 'portreeve-apple-native-trust',
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    policy: { ...record.policy },
    target: { operatingSystem: 'macos', architecture },
    predecessor: transformation.predecessor,
    cli: {
      filename: transformation.filename,
      ...transformation.signed,
      codesign: codesign(),
    },
    application: {
      filename: 'PortReeve.app',
      seal: packageEntry.application.seal,
      codesign: codesign(),
      gatekeeper: gatekeeper(),
    },
    dmg: {
      filename: packageEntry.dmg.filename,
      bytes: packageEntry.dmg.bytes,
      sha256: packageEntry.dmg.sha256,
      codesign: codesign(false),
      notarization: packageEntry.dmg.notarization,
      stapler: { stapled: true, validated: true },
      gatekeeper: gatekeeper(),
    },
    checks: {
      deepStrictSignature: true,
      embeddedCliEqual: true,
      nativeCliSmoke: true,
      quarantinedCliSmoke: true,
      applicationSmoke: true,
      lifecycleSmoke: true,
    },
    runner: { name: `runner-${architecture}`, operatingSystem: 'darwin', architecture },
    verifiedAt: '2026-08-29T12:00:00.000Z',
  };
}

/** @param {boolean} [hardenedRuntime] */
function codesign(hardenedRuntime = true) {
  return {
    identity: APPLE_SIGNING_IDENTITY,
    teamId: APPLE_TEAM_ID,
    hardenedRuntime,
    secureTimestamp: true,
  };
}

function gatekeeper() {
  return {
    accepted: true,
    source: 'Notarized Developer ID',
    origin: APPLE_SIGNING_IDENTITY,
  };
}
