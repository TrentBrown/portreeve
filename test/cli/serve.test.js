// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/index.js';

test('serve blocks, handles SIGTERM, and removes its socket', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-cli-'));
  const socketPath = join(directory, 'portreeve.sock');
  const child = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), 'serve', '--home', directory],
    { stderr: 'pipe', stdout: 'pipe' },
  );

  try {
    const client = new PortreeveClient({ socketPath });
    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        await client.health();
        healthy = true;
        break;
      } catch {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      }
    }
    expect(healthy).toBe(true);
    expect(await client.logs({ limit: 10 })).toEqual([
      expect.objectContaining({
        level: 'info',
        component: 'server',
        message: 'Portreeve server started.',
      }),
    ]);

    const lsof = Bun.spawn(
      ['lsof', '-nP', '-a', '-p', String(child.pid), '-iTCP', '-sTCP:LISTEN', '-Fpcn'],
      { stderr: 'pipe', stdout: 'pipe' },
    );
    const lsofExitCode = await lsof.exited;
    const lsofOutput = await new Response(lsof.stdout).text();
    expect(lsofExitCode).toBe(1);
    expect(lsofOutput).toBe('');

    const listener = Bun.serve({
      port: 0,
      fetch() {
        return new Response('unclaimed');
      },
    });
    try {
      if (listener.port === undefined) {
        throw new Error('TCP listener did not expose a port');
      }
      const inspect = Bun.spawn(
        [
          process.execPath,
          resolve('src/cli/main.js'),
          'ports',
          'inspect',
          String(listener.port),
          '--json',
          '--socket',
          socketPath,
        ],
        { stderr: 'pipe', stdout: 'pipe' },
      );
      const inspectExitCode = await inspect.exited;
      const inspectError = await new Response(inspect.stderr).text();
      const inspectOutput = await new Response(inspect.stdout).text();
      expect(inspectExitCode, inspectError).toBe(0);
      expect(JSON.parse(inspectOutput)).toMatchObject({
        version: 1,
        entry: {
          port: listener.port,
          classification: 'unclaimed',
        },
      });
    } finally {
      listener.stop(true);
    }

    child.kill('SIGTERM');
    const exitCode = await child.exited;
    const error = await new Response(child.stderr).text();
    expect(exitCode, error).toBe(0);
    await expect(stat(socketPath)).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    child.kill('SIGKILL');
    await child.exited;
    await rm(directory, { force: true, recursive: true });
  }
}, 10_000);
