// @ts-check

import { expect, test } from 'bun:test';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
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
    const lifecycleEnvironment = {
      ...process.env,
      HOME: directory,
      PORTREEVE_SUPERVISOR_DEFINITION: join(directory, 'portreeve.plist'),
      PORTREEVE_SUPERVISOR_LABEL: `com.portreeve.compiled-test.${process.pid}`,
    };
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

      const stackRoot = join(directory, 'customer-stack');
      const frontendSource = join(stackRoot, 'frontend', 'src');
      const backendSource = join(stackRoot, 'backend', 'services', 'api');
      const definitionFile = join(stackRoot, 'portreeve.stack.json');
      await mkdir(frontendSource, { recursive: true });
      await mkdir(backendSource, { recursive: true });
      await initializeGitRepository(join(stackRoot, 'frontend'));
      await initializeGitRepository(join(stackRoot, 'backend'));
      await writeFile(
        definitionFile,
        JSON.stringify({
          version: 1,
          project: 'compiled-discovery-stack',
          components: {
            api: {
              endpoints: {
                http: { allocation: { preferredPort: 43229 } },
              },
            },
          },
        }),
      );
      const discoveredApply = Bun.spawn(
        [binaryPath, 'stacks', 'apply', '--socket', socketPath, '--json'],
        { cwd: frontendSource, stderr: 'pipe', stdout: 'pipe' },
      );
      const discoveredApplyCode = await discoveredApply.exited;
      const discoveredApplyError = await new Response(discoveredApply.stderr).text();
      const discoveredApplyOutput = JSON.parse(
        await new Response(discoveredApply.stdout).text(),
      );
      expect(discoveredApplyCode, discoveredApplyError).toBe(0);
      expect(discoveredApplyOutput.result.stack).toMatchObject({
        project: 'compiled-discovery-stack',
        stackRoot: await realpath(stackRoot),
      });

      await rm(definitionFile);
      const fallbackStatus = Bun.spawn(
        [binaryPath, 'stacks', 'status', '--socket', socketPath, '--json'],
        { cwd: backendSource, stderr: 'pipe', stdout: 'pipe' },
      );
      const fallbackStatusCode = await fallbackStatus.exited;
      const fallbackStatusError = await new Response(fallbackStatus.stderr).text();
      const fallbackStatusOutput = JSON.parse(
        await new Response(fallbackStatus.stdout).text(),
      );
      expect(fallbackStatusCode, fallbackStatusError).toBe(0);
      expect(fallbackStatusOutput.status.stack.id).toBe(
        discoveredApplyOutput.result.stack.id,
      );

      const stackWorktree = join(directory, 'deleted-stack-worktree');
      await mkdir(stackWorktree);
      const applied = await client.applyStack({
        stackRoot: stackWorktree,
        definition: {
          version: 1,
          project: 'compiled-cli-stack',
          components: {
            api: {
              endpoints: {
                http: { allocation: { preferredPort: 43230 } },
              },
            },
          },
        },
      });
      const prepared = await client.prepareStack(applied.stack.id);
      const begun = await client.beginStackActivation(prepared.generation.id);
      const lease = begun.leases[0];
      if (lease === undefined) throw new Error('Expected a compiled CLI lease.');
      await client.abandonStackEndpoint(begun.activation.id, {
        leaseId: lease.leaseId,
        leaseToken: lease.leaseToken,
        reason: 'client-cancelled',
      });
      const reconcile = Bun.spawn(
        [
          binaryPath,
          'stacks',
          'reconcile',
          begun.activation.id,
          '--socket',
          socketPath,
          '--json',
        ],
        { stderr: 'pipe', stdout: 'pipe' },
      );
      const reconcileExitCode = await reconcile.exited;
      const reconcileError = await new Response(reconcile.stderr).text();
      const reconcileOutput = await new Response(reconcile.stdout).text();
      expect(reconcileExitCode, reconcileError).toBe(10);
      expect(JSON.parse(reconcileOutput)).toMatchObject({
        version: 1,
        result: { changed: false, activation: { state: 'failed' } },
      });

      await rm(stackWorktree, { force: true, recursive: true });
      const prune = Bun.spawn(
        [
          binaryPath,
          'stacks',
          'prune',
          '--older-than',
          '0',
          '--yes',
          '--socket',
          socketPath,
          '--json',
        ],
        { stderr: 'pipe', stdout: 'pipe' },
      );
      const pruneExitCode = await prune.exited;
      const pruneError = await new Response(prune.stderr).text();
      const pruneOutput = await new Response(prune.stdout).text();
      expect(pruneExitCode, pruneError).toBe(0);
      expect(JSON.parse(pruneOutput)).toMatchObject({
        version: 1,
        result: { deletedStackIds: [applied.stack.id] },
      });

      const status = Bun.spawn(
        [binaryPath, 'status', '--socket', socketPath, '--json'],
        {
          env: lifecycleEnvironment,
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
        status: {
          socket: { path: socketPath, state: 'healthy' },
          mode: 'manual',
          versions: { cli: '0.1.0', running: '0.1.0' },
        },
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

      const implicitStop = Bun.spawn(
        [binaryPath, 'stop', '--home', home, '--socket', socketPath, '--json'],
        {
          env: lifecycleEnvironment,
          stderr: 'pipe',
          stdout: 'pipe',
        },
      );
      const implicitStopCode = await implicitStop.exited;
      const implicitStopOutput = await new Response(implicitStop.stdout).text();
      expect(implicitStopCode).toBe(20);
      expect(JSON.parse(implicitStopOutput)).toMatchObject({
        version: 1,
        result: {
          operation: 'stop',
          outcome: 'refused',
          changed: false,
          before: { mode: 'manual' },
          after: { mode: 'manual' },
          error: { code: 'conflict' },
        },
      });

      const explicitStop = Bun.spawn(
        [binaryPath, 'stop-manual', '--home', home, '--socket', socketPath, '--json'],
        {
          env: lifecycleEnvironment,
          stderr: 'pipe',
          stdout: 'pipe',
        },
      );
      const explicitStopCode = await explicitStop.exited;
      const explicitStopError = await new Response(explicitStop.stderr).text();
      const explicitStopOutput = await new Response(explicitStop.stdout).text();
      expect(explicitStopCode, explicitStopError).toBe(0);
      expect(JSON.parse(explicitStopOutput)).toMatchObject({
        version: 1,
        result: {
          operation: 'stop-manual',
          outcome: 'succeeded',
          changed: true,
          before: { mode: 'manual' },
          after: {
            mode: 'none',
            socket: { state: 'unavailable' },
          },
          error: null,
        },
      });

      const serveExitCode = await serve.exited;
      const serveError = await new Response(serve.stderr).text();
      expect(serveExitCode, serveError).toBe(0);

      const purgePreview = Bun.spawn(
        [
          binaryPath,
          'purge',
          '--home',
          home,
          '--socket',
          socketPath,
          '--dry-run',
          '--json',
        ],
        {
          env: lifecycleEnvironment,
          stderr: 'pipe',
          stdout: 'pipe',
        },
      );
      const purgePreviewCode = await purgePreview.exited;
      const purgePreviewError = await new Response(purgePreview.stderr).text();
      const purgePreviewOutput = JSON.parse(
        await new Response(purgePreview.stdout).text(),
      );
      expect(
        purgePreviewCode,
        `${purgePreviewError}\n${JSON.stringify(purgePreviewOutput, null, 2)}`,
      ).toBe(0);
      expect(purgePreviewOutput).toMatchObject({
        version: 1,
        preview: { operation: 'purge', dryRun: true, allowed: true },
      });

      const purge = Bun.spawn(
        [
          binaryPath,
          'purge',
          '--home',
          home,
          '--socket',
          socketPath,
          '--confirm',
          purgePreviewOutput.preview.confirmationToken,
          '--json',
        ],
        {
          env: lifecycleEnvironment,
          stderr: 'pipe',
          stdout: 'pipe',
        },
      );
      const purgeCode = await purge.exited;
      const purgeError = await new Response(purge.stderr).text();
      const purgeOutput = await new Response(purge.stdout).text();
      expect(purgeCode, purgeError).toBe(0);
      expect(JSON.parse(purgeOutput)).toMatchObject({
        version: 1,
        result: {
          operation: 'purge',
          outcome: 'succeeded',
          confirmationToken: purgePreviewOutput.preview.confirmationToken,
          retained: [],
          refused: [],
        },
      });
      await expect(access(home)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      serve.kill('SIGKILL');
      await serve.exited;
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}, 60_000);

/** @param {string} directory */
async function initializeGitRepository(directory) {
  const child = Bun.spawn(['git', 'init', '--quiet', directory], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`Unable to initialize ${directory}: ${stderr}`);
}
