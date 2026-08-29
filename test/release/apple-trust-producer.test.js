// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { access } from 'node:fs/promises';
import {
  APPLE_NOTARY_KEY_NAME,
  APPLE_SIGNING_IDENTITY,
  APPLE_TEAM_ID,
  withAppleCredentialScope,
} from '../../scripts/apple-trust-contract.js';
import {
  assertProtectedProducerContext,
  createCredentialLifecycle,
} from '../../scripts/produce-apple-trusted-artifacts.js';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
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
});

function configuration() {
  return {
    identity: APPLE_SIGNING_IDENTITY,
    teamId: APPLE_TEAM_ID,
    keyId: 'ABCDEFGHIJ',
    issuerId: '11111111-2222-4333-8444-555555555555',
    keyName: APPLE_NOTARY_KEY_NAME,
  };
}
