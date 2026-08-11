// @ts-check

import { describe, expect, test } from 'bun:test';
import {
  MCP_EXCLUDED_CAPABILITIES,
  MCP_TOOL_CATALOG,
  MCP_TOOL_NAMES,
} from '../../src/mcp/catalog.js';

describe('MCP tool catalog contract', () => {
  test('keeps stable unique operation-specific names', () => {
    expect(MCP_TOOL_NAMES.length).toBeGreaterThan(40);
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length);
    expect(MCP_TOOL_NAMES.every((name) => /^portreeve_[a-z0-9_]+$/u.test(name))).toBe(
      true,
    );
    expect(MCP_TOOL_CATALOG.map(({ name }) => name)).toEqual([...MCP_TOOL_NAMES]);
    expect(
      MCP_TOOL_CATALOG.find(({ name }) => name === 'portreeve_claim_delete_execute'),
    ).toMatchObject({ receiptBound: true, credentialCustody: false });
  });

  test('makes hazardous and out-of-scope surfaces explicit', () => {
    expect(MCP_EXCLUDED_CAPABILITIES).toContain('unsafe-any-owner-eviction');
    expect(MCP_EXCLUDED_CAPABILITIES).toContain('arbitrary-shell-execution');
    expect(MCP_EXCLUDED_CAPABILITIES).toContain('http-mcp-transport');
  });
});
