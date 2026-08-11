// @ts-check

import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MCP_EXCLUDED_CAPABILITIES,
  MCP_TOOL_CATALOG,
  MCP_TOOL_NAMES,
} from '../../src/mcp/catalog.js';

describe('MCP tool catalog contract', () => {
  test('keeps stable unique operation-specific names', () => {
    expect(MCP_TOOL_NAMES).toHaveLength(51);
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length);
    expect(MCP_TOOL_NAMES.every((name) => /^portreeve_[a-z0-9_]+$/u.test(name))).toBe(
      true,
    );
    expect(MCP_TOOL_CATALOG.map(({ name }) => name)).toEqual([...MCP_TOOL_NAMES]);
    expect(
      MCP_TOOL_CATALOG.find(({ name }) => name === 'portreeve_claim_delete_execute'),
    ).toMatchObject({ receiptBound: true, credentialCustody: false });
    expect(
      MCP_TOOL_CATALOG.find(
        ({ name }) => name === 'portreeve_launcher_operation_complete',
      ),
    ).toMatchObject({ receiptBound: false, credentialCustody: true });
  });

  test('makes hazardous and out-of-scope surfaces explicit', () => {
    expect(MCP_EXCLUDED_CAPABILITIES).toContain('unsafe-any-owner-eviction');
    expect(MCP_EXCLUDED_CAPABILITIES).toContain('arbitrary-shell-execution');
    expect(MCP_EXCLUDED_CAPABILITIES).toContain('http-mcp-transport');
  });

  test('keeps the MCP implementation free of shell and network-server authority', async () => {
    const directory = join(process.cwd(), 'src', 'mcp');
    const sources = await Promise.all(
      (await readdir(directory))
        .filter((name) => name.endsWith('.js'))
        .map(
          async (name) => `${name}\n${await readFile(join(directory, name), 'utf8')}`,
        ),
    );
    const combined = sources.join('\n');
    expect(combined).not.toMatch(/node:child_process|Bun\.spawn|Bun\.serve/u);
    expect(combined).not.toMatch(/registerResource|registerPrompt/u);
  });
});
