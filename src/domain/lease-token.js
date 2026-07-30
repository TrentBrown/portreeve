// @ts-check

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * @returns {{token: string, tokenHash: string}}
 */
export function createLeaseToken() {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashLeaseToken(token),
  };
}

/**
 * @param {string} token
 */
export function hashLeaseToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * @param {string} token
 * @param {string} expectedHash
 */
export function verifyLeaseToken(token, expectedHash) {
  const actual = Buffer.from(hashLeaseToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
