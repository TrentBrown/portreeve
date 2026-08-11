// @ts-check

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createPortreeveMcpServer } from './bridge.js';

/**
 * @param {{socketPath?: string, label?: string, onerror?: (error: Error) => void}} [options]
 */
export function servePortreeveMcp(options = {}) {
  return serveStdio(() => createPortreeveMcpServer(options), {
    legacy: 'serve',
    onerror:
      options.onerror ??
      ((error) => {
        console.error(`PortReeve MCP bridge: ${error.message}`);
      }),
  });
}
