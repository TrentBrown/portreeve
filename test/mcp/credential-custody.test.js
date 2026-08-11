// @ts-check

import { describe, expect, test } from 'bun:test';
import {
  CredentialCustody,
  CredentialCustodyError,
} from '../../src/mcp/credential-custody.js';

function fixture() {
  let now = Date.parse('2026-08-11T12:00:00.000Z');
  /** @type {Array<{callback: () => void, delay: number, cancelled: boolean}>} */
  const timers = [];
  /** @type {Array<{leaseId: string, leaseToken: string}>} */
  const standaloneRenewals = [];
  /** @type {Array<{activationId: string, credentials: Array<{leaseId: string, leaseToken: string}>}>} */
  const activationRenewals = [];
  let nextHandle = 0;
  const custody = new CredentialCustody({
    now: () => new Date(now),
    createHandle: () => String(++nextHandle).padStart(43, 'a'),
    schedule: (callback, delay) => {
      const timer = { callback, delay, cancelled: false };
      timers.push(timer);
      return timer;
    },
    cancel: (timer) => {
      /** @type {{cancelled: boolean}} */ (timer).cancelled = true;
    },
    renewLease: async (credential) => {
      standaloneRenewals.push(credential);
      return {
        leaseId: credential.leaseId,
        expiresAt: new Date(now + 30_000).toISOString(),
      };
    },
    renewActivation: async (activationId, credentials) => {
      activationRenewals.push({ activationId, credentials });
      return {
        leases: credentials.map(({ leaseId }) => ({
          leaseId,
          expiresAt: new Date(now + 30_000).toISOString(),
        })),
      };
    },
  });
  return {
    custody,
    timers,
    standaloneRenewals,
    activationRenewals,
    /** @param {number} milliseconds */
    advance(milliseconds) {
      now += milliseconds;
    },
    async runLatestTimer() {
      const timer = timers.findLast(({ cancelled }) => !cancelled);
      if (timer === undefined) throw new Error('No live timer is scheduled.');
      timer.callback();
      await Bun.sleep(0);
    },
  };
}

describe('MCP credential custody', () => {
  test('returns only an opaque handle and renews by the earlier TTL-derived bound', async () => {
    const testFixture = fixture();
    const held = testFixture.custody.holdLease({
      leaseId: '11111111-1111-4111-8111-111111111111',
      leaseToken: 'seeded-secret-that-must-never-cross-the-mcp-boundary',
      expiresAt: '2026-08-11T12:00:30.000Z',
    });

    expect(JSON.stringify(held)).not.toContain('seeded-secret');
    expect(held.credentialHandle).toHaveLength(43);
    expect(testFixture.timers[0]?.delay).toBe(10_000);

    testFixture.advance(10_000);
    await testFixture.runLatestTimer();
    expect(testFixture.standaloneRenewals).toEqual([
      {
        leaseId: '11111111-1111-4111-8111-111111111111',
        leaseToken: 'seeded-secret-that-must-never-cross-the-mcp-boundary',
      },
    ]);
    expect(testFixture.timers.findLast(({ cancelled }) => !cancelled)?.delay).toBe(
      10_000,
    );
  });

  test('settlement erases credentials immediately and bridge instances are isolated', () => {
    const first = fixture();
    const second = fixture();
    const held = first.custody.holdLease({
      leaseId: '11111111-1111-4111-8111-111111111111',
      leaseToken: 'a'.repeat(43),
      expiresAt: '2026-08-11T12:00:30.000Z',
    });

    expect(() => second.custody.get(held.credentialHandle)).toThrow(
      CredentialCustodyError,
    );
    expect(first.custody.settle(held.credentialHandle)).toBe(true);
    expect(first.custody.settle(held.credentialHandle)).toBe(false);
    expect(() => first.custody.get(held.credentialHandle)).toThrow(
      CredentialCustodyError,
    );
  });

  test('rolls back the whole custody group if opaque handle creation collides', () => {
    const handle = 'c'.repeat(43);
    const custody = new CredentialCustody({
      createHandle: () => handle,
      renewLease: async () => {
        throw new Error('not reached');
      },
      renewActivation: async () => {
        throw new Error('not reached');
      },
    });

    expect(() =>
      custody.holdActivation('22222222-2222-4222-8222-222222222222', [
        {
          leaseId: '11111111-1111-4111-8111-111111111111',
          leaseToken: 'a'.repeat(43),
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
        },
        {
          leaseId: '33333333-3333-4333-8333-333333333333',
          leaseToken: 'b'.repeat(43),
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
        },
      ]),
    ).toThrow('unique credential handle');
    expect(() => custody.get(handle)).toThrow(CredentialCustodyError);
  });

  test('activation custody extends from acquisition but never beyond sixty minutes', () => {
    const testFixture = fixture();
    const held = testFixture.custody.holdActivation(
      '22222222-2222-4222-8222-222222222222',
      [
        {
          leaseId: '11111111-1111-4111-8111-111111111111',
          leaseToken: 'a'.repeat(43),
          expiresAt: '2026-08-11T12:00:30.000Z',
        },
      ],
    );

    expect(held.custodyExpiresAt).toBe('2026-08-11T12:10:00.000Z');
    expect(
      testFixture.custody.extendActivation(
        '22222222-2222-4222-8222-222222222222',
        120 * 60_000,
      ),
    ).toMatchObject({
      changed: true,
      custodyExpiresAt: '2026-08-11T13:00:00.000Z',
      maximumCustodyExpiresAt: '2026-08-11T13:00:00.000Z',
    });
    expect(
      testFixture.custody.extendActivation(
        '22222222-2222-4222-8222-222222222222',
        60 * 60_000,
      ).changed,
    ).toBe(false);
  });

  test('erases sibling credentials settled by one activation transition', () => {
    const testFixture = fixture();
    const held = testFixture.custody.holdActivation(
      '22222222-2222-4222-8222-222222222222',
      [
        {
          leaseId: '11111111-1111-4111-8111-111111111111',
          leaseToken: 'a'.repeat(43),
          expiresAt: '2026-08-11T12:00:30.000Z',
        },
        {
          leaseId: '33333333-3333-4333-8333-333333333333',
          leaseToken: 'b'.repeat(43),
          expiresAt: '2026-08-11T12:00:30.000Z',
        },
      ],
    );

    expect(
      testFixture.custody.retainActivationLeases(
        '22222222-2222-4222-8222-222222222222',
        [],
      ),
    ).toBe(0);
    for (const credential of held.credentials) {
      expect(() => testFixture.custody.get(credential.credentialHandle)).toThrow(
        CredentialCustodyError,
      );
    }
  });

  test('custody expiry and bridge close stop renewal and erase every handle', async () => {
    const expired = fixture();
    const held = expired.custody.holdLease({
      leaseId: '11111111-1111-4111-8111-111111111111',
      leaseToken: 'a'.repeat(43),
      expiresAt: '2026-08-11T12:00:30.000Z',
    });
    expired.advance(10 * 60_000);
    await expired.runLatestTimer();
    expect(expired.standaloneRenewals).toHaveLength(0);
    expect(() => expired.custody.get(held.credentialHandle)).toThrow(
      CredentialCustodyError,
    );

    const closed = fixture();
    const closedHeld = closed.custody.holdLease({
      leaseId: '33333333-3333-4333-8333-333333333333',
      leaseToken: 'b'.repeat(43),
      expiresAt: '2026-08-11T12:00:30.000Z',
    });
    closed.custody.close();
    expect(() => closed.custody.get(closedHeld.credentialHandle)).toThrow(
      CredentialCustodyError,
    );
    expect(closed.timers.every(({ cancelled }) => cancelled)).toBe(true);
  });
});
