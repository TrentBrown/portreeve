// @ts-check

import { describe, expect, test } from 'bun:test';
import { CredentialCustodyError } from '../../src/mcp/credential-custody.js';
import { LauncherCredentialCustody } from '../../src/mcp/launcher-credential-custody.js';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';

function fixture() {
  let now = Date.parse('2026-08-11T12:00:00.000Z');
  /** @type {Array<{callback: () => void, delay: number, cancelled: boolean}>} */
  const timers = [];
  /** @type {Array<{operationId: string, credential: string}>} */
  const renewals = [];
  let nextHandle = 0;
  const custody = new LauncherCredentialCustody({
    now: () => new Date(now),
    createHandle: () => String(++nextHandle).padStart(43, 'l'),
    schedule: (callback, delay) => {
      const timer = { callback, delay, cancelled: false };
      timers.push(timer);
      return timer;
    },
    cancel: (timer) => {
      /** @type {{cancelled: boolean}} */ (timer).cancelled = true;
    },
    renewOperation: async (operationId, credential) => {
      renewals.push({ operationId, credential });
      return {
        operation: operation(new Date(now + 30_000).toISOString()),
        renewAfterMilliseconds: 10_000,
      };
    },
  });
  return {
    custody,
    timers,
    renewals,
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

describe('MCP launcher credential custody', () => {
  test('keeps the raw credential hidden and automatically renews the heartbeat', async () => {
    const testFixture = fixture();
    const held = testFixture.custody.hold({
      operation: operation('2026-08-11T12:00:30.000Z'),
      credential: 'seeded-launcher-secret-that-must-remain-process-local',
      renewAfterMilliseconds: 10_000,
    });

    expect(JSON.stringify(held)).not.toContain('seeded-launcher-secret');
    expect(held.credentialHandle).toHaveLength(43);
    expect(testFixture.timers[0]?.delay).toBe(10_000);

    testFixture.advance(10_000);
    await testFixture.runLatestTimer();
    expect(testFixture.renewals).toEqual([
      {
        operationId: OPERATION_ID,
        credential: 'seeded-launcher-secret-that-must-remain-process-local',
      },
    ]);
    expect(testFixture.timers.findLast(({ cancelled }) => !cancelled)?.delay).toBe(
      10_000,
    );
  });

  test('explicit renewal can extend custody but never past sixty minutes', async () => {
    const testFixture = fixture();
    const held = testFixture.custody.hold({
      operation: operation('2026-08-11T12:00:30.000Z'),
      credential: 'a'.repeat(43),
      renewAfterMilliseconds: 10_000,
    });

    const renewed = await testFixture.custody.renew(
      held.credentialHandle,
      OPERATION_ID,
      120 * 60_000,
    );
    expect(renewed).toMatchObject({
      changed: true,
      custodyChanged: true,
      custodyExpiresAt: '2026-08-11T13:00:00.000Z',
      maximumCustodyExpiresAt: '2026-08-11T13:00:00.000Z',
    });
  });

  test('settlement, bridge isolation, expiry, and close erase authority', async () => {
    const first = fixture();
    const second = fixture();
    const held = first.custody.hold({
      operation: operation('2026-08-11T12:00:30.000Z'),
      credential: 'b'.repeat(43),
      renewAfterMilliseconds: 10_000,
    });

    expect(() => second.custody.get(held.credentialHandle, OPERATION_ID)).toThrow(
      CredentialCustodyError,
    );
    expect(first.custody.settle(held.credentialHandle)).toBe(true);
    expect(first.custody.settle(held.credentialHandle)).toBe(false);
    expect(() => first.custody.get(held.credentialHandle, OPERATION_ID)).toThrow(
      CredentialCustodyError,
    );

    const expired = fixture();
    const expiredHeld = expired.custody.hold({
      operation: operation('2026-08-11T12:00:30.000Z'),
      credential: 'c'.repeat(43),
      renewAfterMilliseconds: 10_000,
    });
    expired.advance(10 * 60_000);
    await expired.runLatestTimer();
    expect(expired.renewals).toHaveLength(0);
    expect(() =>
      expired.custody.get(expiredHeld.credentialHandle, OPERATION_ID),
    ).toThrow(CredentialCustodyError);

    const closed = fixture();
    const closedHeld = closed.custody.hold({
      operation: operation('2026-08-11T12:00:30.000Z'),
      credential: 'd'.repeat(43),
      renewAfterMilliseconds: 10_000,
    });
    closed.custody.close();
    expect(() => closed.custody.get(closedHeld.credentialHandle, OPERATION_ID)).toThrow(
      CredentialCustodyError,
    );
    expect(closed.timers.every(({ cancelled }) => cancelled)).toBe(true);
  });
});

/** @param {string} deadlineAt */
function operation(deadlineAt) {
  return /** @type {any} */ ({
    id: OPERATION_ID,
    deadlineAt,
  });
}
