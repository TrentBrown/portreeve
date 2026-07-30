// @ts-check

import { describe, expect, test } from 'bun:test';
import {
  createLeaseToken,
  hashLeaseToken,
  verifyLeaseToken,
} from '../../src/domain/lease-token.js';
import { hasExpired, toTimestamp } from '../../src/domain/time.js';

describe('lease tokens and time', () => {
  test('creates an unguessable token and stores only a one-way hash', () => {
    const first = createLeaseToken();
    const second = createLeaseToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toHaveLength(64);
    expect(first.tokenHash).toBe(hashLeaseToken(first.token));
    expect(verifyLeaseToken(first.token, first.tokenHash)).toBe(true);
    expect(verifyLeaseToken(second.token, first.tokenHash)).toBe(false);
  });

  test('treats the expiration instant as expired', () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    expect(toTimestamp(now)).toBe('2026-07-30T12:00:00.000Z');
    expect(hasExpired('2026-07-30T12:00:00.000Z', now)).toBe(true);
    expect(hasExpired('2026-07-30T12:00:00.001Z', now)).toBe(false);
  });
});
