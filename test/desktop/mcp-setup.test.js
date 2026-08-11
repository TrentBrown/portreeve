// @ts-check

import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';
import { createMcpSetupAdapter } from '../../apps/desktop/main/mcp-setup-adapter.js';

test('keeps exact executable authority in the main-process MCP setup adapter', () => {
  const adapter = createMcpSetupAdapter({
    exactExecutablePath: '/managed/PortReeve/bin/portreeve',
  });
  expect(adapter.generate({ host: 'codex', portable: false })).toMatchObject({
    host: 'codex',
    command: '/managed/PortReeve/bin/portreeve',
    executableMode: 'exact',
  });
  expect(
    adapter.generate({ host: 'codex', portable: true, label: 'codex-local' }),
  ).toMatchObject({
    command: 'portreeve',
    clientLabel: 'codex-local',
    executableMode: 'portable',
  });
  expect(() =>
    adapter.generate({
      host: 'codex',
      portable: false,
      executablePath: '/renderer/chosen/path',
    }),
  ).toThrow();
});

test('presents bounded setup controls, compatibility, copy actions, and Guide link', async () => {
  const [html, renderer, preload, main] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
    readFile('apps/desktop/preload/index.cjs', 'utf8'),
    readFile('apps/desktop/main/index.js', 'utf8'),
  ]);
  expect(html).toContain('data-view="mcp">MCP</button>');
  expect(html).toContain('Each agent host starts a lightweight');
  expect(html).toContain('one PortReeve daemon');
  expect(html).toContain('2026-07-28 and maintained legacy stdio');
  expect(html).toContain('<option value="generic">Generic stdio</option>');
  expect(html).toContain('<option value="codex" selected>');
  expect(html).toContain('<option value="claude-code">Claude Code</option>');
  expect(html).toContain('Exact managed path');
  expect(html).toContain('Bare portreeve');
  expect(html).toContain('Copy configuration');
  expect(html).toContain('Copy command');
  expect(html).toContain('Setup failure details');
  expect(html).toContain('project-owned integration in the Guide');
  expect(renderer).toContain("requiredElement('mcp').hidden = view !== 'mcp'");
  expect(renderer).toContain("if (view === 'mcp') await renderMcpSetup()");
  expect(renderer).toContain('window.portreeveDesktop.generateMcpSetup(');
  expect(preload).toContain('generateMcpSetup: async (host, portable, label) =>');
  expect(preload).not.toMatch(/generateMcpSetup:\s*async\s*\([^)]*path/i);
  expect(main).toContain(
    'exactExecutablePath: resolveRuntimePaths().managedExecutablePath',
  );
  expect(main).not.toContain('writeMcp');
});
