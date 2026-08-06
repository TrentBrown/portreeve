// @ts-check

import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AllocationService } from '../../src/allocation/service.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { startPortreeveServer } from '../../src/server/server.js';
import { openRegistry } from '../../src/storage/registry.js';

test('stack commands share definition discovery and versioned JSON contracts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-cli-'));
  const workspaceRoot = join(directory, 'worktree');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  const applicationDirectory = join(directory, 'data');
  await mkdir(workspaceRoot);
  await prepareRuntimeDirectories({
    applicationDirectory,
    socketPath,
  });
  const registry = openRegistry(join(applicationDirectory, 'registry.sqlite'));
  const server = await startPortreeveServer({
    socketPath,
    allocationService: new AllocationService({ registry }),
  });
  await writeFile(
    join(workspaceRoot, 'portreeve.stack.json'),
    JSON.stringify({
      version: 1,
      project: 'cli-stack',
      components: {
        api: {
          endpoints: {
            http: { allocation: { preferredPort: 43100 } },
          },
        },
      },
    }),
  );

  try {
    const applied = await runCli(
      ['stacks', 'apply', '--socket', socketPath, '--json'],
      workspaceRoot,
    );
    expect(applied.exitCode, applied.stderr).toBe(0);
    const appliedDocument = JSON.parse(applied.stdout);
    expect(appliedDocument).toMatchObject({
      version: 1,
      result: {
        changed: true,
        stack: { project: 'cli-stack', workspaceRoot: await realpath(workspaceRoot) },
      },
    });
    const stackId = appliedDocument.result.stack.id;

    const unchanged = await runCli(
      ['stacks', 'apply', '--socket', socketPath, '--json'],
      workspaceRoot,
    );
    expect(unchanged.exitCode, unchanged.stderr).toBe(10);
    expect(JSON.parse(unchanged.stdout).result.changed).toBe(false);

    const list = await runCli(
      [
        'stacks',
        'list',
        '--workspace',
        workspaceRoot,
        '--socket',
        socketPath,
        '--json',
      ],
      workspaceRoot,
    );
    expect(list.exitCode, list.stderr).toBe(0);
    expect(JSON.parse(list.stdout).stacks).toHaveLength(1);

    const status = await runCli(
      ['stacks', 'status', '--socket', socketPath, '--json'],
      workspaceRoot,
    );
    expect(status.exitCode, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).stack.id).toBe(stackId);

    const show = await runCli(
      ['stacks', 'show', stackId, '--socket', socketPath, '--json'],
      workspaceRoot,
    );
    expect(show.exitCode, show.stderr).toBe(0);
    expect(JSON.parse(show.stdout).stack.currentRevision).toMatch(/^[a-f0-9]{64}$/);
  } finally {
    await server.stop();
    registry.close();
    await rm(directory, { force: true, recursive: true });
  }
});

/**
 * @param {string[]} arguments_
 * @param {string} cwd
 */
async function runCli(arguments_, cwd) {
  const child = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), ...arguments_],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}
