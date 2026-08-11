// @ts-check

import { decodeCursor, encodeCursor } from '../protocol/cursor.js';

export const MCP_DEFAULT_PAGE_SIZE = 50;
export const MCP_MAX_PAGE_SIZE = 200;

/**
 * Deterministically page an in-memory daemon result. Cursors carry no
 * authority; they identify only the last stable item returned.
 *
 * @template T
 * @param {T[]} values
 * @param {{limit?: number, afterCursor?: string}} request
 * @param {(value: T) => string} identity
 */
export function pageMcpValues(values, request, identity) {
  const limit = Math.min(
    MCP_MAX_PAGE_SIZE,
    Math.max(1, request.limit ?? MCP_DEFAULT_PAGE_SIZE),
  );
  const ordered = [...values].sort((left, right) =>
    identity(left).localeCompare(identity(right)),
  );
  const after =
    request.afterCursor === undefined ? null : decodeCursor(request.afterCursor);
  const remaining =
    after === null
      ? ordered
      : ordered.filter((value) => identity(value) > after.sortKey);
  const items = remaining.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    page: {
      nextCursor:
        remaining.length > items.length && last !== undefined
          ? encodeCursor({ sortKey: identity(last), id: identity(last) })
          : null,
    },
  };
}
