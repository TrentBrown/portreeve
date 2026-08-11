// @ts-check

import { z } from 'zod';

export const MCP_SETUP_HOSTS = Object.freeze(['generic', 'codex', 'claude-code']);

export const McpSetupRequestSchema = z
  .object({
    host: z.enum(['generic', 'codex', 'claude-code']),
    portable: z.boolean().default(false),
    label: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .optional(),
  })
  .strict();

export const McpSetupResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    host: z.enum(['generic', 'codex', 'claude-code']),
    hostLabel: z.string().min(1),
    executableMode: z.enum(['exact', 'portable']),
    command: z.string().min(1),
    args: z.array(z.string()),
    clientLabel: z.string().min(1),
    configurationLanguage: z.enum(['json', 'toml']),
    configuration: z.string().min(1),
    setupCommand: z.string().nullable(),
    notes: z.array(z.string().min(1)),
  })
  .strict();

const HOSTS = Object.freeze({
  generic: Object.freeze({ label: 'Generic stdio', clientLabel: 'generic' }),
  codex: Object.freeze({ label: 'Codex CLI and desktop', clientLabel: 'codex' }),
  'claude-code': Object.freeze({
    label: 'Claude Code',
    clientLabel: 'claude-code',
  }),
});

/**
 * Generate copyable MCP host configuration without reading or writing host
 * settings. Path discovery belongs to the trusted caller.
 *
 * @param {unknown} request
 * @param {{exactExecutablePath: string}} authority
 */
export function generateMcpSetup(request, authority) {
  const input = McpSetupRequestSchema.parse(request);
  const exactExecutablePath = z.string().min(1).parse(authority.exactExecutablePath);
  const command = input.portable ? 'portreeve' : exactExecutablePath;
  const clientLabel = input.label ?? HOSTS[input.host].clientLabel;
  const args = ['mcp', 'serve', '--label', clientLabel];
  const descriptor = { type: 'stdio', command, args };
  let configurationLanguage = /** @type {'json'|'toml'} */ ('json');
  let configuration;
  let setupCommand = null;

  if (input.host === 'codex') {
    configurationLanguage = 'toml';
    configuration = [
      '[mcp_servers.portreeve]',
      `command = ${tomlString(command)}`,
      `args = [${args.map(tomlString).join(', ')}]`,
    ].join('\n');
    setupCommand = `codex mcp add portreeve -- ${shellWords([command, ...args])}`;
  } else if (input.host === 'claude-code') {
    configuration = JSON.stringify({ mcpServers: { portreeve: descriptor } }, null, 2);
    setupCommand = `claude mcp add --scope user portreeve -- ${shellWords([command, ...args])}`;
  } else {
    configuration = JSON.stringify(descriptor, null, 2);
  }

  return McpSetupResultSchema.parse({
    schemaVersion: 1,
    host: input.host,
    hostLabel: HOSTS[input.host].label,
    executableMode: input.portable ? 'portable' : 'exact',
    command,
    args,
    clientLabel,
    configurationLanguage,
    configuration,
    setupCommand,
    notes: [
      'Each MCP host starts its own lightweight stdio bridge; every bridge talks to the single PortReeve daemon.',
      input.portable
        ? 'Portable mode requires portreeve to be available on the MCP host PATH.'
        : 'The exact managed path is resilient to restricted GUI application PATH values and remains stable across PortReeve upgrades.',
      'PortReeve generated this preview only. No third-party configuration was changed.',
    ],
  });
}

/** @param {string} value */
function tomlString(value) {
  return JSON.stringify(value);
}

/** @param {string[]} words */
function shellWords(words) {
  return words.map(shellWord).join(' ');
}

/** @param {string} word */
function shellWord(word) {
  return /^[A-Za-z0-9_./:@+-]+$/.test(word)
    ? word
    : `'${word.replaceAll("'", `'"'"'`)}'`;
}
