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
  rewriteTrustedReleaseMetadata,
} from '../../scripts/produce-apple-trusted-artifacts.js';
import { renderChecksumFile, sha256File } from '../../scripts/release-lib.js';

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
});

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
