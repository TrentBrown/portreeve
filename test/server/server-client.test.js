// @ts-check

import { afterEach, expect, test } from 'bun:test';
import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import {
  PortreeveClient,
  PortreeveClientError,
} from '../../packages/client/src/index.js';
import { AllocationService } from '../../src/allocation/service.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { startPortreeveServer } from '../../src/server/server.js';
import { openRegistry } from '../../src/storage/registry.js';
import { idlePort } from '../fixtures/ports.js';

/** @type {Array<() => Promise<void>>} */
const cleanups = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

/** @param {{dockerAdapter?: import('../../src/docker/adapter.js').DockerEvidenceAdapter}} [options] */
async function startFixture(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-server-'));
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  const databasePath = join(directory, 'data', 'registry.sqlite');
  await prepareRuntimeDirectories({
    applicationDirectory: join(directory, 'data'),
    socketPath,
  });
  const registry = openRegistry(databasePath);
  const allocationService = new AllocationService({ registry });
  const server = await startPortreeveServer({
    socketPath,
    allocationService,
    ...(options.dockerAdapter === undefined
      ? {}
      : { dockerAdapter: options.dockerAdapter }),
  });
  cleanups.push(async () => {
    await server.stop();
    registry.close();
    await rm(directory, { force: true, recursive: true });
  });
  return { socketPath, registry, allocationService };
}

function claim(service = 'website', workspaceRoot = tmpdir()) {
  return {
    project: 'caregiver',
    workspaceRoot,
    service,
    transport: /** @type {const} */ ('tcp'),
  };
}

test('serves health only through a private Unix socket', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });

  expect(await client.health()).toMatchObject({
    softwareVersion: '0.1.0',
    protocol: { minimum: 1, maximum: 1 },
    pid: process.pid,
    mode: 'manual',
  });
  expect((await stat(socketPath)).mode & 0o777).toBe(0o600);
});

test('attributes mutations to an explicit diagnostic client origin', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({
    socketPath,
    origin: {
      kind: 'mcp',
      runId: '11111111-1111-4111-8111-111111111111',
      label: 'codex-backend-worktree',
    },
  });
  const lease = await client.acquire({ claim: claim('origin-test') });
  await client.abandon(lease, 'client-cancelled');

  const page = await client.historyPage({ eventType: 'lease.abandoned', limit: 1 });
  expect(page.items[0]?.origin).toEqual({
    kind: 'mcp',
    runId: '11111111-1111-4111-8111-111111111111',
    label: 'codex-backend-worktree',
  });
});

test('renews a standalone lease through the public client without changing its token', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const lease = await client.acquire({ claim: claim('renew-through-client') });
  const renewed = await client.renewLease(lease);

  expect(renewed.leaseId).toBe(lease.leaseId);
  expect(renewed.expiresAt >= lease.expiresAt).toBe(true);
  await client.abandon(lease, 'client-cancelled');
});

test('allows lifecycle callers to abort a pending health request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-client-abort-'));
  const socketPath = join(directory, 'hanging.sock');
  /** @type {Set<import('node:net').Socket>} */
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => resolvePromise(undefined));
  });
  cleanups.push(async () => {
    for (const socket of sockets) socket.destroy();
    server.close();
    await rm(directory, { force: true, recursive: true });
  });
  const controller = new AbortController();
  const pendingHealth = new PortreeveClient({ socketPath }).health({
    signal: controller.signal,
  });
  controller.abort();

  await expect(pendingHealth).rejects.toMatchObject({ code: 'request_aborted' });
});

test('accepts a protected graceful shutdown request through the client', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });

  expect(await client.stopServer()).toMatchObject({ changed: true });
  await Bun.sleep(25);
  await expect(client.health()).rejects.toMatchObject({ code: 'unavailable' });
});

test('refuses a second server on the active per-user socket', async () => {
  const { socketPath, allocationService } = await startFixture();

  await expect(startPortreeveServer({ socketPath, allocationService })).rejects.toThrow(
    'server is already serving',
  );
});

test('rejects incompatible clients before allocation mutation', async () => {
  const { socketPath, registry } = await startFixture();
  const response = await fetch('http://portreeve/v1/leases/acquire', {
    unix: socketPath,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client: {
        softwareVersion: '99.0.0',
        protocol: { minimum: 2, maximum: 2 },
        requiredCapabilities: [],
      },
      claim: claim('future'),
      allocation: {
        mode: 'sticky',
        replacementPolicy: 'never',
      },
    }),
  });
  const envelope = await response.json();

  expect(response.status).toBe(426);
  expect(envelope).toMatchObject({
    error: { code: 'incompatible_protocol' },
  });
  expect(registry.findClaim(claim('future'))).toBeNull();
});

test('official client refuses a stack apply when an old server lacks the capability', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'portreeve-old-server-'));
  cleanups.push(() => rm(workspaceRoot, { force: true, recursive: true }));
  const client = new PortreeveClient({ socketPath: '/not-used' });
  client.health = async () => ({
    softwareVersion: '0.0.1',
    protocol: { minimum: 1, maximum: 1 },
    capabilities: ['two-phase-allocation-v1'],
    pid: 1,
    mode: 'manual',
  });

  await expect(
    client.applyStack({
      stackRoot: workspaceRoot,
      definition: {
        version: 1,
        project: 'caregiver',
        components: { api: {} },
      },
    }),
  ).rejects.toMatchObject({
    code: 'incompatible_protocol',
    details: { missingCapabilities: ['stack-definitions-v1'] },
  });
  await expect(client.prepareStack(crypto.randomUUID())).rejects.toMatchObject({
    code: 'incompatible_protocol',
    details: { missingCapabilities: ['stack-activations-v1'] },
  });
  await expect(
    client.resolveStackEndpoints(crypto.randomUUID(), 'api'),
  ).rejects.toMatchObject({
    code: 'incompatible_protocol',
    details: { missingCapabilities: ['stack-discovery-v1'] },
  });
});

test('applies and inspects a stack definition through the official client', async () => {
  const { socketPath, registry } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'portreeve-stack-worktree-'));
  cleanups.push(() => rm(workspaceRoot, { force: true, recursive: true }));
  const definition = {
    version: /** @type {const} */ (1),
    project: 'caregiver',
    components: {
      api: {
        endpoints: {
          http: { allocation: { preferredPort: 43100 } },
        },
      },
    },
  };

  const applied = await client.applyStack({ stackRoot: workspaceRoot, definition });
  expect(applied.changed).toBe(true);
  expect(applied.stack).toMatchObject({
    project: 'caregiver',
    stackRoot: await realpath(resolve(workspaceRoot)),
  });
  expect(applied.stack.definition.components.api?.endpoints?.http).toEqual({
    transport: 'tcp',
    publish: true,
    required: true,
    allocation: { preferredPort: 43100 },
  });
  expect(await client.listStacks({ stackRoot: workspaceRoot })).toEqual([
    applied.stack,
  ]);
  expect(await client.getStack(applied.stack.id)).toEqual(applied.stack);
  expect(await client.getStackStatus(applied.stack.id)).toEqual({
    stack: applied.stack,
    generation: null,
    activation: null,
    providers: [],
  });
  expect(
    (await client.applyStack({ stackRoot: workspaceRoot, definition })).changed,
  ).toBe(false);
  expect(registry.listClaims()[0]?.identity).toMatchObject({
    service: 'api',
    component: 'api',
    endpoint: 'http',
  });
});

test('canonicalizes and validates stack roots for raw protocol callers', async () => {
  const { socketPath, registry } = await startFixture();
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-raw-stack-'));
  const stackRoot = join(directory, 'stack');
  const alias = join(directory, 'alias');
  await Bun.write(join(stackRoot, '.keep'), '');
  await symlink(stackRoot, alias, 'dir');
  cleanups.push(() => rm(directory, { force: true, recursive: true }));
  const request = {
    client: {
      softwareVersion: '0.1.0',
      protocol: { minimum: 1, maximum: 1 },
      requiredCapabilities: ['stack-definitions-v1'],
    },
    definition: {
      version: 1,
      project: 'raw-client',
      components: { api: {} },
    },
  };

  const response = await fetch('http://portreeve/v1/stacks/apply', {
    unix: socketPath,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, stackRoot: alias }),
  });
  expect(response.status).toBe(200);
  expect(registry.listStacks()).toMatchObject([
    { stackRoot: await realpath(stackRoot) },
  ]);

  const obsoleteFilter = await fetch(
    `http://portreeve/v1/stacks?workspaceRoot=${encodeURIComponent(alias)}`,
    { unix: socketPath },
  );
  expect(obsoleteFilter.status).toBe(400);
  expect(await obsoleteFilter.json()).toMatchObject({
    error: {
      code: 'invalid_input',
      details: { reason: 'unsupported_stack_filter' },
    },
  });

  const invalid = await fetch('http://portreeve/v1/stacks/apply', {
    unix: socketPath,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, stackRoot: join(directory, 'missing') }),
  });
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: {
      code: 'invalid_input',
      details: { reason: 'invalid_stack_root' },
    },
  });

  const fileRoot = await fetch('http://portreeve/v1/stacks/apply', {
    unix: socketPath,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, stackRoot: join(stackRoot, '.keep') }),
  });
  expect(fileRoot.status).toBe(400);
  expect(await fileRoot.json()).toMatchObject({
    error: {
      code: 'invalid_input',
      details: { reason: 'invalid_stack_root' },
    },
  });
  expect(registry.listStacks()).toHaveLength(1);
});

test('previews and executes missing-stack-root pruning through the official client', async () => {
  const { socketPath, registry } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'portreeve-prune-stack-'));
  const applied = await client.applyStack({
    stackRoot: workspaceRoot,
    definition: {
      version: 1,
      project: 'prune-client',
      components: {
        api: { endpoints: { http: { allocation: { preferredPort: 43100 } } } },
      },
    },
  });
  await rm(workspaceRoot, { force: true, recursive: true });

  expect(
    await client.pruneStacks({ olderThanMilliseconds: 0, dryRun: true }),
  ).toMatchObject({
    dryRun: true,
    candidates: [{ stack: { id: applied.stack.id } }],
    deletedStackIds: [],
  });
  expect(
    await client.pruneStacks({ olderThanMilliseconds: 0, dryRun: false }),
  ).toMatchObject({
    dryRun: false,
    deletedStackIds: [applied.stack.id],
  });
  expect(registry.getStack(applied.stack.id)).toBeNull();
});

test('prepares and confirms a process-backed activation through the official client', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'portreeve-activation-'));
  cleanups.push(() => rm(workspaceRoot, { force: true, recursive: true }));
  const exactPort = await idlePort();
  const optionalPort = await idlePort();
  let listener;

  try {
    const applied = await client.applyStack({
      stackRoot: workspaceRoot,
      definition: {
        version: 1,
        project: 'caregiver',
        components: {
          api: {
            endpoints: {
              http: { allocation: { exactPort } },
              metrics: {
                required: false,
                allocation: { exactPort: optionalPort },
              },
            },
          },
        },
      },
    });
    const prepared = await client.prepareStack(applied.stack.id);
    const begun = await client.beginStackActivation(prepared.generation.id, {
      skippedEndpoints: [{ component: 'api', endpoint: 'metrics' }],
    });
    expect(
      await client.listStackGenerations({ stackId: applied.stack.id, state: 'valid' }),
    ).toEqual([prepared.generation]);
    expect(
      await client.listStackActivations({
        stackId: applied.stack.id,
        generationId: prepared.generation.id,
        state: 'starting',
      }),
    ).toEqual([begun.activation]);
    expect(
      await client.resolveStackEndpoints(begun.activation.id, 'api'),
    ).toMatchObject({
      activationId: begun.activation.id,
      generationId: prepared.generation.id,
      component: 'api',
      own: {
        http: {
          component: 'api',
          endpoint: 'http',
          host: { host: '127.0.0.1', port: exactPort },
          dockerNetwork: null,
        },
      },
    });
    expect(
      await client.createStackEndpointSnapshot(begun.activation.id, {
        component: 'api',
        gatewayHost: 'host.docker.internal',
      }),
    ).toMatchObject({
      activationId: begun.activation.id,
      generationId: prepared.generation.id,
      component: 'api',
      own: { http: { address: { host: 'host.docker.internal', port: exactPort } } },
    });
    const lease = begun.leases[0];
    if (lease === undefined) throw new Error('Expected an activation lease.');
    listener = Bun.serve({
      port: lease.port,
      fetch() {
        return new Response('stack endpoint');
      },
    });
    const activation = await client.confirmStackEndpoint(begun.activation.id, {
      leaseId: lease.leaseId,
      leaseToken: lease.leaseToken,
      rootPid: process.pid,
    });

    expect(activation.state).toBe('degraded');
    expect(await client.getStackActivation(activation.id)).toEqual(activation);
    expect(await client.reconcileStackActivation(activation.id)).toMatchObject({
      changed: false,
      activation: { state: 'degraded' },
      providers: [{ status: 'active', bindingKind: 'process' }],
    });
    expect(await client.getStackStatus(applied.stack.id)).toMatchObject({
      stack: { id: applied.stack.id },
      generation: { id: prepared.generation.id, state: 'valid' },
      activation: { id: activation.id, state: 'degraded' },
      providers: [{ status: 'active', bindingKind: 'process' }],
    });
    listener.stop(true);
    listener = undefined;
    expect(await client.reconcileStackActivation(activation.id)).toMatchObject({
      changed: true,
      activation: { state: 'lost' },
      providers: [{ status: 'gone', bindingKind: 'process' }],
    });
    expect(await client.getStackGeneration(prepared.generation.id)).toEqual(
      prepared.generation,
    );
    const ended = await client.endStackActivation(activation.id);
    expect(ended).toMatchObject({
      changed: true,
      activation: { state: 'ended' },
    });
    expect(await client.getStackStatus(applied.stack.id)).toMatchObject({
      activation: { id: activation.id, state: 'ended' },
      providers: [],
    });
  } finally {
    listener?.stop(true);
  }
});

test('advertises and confirms Docker evidence through the official socket client', async () => {
  const containerId = 'd'.repeat(64);
  /** @type {null | {id: string, running: boolean, labels: Readonly<Record<string, string>>, ports: Array<{containerPort: number, hostIp: string, hostPort: number}>}} */
  let container = null;
  /** @type {import('../../src/docker/adapter.js').DockerEvidenceAdapter} */
  const dockerAdapter = {
    availability: async () => ({ available: true, reason: null }),
    inspect: async (id) =>
      id === containerId && container !== null
        ? { status: 'ok', reason: null, container }
        : { status: 'missing', reason: 'container-missing', container: null },
    findPublishedPort: async (port) => ({
      available: true,
      reason: null,
      containers:
        container?.ports.some((binding) => binding.hostPort === port) === true
          ? [container]
          : [],
    }),
  };
  const { socketPath } = await startFixture({ dockerAdapter });
  const client = new PortreeveClient({ socketPath });
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'portreeve-docker-activation-'));
  cleanups.push(() => rm(workspaceRoot, { force: true, recursive: true }));
  const exactPort = await idlePort();
  expect((await client.health()).capabilities).toContain('docker-evidence-v1');
  const applied = await client.applyStack({
    stackRoot: workspaceRoot,
    definition: {
      version: 1,
      project: 'docker-client',
      components: {
        api: {
          docker: { service: 'api' },
          endpoints: {
            http: {
              allocation: { exactPort },
              docker: { containerPort: 3000 },
            },
          },
        },
      },
    },
  });
  const prepared = await client.prepareStack(applied.stack.id);
  const begun = await client.beginStackActivation(prepared.generation.id, {
    bindings: { api: 'docker' },
  });
  const lease = begun.leases[0];
  if (lease?.docker === null || lease === undefined) {
    throw new Error('Expected a Docker activation lease.');
  }
  container = {
    id: containerId,
    running: true,
    labels: lease.docker.requiredLabels,
    ports: [{ containerPort: 3000, hostIp: '127.0.0.1', hostPort: exactPort }],
  };
  const activation = await client.confirmStackEndpoint(begun.activation.id, {
    leaseId: lease.leaseId,
    leaseToken: lease.leaseToken,
    bindingKind: 'docker',
    containerId,
  });
  expect(activation).toMatchObject({
    state: 'confirmed',
    endpoints: [{ bindingKind: 'docker', state: 'confirmed' }],
  });
  expect(await client.inspectPort(exactPort)).toMatchObject({
    classification: 'docker-managed',
    docker: { containers: [{ id: containerId }] },
    listeners: [],
  });
});

test('omits unavailable Docker capability without impairing process-only inventory', async () => {
  const { socketPath } = await startFixture({
    dockerAdapter: {
      availability: async () => ({
        available: false,
        reason: 'docker-executable-unavailable',
      }),
      inspect: async () => ({
        status: 'unavailable',
        reason: 'docker-executable-unavailable',
        container: null,
      }),
      findPublishedPort: async () => {
        throw new Error('Unavailable Docker discovery must not run for inventory.');
      },
    },
  });
  const client = new PortreeveClient({ socketPath });
  const listener = Bun.serve({
    port: 0,
    fetch: () => new Response('process-only'),
  });

  try {
    expect((await client.health()).capabilities).not.toContain('docker-evidence-v1');
    if (listener.port === undefined) throw new Error('Listener did not expose a port.');
    expect(await client.inspectPort(listener.port)).toMatchObject({
      classification: 'unclaimed',
      docker: null,
    });
  } finally {
    listener.stop(true);
  }
});

test('acquires, binds, confirms, releases, and reuses a sticky assignment', async () => {
  const { socketPath, registry } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const preferredPort = await idlePort();
  /** @type {Bun.Server<undefined> | undefined} */
  let listener;

  try {
    const first = await client.withPort(
      {
        claim: claim(),
        allocation: { preferredPort },
      },
      async (port) => {
        listener = Bun.serve({
          port,
          fetch() {
            return new Response('service');
          },
        });
        return 'started';
      },
    );

    expect(first.port).toBe(preferredPort);
    expect(first.value).toBe('started');
    expect(registry.getRun(first.run.runId)?.state).toBe('confirmed');
    const activeEntry = await client.inspectPort(preferredPort);
    expect(activeEntry.classification).toBe('verified');
    expect(activeEntry.listeners[0]).toMatchObject({
      pid: process.pid,
      ownership: { verified: true },
    });
    expect(activeEntry.run).toMatchObject({
      confirmedListenerFingerprints: [
        {
          fingerprint: { pid: process.pid },
        },
      ],
    });

    if (listener === undefined) {
      throw new Error('Service callback did not create a listener');
    }
    listener.stop(true);
    listener = undefined;
    expect((await first.release()).changed).toBe(true);

    const second = await client.acquire({
      claim: claim(),
      allocation: { preferredPort: preferredPort + 1 },
    });
    expect(second.port).toBe(preferredPort);
    expect(second.reusedAssignment).toBe(true);
    await client.abandon(second, 'client-cancelled');
  } finally {
    listener?.stop(true);
  }
});

test('confirms and inventories a listener descended from the run root', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const exactPort = await idlePort();
  /** @type {Bun.Subprocess<'ignore', 'pipe', 'pipe'> | undefined} */
  let child;

  try {
    const started = await client.withPort(
      {
        claim: claim('child-listener'),
        allocation: { exactPort },
        rootPid: process.pid,
      },
      async (port) => {
        const spawned = Bun.spawn(
          [
            'node',
            '--input-type=module',
            '--eval',
            `import http from 'node:http';
             const server = http.createServer((_request, response) => response.end('ok'));
             server.listen(Number(process.env.PORT), () => console.log('ready'));
             process.on('SIGTERM', () => server.close(() => process.exit(0)));`,
          ],
          {
            env: { ...process.env, PORT: String(port) },
            stderr: 'pipe',
            stdout: 'pipe',
          },
        );
        child = spawned;
        const reader = spawned.stdout.getReader();
        const ready = await reader.read();
        reader.releaseLock();
        expect(new TextDecoder().decode(ready.value)).toContain('ready');
        return 'child-started';
      },
    );

    if (child === undefined) {
      throw new Error('Child listener was not started');
    }
    const runningChild = child;
    const entry = await client.inspectPort(exactPort);
    expect(entry.classification).toBe('verified');
    expect(entry.listeners[0]).toMatchObject({
      pid: runningChild.pid,
      ownership: {
        verified: true,
        lineage: [runningChild.pid, process.pid],
      },
    });

    runningChild.kill('SIGTERM');
    expect(await runningChild.exited).toBe(0);
    child = undefined;
    await started.release();
  } finally {
    child?.kill('SIGKILL');
    if (child !== undefined) {
      await child.exited;
    }
  }
});

test('preserves a sticky assignment across a server and database restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-restart-'));
  const applicationDirectory = join(directory, 'data');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  const databasePath = join(applicationDirectory, 'registry.sqlite');
  await prepareRuntimeDirectories({ applicationDirectory, socketPath });
  const preferredPort = await idlePort();
  /** @type {Bun.Server<undefined> | undefined} */
  let serviceListener;
  let firstServer;
  let secondServer;
  let firstRegistry;
  let secondRegistry;

  try {
    firstRegistry = openRegistry(databasePath);
    firstServer = await startPortreeveServer({
      socketPath,
      allocationService: new AllocationService({ registry: firstRegistry }),
    });
    const firstClient = new PortreeveClient({ socketPath });
    const first = await firstClient.withPort(
      {
        claim: claim('restart-service'),
        allocation: { preferredPort },
      },
      async (port) => {
        serviceListener = Bun.serve({
          port,
          fetch() {
            return new Response('service');
          },
        });
        return undefined;
      },
    );
    serviceListener?.stop(true);
    serviceListener = undefined;
    await first.release();
    await firstServer.stop();
    firstServer = undefined;
    firstRegistry.close();
    firstRegistry = undefined;

    secondRegistry = openRegistry(databasePath);
    secondServer = await startPortreeveServer({
      socketPath,
      allocationService: new AllocationService({ registry: secondRegistry }),
    });
    const secondClient = new PortreeveClient({ socketPath });
    const second = await secondClient.acquire({
      claim: claim('restart-service'),
      allocation: { preferredPort: preferredPort + 1 },
    });

    expect(second.port).toBe(preferredPort);
    expect(second.reusedAssignment).toBe(true);
    await secondClient.abandon(second, 'client-cancelled');
  } finally {
    serviceListener?.stop(true);
    await firstServer?.stop();
    await secondServer?.stop();
    firstRegistry?.close();
    secondRegistry?.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('returns structured exact-port conflicts without fallback', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const listener = Bun.serve({
    port: 0,
    fetch() {
      return new Response('occupied');
    },
  });

  try {
    if (listener.port === undefined) {
      throw new Error('TCP listener did not expose a port');
    }
    await expect(
      client.acquire({
        claim: claim('api'),
        allocation: { exactPort: listener.port },
      }),
    ).rejects.toMatchObject({
      code: 'conflict',
      status: 409,
    });
  } finally {
    listener.stop(true);
  }
});

test('exposes evidence-bound reclaim and explicit unsafe dry-run APIs', async () => {
  const { socketPath, registry } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const listener = Bun.serve({
    port: 0,
    fetch() {
      return new Response('occupied');
    },
  });

  try {
    if (listener.port === undefined) {
      throw new Error('TCP listener did not expose a port');
    }
    expect(
      await client.reclaimPort(listener.port, {
        policy: 'graceful',
        dryRun: true,
      }),
    ).toMatchObject({
      operation: 'reclaim',
      outcome: 'refused',
      reason: 'ownership-unverified',
      signals: [],
    });
    const unsafePlan = await client.unsafeEvictPort(listener.port, {
      unsafeAnyOwner: true,
      policy: 'force-after-grace',
      dryRun: true,
    });
    expect(unsafePlan).toMatchObject({
      operation: 'unsafe-eviction',
      port: listener.port,
      outcome: 'would-terminate',
      targets: [{ pid: process.pid }],
      signals: [],
    });

    const response = await fetch(
      `http://portreeve/v1/ports/${String(listener.port)}/unsafe-evict`,
      {
        unix: socketPath,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client: {
            softwareVersion: '0.1.0',
            protocol: { minimum: 1, maximum: 1 },
            requiredCapabilities: [],
          },
          policy: 'graceful',
          dryRun: true,
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'invalid_input' },
    });
    expect(
      registry
        .listHistory()
        .filter(({ entityType }) => entityType === 'reclamation')
        .map(({ eventType }) => eventType),
    ).toEqual([
      'reclamation.requested',
      'reclamation.completed',
      'reclamation.requested',
      'reclamation.completed',
    ]);
  } finally {
    listener.stop(true);
  }
});

test('serializes concurrent acquisitions onto distinct ports', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const preferredPort = await idlePort();

  const [first, second] = await Promise.all([
    client.acquire({
      claim: claim('website', tmpdir()),
      allocation: { preferredPort },
    }),
    client.acquire({
      claim: claim('api', tmpdir()),
      allocation: { preferredPort },
    }),
  ]);

  expect(first.port).not.toBe(second.port);
  await Promise.all([
    client.abandon(first, 'client-cancelled'),
    client.abandon(second, 'client-cancelled'),
  ]);
});

test('high-level helper retries a bind collision through the server', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const preferredPort = await idlePort();
  /** @type {Bun.Server<undefined> | undefined} */
  let collisionListener;
  /** @type {Bun.Server<undefined> | undefined} */
  let serviceListener;
  let attempts = 0;

  try {
    const started = await client.withPort(
      {
        claim: claim('retry-service'),
        allocation: { preferredPort },
      },
      async (port) => {
        attempts += 1;
        if (attempts === 1) {
          collisionListener = Bun.serve({
            port,
            fetch() {
              return new Response('collision');
            },
          });
          const error = new Error('address already in use');
          Object.assign(error, { code: 'EADDRINUSE' });
          throw error;
        }

        serviceListener = Bun.serve({
          port,
          fetch() {
            return new Response('service');
          },
        });
        return 'started';
      },
    );

    expect(attempts).toBe(2);
    expect(started.port).not.toBe(preferredPort);
    serviceListener?.stop(true);
    serviceListener = undefined;
    await started.release();
  } finally {
    collisionListener?.stop(true);
    serviceListener?.stop(true);
  }
});

test('works from a separate Node process through the public protocol', async () => {
  const { socketPath } = await startFixture();
  const clientUrl = new URL('../../packages/client/src/index.js', import.meta.url).href;
  const child = Bun.spawn(
    [
      'node',
      '--input-type=module',
      '--eval',
      `import { PortreeveClient } from ${JSON.stringify(clientUrl)};
       const health = await new PortreeveClient({ socketPath: ${JSON.stringify(socketPath)} }).health();
       console.log(JSON.stringify(health.protocol));`,
    ],
    { stderr: 'pipe', stdout: 'pipe' },
  );
  const exitCode = await child.exited;
  const error = await new Response(child.stderr).text();
  const output = await new Response(child.stdout).text();

  expect(exitCode, error).toBe(0);
  expect(JSON.parse(output.trim())).toEqual({ minimum: 1, maximum: 1 });
});

test('fails loudly when the authority is unavailable', async () => {
  const client = new PortreeveClient({
    socketPath: resolve(tmpdir(), crypto.randomUUID(), 'missing.sock'),
  });

  try {
    await client.health();
    throw new Error('Expected health to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(PortreeveClientError);
    expect(error).toMatchObject({ code: 'unavailable' });
    expect(/** @type {Error} */ (error).message).toContain('portreeve serve');
  }
});

test('global inventory reports an unclaimed live listener', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
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
    const entry = await client.inspectPort(listener.port);
    expect(entry.classification).toBe('unclaimed');
    expect(entry.listeners).toHaveLength(1);
    expect(entry.listeners[0]).toMatchObject({
      pid: process.pid,
      port: listener.port,
    });
  } finally {
    listener.stop(true);
  }
});

test('administers claims, settings, pruning, and history through the public API', async () => {
  const { socketPath, registry } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const exactPort = await idlePort();
  const lease = await client.acquire({
    claim: claim('admin-api'),
    allocation: { exactPort },
  });
  await client.abandon(lease, 'client-cancelled');

  const claims = await client.listClaims();
  const managed = claims.find(
    (candidate) => candidate.identity.service === 'admin-api',
  );
  expect(managed).toBeDefined();
  if (managed === undefined) {
    throw new Error('Admin test claim was not listed.');
  }
  expect(
    await client.listClaims({ component: 'admin-api', endpoint: 'default' }),
  ).toEqual([managed]);
  expect(await client.getClaim(managed.id)).toMatchObject({
    id: managed.id,
    assignedPort: null,
  });
  expect(await client.reassignClaim(managed.id, { exactPort })).toMatchObject({
    id: managed.id,
    assignedPort: exactPort,
    exactPort,
  });

  const settings = await client.getConfig();
  expect(settings.gracefulShutdownMilliseconds).toBe(5_000);
  expect(await client.setConfig({ gracefulShutdownMilliseconds: 750 })).toMatchObject({
    gracefulShutdownMilliseconds: 750,
  });
  await expect(client.setConfig({ unknownSetting: true })).rejects.toMatchObject({
    code: 'invalid_input',
    status: 400,
  });
  await expect(
    client.setConfig({ gracefulShutdownMilliseconds: 20 }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    status: 400,
  });

  expect((await client.deleteClaim(managed.id)).changed).toBe(true);
  const missingClaim = registry.insertClaim(
    {
      identity: claim(
        'missing-workspace',
        join(tmpdir(), `portreeve-deleted-${crypto.randomUUID()}`),
      ),
      mode: 'sticky',
    },
    new Date('2026-01-01T00:00:00.000Z'),
  );
  const plan = await client.pruneClaims({
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: true,
  });
  expect(plan.candidates.map(({ claim: candidate }) => candidate.id)).toContain(
    missingClaim.id,
  );
  expect(registry.getClaim(missingClaim.id)).not.toBeNull();
  const pruned = await client.pruneClaims({
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: false,
  });
  expect(pruned.deletedClaimIds).toContain(missingClaim.id);

  const history = await client.history({
    eventType: 'claim.pruned',
    entityId: missingClaim.id,
    limit: 10,
  });
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({
    eventType: 'claim.pruned',
    entityId: missingClaim.id,
  });
});

test('binds settings changes to five-minute receipts and durably replays completion', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const stale = await client.previewConfigUpdate({
    gracefulShutdownMilliseconds: 750,
  });
  await client.setConfig({ gracefulShutdownMilliseconds: 800 });
  await expect(client.executeConfigUpdate(stale.receiptId)).rejects.toMatchObject({
    code: 'conflict',
    details: { receiptCode: 'receipt_mismatch' },
  });

  const preview = await client.previewConfigUpdate({
    gracefulShutdownMilliseconds: 900,
  });
  const first = await client.executeConfigUpdate(preview.receiptId);
  expect(first).toMatchObject({
    changed: true,
    replayed: false,
    result: { settings: { gracefulShutdownMilliseconds: 900 } },
  });
  await client.setConfig({ gracefulShutdownMilliseconds: 1_000 });
  expect(await client.executeConfigUpdate(preview.receiptId)).toEqual({
    changed: false,
    replayed: true,
    result: first.result,
  });
});

test('owns only the canonical stack document and rejects external edits after preview', async () => {
  const { socketPath } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  const stackRoot = await mkdtemp(join(tmpdir(), 'portreeve-action-stack-'));
  cleanups.push(() => rm(stackRoot, { force: true, recursive: true }));
  const definition = {
    version: /** @type {const} */ (1),
    project: 'receipt-stack',
    components: {
      api: { endpoints: { default: { required: true } } },
    },
  };

  expect(await client.validateStackDefinition(definition)).toMatchObject({
    valid: true,
    definition: { project: 'receipt-stack' },
  });
  expect(await client.validateStackDefinition({ version: 1 })).toMatchObject({
    valid: false,
  });
  const missing = await client.getStackDocument(stackRoot);
  expect(missing).toMatchObject({ kind: 'missing', fingerprint: null });
  expect(missing).not.toHaveProperty('content');

  const stale = await client.previewStackApply({ stackRoot, definition });
  await writeFile(missing.path, '{"external":true}\n', 'utf8');
  await expect(
    client.executeStackApply({ stackRoot, receiptId: stale.receiptId }),
  ).rejects.toMatchObject({
    code: 'conflict',
    details: { receiptCode: 'receipt_mismatch' },
  });

  const preview = await client.previewStackApply({ stackRoot, definition });
  const executed = await client.executeStackApply({
    stackRoot,
    receiptId: preview.receiptId,
  });
  expect(executed).toMatchObject({
    changed: true,
    replayed: false,
    result: {
      saved: true,
      applied: true,
      stack: { project: 'receipt-stack' },
    },
  });
  const appliedStack = /** @type {any} */ (executed.result.stack);
  expect(JSON.parse(await readFile(missing.path, 'utf8'))).toEqual(
    appliedStack.definition,
  );
  expect(
    await client.executeStackApply({ stackRoot, receiptId: preview.receiptId }),
  ).toEqual({ changed: false, replayed: true, result: executed.result });
});

test('routes port, claim, and prune mutations through evidence receipts', async () => {
  const { socketPath, registry } = await startFixture();
  const client = new PortreeveClient({ socketPath });

  const freePort = await idlePort();
  const reclaim = await client.previewPortReclaim(freePort, {
    policy: 'graceful',
  });
  const reclaimed = await client.executePortReclaim(freePort, reclaim.receiptId);
  expect(reclaimed).toMatchObject({
    changed: true,
    replayed: false,
    result: { outcome: 'already-free', port: freePort },
  });
  expect(await client.executePortReclaim(freePort, reclaim.receiptId)).toEqual({
    changed: false,
    replayed: true,
    result: reclaimed.result,
  });

  const firstPort = await idlePort();
  const secondPort = await idlePort();
  const lease = await client.acquire({
    claim: claim('receipt-admin'),
    allocation: { exactPort: firstPort },
  });
  await client.abandon(lease, 'client-cancelled');
  const managed = (await client.listClaims({ component: 'receipt-admin' }))[0];
  if (managed === undefined) throw new Error('Receipt test claim was not created.');
  const reassign = await client.previewClaimReassign(managed.id, {
    exactPort: secondPort,
  });
  expect(
    await client.executeClaimReassign(managed.id, reassign.receiptId),
  ).toMatchObject({ result: { assignedPort: secondPort } });
  const deletion = await client.previewClaimDelete(managed.id);
  expect(await client.executeClaimDelete(managed.id, deletion.receiptId)).toMatchObject(
    {
      result: { deleted: true, claimId: managed.id },
    },
  );

  const missingClaim = registry.insertClaim(
    {
      identity: claim(
        'receipt-prune',
        join(tmpdir(), `portreeve-missing-${crypto.randomUUID()}`),
      ),
      mode: 'sticky',
    },
    new Date('2026-01-01T00:00:00.000Z'),
  );
  const claimPrune = await client.previewClaimsPrune({
    olderThanMilliseconds: 1,
  });
  expect(await client.executeClaimsPrune(claimPrune.receiptId)).toMatchObject({
    result: { deletedClaimIds: expect.arrayContaining([missingClaim.id]) },
  });

  const removedRoot = await mkdtemp(join(tmpdir(), 'portreeve-prune-stack-'));
  await client.applyStack({
    stackRoot: removedRoot,
    definition: {
      version: 1,
      project: 'receipt-prune-stack',
      components: { api: { endpoints: { default: {} } } },
    },
  });
  await rm(removedRoot, { recursive: true });
  const stackPrune = await client.previewStacksPrune({
    olderThanMilliseconds: 0,
  });
  expect(await client.executeStacksPrune(stackPrune.receiptId)).toMatchObject({
    result: { deletedStackIds: expect.any(Array) },
  });
});
