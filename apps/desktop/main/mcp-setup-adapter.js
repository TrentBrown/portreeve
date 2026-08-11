// @ts-check

import { generateMcpSetup } from '../../../src/mcp/setup.js';

/**
 * Keep executable discovery and setup generation in the trusted main process.
 * The renderer may select only the bounded presentation inputs.
 *
 * @param {{exactExecutablePath: string}} options
 */
export function createMcpSetupAdapter(options) {
  const exactExecutablePath = options.exactExecutablePath;
  return Object.freeze({
    /** @param {unknown} request */
    generate(request) {
      return generateMcpSetup(request, { exactExecutablePath });
    },
  });
}
