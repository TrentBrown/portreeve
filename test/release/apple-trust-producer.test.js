// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  APPLE_NOTARY_KEY_NAME,
  APPLE_SIGNING_IDENTITY,
  APPLE_TEAM_ID,
  withAppleCredentialScope,
} from '../../scripts/apple-trust-contract.js';
import {
  assertProtectedProducerContext,
  createCredentialLifecycle,
  notarizeDmg,
  preserveNotarizationCandidate,
  rewriteTrustedReleaseMetadata,
  stageTrustedReleaseArtifacts,
} from '../../scripts/produce-apple-trusted-artifacts.js';
import { renderChecksumFile, sha256File } from '../../scripts/release-lib.js';
import { createReleaseRecord } from '../../scripts/release-record.js';

const originalEnvironment = { ...process.env };
/** @type {string[]} */
const directories = [];

afterEach(async () => {
  process.env = { ...originalEnvironment };
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('Apple trust producer', () => {
  test('accepts only a pinned trusted candidate from main', () => {
    const valid = {
      githubRef: 'refs/heads/main',
      githubSha: 'a'.repeat(40),
      sourceCommit: 'a'.repeat(40),
      desktopTrust: 'developer-id-notarized',
      lastStage: 'candidate-qualified',
      githubRunAttempt: '1',
    };
    expect(() => assertProtectedProducerContext(valid)).not.toThrow();
    expect(() =>
      assertProtectedProducerContext({ ...valid, githubRef: 'refs/heads/topic' }),
    ).toThrow('main-only');
    expect(() =>
      assertProtectedProducerContext({ ...valid, githubSha: 'b'.repeat(40) }),
    ).toThrow('does not match the pinned release commit');
    expect(() =>
      assertProtectedProducerContext({ ...valid, desktopTrust: 'unsigned' }),
    ).toThrow('requires Developer ID notarization policy');
    expect(() =>
      assertProtectedProducerContext({ ...valid, githubRunAttempt: '2' }),
    ).toThrow('cannot be rerun after a protected attempt');
  });

  test('validates public configuration before credential decoding', async () => {
    /** @type {string[]} */
    const calls = [];
    const lifecycle = createCredentialLifecycle({
      run: async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`);
        return { stdout: '', stderr: '', exitCode: 0 };
      },
    });
    await expect(
      withAppleCredentialScope(
        { ...configuration(), teamId: 'AAAAAAAAAA' },
        lifecycle,
        async () => undefined,
      ),
    ).rejects.toThrow('does not match PortReeve policy');
    expect(calls).toEqual([]);
  });

  test('restores and deletes partial credential state when import fails', async () => {
    process.env.PORTREEVE_APPLE_CERTIFICATE_P12_BASE64 =
      Buffer.from('p12').toString('base64');
    process.env.PORTREEVE_APPLE_CERTIFICATE_PASSWORD = 'certificate-password';
    process.env.PORTREEVE_APPLE_NOTARY_KEY_P8_BASE64 =
      Buffer.from('p8').toString('base64');
    /** @type {Array<{command: string, args: string[]}>} */
    const calls = [];
    const lifecycle = createCredentialLifecycle({
      run: async (command, args) => {
        calls.push({ command, args });
        if (
          command === 'security' &&
          args[0] === 'list-keychains' &&
          args.length === 3
        ) {
          return {
            stdout: '    "/Users/runner/Library/Keychains/login.keychain-db"\n',
            stderr: '',
            exitCode: 0,
          };
        }
        if (command === 'security' && args[0] === 'import') {
          return { stdout: '', stderr: 'injected failure', exitCode: 1 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      },
    });
    await expect(
      withAppleCredentialScope(configuration(), lifecycle, async () => undefined),
    ).rejects.toThrow('certificate import failed');
    const deletion = calls.find(({ args }) => args[0] === 'delete-keychain');
    expect(deletion).toBeDefined();
    expect(
      calls.some(
        ({ args }) =>
          args[0] === 'list-keychains' &&
          args.includes('/Users/runner/Library/Keychains/login.keychain-db') &&
          !args.some((arg) => arg.includes('release.keychain-db')),
      ),
    ).toBe(true);
    const keychainPath = deletion?.args[1];
    if (keychainPath === undefined) throw new Error('Expected keychain path.');
    await expect(
      access(keychainPath.replace('/release.keychain-db', '')),
    ).rejects.toThrow();
  });

  test('rewrites every signed CLI metadata authority as one consistent set', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-trusted-metadata-'));
    directories.push(root);
    const artifactsRoot = join(root, 'artifacts');
    await mkdir(artifactsRoot);
    const transformations = [
      transformation('arm64', 'a', 'c', 20, 24),
      transformation('x64', 'b', 'd', 21, 25),
    ];
    const manifest = {
      schemaVersion: 1,
      artifacts: [
        ...transformations.map((entry) => ({
          type: 'executable',
          filename: entry.filename,
          operatingSystem: 'macos',
          architecture: entry.architecture,
          ...entry.predecessor,
        })),
        {
          type: 'homebrew-formula',
          filename: 'portreeve.rb',
          bytes: 0,
          sha256: '0'.repeat(64),
        },
      ],
    };
    const formula = transformations
      .map((entry) => `sha256 "${entry.predecessor.sha256}"`)
      .join('\n')
      .concat('\n');
    await writeFile(join(artifactsRoot, 'portreeve.rb'), formula);
    const formulaIdentity = {
      bytes: (await stat(join(artifactsRoot, 'portreeve.rb'))).size,
      sha256: await sha256File(join(artifactsRoot, 'portreeve.rb')),
    };
    const formulaManifestEntry = manifest.artifacts.at(-1);
    if (formulaManifestEntry === undefined) {
      throw new Error('Missing formula manifest fixture.');
    }
    Object.assign(formulaManifestEntry, formulaIdentity);
    await writeFile(
      join(artifactsRoot, 'manifest.json'),
      JSON.stringify(manifest, null, 2).concat('\n'),
    );
    await writeFile(
      join(artifactsRoot, 'SHA256SUMS'),
      renderChecksumFile(manifest.artifacts),
    );
    const record = {
      artifacts: await Promise.all(
        ['portreeve.rb', 'manifest.json', 'SHA256SUMS'].map(async (filename) => ({
          filename,
          bytes: (await stat(join(artifactsRoot, filename))).size,
          sha256: await sha256File(join(artifactsRoot, filename)),
        })),
      ),
    };
    await rewriteTrustedReleaseMetadata({ releaseRoot: root, record, transformations });
    const rewrittenManifest = JSON.parse(
      await readFile(join(artifactsRoot, 'manifest.json'), 'utf8'),
    );
    for (const entry of transformations) {
      expect(rewrittenManifest.artifacts).toContainEqual(
        expect.objectContaining({
          filename: entry.filename,
          bytes: entry.signed.bytes,
          sha256: entry.signed.sha256,
        }),
      );
    }
    const rewrittenFormula = await readFile(
      join(artifactsRoot, 'portreeve.rb'),
      'utf8',
    );
    const firstTransformation = transformations[0];
    if (firstTransformation === undefined) {
      throw new Error('Missing transformation fixture.');
    }
    expect(rewrittenFormula).not.toContain(firstTransformation.predecessor.sha256);
    expect(rewrittenFormula).toContain(firstTransformation.signed.sha256);
    expect(await readFile(join(artifactsRoot, 'SHA256SUMS'), 'utf8')).toBe(
      renderChecksumFile(rewrittenManifest.artifacts),
    );
    for (const artifact of record.artifacts) {
      expect(artifact.bytes).toBe(
        (await stat(join(artifactsRoot, artifact.filename))).size,
      );
      expect(artifact.sha256).toBe(
        await sha256File(join(artifactsRoot, artifact.filename)),
      );
    }
  });

  test('stages one predecessor manifest before the authoritative rewrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-trusted-stage-'));
    directories.push(root);
    const releaseRoot = join(root, 'release');
    const sourceArtifacts = join(releaseRoot, 'artifacts');
    const signedArtifacts = join(root, 'signed-artifacts');
    const dmgRoot = join(root, 'dmgs');
    const outputRoot = join(root, 'trusted');
    await Promise.all([
      mkdir(sourceArtifacts, { recursive: true }),
      mkdir(signedArtifacts, { recursive: true }),
      mkdir(dmgRoot, { recursive: true }),
      mkdir(outputRoot, { recursive: true }),
    ]);
    const transformations = [
      transformation('arm64', 'a', 'c', 20, 24),
      transformation('x64', 'b', 'd', 21, 25),
    ];
    const manifest = {
      schemaVersion: 1,
      artifacts: [
        ...transformations.map((entry) => ({
          type: 'executable',
          filename: entry.filename,
          operatingSystem: 'macos',
          architecture: entry.architecture,
          ...entry.predecessor,
        })),
        {
          type: 'homebrew-formula',
          filename: 'portreeve.rb',
          bytes: 0,
          sha256: '0'.repeat(64),
        },
      ],
    };
    const formula = transformations
      .map((entry) => `sha256 "${entry.predecessor.sha256}"`)
      .join('\n')
      .concat('\n');
    await writeFile(join(sourceArtifacts, 'portreeve.rb'), formula);
    const formulaManifestEntry = manifest.artifacts.at(-1);
    if (formulaManifestEntry === undefined) throw new Error('Formula missing.');
    Object.assign(formulaManifestEntry, {
      bytes: (await stat(join(sourceArtifacts, 'portreeve.rb'))).size,
      sha256: await sha256File(join(sourceArtifacts, 'portreeve.rb')),
    });
    await writeFile(
      join(sourceArtifacts, 'manifest.json'),
      JSON.stringify(manifest, null, 2).concat('\n'),
    );
    await writeFile(
      join(sourceArtifacts, 'SHA256SUMS'),
      renderChecksumFile(manifest.artifacts),
    );
    for (const entry of transformations) {
      await writeFile(join(signedArtifacts, entry.filename), entry.signed.sha256);
    }
    const record = createReleaseRecord({
      releaseVersion: '0.1.0-preview.9',
      source: {
        repository: 'TrentBrown/portreeve',
        commit: 'a'.repeat(40),
      },
      versions: {
        server: '0.1.0-preview.9',
        desktop: '0.1.0-preview.9',
        client: '0.1.0-preview.9',
      },
      policy: {
        maturity: 'alpha',
        channel: 'preview',
        desktopTrust: 'developer-id-notarized',
      },
      tools: {},
    });
    record.artifacts = [
      ...transformations.map((entry) => ({
        type: 'executable',
        filename: entry.filename,
        path: `artifacts/${entry.filename}`,
        provenanceStage: 'artifact-digests-established',
        operatingSystem: 'macos',
        architecture: entry.architecture,
        ...entry.predecessor,
      })),
      ...(await Promise.all(
        ['portreeve.rb', 'manifest.json', 'SHA256SUMS'].map(async (filename) => ({
          type: 'release-metadata',
          filename,
          path: `artifacts/${filename}`,
          provenanceStage: 'artifact-digests-established',
          bytes: (await stat(join(sourceArtifacts, filename))).size,
          sha256: await sha256File(join(sourceArtifacts, filename)),
        })),
      )),
    ];
    const result = await stageTrustedReleaseArtifacts({
      releaseRoot,
      outputRoot,
      signedArtifacts,
      dmgRoot,
      record,
      packages: [],
      transformations,
    });
    const rewrittenManifest = JSON.parse(
      await readFile(join(outputRoot, 'artifacts', 'manifest.json'), 'utf8'),
    );
    for (const entry of transformations) {
      expect(rewrittenManifest.artifacts).toContainEqual(
        expect.objectContaining({
          filename: entry.filename,
          bytes: entry.signed.bytes,
          sha256: entry.signed.sha256,
        }),
      );
      expect(result.trustedRecord.artifacts).toContainEqual(
        expect.objectContaining({
          filename: entry.filename,
          bytes: entry.signed.bytes,
          sha256: entry.signed.sha256,
        }),
      );
    }
    const untouchedManifest = JSON.parse(
      await readFile(join(sourceArtifacts, 'manifest.json'), 'utf8'),
    );
    expect(untouchedManifest.artifacts[0].sha256).toBe(
      transformations[0]?.predecessor.sha256,
    );
  });

  test('keeps request-bound candidates until producer evidence is durable', async () => {
    const source = await readFile(
      join('scripts', 'produce-apple-trusted-artifacts.js'),
      'utf8',
    );
    expect(source.indexOf('await rm(recoveryCandidatesRoot')).toBeGreaterThan(
      source.indexOf("'apple-trust-producer.json'"),
    );
  });

  test('records an asynchronous submit response and polls exactly one request', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-notary-producer-'));
    directories.push(root);
    const dmgPath = join(root, 'PortReeve-test.dmg');
    await writeFile(dmgPath, 'signed candidate');
    /** @type {Array<{command: string, args: string[]}>} */
    const calls = [];
    /** @type {Array<Record<string, any>>} */
    const recoveries = [];
    let infoCalls = 0;
    const result = await notarizeDmg({
      dmgPath,
      releaseId: 'portreeve-v0.1.0-preview.6',
      scope: { notaryKey: '/private/AuthKey_TEST.p8' },
      configuration: configuration(),
      run: async (command, args) => {
        calls.push({ command, args });
        if (args[1] === 'submit') {
          return {
            stdout: JSON.stringify({
              id: '11111111-2222-4333-8444-555555555555',
              message: 'Successfully uploaded file',
            }),
            stderr: '',
            exitCode: 0,
          };
        }
        infoCalls += 1;
        return {
          stdout: JSON.stringify({
            id: '11111111-2222-4333-8444-555555555555',
            status: infoCalls === 1 ? 'In Progress' : 'Accepted',
          }),
          stderr: '',
          exitCode: 0,
        };
      },
      now: tickingClock('2026-08-29T18:00:00.000Z'),
      sleep: async () => undefined,
      persistRecovery: async (recovery) => {
        recoveries.push(structuredClone(recovery));
      },
    });
    const submissions = calls.filter(({ args }) => args[1] === 'submit');
    const polls = calls.filter(({ args }) => args[1] === 'info');
    expect(submissions).toHaveLength(1);
    expect(polls).toHaveLength(2);
    expect(polls.every(({ args }) => args[2] === result.requestId)).toBe(true);
    expect(result).toMatchObject({
      requestId: '11111111-2222-4333-8444-555555555555',
      status: 'Accepted',
      recovery: {
        status: 'accepted',
        uploadAttempts: 1,
        currentRequestId: '11111111-2222-4333-8444-555555555555',
      },
    });
    expect(recoveries.map(({ status }) => status)).toEqual([
      'awaiting-upload',
      'awaiting-poll',
      'awaiting-poll',
      'accepted',
    ]);
  });

  test('preserves submitted DMG bytes when the working copy is later mutated', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-notary-candidate-'));
    directories.push(root);
    const workingPath = join(root, 'work', 'PortReeve-test.dmg');
    const recoveryRoot = join(root, 'recovery', 'candidates');
    await mkdir(join(root, 'work'));
    await writeFile(workingPath, 'signed pre-staple bytes');
    const submittedPath = await preserveNotarizationCandidate({
      sourcePath: workingPath,
      recoveryCandidatesRoot: recoveryRoot,
    });
    const submittedSha256 = await sha256File(submittedPath);

    await writeFile(workingPath, 'signed pre-staple bytes plus staple ticket');

    expect(await sha256File(submittedPath)).toBe(submittedSha256);
    expect(await sha256File(workingPath)).not.toBe(submittedSha256);
    expect(await readFile(submittedPath, 'utf8')).toBe('signed pre-staple bytes');
  });

  test('keeps info status strict while preserving the known request', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-notary-producer-'));
    directories.push(root);
    const dmgPath = join(root, 'PortReeve-test.dmg');
    const recoveryPath = join(root, 'recovery', 'notarization-arm64.json');
    await writeFile(dmgPath, 'signed candidate');
    await expect(
      notarizeDmg({
        dmgPath,
        releaseId: 'portreeve-v0.1.0-preview.6',
        recoveryPath,
        scope: { notaryKey: '/private/AuthKey_TEST.p8' },
        configuration: configuration(),
        run: async (_command, args) => ({
          stdout: JSON.stringify(
            args[1] === 'submit'
              ? {
                  id: '11111111-2222-4333-8444-555555555555',
                  message: 'Successfully uploaded file',
                }
              : { id: '11111111-2222-4333-8444-555555555555' },
          ),
          stderr: '',
          exitCode: 0,
        }),
        now: tickingClock('2026-08-29T18:00:00.000Z'),
        sleep: async () => undefined,
      }),
    ).rejects.toThrow('status must be a non-empty string');
    const recovery = JSON.parse(await readFile(recoveryPath, 'utf8'));
    expect(recovery).toMatchObject({
      status: 'awaiting-poll',
      uploadAttempts: 1,
      currentRequestId: '11111111-2222-4333-8444-555555555555',
      candidate: {
        releaseId: 'portreeve-v0.1.0-preview.6',
        sha256: await sha256File(dmgPath),
      },
      history: [{ kind: 'request-created' }, { kind: 'poll-indeterminate' }],
    });
    /** @type {string[]} */
    const resumedActions = [];
    const resumed = await notarizeDmg({
      dmgPath,
      releaseId: 'portreeve-v0.1.0-preview.6',
      recovery,
      scope: { notaryKey: '/private/AuthKey_TEST.p8' },
      configuration: configuration(),
      run: async (_command, args) => {
        resumedActions.push(String(args[1]));
        return {
          stdout: JSON.stringify({
            id: '11111111-2222-4333-8444-555555555555',
            status: 'Accepted',
          }),
          stderr: '',
          exitCode: 0,
        };
      },
      now: tickingClock('2026-08-29T18:05:00.000Z'),
      sleep: async () => undefined,
      persistRecovery: async () => undefined,
    });
    expect(resumedActions).toEqual(['info']);
    expect(resumed).toMatchObject({
      requestId: '11111111-2222-4333-8444-555555555555',
      status: 'Accepted',
      recovery: { uploadAttempts: 1, status: 'accepted' },
    });
  });

  test('preserves a machine-readable request ID even when submit exits nonzero', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portreeve-notary-producer-'));
    directories.push(root);
    const dmgPath = join(root, 'PortReeve-test.dmg');
    await writeFile(dmgPath, 'signed candidate');
    /** @type {Array<Record<string, any>>} */
    const recoveries = [];
    await expect(
      notarizeDmg({
        dmgPath,
        releaseId: 'portreeve-v0.1.0-preview.6',
        scope: { notaryKey: '/private/AuthKey_TEST.p8' },
        configuration: configuration(),
        run: async () => ({
          stdout: JSON.stringify({
            id: '11111111-2222-4333-8444-555555555555',
          }),
          stderr: '',
          exitCode: 1,
        }),
        now: tickingClock('2026-08-29T18:00:00.000Z'),
        persistRecovery: async (recovery) => {
          recoveries.push(structuredClone(recovery));
        },
      }),
    ).rejects.toThrow('submission failed with exit 1');
    expect(recoveries.at(-1)).toMatchObject({
      status: 'awaiting-poll',
      uploadAttempts: 1,
      currentRequestId: '11111111-2222-4333-8444-555555555555',
      history: [
        {
          kind: 'request-created',
          diagnostic: 'notarytool submit exited 1; request ID preserved',
        },
      ],
    });
  });
});

/** @param {string} initial */
function tickingClock(initial) {
  let current = Date.parse(initial);
  return () => {
    const value = new Date(current);
    current += 1_000;
    return value;
  };
}

/** @param {'arm64'|'x64'} architecture @param {string} before @param {string} after @param {number} beforeBytes @param {number} afterBytes */
function transformation(architecture, before, after, beforeBytes, afterBytes) {
  return {
    architecture,
    filename: `portreeve-v0.1.0-preview.5-macos-${architecture}`,
    predecessor: { bytes: beforeBytes, sha256: before.repeat(64) },
    signed: { bytes: afterBytes, sha256: after.repeat(64) },
  };
}

function configuration() {
  return {
    identity: APPLE_SIGNING_IDENTITY,
    teamId: APPLE_TEAM_ID,
    keyId: 'ABCDEFGHIJ',
    issuerId: '11111111-2222-4333-8444-555555555555',
    keyName: APPLE_NOTARY_KEY_NAME,
  };
}
