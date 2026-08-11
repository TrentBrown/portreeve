// @ts-check

import { expect, test } from 'bun:test';
import { mcpSetupCommand } from '../../src/cli/commands/mcp.js';
import { captureOutput, parseRenderedJson } from '../fixtures/cli-runtime.js';

test('prints copyable MCP setup without contacting a daemon or changing host files', async () => {
  const human = await captureOutput(async () => {
    mcpSetupCommand({ host: 'codex', portable: true });
  });
  expect(human.lines.join('\n')).toContain('[mcp_servers.portreeve]');
  expect(human.lines.join('\n')).toContain('command = "portreeve"');
  expect(human.lines).toContain(
    'codex mcp add portreeve -- portreeve mcp serve --label codex',
  );
  expect(human.lines.at(-1)).toBe(
    'PortReeve generated this preview only. No third-party configuration was changed.',
  );

  const json = await captureOutput(async () =>
    mcpSetupCommand({
      host: 'claude-code',
      label: 'claude-local',
      json: true,
    }),
  );
  expect(parseRenderedJson(json.lines)).toMatchObject({
    version: 1,
    setup: {
      schemaVersion: 1,
      host: 'claude-code',
      executableMode: 'exact',
      clientLabel: 'claude-local',
    },
  });
});
