// @ts-check

import { describe, expect, test } from 'bun:test';
import { CursorError, decodeCursor, encodeCursor } from '../../src/protocol/cursor.js';

describe('opaque continuation cursors', () => {
  test('round-trips stable continuation state without granting authority', () => {
    const encoded = encodeCursor({
      sortKey: '2026-08-10T12:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
    });

    expect(encoded).not.toContain('2026-08-10');
    expect(decodeCursor(encoded)).toEqual({
      version: 1,
      sortKey: '2026-08-10T12:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });

  test('rejects malformed and unsupported cursor payloads', () => {
    expect(() => decodeCursor('not-json')).toThrow(CursorError);
    const unsupported = Buffer.from(
      JSON.stringify({ version: 2, sortKey: 'a', id: 'b' }),
    ).toString('base64url');
    expect(() => decodeCursor(unsupported)).toThrow(CursorError);
  });
});
