// @ts-check

import { readFile } from 'node:fs/promises';

export const CONSERVATIVE_EPHEMERAL_RANGE = Object.freeze({
  start: 32_768,
  end: 65_535,
  source: 'conservative-fallback',
});

export async function detectEphemeralPortRange() {
  try {
    if (process.platform === 'darwin') {
      const child = Bun.spawn(
        ['sysctl', '-n', 'net.inet.ip.portrange.first', 'net.inet.ip.portrange.last'],
        { stderr: 'pipe', stdout: 'pipe' },
      );
      const exitCode = await child.exited;
      const output = await new Response(child.stdout).text();
      if (exitCode === 0) {
        const range = parsePortRange(output, 'sysctl');
        if (range !== null) return range;
      }
    }

    if (process.platform === 'linux') {
      const output = await readFile('/proc/sys/net/ipv4/ip_local_port_range', 'utf8');
      const range = parsePortRange(output, 'procfs');
      if (range !== null) return range;
    }
  } catch {
    // Use the conservative fallback when platform discovery is unavailable.
  }

  return CONSERVATIVE_EPHEMERAL_RANGE;
}

/**
 * Read one whitespace-separated `start end` port range as the platform
 * reports it.
 *
 * @param {string} output
 * @param {string} source
 */
function parsePortRange(output, source) {
  const [start, end] = output
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10));
  return isPortRange(start, end)
    ? {
        start: /** @type {number} */ (start),
        end: /** @type {number} */ (end),
        source,
      }
    : null;
}

/**
 * @param {number | undefined} start
 * @param {number | undefined} end
 */
function isPortRange(start, end) {
  return (
    start !== undefined &&
    end !== undefined &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 1 &&
    start <= end &&
    end <= 65_535
  );
}
