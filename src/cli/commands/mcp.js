// @ts-check

import { servePortreeveMcp } from '../../mcp/stdio.js';
import { generateMcpSetup } from '../../mcp/setup.js';
import { resolveRuntimePaths } from '../../platform/paths.js';
import { renderOutput } from '../output/render.js';

/** @param {{socket?: string, label?: string}} options */
export async function mcpServeCommand(options) {
  const handle = servePortreeveMcp({
    ...(options.socket === undefined ? {} : { socketPath: options.socket }),
    ...(options.label === undefined ? {} : { label: options.label }),
  });
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      process.off('SIGINT', close);
      process.off('SIGTERM', close);
      process.stdin.off('close', stdinClosed);
    };
    const close = () => {
      cleanup();
      void handle.close().then(resolve, reject);
    };
    const stdinClosed = () => {
      cleanup();
      resolve(undefined);
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    process.stdin.once('close', stdinClosed);
  });
}

/**
 * @param {{host: 'generic'|'codex'|'claude-code', portable?: boolean, label?: string, json?: boolean}} options
 */
export function mcpSetupCommand(options) {
  const setup = generateMcpSetup(
    {
      host: options.host,
      portable: options.portable ?? false,
      ...(options.label === undefined ? {} : { label: options.label }),
    },
    { exactExecutablePath: resolveRuntimePaths().managedExecutablePath },
  );
  renderOutput(options.json ?? false, 'setup', setup, [
    `${setup.hostLabel} MCP setup (${setup.executableMode} executable):`,
    '',
    setup.configuration,
    ...(setup.setupCommand === null
      ? []
      : ['', 'Or register it from a terminal:', setup.setupCommand]),
    '',
    ...setup.notes,
  ]);
}
