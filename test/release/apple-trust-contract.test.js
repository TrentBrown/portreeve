// @ts-check

import { describe, expect, test } from 'bun:test';
import {
  APPLE_NOTARY_KEY_NAME,
  APPLE_SIGNING_IDENTITY,
  APPLE_TEAM_ID,
  assertAppleSigningConfiguration,
  assertNotarizationCandidate,
  createNotarizationRecovery,
  nextNotarizationAction,
  parseCodesignFacts,
  parseGatekeeperFacts,
  parseNotarytoolFacts,
  parseNotarytoolSubmissionFacts,
  parseStaplerFacts,
  recordNotarizationObservation,
  runBoundedAppleCommand,
  withAppleCredentialScope,
} from '../../scripts/apple-trust-contract.js';

const REQUEST_ID = '11111111-2222-4333-8444-555555555555';
const SHA256 = 'a'.repeat(64);

describe('Apple trust contract', () => {
  test('accepts only the expected team identity and product-specific notary key', () => {
    expect(assertAppleSigningConfiguration(configuration())).toEqual(configuration());
    expect(() =>
      assertAppleSigningConfiguration({ ...configuration(), teamId: 'AAAAAAAAAA' }),
    ).toThrow('does not match PortReeve policy');
    expect(() =>
      assertAppleSigningConfiguration({ ...configuration(), keyName: 'GateReeve' }),
    ).toThrow('product-specific PortReeve key');
  });

  test('parses hardened-runtime and secure-timestamp identity facts', () => {
    expect(
      parseCodesignFacts(`Executable=/tmp/portreeve
Identifier=com.trentbrown.portreeve
Authority=${APPLE_SIGNING_IDENTITY}
Timestamp=Aug 28, 2026 at 8:00:00 PM
TeamIdentifier=${APPLE_TEAM_ID}
CodeDirectory v=20500 size=1 flags=0x10000(runtime) hashes=1+0 location=embedded
`),
    ).toEqual({
      identity: APPLE_SIGNING_IDENTITY,
      teamId: APPLE_TEAM_ID,
      hardenedRuntime: true,
      secureTimestamp: true,
    });
    expect(() =>
      parseCodesignFacts(`Authority=${APPLE_SIGNING_IDENTITY}
Timestamp=now
TeamIdentifier=${APPLE_TEAM_ID}`),
    ).toThrow('Hardened runtime flag is missing');
  });

  test('parses notarization, stapler, and Gatekeeper evidence', () => {
    expect(
      parseNotarytoolSubmissionFacts(
        JSON.stringify({ id: REQUEST_ID, message: 'Successfully uploaded file' }),
      ),
    ).toEqual({ requestId: REQUEST_ID });
    expect(
      parseNotarytoolFacts(JSON.stringify({ id: REQUEST_ID, status: 'Accepted' })),
    ).toEqual({ requestId: REQUEST_ID, status: 'Accepted' });
    expect(
      parseStaplerFacts({ exitCode: 0, stdout: 'The validate action worked!' }),
    ).toEqual({ stapled: true, validated: true });
    expect(
      parseGatekeeperFacts({
        exitCode: 0,
        stderr: `accepted\nsource=Notarized Developer ID\norigin=${APPLE_SIGNING_IDENTITY}\n`,
      }),
    ).toEqual({
      accepted: true,
      source: 'Notarized Developer ID',
      origin: APPLE_SIGNING_IDENTITY,
    });
    expect(
      parseGatekeeperFacts({
        exitCode: 0,
        stderr: `/tmp/PortReeve-0.1.0-preview.6-macos-arm64.dmg: accepted\nsource=Notarized Developer ID\norigin=${APPLE_SIGNING_IDENTITY}\n`,
      }),
    ).toEqual({
      accepted: true,
      source: 'Notarized Developer ID',
      origin: APPLE_SIGNING_IDENTITY,
    });
    expect(
      parseGatekeeperFacts({
        exitCode: 0,
        stderr: `/tmp/PortReeve-0.1.0-preview.7-macos-arm64.dmg: accepted\nsource=Notarized Developer ID\n`,
      }),
    ).toEqual({
      accepted: true,
      source: 'Notarized Developer ID',
    });
    expect(() =>
      parseGatekeeperFacts({
        exitCode: 0,
        stderr: `/tmp/PortReeve.dmg: rejected\nsource=Notarized Developer ID\norigin=${APPLE_SIGNING_IDENTITY}\n`,
      }),
    ).toThrow('did not accept');
    expect(() =>
      parseGatekeeperFacts({
        exitCode: 0,
        stderr: `accepted\nsource=Developer ID\norigin=${APPLE_SIGNING_IDENTITY}\n`,
      }),
    ).toThrow('did not accept');
    expect(() =>
      parseGatekeeperFacts({
        exitCode: 0,
        stderr: `accepted\nsource=Notarized Developer ID\norigin=Developer ID Application: Somebody Else (AAAAAAAAAA)\n`,
      }),
    ).toThrow('did not accept');
    expect(() => parseNotarytoolFacts('{')).toThrow('not valid JSON');
    expect(() => parseNotarytoolFacts(JSON.stringify({ id: REQUEST_ID }))).toThrow(
      'status must be a non-empty string',
    );
    expect(() =>
      parseNotarytoolFacts(JSON.stringify({ id: REQUEST_ID, status: 'Unknown' })),
    ).toThrow('status is unsupported');
  });

  test('bounds injected platform commands and aborts timed-out work', async () => {
    await expect(
      runBoundedAppleCommand('xcrun', ['notarytool'], {
        timeoutMs: 100,
        run: async (command, args) => ({ command, args }),
      }),
    ).resolves.toEqual({ command: 'xcrun', args: ['notarytool'] });
    let aborted = false;
    await expect(
      runBoundedAppleCommand('codesign', [], {
        timeoutMs: 5,
        run: async (_command, _args, { signal }) => {
          await new Promise((resolve) => {
            signal.addEventListener('abort', () => {
              aborted = true;
              resolve(undefined);
            });
          });
          return 'late';
        },
      }),
    ).rejects.toThrow('exceeded 5 ms');
    expect(aborted).toBe(true);
  });

  test('restores credential state after success, action failure, and prepare failure', async () => {
    for (const failure of ['none', 'action', 'prepare']) {
      /** @type {string[]} */
      const calls = [];
      const operation = withAppleCredentialScope(
        configuration(),
        {
          capture: async () => {
            calls.push('capture');
            return ['login.keychain-db'];
          },
          prepare: async () => {
            calls.push('prepare');
            if (failure === 'prepare') throw new Error('prepare failed');
            return { keychain: 'ephemeral.keychain-db' };
          },
          cleanup: async (scope, captured) => {
            calls.push(`cleanup:${scope?.keychain ?? 'none'}:${String(captured)}`);
          },
        },
        async () => {
          calls.push('action');
          if (failure === 'action') throw new Error('action failed');
          return 'done';
        },
      );
      if (failure === 'none') await expect(operation).resolves.toBe('done');
      else await expect(operation).rejects.toThrow(`${failure} failed`);
      expect(calls.at(-1)).toStartWith('cleanup:');
    }
    await expect(
      withAppleCredentialScope(
        configuration(),
        {
          capture: async () => 'captured',
          prepare: async () => 'prepared',
          cleanup: async () => {
            throw new Error('cleanup failed');
          },
        },
        async () => {
          throw new Error('action failed');
        },
      ),
    ).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Apple credential action and cleanup both failed.',
    });
  });

  test('continues one Apple request and never resubmits it', () => {
    const initial = recovery();
    const submitted = recordNotarizationObservation(
      initial,
      { kind: 'request-created', requestId: REQUEST_ID, status: 'In Progress' },
      '2026-08-29T03:01:00.000Z',
    );
    expect(nextNotarizationAction(submitted, '2026-08-29T03:02:00.000Z')).toEqual({
      action: 'poll',
      requestId: REQUEST_ID,
    });
    expect(() =>
      recordNotarizationObservation(
        submitted,
        { kind: 'request-created', requestId: REQUEST_ID },
        '2026-08-29T03:03:00.000Z',
      ),
    ).toThrow('must be polled, not resubmitted');
    const accepted = recordNotarizationObservation(
      submitted,
      { kind: 'poll', requestId: REQUEST_ID, status: 'Accepted' },
      '2026-08-29T03:04:00.000Z',
    );
    expect(nextNotarizationAction(accepted, '2026-08-29T03:05:00.000Z')).toEqual({
      action: 'accepted',
    });
    expect(initial.history).toEqual([]);
    expect(accepted.history).toHaveLength(2);
  });

  test('retries upload only after proven no-request and blocks bounded failures', () => {
    const first = recordNotarizationObservation(
      recovery(),
      { kind: 'upload-no-request', diagnostic: 'transport failed before response' },
      '2026-08-29T03:01:00.000Z',
    );
    expect(nextNotarizationAction(first, '2026-08-29T03:02:00.000Z')).toEqual({
      action: 'submit',
    });
    const exhausted = recordNotarizationObservation(
      first,
      { kind: 'upload-no-request', diagnostic: 'second pre-request failure' },
      '2026-08-29T03:03:00.000Z',
    );
    expect(nextNotarizationAction(exhausted, '2026-08-29T03:04:00.000Z')).toEqual({
      action: 'blocked',
    });
    expect(nextNotarizationAction(first, '2026-08-29T03:31:00.000Z')).toEqual({
      action: 'blocked',
      reason: 'deadline-expired',
    });
  });

  test('blocks terminal rejection and indeterminate submission state', () => {
    const rejected = recordNotarizationObservation(
      recovery(),
      { kind: 'request-created', requestId: REQUEST_ID, status: 'Rejected' },
      '2026-08-29T03:01:00.000Z',
    );
    expect(nextNotarizationAction(rejected, '2026-08-29T03:02:00.000Z')).toEqual({
      action: 'blocked',
    });
    expect(() =>
      recordNotarizationObservation(
        recovery(),
        { kind: 'request-created', requestId: REQUEST_ID, status: 'Uploaded' },
        '2026-08-29T03:01:00.000Z',
      ),
    ).toThrow('submission status is unsupported');
    const indeterminate = recordNotarizationObservation(
      recovery(),
      {
        kind: 'submission-indeterminate',
        diagnostic: 'successful response could not be parsed',
      },
      '2026-08-29T03:01:00.000Z',
    );
    expect(nextNotarizationAction(indeterminate, '2026-08-29T03:02:00.000Z')).toEqual({
      action: 'blocked',
    });
  });

  test('preserves a known request after indeterminate polling', () => {
    const submitted = recordNotarizationObservation(
      recovery(),
      { kind: 'request-created', requestId: REQUEST_ID },
      '2026-08-29T03:01:00.000Z',
    );
    const interrupted = recordNotarizationObservation(
      submitted,
      {
        kind: 'poll-indeterminate',
        requestId: REQUEST_ID,
        diagnostic: 'notarytool info output was incomplete',
      },
      '2026-08-29T03:02:00.000Z',
    );
    expect(nextNotarizationAction(interrupted, '2026-08-29T03:03:00.000Z')).toEqual({
      action: 'poll',
      requestId: REQUEST_ID,
    });
    expect(interrupted.uploadAttempts).toBe(1);
  });

  test('rejects cross-request polling and changed candidate identity', () => {
    const submitted = recordNotarizationObservation(
      recovery(),
      { kind: 'request-created', requestId: REQUEST_ID },
      '2026-08-29T03:01:00.000Z',
    );
    expect(() =>
      recordNotarizationObservation(
        submitted,
        {
          kind: 'poll',
          requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          status: 'Accepted',
        },
        '2026-08-29T03:02:00.000Z',
      ),
    ).toThrow('does not match the active Apple request');
    expect(() =>
      assertNotarizationCandidate(submitted, {
        releaseId: 'portreeve-v0.1.0-preview.2',
        sha256: 'b'.repeat(64),
      }),
    ).toThrow('next unused preview version');
  });
});

function configuration() {
  return {
    identity: APPLE_SIGNING_IDENTITY,
    teamId: APPLE_TEAM_ID,
    keyId: 'ABCDEFGHIJ',
    issuerId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    keyName: APPLE_NOTARY_KEY_NAME,
  };
}

function recovery() {
  return createNotarizationRecovery({
    releaseId: 'portreeve-v0.1.0-preview.1',
    sha256: SHA256,
    startedAt: '2026-08-29T03:00:00.000Z',
    deadlineAt: '2026-08-29T03:30:00.000Z',
    maxUploadAttempts: 2,
  });
}
