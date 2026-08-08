// @ts-check

import { expect, test } from 'bun:test';
import { LauncherEvidenceService } from '../../src/launcher/evidence-service.js';

const stack = {
  id: '11111111-1111-4111-8111-111111111111',
  project: 'example',
  stackRoot: '/worktrees/example',
  currentRevision: 'a'.repeat(64),
  definition: {
    version: 1,
    project: 'example',
    components: {
      api: {
        endpoints: { http: {}, metrics: { required: false } },
      },
    },
  },
  createdAt: '2026-08-08T20:00:00.000Z',
  updatedAt: '2026-08-08T20:00:00.000Z',
  lastUsedAt: '2026-08-08T20:00:00.000Z',
};

const endpoints = [
  {
    claimId: '22222222-2222-4222-8222-222222222222',
    component: 'api',
    endpoint: 'http',
    transport: 'tcp',
    host: '127.0.0.1',
    port: 43100,
    required: true,
  },
  {
    claimId: '33333333-3333-4333-8333-333333333333',
    component: 'api',
    endpoint: 'metrics',
    transport: 'tcp',
    host: '127.0.0.1',
    port: 43101,
    required: false,
  },
];
const requiredEndpoint = endpoints[0];
const optionalEndpoint = endpoints[1];
if (requiredEndpoint === undefined || optionalEndpoint === undefined) {
  throw new Error('Expected launcher evidence fixtures.');
}

const generation = {
  id: '44444444-4444-4444-8444-444444444444',
  stackId: stack.id,
  revision: stack.currentRevision,
  state: 'valid',
  endpoints,
  createdAt: '2026-08-08T20:00:00.000Z',
  invalidatedAt: null,
};

/** @param {number} port */
function listener(port) {
  return {
    pid: port,
    port,
    command: 'bun',
    names: [`127.0.0.1:${port}`],
    process: { pid: port },
    ownership: { verified: false, reason: 'no-confirmed-run-evidence', lineage: [] },
  };
}

/** @param {typeof endpoints[number]} endpoint @param {Partial<{observed: boolean, classification: 'idle' | 'conflicting' | 'pending' | 'verified', run: Record<string, unknown> | null}>} [options] */
function inventory(endpoint, options = {}) {
  return {
    port: endpoint.port,
    transport: 'tcp',
    classification: options.classification ?? 'idle',
    claim: { id: endpoint.claimId },
    lease: options.classification === 'pending' ? { id: 'lease' } : null,
    run: options.run ?? null,
    docker: null,
    listeners: options.observed ? [listener(endpoint.port)] : [],
  };
}

/** @param {Map<number, ReturnType<typeof inventory>>} inventories @param {Partial<{activation: any, providers: any[]}>} [options] */
function service(inventories, options = {}) {
  return new LauncherEvidenceService({
    client: {
      async getStackStatus() {
        return {
          stack,
          generation,
          activation: options.activation ?? null,
          providers: options.providers ?? [],
        };
      },
      async inspectPort(port) {
        const value = inventories.get(port);
        if (value === undefined) throw new Error('inventory unavailable');
        return value;
      },
    },
    now: () => new Date('2026-08-08T20:05:00.000Z'),
  });
}

test('classifies command-only listeners as stopped, partial, or fully observed', async () => {
  const stopped = service(
    new Map(endpoints.map((endpoint) => [endpoint.port, inventory(endpoint)])),
  );
  expect((await stopped.inspectDaemon(stack)).summary.classification).toBe('stopped');

  const partial = service(
    new Map([
      [
        requiredEndpoint.port,
        inventory(requiredEndpoint, { observed: true, classification: 'conflicting' }),
      ],
      [optionalEndpoint.port, inventory(optionalEndpoint)],
    ]),
  );
  expect((await partial.inspectDaemon(stack)).summary).toMatchObject({
    classification: 'partial',
    source: 'daemon',
    listenerCount: 1,
  });

  const full = service(
    new Map(
      endpoints.map((endpoint) => [
        endpoint.port,
        inventory(endpoint, { observed: true, classification: 'conflicting' }),
      ]),
    ),
  );
  expect((await full.inspectDaemon(stack)).summary.classification).toBe(
    'fully-observed',
  );
});

test('separates conflicting ownership and uncertain evidence', async () => {
  const conflict = service(
    new Map([
      [
        requiredEndpoint.port,
        inventory(requiredEndpoint, {
          observed: true,
          classification: 'conflicting',
          run: { claimId: '55555555-5555-4555-8555-555555555555' },
        }),
      ],
      [optionalEndpoint.port, inventory(optionalEndpoint)],
    ]),
  );
  expect((await conflict.inspectDaemon(stack)).summary).toMatchObject({
    classification: 'conflicting',
    reasonCodes: expect.arrayContaining(['ownership-conflict']),
  });

  const uncertain = service(
    new Map([
      [
        requiredEndpoint.port,
        inventory(requiredEndpoint, { classification: 'pending' }),
      ],
    ]),
  );
  expect((await uncertain.inspectDaemon(stack)).summary).toMatchObject({
    classification: 'uncertain',
    reasonCodes: expect.arrayContaining(['inventory-unavailable', 'lease-pending']),
  });
});

test('requires matching activation and fresh provider evidence for verified', async () => {
  const activation = {
    id: '66666666-6666-4666-8666-666666666666',
    stackId: stack.id,
    generationId: generation.id,
    state: 'degraded',
    endpoints: [
      {
        component: 'api',
        endpoint: 'http',
        claimId: requiredEndpoint.claimId,
        port: requiredEndpoint.port,
        required: true,
        bindingKind: 'process',
        state: 'confirmed',
        leaseId: null,
        runId: '77777777-7777-4777-8777-777777777777',
        expiresAt: null,
        failureReason: null,
        updatedAt: '2026-08-08T20:00:00.000Z',
      },
      {
        component: 'api',
        endpoint: 'metrics',
        claimId: optionalEndpoint.claimId,
        port: optionalEndpoint.port,
        required: false,
        bindingKind: 'process',
        state: 'skipped',
        leaseId: null,
        runId: null,
        expiresAt: null,
        failureReason: null,
        updatedAt: '2026-08-08T20:00:00.000Z',
      },
    ],
    createdAt: '2026-08-08T20:00:00.000Z',
    updatedAt: '2026-08-08T20:00:00.000Z',
    confirmedAt: '2026-08-08T20:00:00.000Z',
    endedAt: null,
  };
  const verified = service(
    new Map([
      [
        requiredEndpoint.port,
        inventory(requiredEndpoint, {
          observed: true,
          classification: 'verified',
          run: { claimId: requiredEndpoint.claimId },
        }),
      ],
      [optionalEndpoint.port, inventory(optionalEndpoint)],
    ]),
    {
      activation,
      providers: [
        {
          component: 'api',
          endpoint: 'http',
          port: requiredEndpoint.port,
          bindingKind: 'process',
          status: 'active',
          reason: 'process-ownership-verified',
          listeners: 1,
          runId: '77777777-7777-4777-8777-777777777777',
          containerId: null,
        },
      ],
    },
  );
  expect((await verified.inspectDaemon(stack)).summary).toMatchObject({
    classification: 'verified',
    activationId: activation.id,
    reasonCodes: expect.arrayContaining(['activation-degraded', 'provider-verified']),
  });
});

test('labels cached lsof observations as local and never verified', async () => {
  const local = new LauncherEvidenceService({
    client: {
      async getStackStatus() {
        throw new Error('daemon unavailable');
      },
      async inspectPort() {
        throw new Error('daemon unavailable');
      },
    },
    inspectListeners: async () => [listener(43100)],
    now: () => new Date('2026-08-08T20:05:00.000Z'),
  });
  const result = await local.inspectLocal({
    revision: 'f'.repeat(64),
    resolvedAt: '2026-08-08T19:00:00.000Z',
    stackId: stack.id,
    generationId: generation.id,
    activationId: null,
    socketPath: '/private/portreeve.sock',
    environment: { API_PORT: '43100' },
    endpoints: endpoints.map((endpoint) => ({
      component: endpoint.component,
      endpoint: endpoint.endpoint,
      hostPort: endpoint.port,
      required: endpoint.required,
    })),
  });
  expect(result.summary).toMatchObject({
    classification: 'partial',
    source: 'local',
    listenerCount: 1,
    reasonCodes: ['degraded-uncoordinated'],
  });
  expect(result.endpoints.every((endpoint) => !endpoint.verified)).toBe(true);
  expect(result.endpoints.every((endpoint) => !endpoint.conflicting)).toBe(true);
});
