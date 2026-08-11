// @ts-check

import { describe, expect, test } from 'bun:test';
import { generateMcpSetup } from '../../src/mcp/setup.js';

const exactExecutablePath =
  '/Users/example/Library/Application Support/Portreeve/bin/portreeve';

describe('MCP setup generation', () => {
  test('renders a canonical generic stdio descriptor at the exact managed path', () => {
    const result = generateMcpSetup({ host: 'generic' }, { exactExecutablePath });
    expect(result).toMatchObject({
      schemaVersion: 1,
      host: 'generic',
      executableMode: 'exact',
      command: exactExecutablePath,
      args: ['mcp', 'serve', '--label', 'generic'],
      clientLabel: 'generic',
      configurationLanguage: 'json',
      setupCommand: null,
    });
    expect(JSON.parse(result.configuration)).toEqual({
      type: 'stdio',
      command: exactExecutablePath,
      args: ['mcp', 'serve', '--label', 'generic'],
    });
  });

  test('renders Codex TOML and a shell-safe registration command', () => {
    const result = generateMcpSetup(
      { host: 'codex', label: 'codex-worktree-4' },
      { exactExecutablePath },
    );
    expect(result.configuration).toBe(
      `[mcp_servers.portreeve]\ncommand = ${JSON.stringify(exactExecutablePath)}\nargs = ["mcp", "serve", "--label", "codex-worktree-4"]`,
    );
    expect(result.setupCommand).toBe(
      `codex mcp add portreeve -- '${exactExecutablePath}' mcp serve --label codex-worktree-4`,
    );
  });

  test('renders Claude Code JSON and supports the explicit portable variant', () => {
    const result = generateMcpSetup(
      { host: 'claude-code', portable: true },
      { exactExecutablePath },
    );
    expect(result).toMatchObject({
      executableMode: 'portable',
      command: 'portreeve',
      clientLabel: 'claude-code',
      setupCommand:
        'claude mcp add --scope user portreeve -- portreeve mcp serve --label claude-code',
    });
    expect(JSON.parse(result.configuration)).toEqual({
      mcpServers: {
        portreeve: {
          type: 'stdio',
          command: 'portreeve',
          args: ['mcp', 'serve', '--label', 'claude-code'],
        },
      },
    });
  });

  test('rejects unknown hosts, unsafe labels, and caller-selected paths', () => {
    expect(() =>
      generateMcpSetup({ host: 'other' }, { exactExecutablePath }),
    ).toThrow();
    expect(() =>
      generateMcpSetup({ host: 'codex', label: '../secret' }, { exactExecutablePath }),
    ).toThrow();
    expect(() =>
      generateMcpSetup(
        { host: 'generic', executablePath: '/tmp/other' },
        { exactExecutablePath },
      ),
    ).toThrow();
  });
});
