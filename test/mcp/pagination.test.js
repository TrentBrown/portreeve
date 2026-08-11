// @ts-check

import { expect, test } from 'bun:test';
import { CursorError } from '../../src/protocol/cursor.js';
import {
  MCP_DEFAULT_PAGE_SIZE,
  MCP_MAX_PAGE_SIZE,
  pageMcpValues,
} from '../../src/mcp/pagination.js';

test('MCP in-memory pages are bounded, stable, and cursor driven', () => {
  const values = Array.from({ length: MCP_MAX_PAGE_SIZE + 7 }, (_, index) => ({
    id: String(index).padStart(3, '0'),
  })).reverse();
  const first = pageMcpValues(values, {}, (value) => value.id);
  expect(first.items).toHaveLength(MCP_DEFAULT_PAGE_SIZE);
  expect(first.items[0]?.id).toBe('000');
  expect(first.page.nextCursor).not.toBeNull();
  const afterCursor = first.page.nextCursor;
  if (afterCursor === null) throw new Error('Expected a continuation cursor.');

  const second = pageMcpValues(
    values,
    { limit: MCP_MAX_PAGE_SIZE, afterCursor },
    (value) => value.id,
  );
  expect(second.items[0]?.id).toBe('050');
  expect(second.items).toHaveLength(157);
  expect(second.page.nextCursor).toBeNull();
});

test('MCP pages reject malformed cursors', () => {
  expect(() =>
    pageMcpValues([{ id: 'one' }], { afterCursor: 'bad' }, (v) => v.id),
  ).toThrow(CursorError);
});
