// @ts-check

import { expect, test } from 'bun:test';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
    `Unsupported runtime spike target: ${process.platform}/${process.arch}`,
  );
}

test('compiled runtime supports Unix HTTP, SQLite, lsof, and disabled dotenv autoload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-compiled-spike-'));
  const binaryPath = join(directory, 'runtime-spike');
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
        resolve('test/fixtures/compiled-runtime.js'),
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
    await writeFile(join(directory, '.env'), 'PORTREEVE_SPIKE_AMBIENT=loaded\n');

    const run = Bun.spawn([binaryPath], {
      cwd: directory,
      stderr: 'pipe',
      stdout: 'pipe',
    });
    const runExitCode = await run.exited;
    const runError = await new Response(run.stderr).text();
    const output = await new Response(run.stdout).text();

    expect(runExitCode, runError).toBe(0);

    const result = JSON.parse(output.trim());
    expect(result).toEqual({
      ambientDotenvLoaded: false,
      body: { value: 'sqlite-ok' },
      embeddedAsset: 'embedded-asset-ok',
      lsofExitCode: 0,
      lsofFoundListener: true,
      signalExitCode: 143,
      socketMode: 0o600,
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}, 60_000);
