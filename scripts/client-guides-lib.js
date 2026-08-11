// @ts-check

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { format } from 'prettier';
import { createProgram } from '../src/cli/program.js';
import {
  CLI_SAFETY_CATEGORIES,
  cliDocumentationCatalog,
} from '../src/cli/documentation.js';
import { mcpDocumentationCatalog } from '../src/mcp/documentation.js';
import { PORTREEVE_VERSION } from '../src/version.js';

const GUIDE_SOURCES = Object.freeze({
  mcp: Object.freeze({
    sourcePath: 'docs/mcp.md',
    marker: 'MCP-TOOLS',
  }),
  cli: Object.freeze({
    sourcePath: 'docs/cli-contract.md',
    marker: 'CLI-COMMANDS',
  }),
});
export const CLIENT_GUIDES_BUNDLE = 'apps/desktop/renderer/generated/client-guides.js';

/** @param {{root: string, write?: boolean}} options */
export async function generateClientGuides({ root, write = false }) {
  const workspaceRoot = resolve(root);
  const cliReference = cliDocumentationCatalog(createProgram());
  const mcpReference = await mcpDocumentationCatalog();
  validateCatalogs(cliReference, mcpReference);

  const replacements = {
    cli: renderCliReference(cliReference),
    mcp: renderMcpReference(mcpReference),
  };
  /** @type {Record<string, {sourcePath: string, markdown: string, document: unknown, reference: unknown[]}>} */
  const guides = {};
  /** @type {Array<{path: string, expected: string, actual: string|null}>} */
  const outputs = [];

  for (const [guideId, source] of Object.entries(GUIDE_SOURCES)) {
    const absolutePath = join(workspaceRoot, source.sourcePath);
    const current = await readFile(absolutePath, 'utf8');
    const markdown = replaceGeneratedRegion(
      current,
      source.marker,
      replacements[/** @type {'mcp'|'cli'} */ (guideId)],
    );
    const document = await compileMarkdown({
      markdown,
      sourcePath: source.sourcePath,
      workspaceRoot,
      referenceAnchors:
        guideId === 'mcp'
          ? ['searchable-complete-reference', ...mcpReference.map(({ id }) => id)]
          : ['searchable-complete-reference', ...cliReference.map(({ id }) => id)],
    });
    guides[guideId] = {
      sourcePath: source.sourcePath,
      markdown,
      document,
      reference: guideId === 'mcp' ? mcpReference : cliReference,
    };
    outputs.push({ path: source.sourcePath, expected: markdown, actual: current });
  }

  const bundleData = {
    schemaVersion: 1,
    generatedForVersion: PORTREEVE_VERSION,
    guides: Object.fromEntries(
      Object.entries(guides).map(([id, guide]) => [
        id,
        {
          sourcePath: guide.sourcePath,
          document: guide.document,
          reference: guide.reference,
        },
      ]),
    ),
    searchIndex: buildSearchIndex({ cliReference, mcpReference }),
  };
  const bundle = await format(
    `export const CLIENT_GUIDES_ATTESTATION = Object.freeze(${JSON.stringify({ schemaVersion: 1, generatedForVersion: PORTREEVE_VERSION, cliCommands: cliReference.length, mcpTools: mcpReference.length }, null, 2)});\nexport default ${JSON.stringify(bundleData, null, 2)};\n`,
    { parser: 'babel', printWidth: 88 },
  );
  const bundlePath = join(workspaceRoot, CLIENT_GUIDES_BUNDLE);
  const currentBundle = await readOptional(bundlePath);
  outputs.push({
    path: CLIENT_GUIDES_BUNDLE,
    expected: bundle,
    actual: currentBundle,
  });

  const stale = outputs.filter(({ actual, expected }) => actual !== expected);
  if (write) {
    for (const output of stale) {
      await mkdir(dirname(join(workspaceRoot, output.path)), { recursive: true });
      await writeFile(join(workspaceRoot, output.path), output.expected, 'utf8');
    }
  }
  return {
    changed: stale.map(({ path }) => path),
    cliCommands: cliReference.length,
    mcpTools: mcpReference.length,
    bundle,
    bundleData,
  };
}

/** @param {ReturnType<typeof cliDocumentationCatalog>} cli @param {Awaited<ReturnType<typeof mcpDocumentationCatalog>>} mcp */
function validateCatalogs(cli, mcp) {
  const safety = new Set(
    /** @type {string[]} */ (Object.values(CLI_SAFETY_CATEGORIES)),
  );
  if (cli.length === 0 || mcp.length === 0) {
    throw new Error('Client guide reference catalogs cannot be empty.');
  }
  for (const command of cli) {
    if (!safety.has(command.safety)) {
      throw new Error(`Invalid CLI safety classification for ${command.path}.`);
    }
  }
  assertUnique(
    cli.map(({ id }) => id),
    'CLI reference anchor',
  );
  assertUnique(
    cli.map(({ path }) => path),
    'CLI command path',
  );
  assertUnique(
    mcp.map(({ id }) => id),
    'MCP reference anchor',
  );
  assertUnique(
    mcp.map(({ name }) => name),
    'MCP tool name',
  );
}

/** @param {ReturnType<typeof cliDocumentationCatalog>} commands */
function renderCliReference(commands) {
  const lines = [
    '## Searchable complete reference',
    '',
    '> Generated from the Commander command tree and required documentation metadata. Do not edit this region directly.',
    '',
  ];
  for (const command of commands) {
    lines.push(
      `### CLI command: \`${command.path}\``,
      '',
      command.description,
      '',
      `- **Family:** ${command.family}`,
      `- **Safety:** ${command.safetyLabel}`,
      `- **Synopsis:** \`${command.synopsis}\``,
      '',
      `#### Arguments for \`${command.path}\``,
      '',
    );
    if (command.arguments.length === 0) {
      lines.push('None.', '');
    } else {
      lines.push(
        '| Name | Required | Variadic | Default | Description |',
        '|---|---:|---:|---|---|',
        ...command.arguments.map(
          (argument) =>
            `| \`${escapeTable(argument.name)}\` | ${yesNo(argument.required)} | ${yesNo(argument.variadic)} | ${codeOrDash(argument.defaultValue)} | ${escapeTable(argument.description || '—')} |`,
        ),
        '',
      );
    }
    lines.push(`#### Options for \`${command.path}\``, '');
    if (command.options.length === 0) {
      lines.push('None.', '');
    } else {
      lines.push(
        '| Flags | Required | Default | Choices | Description |',
        '|---|---:|---|---|---|',
        ...command.options.map(
          (option) =>
            `| \`${escapeTable(option.flags)}\` | ${yesNo(option.mandatory)} | ${codeOrDash(option.defaultValue)} | ${option.choices.length === 0 ? '—' : option.choices.map((choice) => `\`${escapeTable(String(choice))}\``).join(', ')} | ${escapeTable(option.description)} |`,
        ),
        '',
      );
    }
    lines.push(`#### Environment and configuration for \`${command.path}\``, '');
    if (command.environment.length === 0) {
      lines.push('No command-specific environment input.', '');
    } else {
      lines.push(...command.environment.map((note) => `- ${note}`), '');
    }
    lines.push(
      `#### Output and exit behavior for \`${command.path}\``,
      '',
      outputProfile(command.outputProfile),
      '',
    );
  }
  return lines.join('\n').trimEnd();
}

/** @param {Awaited<ReturnType<typeof mcpDocumentationCatalog>>} tools */
function renderMcpReference(tools) {
  const lines = [
    '## Searchable complete reference',
    '',
    '> Generated from the exact tool catalog registered with the pinned MCP SDK. Do not edit this region directly.',
    '',
  ];
  for (const tool of tools) {
    lines.push(
      `### MCP tool: \`${tool.name}\``,
      '',
      tool.description,
      '',
      `- **Title:** ${tool.title}`,
      `- **Family:** ${tool.family}`,
      `- **Safety:** ${tool.safety}`,
      `- **Receipt-bound:** ${yesNo(tool.receiptBound)}`,
      `- **Bridge credential custody:** ${yesNo(tool.credentialCustody)}`,
      `- **Annotations:** read-only ${yesNo(tool.annotations.readOnlyHint)}; destructive ${yesNo(tool.annotations.destructiveHint)}; idempotent ${yesNo(tool.annotations.idempotentHint)}; open-world ${yesNo(tool.annotations.openWorldHint)}`,
      '',
      `#### Input schema for \`${tool.name}\``,
      '',
      '```json',
      JSON.stringify(tool.inputSchema, null, 2),
      '```',
      '',
      `#### Structured output schema for \`${tool.name}\``,
      '',
      'Every result uses either `{ "ok": true, "data": ... }` or the stable failure envelope `{ "ok": false, "error": { "code", "message", "retryable", "details" } }`.',
      '',
      '```json',
      JSON.stringify(tool.outputSchema, null, 2),
      '```',
      '',
    );
  }
  return lines.join('\n').trimEnd();
}

/**
 * Replace one exact generated region while preserving all authored bytes
 * outside it.
 *
 * @param {string} markdown
 * @param {string} marker
 * @param {string} generated
 */
export function replaceGeneratedRegion(markdown, marker, generated) {
  const start = `<!-- PORTREEVE:GENERATED ${marker} START -->`;
  const end = `<!-- PORTREEVE:GENERATED ${marker} END -->`;
  const starts = occurrences(markdown, start);
  const ends = occurrences(markdown, end);
  const startIndex = starts[0];
  const endIndex = ends[0];
  if (
    starts.length !== 1 ||
    ends.length !== 1 ||
    startIndex === undefined ||
    endIndex === undefined ||
    startIndex >= endIndex
  ) {
    throw new Error(
      `Expected exactly one ordered ${marker} generated region; found ${starts.length} start and ${ends.length} end markers.`,
    );
  }
  const nested = markdown
    .slice(startIndex + start.length, endIndex)
    .match(/<!-- PORTREEVE:GENERATED [A-Z0-9-]+ (?:START|END) -->/gu);
  if (nested !== null) {
    throw new Error(`Nested generated marker in ${marker} region.`);
  }
  const before = markdown.slice(0, startIndex + start.length);
  const after = markdown.slice(endIndex);
  return `${before}\n${generated.trim()}\n${after}`;
}

/**
 * Compile the supported Markdown subset to inert presentation data.
 *
 * @param {{markdown: string, sourcePath: string, workspaceRoot: string, referenceAnchors?: string[]}} input
 */
export async function compileMarkdown({
  markdown,
  sourcePath,
  workspaceRoot,
  referenceAnchors = [],
}) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  /** @type {any[]} */
  const blocks = [];
  /** @type {Set<string>} */
  const anchors = new Set(referenceAnchors);
  /** @type {Array<{href: string, line: number}>} */
  const links = [];
  let title = '';
  let generatedRegion = false;

  for (let index = 0; index < lines.length;) {
    const line = lineAt(lines, index);
    const lineNumber = index + 1;
    if (isGeneratedStartMarker(line)) {
      if (generatedRegion) {
        throw markdownError(sourcePath, lineNumber, 'Nested generated region.');
      }
      generatedRegion = true;
      index += 1;
      continue;
    }
    if (isGeneratedEndMarker(line)) {
      if (!generatedRegion) {
        throw markdownError(sourcePath, lineNumber, 'Unmatched generated end marker.');
      }
      generatedRegion = false;
      index += 1;
      continue;
    }
    if (generatedRegion) {
      index += 1;
      continue;
    }
    if (line.trim() === '') {
      index += 1;
      continue;
    }
    if (containsRawHtml(line)) {
      throw markdownError(sourcePath, lineNumber, 'Raw HTML is not supported.');
    }
    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/u);
    if (fence !== null) {
      const content = [];
      index += 1;
      while (index < lines.length && lineAt(lines, index) !== '```') {
        content.push(lineAt(lines, index));
        index += 1;
      }
      if (index >= lines.length) {
        throw markdownError(sourcePath, lineNumber, 'Unclosed fenced code block.');
      }
      blocks.push({
        type: 'code',
        language: fence[1] ?? null,
        text: content.join('\n'),
      });
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading !== null) {
      const inline = compileInline(heading[2] ?? '', sourcePath, lineNumber, links);
      const anchor = markdownAnchor(plainInline(inline));
      if (anchor === '' || anchors.has(anchor)) {
        throw markdownError(
          sourcePath,
          lineNumber,
          `Duplicate or empty anchor: ${anchor}`,
        );
      }
      anchors.add(anchor);
      if ((heading[1] ?? '').length === 1 && title === '') title = plainInline(inline);
      blocks.push({
        type: 'heading',
        level: (heading[1] ?? '').length,
        id: anchor,
        inline,
      });
      index += 1;
      continue;
    }
    if (isTableStart(lines, index)) {
      const header = tableCells(line).map((cell) =>
        compileInline(cell, sourcePath, lineNumber, links),
      );
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/u.test(lineAt(lines, index))) {
        rows.push(
          tableCells(lineAt(lines, index)).map((cell) =>
            compileInline(cell, sourcePath, index + 1, links),
          ),
        );
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (/^>\s?/u.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/u.test(lineAt(lines, index))) {
        quote.push(lineAt(lines, index).replace(/^>\s?/u, ''));
        index += 1;
      }
      blocks.push({
        type: 'callout',
        inline: compileInline(quote.join(' '), sourcePath, lineNumber, links),
      });
      continue;
    }
    const listMatch = line.match(/^\s*(-|\d+\.)\s+(.+)$/u);
    if (listMatch !== null) {
      const ordered = /\d+\./u.test(listMatch[1] ?? '');
      const items = [];
      while (index < lines.length) {
        const item = lineAt(lines, index).match(/^\s*(-|\d+\.)\s+(.+)$/u);
        if (item === null || /\d+\./u.test(item[1] ?? '') !== ordered) break;
        const text = [item[2] ?? ''];
        index += 1;
        while (
          index < lines.length &&
          /^\s{2,}\S/u.test(lineAt(lines, index)) &&
          !/^\s*(-|\d+\.)\s+/u.test(lineAt(lines, index))
        ) {
          text.push(lineAt(lines, index).trim());
          index += 1;
        }
        items.push(compileInline(text.join(' '), sourcePath, lineNumber, links));
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/u.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }
    if (/^\s{4,}\S/u.test(line)) {
      throw markdownError(
        sourcePath,
        lineNumber,
        'Indented code is unsupported; use a fenced code block.',
      );
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !startsBlock(lines, index)) {
      paragraph.push(lineAt(lines, index).trim());
      index += 1;
    }
    blocks.push({
      type: 'paragraph',
      inline: compileInline(paragraph.join(' '), sourcePath, lineNumber, links),
    });
  }

  if (generatedRegion) throw new Error(`${sourcePath}: unclosed generated region.`);
  if (title === '') throw new Error(`${sourcePath}: missing level-one title.`);
  for (const link of links) {
    await validateLink({
      href: link.href,
      line: link.line,
      anchors,
      sourcePath,
      workspaceRoot,
    });
  }
  return { title, blocks, anchors: [...anchors] };
}

/** @param {{cliReference: ReturnType<typeof cliDocumentationCatalog>, mcpReference: Awaited<ReturnType<typeof mcpDocumentationCatalog>>}} input */
function buildSearchIndex({ cliReference, mcpReference }) {
  return [
    ...cliReference.map((entry) => ({
      guide: 'cli',
      kind: 'command',
      id: entry.id,
      title: entry.path,
      description: entry.description,
      family: entry.family,
      safety: entry.safety,
      searchText:
        `${entry.path} ${entry.description} ${entry.family} ${entry.safety}`.toLowerCase(),
    })),
    ...mcpReference.map((entry) => ({
      guide: 'mcp',
      kind: 'tool',
      id: entry.id,
      title: entry.name,
      description: entry.description,
      family: entry.family,
      safety: entry.safety,
      searchText:
        `${entry.name} ${entry.title} ${entry.description} ${entry.family} ${entry.safety}`.toLowerCase(),
    })),
  ];
}

/** @param {string} text @param {string} sourcePath @param {number} line @param {Array<{href: string, line: number}>} links */
function compileInline(text, sourcePath, line, links) {
  /** @type {any[]} */
  const nodes = [];
  let remaining = text;
  while (remaining !== '') {
    /** @type {Array<{type: string, match: RegExpMatchArray}>} */
    const candidates = [];
    for (const [type, expression] of /** @type {Array<[string, RegExp]>} */ ([
      ['link', /\[([^\]]+)\]\(([^)]+)\)/u],
      ['code', /`([^`]+)`/u],
      ['strong', /\*\*([^*]+)\*\*/u],
      ['emphasis', /(?<!\*)\*([^*]+)\*(?!\*)/u],
    ])) {
      const match = remaining.match(expression);
      if (match !== null) candidates.push({ type, match });
    }
    if (candidates.length === 0) {
      nodes.push({ type: 'text', text: remaining });
      break;
    }
    candidates.sort(
      (left, right) => (left.match.index ?? 0) - (right.match.index ?? 0),
    );
    const next = candidates[0];
    if (next === undefined) throw new Error('Inline candidate selection failed.');
    const match = next.match;
    const matchIndex = match.index ?? 0;
    if (matchIndex > 0) {
      nodes.push({ type: 'text', text: remaining.slice(0, matchIndex) });
    }
    if (next.type === 'link') {
      const href = match[2] ?? '';
      validateHref(href, sourcePath, line);
      links.push({ href, line });
      nodes.push({ type: 'link', text: match[1] ?? '', href });
    } else {
      nodes.push({ type: next.type, text: match[1] ?? '' });
    }
    remaining = remaining.slice(matchIndex + match[0].length);
  }
  return nodes;
}

/** @param {any[]} inline */
function plainInline(inline) {
  return inline.map((node) => node.text).join('');
}

/** @param {{href: string, line: number, anchors: Set<string>, sourcePath: string, workspaceRoot: string}} input */
async function validateLink({ href, line, anchors, sourcePath, workspaceRoot }) {
  const parts = href.split('#', 2);
  const target = parts[0] ?? '';
  const fragment = parts[1];
  if (target === '') {
    if (fragment === undefined || !anchors.has(fragment)) {
      throw markdownError(sourcePath, line, `Unresolved internal anchor: ${href}`);
    }
    return;
  }
  if (/^https:\/\//u.test(target) || /^mailto:/u.test(target)) return;
  const resolved = resolve(dirname(join(workspaceRoot, sourcePath)), target);
  if (!resolved.startsWith(`${workspaceRoot}/`) && resolved !== workspaceRoot) {
    throw markdownError(sourcePath, line, `Link escapes the workspace: ${href}`);
  }
  try {
    await access(resolved);
  } catch {
    throw markdownError(sourcePath, line, `Linked file does not exist: ${href}`);
  }
}

/** @param {string} href @param {string} sourcePath @param {number} line */
function validateHref(href, sourcePath, line) {
  if (/^(?:javascript|data|file|vbscript):/iu.test(href) || /^http:\/\//iu.test(href)) {
    throw markdownError(sourcePath, line, `Unsafe link: ${href}`);
  }
  if (/\s/u.test(href)) {
    throw markdownError(sourcePath, line, `Unescaped whitespace in link: ${href}`);
  }
}

/** @param {string[]} lines @param {number} index */
function startsBlock(lines, index) {
  const line = lineAt(lines, index);
  return (
    line.trim() === '' ||
    isGeneratedMarker(line) ||
    /^```/u.test(line) ||
    /^(#{1,6})\s+/u.test(line) ||
    /^>\s?/u.test(line) ||
    /^\s*(-|\d+\.)\s+/u.test(line) ||
    /^(-{3,}|\*{3,})\s*$/u.test(line) ||
    isTableStart(lines, index)
  );
}

/** @param {string[]} lines @param {number} index */
function isTableStart(lines, index) {
  return (
    /^\s*\|.*\|\s*$/u.test(lines[index] ?? '') &&
    /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/u.test(lines[index + 1] ?? '')
  );
}

/** @param {string} line */
function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** @param {string} line */
function isGeneratedMarker(line) {
  return /^<!-- PORTREEVE:GENERATED [A-Z0-9-]+ (?:START|END) -->$/u.test(line.trim());
}

/** @param {string} line */
function isGeneratedStartMarker(line) {
  return /^<!-- PORTREEVE:GENERATED [A-Z0-9-]+ START -->$/u.test(line.trim());
}

/** @param {string} line */
function isGeneratedEndMarker(line) {
  return /^<!-- PORTREEVE:GENERATED [A-Z0-9-]+ END -->$/u.test(line.trim());
}

/** @param {string} line */
function containsRawHtml(line) {
  const withoutInlineCode = line.replace(/`[^`]*`/gu, '');
  return /<\/?[A-Za-z][^>]*>|<!--/u.test(withoutInlineCode);
}

/** @param {string} markdown @param {string} needle */
function occurrences(markdown, needle) {
  const indexes = [];
  let offset = 0;
  while (true) {
    const index = markdown.indexOf(needle, offset);
    if (index === -1) return indexes;
    indexes.push(index);
    offset = index + needle.length;
  }
}

/** @param {string[]} values @param {string} label */
function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label}.`);
  }
}

/** @param {string} text */
function markdownAnchor(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, '')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-');
}

/** @param {string} path @param {number} line @param {string} message */
function markdownError(path, line, message) {
  return new Error(`${path}:${line}: ${message}`);
}

/** @param {boolean} value */
function yesNo(value) {
  return value ? 'yes' : 'no';
}

/** @param {unknown} value */
function codeOrDash(value) {
  return value === null || value === undefined
    ? '—'
    : `\`${escapeTable(JSON.stringify(value))}\``;
}

/** @param {string} value */
function escapeTable(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/** @param {string} profile */
function outputProfile(profile) {
  if (profile === 'mcp-stdio') {
    return 'Runs a blocking stdio MCP bridge. Standard output is reserved for MCP framing; startup or protocol failures use the documented CLI exit bands.';
  }
  if (profile === 'foreground-server') {
    return 'Runs the PortReeve server in the foreground until stopped. Startup and runtime failures use the documented CLI exit bands.';
  }
  return 'Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.';
}

/** @param {string} path */
async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return null;
    throw error;
  }
}

/** @param {string[]} lines @param {number} index */
function lineAt(lines, index) {
  return lines[index] ?? '';
}
