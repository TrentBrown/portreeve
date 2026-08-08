// @ts-check

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/index.js';

/**
 * Start a foreground Portreeve server on a private socket.
 *
 * Command modules construct their own client from `--socket`, so in-process
 * command tests need a real server rather than a stubbed transport.
 *
 * @param {string} prefix
 */
export async function startCliRuntime(prefix) {
  const directory = await mkdtemp(join(tmpdir(), `${prefix}-`));
  const socketPath = join(directory, 'portreeve.sock');
  const server = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), 'serve', '--home', directory],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const client = new PortreeveClient({ socketPath });
  let healthy = false;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      await client.health();
      healthy = true;
      break;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    }
  }
  if (!healthy) {
    server.kill('SIGKILL');
    await server.exited;
    await rm(directory, { force: true, recursive: true });
    throw new Error('Portreeve server did not become healthy.');
  }

  return {
    client,
    directory,
    socketPath,
    async stop() {
      server.kill('SIGTERM');
      await server.exited;
      await rm(directory, { force: true, recursive: true });
    },
  };
}

/**
 * Capture stdout lines written by command rendering.
 *
 * @template T
 * @param {() => Promise<T>} run
 * @returns {Promise<{result: T, lines: string[], exitCode: number | string | undefined}>}
 */
export async function captureOutput(run) {
  const original = console.log;
  const previousExitCode = process.exitCode ?? 0;
  process.exitCode = 0;
  /** @type {string[]} */
  const lines = [];
  console.log = (/** @type {unknown[]} */ ...values) => {
    lines.push(values.map((value) => String(value)).join(' '));
  };
  try {
    const result = await run();
    return { result, lines, exitCode: process.exitCode };
  } finally {
    console.log = original;
    process.exitCode = previousExitCode;
  }
}

/**
 * Parse the single versioned JSON document a command rendered.
 *
 * @param {string[]} lines
 */
export function parseRenderedJson(lines) {
  if (lines.length !== 1) {
    throw new Error(
      `Expected exactly one JSON line, received ${String(lines.length)}.`,
    );
  }
  return JSON.parse(lines[0] ?? '');
}

/**
 * Reserve a port that is known to be idle at reservation time.
 */
export async function idlePort() {
  const probe = Bun.serve({ port: 0, fetch: () => new Response('probe') });
  const { port } = probe;
  probe.stop(true);
  if (port === undefined) {
    throw new Error('Probe did not expose a port.');
  }
  return port;
}
