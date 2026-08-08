// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/client.js';
import { AllocationService } from '../../src/allocation/service.js';
import { LauncherEvidenceService } from '../../src/launcher/evidence-service.js';
import { LauncherEnvironmentService } from '../../src/launcher/environment-service.js';
import { createLauncherLocalStateStore } from '../../src/launcher/local-state.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { InventoryService } from '../../src/reconciliation/inventory.js';
import { startPortreeveServer } from '../../src/server/server.js';
import { openRegistry } from '../../src/storage/registry.js';

const revision = 'a'.repeat(64);

function stack() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    project: 'example',
    stackRoot: '/worktrees/example',
    currentRevision: 'b'.repeat(64),
    definition: {
      version: 1,
      project: 'example',
      components: {
        api: {
          docker: { service: 'api-service' },
          endpoints: {
            http: { docker: { containerPort: 8080 } },
            internal: { publish: false, docker: { containerPort: 9090 } },
          },
        },
      },
    },
    createdAt: '2026-08-08T20:00:00.000Z',
    updatedAt: '2026-08-08T20:00:00.000Z',
    lastUsedAt: '2026-08-08T20:00:00.000Z',
  };
}

function generation() {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    stackId: stack().id,
    revision: stack().currentRevision,
    state: 'valid',
    endpoints: [
      {
        claimId: '33333333-3333-4333-8333-333333333333',
        component: 'api',
        endpoint: 'http',
        transport: 'tcp',
        host: '127.0.0.1',
        port: 43100,
        required: true,
      },
    ],
    createdAt: '2026-08-08T20:00:00.000Z',
    invalidatedAt: null,
  };
}

function launcher() {
  return {
    stackRoot: stack().stackRoot,
    revision,
    definition: {
      version: 1,
      operations: {
        start: { command: 'make start' },
        stop: { command: 'make stop' },
      },
      environment: [
        {
          name: 'API_PORT',
          endpoint: { component: 'api', endpoint: 'http' },
          value: 'host-port',
        },
        {
          name: 'API_URL',
          endpoint: { component: 'api', endpoint: 'http' },
          value: 'host-url',
          scheme: 'http',
        },
        {
          name: 'API_CONTAINER_PORT',
          endpoint: { component: 'api', endpoint: 'internal' },
          value: 'container-port',
        },
        {
          name: 'API_NETWORK_URL',
          endpoint: { component: 'api', endpoint: 'internal' },
          value: 'docker-network-url',
          scheme: 'https',
        },
      ],
    },
  };
}

test('resolves every endpoint mapping and caches only nonsecret immutable context', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-environment-'));
  const stateStore = createLauncherLocalStateStore({
    path: join(directory, 'launcher-state.json'),
  });
  let prepares = 0;
  const service = new LauncherEnvironmentService({
    client: {
      socketPath: '/private/portreeve.sock',
      async prepareStack(stackId) {
        prepares += 1;
        expect(stackId).toBe(stack().id);
        return { reused: false, generation: generation() };
      },
    },
    stateStore,
    now: () => new Date('2026-08-08T20:01:00.000Z'),
  });
  try {
    const resolved = await service.resolve({ stack: stack(), launcher: launcher() });
    expect(prepares).toBe(1);
    expect(resolved).toMatchObject({
      source: 'daemon',
      reusedGeneration: false,
      generationId: generation().id,
      activationId: null,
      environment: {
        PORTREEVE_STACK_ROOT: stack().stackRoot,
        PORTREEVE_STACK_ID: stack().id,
        PORTREEVE_GENERATION_ID: generation().id,
        PORTREEVE_SOCKET: '/private/portreeve.sock',
        API_PORT: '43100',
        API_URL: 'http://127.0.0.1:43100',
        API_CONTAINER_PORT: '9090',
        API_NETWORK_URL: 'https://api-service:9090',
      },
      endpoints: [
        {
          component: 'api',
          endpoint: 'http',
          required: true,
          host: { host: '127.0.0.1', port: 43100 },
          dockerNetwork: { host: 'api-service', port: 8080 },
        },
      ],
    });
    expect(resolved.environment).not.toHaveProperty('PORTREEVE_ACTIVATION_ID');
    expect(await service.cached(stack().stackRoot, revision)).toMatchObject({
      environment: { API_PORT: '43100' },
      endpoints: [
        {
          component: 'api',
          endpoint: 'http',
          hostPort: 43100,
          required: true,
        },
      ],
    });

    const defaultPortGeneration = {
      ...generation(),
      endpoints: [{ ...generation().endpoints[0], port: 80 }],
    };
    const defaultPort = await service.resolve({
      stack: stack(),
      launcher: launcher(),
      generation: defaultPortGeneration,
    });
    expect(defaultPort.environment.API_URL).toBe('http://127.0.0.1:80');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('retains an explicit generation and validates activation identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-environment-'));
  const stateStore = createLauncherLocalStateStore({
    path: join(directory, 'launcher-state.json'),
  });
  const service = new LauncherEnvironmentService({
    client: {
      socketPath: '/private/portreeve.sock',
      async prepareStack() {
        throw new Error('must not prepare around an existing generation');
      },
    },
    stateStore,
  });
  const activation = {
    id: '44444444-4444-4444-8444-444444444444',
    stackId: stack().id,
    generationId: generation().id,
    state: 'starting',
    endpoints: [],
    createdAt: '2026-08-08T20:00:00.000Z',
    updatedAt: '2026-08-08T20:00:00.000Z',
    confirmedAt: null,
    endedAt: null,
  };
  try {
    const resolved = await service.resolve({
      stack: stack(),
      launcher: launcher(),
      generation: generation(),
      activation,
    });
    expect(resolved.reusedGeneration).toBe(true);
    expect(resolved.environment.PORTREEVE_ACTIVATION_ID).toBe(activation.id);
    await expect(
      service.resolve({
        stack: stack(),
        launcher: launcher(),
        generation: { ...generation(), state: 'stale' },
      }),
    ).rejects.toMatchObject({ code: 'launcher_generation_stale' });
    await expect(
      service.resolve({
        stack: stack(),
        launcher: { ...launcher(), stackRoot: '/worktrees/other' },
        generation: generation(),
      }),
    ).rejects.toMatchObject({ code: 'launcher_stack_mismatch' });
    await expect(
      service.resolve({
        stack: stack(),
        launcher: launcher(),
        generation: generation(),
        activation: { ...activation, state: 'ended', endedAt: activation.updatedAt },
      }),
    ).rejects.toMatchObject({ code: 'launcher_activation_inactive' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resolves and classifies through the official Unix-socket client', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-environment-integration-'));
  const applicationDirectory = join(directory, 'data');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  await prepareRuntimeDirectories({ applicationDirectory, socketPath });
  const registry = openRegistry(join(applicationDirectory, 'registry.sqlite'));
  const inventoryService = new InventoryService({
    registry,
    inspectListeners: async () => [],
  });
  const server = await startPortreeveServer({
    socketPath,
    allocationService: new AllocationService({ registry }),
    inventoryService,
  });
  try {
    const client = new PortreeveClient({ socketPath });
    const stackRoot = await realpath(directory);
    const applied = await client.applyStack({
      stackRoot,
      definition: {
        version: 1,
        project: 'integration',
        components: { api: { endpoints: { default: {} } } },
      },
    });
    const stateStore = createLauncherLocalStateStore({
      path: join(applicationDirectory, 'launcher-state.json'),
    });
    const launcher = {
      stackRoot,
      revision,
      definition: {
        version: 1,
        operations: {
          start: { command: 'make start' },
          stop: { command: 'make stop' },
        },
        environment: [
          {
            name: 'API_PORT',
            endpoint: { component: 'api' },
            value: 'host-port',
          },
        ],
      },
    };
    const resolved = await new LauncherEnvironmentService({
      client,
      stateStore,
    }).resolve({ stack: applied.stack, launcher });
    const apiPort = resolved.environment.API_PORT;
    const apiEndpoint = resolved.endpoints[0];
    if (apiPort === undefined) throw new Error('Expected API_PORT to resolve.');
    if (apiEndpoint === undefined) throw new Error('Expected an API endpoint.');
    expect(Number(apiPort)).toBe(apiEndpoint.host.port);
    expect(
      (await new LauncherEvidenceService({ client }).inspectDaemon(applied.stack))
        .summary,
    ).toMatchObject({
      classification: 'stopped',
      source: 'daemon',
      generationId: resolved.generationId,
    });
  } finally {
    await server.stop();
    registry.close();
    await rm(directory, { recursive: true, force: true });
  }
});
