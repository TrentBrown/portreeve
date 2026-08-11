// @ts-check

import { servePortreeveMcp } from '../../mcp/stdio.js';

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
