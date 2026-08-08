// @ts-check

import { randomInt } from 'node:crypto';

const firstTestPort = 10_240;
const lastTestPort = 32_767;
const testPortCount = lastTestPort - firstTestPort + 1;
const attemptedPorts = new Set();

/**
 * Find a currently idle test port outside the usual macOS and Linux dynamic ranges.
 *
 * Unpredictable candidates avoid following the kernel's next ephemeral-port pointer or
 * colliding systematically with another developer tool's preferred range. Candidates
 * are never reused by this process after their probe is released.
 */
export async function idlePort() {
  for (let attempt = 0; attempt < testPortCount; attempt += 1) {
    if (attemptedPorts.size === testPortCount) break;
    let port;
    do {
      port = randomInt(firstTestPort, lastTestPort + 1);
    } while (attemptedPorts.has(port));
    attemptedPorts.add(port);
    try {
      const probe = Bun.serve({
        port,
        fetch: () => new Response('probe'),
      });
      probe.stop(true);
      return port;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EADDRINUSE'
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('No idle test port is available in the test allocation band.');
}
