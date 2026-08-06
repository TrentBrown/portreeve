// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/index.js';

/** @type {Array<() => Promise<void>>} */
const cleanups = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-operations-'));
  const socketPath = join(directory, 'portreeve.sock');
  const server = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), 'serve', '--home', directory],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const client = new PortreeveClient({ socketPath });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await client.health();
      break;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    }
  }
  cleanups.push(async () => {
    server.kill('SIGTERM');
    await server.exited;
    await rm(directory, { force: true, recursive: true });
  });
  return { directory, socketPath, server, client };
}

/**
 * @param {string[]} arguments_
 * @param {string} home
 */
async function runCliWithHome(arguments_, home) {
  const child = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), ...arguments_],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: join(home, '.config'),
      },
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

async function unusedPort() {
  const probe = Bun.serve({
    port: 0,
    fetch: () => new Response('probe'),
  });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) {
    throw new Error('Probe did not expose a port.');
  }
  return port;
}

test('operational commands expose stable JSON and exit-code contracts', async () => {
  const { directory, socketPath, server, client } = await fixture();
  const runCli = (/** @type {string[]} */ arguments_) =>
    runCliWithHome(arguments_, directory);

  const status = await runCli(['status', '--socket', socketPath, '--json']);
  expect(status.exitCode, status.stderr).toBe(0);
  expect(JSON.parse(status.stdout)).toMatchObject({
    version: 1,
    status: {
      socket: { path: socketPath, state: 'healthy' },
      mode: 'manual',
      versions: { cli: '0.1.0', running: '0.1.0' },
    },
  });

  const configSet = await runCli([
    'config',
    'set',
    'gracefulShutdownMilliseconds',
    '900',
    '--socket',
    socketPath,
    '--json',
  ]);
  expect(configSet.exitCode, configSet.stderr).toBe(0);
  expect(JSON.parse(configSet.stdout)).toMatchObject({
    version: 1,
    settings: { gracefulShutdownMilliseconds: 900 },
  });

  const unclaimed = Bun.serve({
    port: 0,
    fetch: () => new Response('unclaimed'),
  });
  try {
    if (unclaimed.port === undefined) {
      throw new Error('Unclaimed listener did not expose a port.');
    }
    const reclaimConflict = await runCli([
      'ports',
      'reclaim',
      String(unclaimed.port),
      '--dry-run',
      '--socket',
      socketPath,
      '--json',
    ]);
    expect(reclaimConflict.exitCode).toBe(20);
    expect(JSON.parse(reclaimConflict.stdout)).toMatchObject({
      result: {
        outcome: 'refused',
        reason: 'ownership-unverified',
      },
    });
  } finally {
    unclaimed.stop(true);
  }

  const workspace = join(directory, 'deleted-workspace');
  await mkdir(workspace);
  const port = await unusedPort();
  const lease = await client.acquire({
    claim: {
      project: 'cli-tests',
      workspaceRoot: workspace,
      service: 'prunable',
    },
    allocation: { exactPort: port },
  });
  await client.abandon(lease, 'client-cancelled');
  await rm(workspace, { recursive: true });

  const dryRun = await runCli([
    'claims',
    'prune',
    '--older-than',
    '0',
    '--dry-run',
    '--socket',
    socketPath,
    '--json',
  ]);
  expect(dryRun.exitCode, dryRun.stderr).toBe(0);
  expect(JSON.parse(dryRun.stdout)).toMatchObject({
    version: 1,
    result: {
      dryRun: true,
      candidates: [{ claim: { identity: { service: 'prunable' } } }],
      deletedClaimIds: [],
    },
  });

  const missingConsent = await runCli([
    'claims',
    'prune',
    '--older-than',
    '0',
    '--socket',
    socketPath,
    '--json',
  ]);
  expect(missingConsent.exitCode).toBe(50);
  expect(JSON.parse(missingConsent.stderr)).toMatchObject({
    version: 1,
    error: { code: 'invalid_input' },
  });

  const contradictory = await runCli([
    'claims',
    'prune',
    '--dry-run',
    '--yes',
    '--socket',
    socketPath,
    '--json',
  ]);
  expect(contradictory.exitCode).toBe(50);

  const commanderFailure = await runCli(['claims', 'show', '--json']);
  expect(commanderFailure.exitCode).toBe(50);
  expect(JSON.parse(commanderFailure.stderr)).toMatchObject({
    version: 1,
    error: { code: 'invalid_input' },
  });

  const execution = await runCli([
    'claims',
    'prune',
    '--older-than',
    '0',
    '--yes',
    '--socket',
    socketPath,
    '--json',
  ]);
  expect(execution.exitCode, execution.stderr).toBe(0);
  expect(JSON.parse(execution.stdout)).toMatchObject({
    result: {
      dryRun: false,
      deletedClaimIds: [lease.claimId],
    },
  });

  /** @type {Array<[string[], string]>} */
  const readCommands = [
    [['claims', 'list'], 'claims'],
    [['history', '--limit', '5'], 'events'],
    [['logs', '--limit', '5'], 'entries'],
  ];
  for (const [command, key] of readCommands) {
    const result = await runCli([...command, '--socket', socketPath, '--json']);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveProperty(key);
  }

  server.kill('SIGTERM');
  expect(await server.exited).toBe(0);
  const stopped = await runCli(['status', '--socket', socketPath, '--json']);
  expect(stopped.exitCode).toBe(10);
  expect(JSON.parse(stopped.stdout)).toMatchObject({
    status: {
      socket: { state: 'unavailable' },
      mode: 'none',
    },
  });
  const unavailable = await runCli([
    'claims',
    'list',
    '--socket',
    socketPath,
    '--json',
  ]);
  expect(unavailable.exitCode).toBe(30);
  expect(JSON.parse(unavailable.stderr)).toMatchObject({
    error: { code: 'unavailable' },
  });
}, 15_000);
