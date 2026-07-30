// @ts-check

import { expect, test } from 'bun:test';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/index.js';

/**
 * @returns {string}
 */
function currentTarget() {
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return 'bun-darwin-x64-baseline';
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'bun-darwin-arm64';
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'bun-linux-x64-baseline';
  }
  if (process.platform === 'linux' && process.arch === 'arm64') {
    return 'bun-linux-arm64';
  }
  throw new Error(
    `Unsupported compiled CLI target: ${process.platform}/${process.arch}`,
  );
}

test('Commander.js CLI runs from the standalone executable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-compiled-cli-'));
  const binaryPath = join(directory, 'portreeve');
  const bunBinary = process.env.PORTREEVE_BUN_BINARY ?? process.execPath;

  try {
    const build = Bun.spawn(
      [
        bunBinary,
        'build',
        '--compile',
        `--target=${currentTarget()}`,
        '--no-compile-autoload-dotenv',
        '--no-compile-autoload-bunfig',
        `--outfile=${binaryPath}`,
        resolve('src/cli/main.js'),
      ],
      {
        stderr: 'pipe',
        stdout: 'pipe',
      },
    );

    const buildExitCode = await build.exited;
    const buildError = await new Response(build.stderr).text();
    expect(buildExitCode, buildError).toBe(0);

    await chmod(binaryPath, 0o755);

    const version = Bun.spawn([binaryPath, '--version'], {
      stderr: 'pipe',
      stdout: 'pipe',
    });
    const versionExitCode = await version.exited;
    const versionError = await new Response(version.stderr).text();
    const versionOutput = await new Response(version.stdout).text();

    expect(versionExitCode, versionError).toBe(0);
    expect(versionOutput.trim()).toBe('0.1.0');

    const home = join(directory, 'home');
    const socketPath = join(home, 'portreeve.sock');
    const serve = Bun.spawn([binaryPath, 'serve', '--home', home], {
      stderr: 'pipe',
      stdout: 'pipe',
    });
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
      const status = Bun.spawn(
        [binaryPath, 'status', '--socket', socketPath, '--json'],
        {
          stderr: 'pipe',
          stdout: 'pipe',
        },
      );
      const statusExitCode = await status.exited;
      const statusError = await new Response(status.stderr).text();
      const statusOutput = await new Response(status.stdout).text();
      expect(statusExitCode, statusError).toBe(0);
      expect(JSON.parse(statusOutput)).toMatchObject({
        version: 1,
        status: { running: true, socketPath },
      });

      const config = Bun.spawn(
        [binaryPath, 'config', 'get', '--socket', socketPath, '--json'],
        {
          stderr: 'pipe',
          stdout: 'pipe',
        },
      );
      const configExitCode = await config.exited;
      const configError = await new Response(config.stderr).text();
      const configOutput = await new Response(config.stdout).text();
      expect(configExitCode, configError).toBe(0);
      expect(JSON.parse(configOutput)).toMatchObject({
        version: 1,
        settings: { historyMaximumEvents: 10_000 },
      });

      serve.kill('SIGTERM');
      const serveExitCode = await serve.exited;
      const serveError = await new Response(serve.stderr).text();
      expect(serveExitCode, serveError).toBe(0);
    } finally {
      serve.kill('SIGKILL');
      await serve.exited;
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}, 60_000);
