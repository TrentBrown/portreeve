// @ts-check

import { expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AllocationService } from '../../src/allocation/service.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { startPortreeveServer } from '../../src/server/server.js';
import { openRegistry } from '../../src/storage/registry.js';
import { idlePort } from '../fixtures/ports.js';

test('stack commands share definition discovery and versioned JSON contracts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-cli-'));
  const stackRoot = join(directory, 'customer-stack');
  const frontendDirectory = join(stackRoot, 'frontend');
  const frontendSourceDirectory = join(frontendDirectory, 'src');
  const backendDirectory = join(stackRoot, 'backend');
  const backendSourceDirectory = join(backendDirectory, 'services', 'api');
  const definitionFile = join(stackRoot, 'portreeve.stack.json');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  const applicationDirectory = join(directory, 'data');
  await mkdir(frontendSourceDirectory, { recursive: true });
  await mkdir(backendSourceDirectory, { recursive: true });
  await initializeGitRepository(frontendDirectory);
  await initializeGitRepository(backendDirectory);
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
    definitionFile,
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
      frontendSourceDirectory,
    );
    expect(applied.exitCode, applied.stderr).toBe(0);
    const appliedDocument = JSON.parse(applied.stdout);
    expect(appliedDocument).toMatchObject({
      version: 1,
      result: {
        changed: true,
        stack: { project: 'cli-stack', stackRoot: await realpath(stackRoot) },
      },
    });
    const stackId = appliedDocument.result.stack.id;

    const unchanged = await runCli(
      ['stacks', 'apply', '--socket', socketPath, '--json'],
      backendSourceDirectory,
    );
    expect(unchanged.exitCode, unchanged.stderr).toBe(10);
    expect(JSON.parse(unchanged.stdout).result.changed).toBe(false);

    const list = await runCli(
      ['stacks', 'list', '--stack-root', stackRoot, '--socket', socketPath, '--json'],
      directory,
    );
    expect(list.exitCode, list.stderr).toBe(0);
    expect(JSON.parse(list.stdout).stacks).toHaveLength(1);

    const explicitRoot = await runCli(
      ['stacks', 'apply', '--stack-root', stackRoot, '--socket', socketPath, '--json'],
      directory,
    );
    expect(explicitRoot.exitCode, explicitRoot.stderr).toBe(10);

    const explicitFile = await runCli(
      ['stacks', 'apply', '--file', definitionFile, '--socket', socketPath, '--json'],
      directory,
    );
    expect(explicitFile.exitCode, explicitFile.stderr).toBe(10);

    const conflictingSelectors = await runCli(
      [
        'stacks',
        'apply',
        '--file',
        definitionFile,
        '--stack-root',
        stackRoot,
        '--socket',
        socketPath,
        '--json',
      ],
      directory,
    );
    expect(conflictingSelectors.exitCode).toBe(50);
    expect(JSON.parse(conflictingSelectors.stderr).error.message).toContain(
      '--file and --stack-root cannot be used together',
    );

    const status = await runCli(
      ['stacks', 'status', '--socket', socketPath, '--json'],
      backendSourceDirectory,
    );
    expect(status.exitCode, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).status).toMatchObject({
      stack: { id: stackId },
      generation: null,
      activation: null,
      providers: [],
    });

    await rm(definitionFile);
    const fallbackStatus = await runCli(
      ['stacks', 'status', '--socket', socketPath, '--json'],
      frontendSourceDirectory,
    );
    expect(fallbackStatus.exitCode, fallbackStatus.stderr).toBe(0);
    expect(JSON.parse(fallbackStatus.stdout).status.stack.id).toBe(stackId);

    const missingDefinition = await runCli(
      ['stacks', 'apply', '--socket', socketPath, '--json'],
      backendSourceDirectory,
    );
    expect(missingDefinition.exitCode).toBe(50);
    expect(JSON.parse(missingDefinition.stderr).error.message).toContain(
      'No enclosing portreeve.stack.json was found',
    );

    const show = await runCli(
      ['stacks', 'show', stackId, '--socket', socketPath, '--json'],
      frontendSourceDirectory,
    );
    expect(show.exitCode, show.stderr).toBe(0);
    expect(JSON.parse(show.stdout).stack.currentRevision).toMatch(/^[a-f0-9]{64}$/);

    const prepared = await runCli(
      ['stacks', 'prepare', stackId, '--socket', socketPath, '--json'],
      frontendSourceDirectory,
    );
    expect(prepared.exitCode, prepared.stderr).toBe(0);
    const generationId = JSON.parse(prepared.stdout).result.generation.id;
    const preparedStatus = await runCli(
      ['stacks', 'status', '--socket', socketPath, '--json'],
      backendSourceDirectory,
    );
    expect(JSON.parse(preparedStatus.stdout).status).toMatchObject({
      generation: { id: generationId, state: 'valid' },
      activation: null,
    });
    const generation = await runCli(
      ['stacks', 'generation', generationId, '--socket', socketPath, '--json'],
      frontendSourceDirectory,
    );
    expect(generation.exitCode, generation.stderr).toBe(0);
    expect(JSON.parse(generation.stdout).generation.id).toBe(generationId);
    const reused = await runCli(
      ['stacks', 'prepare', stackId, '--socket', socketPath, '--json'],
      backendSourceDirectory,
    );
    expect(reused.exitCode, reused.stderr).toBe(10);
    expect(JSON.parse(reused.stdout).result.reused).toBe(true);

    const begun = await runCli(
      [
        'stacks',
        'begin',
        generationId,
        '--required-endpoint',
        '{"component":"api","endpoint":"http"}',
        '--socket',
        socketPath,
        '--json',
      ],
      frontendSourceDirectory,
    );
    expect(begun.exitCode, begun.stderr).toBe(0);
    const begunDocument = JSON.parse(begun.stdout).result;
    expect(begunDocument.activation.state).toBe('starting');
    expect(begunDocument.leases).toHaveLength(1);
    const activationId = begunDocument.activation.id;
    const resolved = await runCli(
      [
        'stacks',
        'resolve',
        activationId,
        '--component',
        'api',
        '--socket',
        socketPath,
        '--json',
      ],
      backendSourceDirectory,
    );
    expect(resolved.exitCode, resolved.stderr).toBe(0);
    expect(JSON.parse(resolved.stdout)).toMatchObject({
      resolution: { component: 'api', own: { http: { component: 'api' } } },
    });
    const snapshotFile = join(directory, 'sandbox', 'endpoints.json');
    const snapshotted = await runCli(
      [
        'stacks',
        'snapshot',
        activationId,
        '--component',
        'api',
        '--gateway-host',
        'host.docker.internal',
        '--file',
        snapshotFile,
        '--socket',
        socketPath,
        '--json',
      ],
      frontendSourceDirectory,
    );
    expect(snapshotted.exitCode, snapshotted.stderr).toBe(0);
    expect(JSON.parse(await readFile(snapshotFile, 'utf8'))).toMatchObject({
      activationId,
      component: 'api',
      own: { http: { address: { host: 'host.docker.internal' } } },
    });
    expect((await stat(snapshotFile)).mode & 0o777).toBe(0o600);
    const credentialFile = join(directory, 'lease.json');
    await writeFile(
      credentialFile,
      JSON.stringify({
        leaseId: begunDocument.leases[0].leaseId,
        leaseToken: begunDocument.leases[0].leaseToken,
      }),
      { mode: 0o600 },
    );
    const abandoned = await runCli(
      [
        'stacks',
        'abandon',
        activationId,
        '--lease-file',
        credentialFile,
        '--socket',
        socketPath,
        '--json',
      ],
      backendSourceDirectory,
    );
    expect(abandoned.exitCode, abandoned.stderr).toBe(0);
    expect(JSON.parse(abandoned.stdout).activation.state).toBe('failed');
    const activation = await runCli(
      ['stacks', 'activation', activationId, '--socket', socketPath, '--json'],
      frontendSourceDirectory,
    );
    expect(activation.exitCode, activation.stderr).toBe(0);
    expect(JSON.parse(activation.stdout).activation.state).toBe('failed');
    const reconciled = await runCli(
      ['stacks', 'reconcile', activationId, '--socket', socketPath, '--json'],
      backendSourceDirectory,
    );
    expect(reconciled.exitCode, reconciled.stderr).toBe(10);
    expect(JSON.parse(reconciled.stdout).result).toMatchObject({
      changed: false,
      activation: { state: 'failed' },
    });
    const ended = await runCli(
      ['stacks', 'end', activationId, '--socket', socketPath, '--json'],
      frontendSourceDirectory,
    );
    expect(ended.exitCode, ended.stderr).toBe(0);
    expect(JSON.parse(ended.stdout).result.activation.state).toBe('ended');
    const alreadyEnded = await runCli(
      ['stacks', 'end', activationId, '--socket', socketPath, '--json'],
      backendSourceDirectory,
    );
    expect(alreadyEnded.exitCode, alreadyEnded.stderr).toBe(10);

    await rm(stackRoot, { force: true, recursive: true });
    const prunePlan = await runCli(
      [
        'stacks',
        'prune',
        '--older-than',
        '0',
        '--dry-run',
        '--socket',
        socketPath,
        '--json',
      ],
      directory,
    );
    expect(prunePlan.exitCode, prunePlan.stderr).toBe(0);
    expect(JSON.parse(prunePlan.stdout).result).toMatchObject({
      candidates: [{ stack: { id: stackId } }],
      deletedStackIds: [],
    });
    const refusedPrune = await runCli(
      ['stacks', 'prune', '--older-than', '0', '--socket', socketPath, '--json'],
      directory,
    );
    expect(refusedPrune.exitCode).toBe(50);
    expect(refusedPrune.stderr).toContain(
      'Noninteractive stack pruning requires --yes',
    );
    const pruned = await runCli(
      [
        'stacks',
        'prune',
        '--older-than',
        '0',
        '--yes',
        '--socket',
        socketPath,
        '--json',
      ],
      directory,
    );
    expect(pruned.exitCode, pruned.stderr).toBe(0);
    expect(JSON.parse(pruned.stdout).result.deletedStackIds).toEqual([stackId]);
  } finally {
    await server.stop();
    registry.close();
    await rm(directory, { force: true, recursive: true });
  }
}, 15_000);

test('stack CLI begins and confirms a Docker-backed component', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pr-dcli-'));
  const workspaceRoot = join(directory, 'worktree');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  const applicationDirectory = join(directory, 'data');
  const containerId = 'e'.repeat(64);
  const port = await idlePort();
  /** @type {null | {id: string, running: boolean, labels: Readonly<Record<string, string>>, ports: Array<{containerPort: number, hostIp: string, hostPort: number}>}} */
  let container = null;
  /** @type {Bun.Server<undefined> | undefined} */
  let listener;
  await mkdir(workspaceRoot);
  await prepareRuntimeDirectories({ applicationDirectory, socketPath });
  const registry = openRegistry(join(applicationDirectory, 'registry.sqlite'));
  const server = await startPortreeveServer({
    socketPath,
    allocationService: new AllocationService({ registry }),
    dockerAdapter: {
      availability: async () => ({ available: true, reason: null }),
      inspect: async (id) =>
        id === containerId && container !== null
          ? { status: 'ok', reason: null, container }
          : { status: 'missing', reason: 'container-missing', container: null },
      findPublishedPort: async (requestedPort) => ({
        available: true,
        reason: null,
        containers:
          container?.ports.some(({ hostPort }) => hostPort === requestedPort) === true
            ? [container]
            : [],
      }),
    },
  });
  await writeFile(
    join(workspaceRoot, 'portreeve.stack.json'),
    JSON.stringify({
      version: 1,
      project: 'cli-docker-stack',
      components: {
        api: {
          docker: { service: 'api' },
          endpoints: {
            http: {
              allocation: { exactPort: port },
              docker: { containerPort: 3000 },
            },
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
    const stackId = JSON.parse(applied.stdout).result.stack.id;
    const prepared = await runCli(
      ['stacks', 'prepare', stackId, '--socket', socketPath, '--json'],
      workspaceRoot,
    );
    const generationId = JSON.parse(prepared.stdout).result.generation.id;
    const begun = await runCli(
      [
        'stacks',
        'begin',
        generationId,
        '--docker-component',
        'api',
        '--socket',
        socketPath,
        '--json',
      ],
      workspaceRoot,
    );
    expect(begun.exitCode, begun.stderr).toBe(0);
    const begunResult = JSON.parse(begun.stdout).result;
    const lease = begunResult.leases[0];
    expect(lease).toMatchObject({
      bindingKind: 'docker',
      docker: { service: 'api', containerPort: 3000 },
    });
    container = {
      id: containerId,
      running: true,
      labels: lease.docker.requiredLabels,
      ports: [{ containerPort: 3000, hostIp: '127.0.0.1', hostPort: port }],
    };
    listener = Bun.serve({
      hostname: '127.0.0.1',
      port,
      fetch: () => new Response('Docker CLI fixture'),
    });
    const credentialFile = join(directory, 'docker-lease.json');
    await writeFile(
      credentialFile,
      JSON.stringify({ leaseId: lease.leaseId, leaseToken: lease.leaseToken }),
      { mode: 0o600 },
    );
    const confirmed = await runCli(
      [
        'stacks',
        'confirm-docker',
        begunResult.activation.id,
        '--lease-file',
        credentialFile,
        '--container-id',
        containerId,
        '--socket',
        socketPath,
        '--json',
      ],
      workspaceRoot,
    );
    expect(confirmed.exitCode, confirmed.stderr).toBe(0);
    expect(JSON.parse(confirmed.stdout).activation).toMatchObject({
      state: 'confirmed',
      endpoints: [{ bindingKind: 'docker', state: 'confirmed' }],
    });
  } finally {
    listener?.stop(true);
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
