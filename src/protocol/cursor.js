// @ts-check

import { z } from 'zod';

const CursorPayloadSchema = z
  .object({
    version: z.literal(1),
    sortKey: z.string().min(1),
    id: z.string().min(1),
  })
  .strict();

export class CursorError extends Error {
  constructor(message = 'The continuation cursor is invalid.') {
    super(message);
    this.name = 'CursorError';
  }
}

/**
 * Cursors deliberately contain continuation state rather than authority. The
 * encoding is opaque to callers and versioned so its representation can evolve.
 *
 * @param {{sortKey: string, id: string}} value
 */
export function encodeCursor(value) {
  const payload = CursorPayloadSchema.parse({ version: 1, ...value });
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** @param {string} cursor */
export function decodeCursor(cursor) {
  try {
    const serialized = Buffer.from(
      z.string().min(1).parse(cursor),
      'base64url',
    ).toString('utf8');
    return CursorPayloadSchema.parse(JSON.parse(serialized));
  } catch {
    throw new CursorError();
  }
}
