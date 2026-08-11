// @ts-check

import { expect, test } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

test('loads the pinned official MCP v2 server and stdio entrypoints', () => {
  expect(typeof McpServer).toBe('function');
  expect(typeof serveStdio).toBe('function');
});
