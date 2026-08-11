// @ts-check

import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createProgram } from '../../src/cli/program.js';
import {
  CLI_SAFETY_CATEGORIES,
  cliDocumentationCatalog,
} from '../../src/cli/documentation.js';
import { MCP_TOOL_NAMES } from '../../src/mcp/catalog.js';
import { mcpDocumentationCatalog } from '../../src/mcp/documentation.js';
import {
  CLIENT_GUIDES_BUNDLE,
  compileMarkdown,
  generateClientGuides,
  replaceGeneratedRegion,
} from '../../scripts/client-guides-lib.js';
import { PORTREEVE_VERSION } from '../../src/version.js';

describe('client guide contract generation', () => {
  test('classifies every CLI leaf exactly once and rejects stale metadata at construction', () => {
    const catalog = cliDocumentationCatalog(createProgram());
    expect(catalog).toHaveLength(49);
    expect(new Set(catalog.map(({ path }) => path)).size).toBe(catalog.length);
    expect(new Set(catalog.map(({ safety }) => safety))).toEqual(
      new Set(Object.values(CLI_SAFETY_CATEGORIES)),
    );
    expect(catalog.find(({ path }) => path === 'portreeve ports unsafe-evict')).toMatchObject(
      {
        safety: CLI_SAFETY_CATEGORIES.UNSAFE_OVERRIDE,
        family: 'ports',
      },
    );
    expect(catalog.find(({ path }) => path === 'portreeve mcp setup')).toMatchObject({
      safety: CLI_SAFETY_CATEGORIES.READ_ONLY,
      outputProfile: 'standard',
    });
  });

  test('extracts the exact advertised MCP schemas without daemon access', async () => {
    const catalog = await mcpDocumentationCatalog();
    expect(catalog.map(({ name }) => name)).toEqual([...MCP_TOOL_NAMES]);
    expect(catalog.find(({ name }) => name === 'portreeve_ports_list')).toMatchObject({
      family: 'ports',
      safety: 'read-only',
      annotations: { readOnlyHint: true, destructiveHint: false },
    });
    expect(
      catalog.find(({ name }) => name === 'portreeve_port_reclaim_execute'),
    ).toMatchObject({
      safety: 'consequential-mutation',
      receiptBound: true,
    });
    expect(
      catalog.find(({ name }) => name === 'portreeve_lease_acquire')?.inputSchema,
    ).toMatchObject({ type: 'object' });
  });

  test('updates only one well-formed generated region', () => {
    const input = [
      '# Guide',
      '',
      'Before.',
      '<!-- PORTREEVE:GENERATED TEST START -->',
      'old',
      '<!-- PORTREEVE:GENERATED TEST END -->',
      'After.',
      '',
    ].join('\n');
    expect(replaceGeneratedRegion(input, 'TEST', 'new')).toBe(
      input.replace('old', 'new'),
    );
    expect(() => replaceGeneratedRegion('# Guide\n', 'TEST', 'new')).toThrow(
      'Expected exactly one ordered TEST generated region',
    );
    expect(() =>
      replaceGeneratedRegion(
        input.replace('old', '<!-- PORTREEVE:GENERATED INNER START -->'),
        'TEST',
        'new',
      ),
    ).toThrow('Nested generated marker');
  });

  test('compiles inert supported Markdown and rejects unsafe or ambiguous content', async () => {
    const root = process.cwd();
    const compiled = await compileMarkdown({
      markdown: '# Guide\n\nRead [MCP](mcp.md).\n\n## Start\n\n- Copy `command`.\n',
      sourcePath: 'docs/example.md',
      workspaceRoot: root,
    });
    expect(compiled).toMatchObject({
      title: 'Guide',
      anchors: ['guide', 'start'],
    });
    await expect(
      compileMarkdown({
        markdown: '# Guide\n\nText before <script>alert(1)</script>.\n',
        sourcePath: 'docs/example.md',
        workspaceRoot: root,
      }),
    ).rejects.toThrow('Raw HTML is not supported');
    await expect(
      compileMarkdown({
        markdown: '# Guide\n\n[bad](javascript:alert)\n',
        sourcePath: 'docs/example.md',
        workspaceRoot: root,
      }),
    ).rejects.toThrow('Unsafe link');
    await expect(
      compileMarkdown({
        markdown: '# Guide\n\n## Same\n\n## Same\n',
        sourcePath: 'docs/example.md',
        workspaceRoot: root,
      }),
    ).rejects.toThrow('Duplicate or empty anchor');
    await expect(
      compileMarkdown({
        markdown: '# Guide\n\n[missing](#absent)\n',
        sourcePath: 'docs/example.md',
        workspaceRoot: root,
      }),
    ).rejects.toThrow('Unresolved internal anchor');
  });

  test('keeps committed Markdown and Desktop bundle current and version-bound', async () => {
    const generated = await generateClientGuides({ root: process.cwd() });
    expect(generated.changed).toEqual([]);
    expect(generated).toMatchObject({ cliCommands: 49, mcpTools: 51 });
    const bundle = JSON.parse(
      await readFile(join(process.cwd(), CLIENT_GUIDES_BUNDLE), 'utf8'),
    );
    expect(bundle).toMatchObject({
      schemaVersion: 1,
      generatedForVersion: PORTREEVE_VERSION,
    });
    expect(bundle.guides.cli.reference).toHaveLength(49);
    expect(bundle.guides.mcp.reference).toHaveLength(51);
    expect(bundle.searchIndex).toHaveLength(100);
  });

  test('ships the approved authored workflows, safety boundaries, and platform contract', async () => {
    const [mcp, cli] = await Promise.all([
      readFile(join(process.cwd(), 'docs/mcp.md'), 'utf8'),
      readFile(join(process.cwd(), 'docs/cli-contract.md'), 'utf8'),
    ]);
    for (const guide of [mcp, cli]) {
      expect(guide).toContain('## Start here');
      expect(guide).toContain('## Common workflows');
      expect(guide).toContain('## Searchable complete reference');
      expect(guide).toContain('## Troubleshooting and safety');
      expect(guide).toMatch(/Windows is not\s+supported/u);
      expect(guide).toMatch(/does\s+not\s+currently\s+provide Docker Sandbox/u);
      expect(guide).not.toContain('Docker-sandbox');
    }
    expect(mcp).toContain('stop, and call the corresponding execute tool only');
    expect(mcp).toContain('it does not prove current human intent');
    expect(mcp).toContain('The raw lease token never crosses MCP');
    expect(cli).toContain('portreeve launcher start --stack-root "$STACK_ROOT"');
    expect(cli).toContain('ports unsafe-evict` deliberately ignores');
  });
});
