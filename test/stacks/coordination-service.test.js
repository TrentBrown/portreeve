// @ts-check

import { expect, test } from 'bun:test';
import { AllocationService } from '../../src/allocation/service.js';
import { InventoryService } from '../../src/reconciliation/inventory.js';
import { StackCoordinationService } from '../../src/stacks/coordination-service.js';
import { StackDefinitionService } from '../../src/stacks/service.js';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';

const client = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['stack-activations-v1'],
};

/** @returns {any} */
function definition() {
  return {
    version: 1,
    project: 'caregiver',
    components: {
      api: {
        endpoints: {
          http: { allocation: { exactPort: 43100 } },
          metrics: {
            required: false,
            allocation: { preferredPort: 43101 },
          },
        },
      },
    },
  };
}

function harness() {
  const registry = openRegistry();
  let now = new Date('2026-08-06T12:00:00.000Z');
  let ownershipVerified = true;
  const listening = new Set();
  /** @param {number} port */
  const inspectListeners = async (port) =>
    listening.has(port)
      ? [
          {
            pid: 4242,
            port,
            command: 'bun',
            names: [`127.0.0.1:${port}`],
            process: { pid: 4242, startTime: '123', executable: '/usr/bin/bun' },
          },
        ]
      : [];
  const allocationService = new AllocationService({
    registry,
    inspectListeners,
    inspectProcessInstance: async (pid) => ({
      pid,
      parentPid: 1,
      uid: 501,
      startTime: '123',
      executable: '/usr/bin/bun',
      command: 'bun test',
      workingDirectory: '/worktrees/caregiver-a',
    }),
    verifyLineage: async () => ({ verified: true, reason: 'matched', lineage: [4242] }),
    detectEphemeralRange: async () => ({
      start: 49152,
      end: 65535,
      source: 'test',
    }),
    now: () => now,
  });
  const inventoryService = new InventoryService({
    registry,
    inspectListeners: async () =>
      [...listening].map((port) => ({
        pid: 4242,
        port,
        command: 'bun',
        names: [`127.0.0.1:${port}`],
        process: { pid: 4242, startTime: '123', executable: '/usr/bin/bun' },
      })),
    verifyLineage: async () =>
      ownershipVerified
        ? { verified: true, reason: 'matched', lineage: [4242] }
        : { verified: false, reason: 'process-changed', lineage: [] },
    now: () => now,
  });
  const service = new StackCoordinationService({
    registry,
    allocationService,
    inventoryService,
    detectEphemeralRange: async () => ({
      start: 49152,
      end: 65535,
      source: 'test',
    }),
    now: () => now,
  });
  const definitionService = new StackDefinitionService({
    registry,
    now: () => now,
  });
  const stack = definitionService.apply({
    client: { ...client, requiredCapabilities: ['stack-definitions-v1'] },
    workspaceRoot: '/worktrees/caregiver-a',
    definition: definition(),
  }).stack;
  return {
    registry,
    service,
    definitionService,
    stack,
    listening,
    /** @param {boolean} value */
    setOwnershipVerified(value) {
      ownershipVerified = value;
    },
    /** @param {number} milliseconds */
    advance(milliseconds) {
      now = new Date(now.getTime() + milliseconds);
    },
  };
}

test('prepares one immutable generation and reuses it while its evidence remains valid', async () => {
  const { registry, service, stack } = harness();
  const [first, second] = await Promise.all([
    service.prepare({ client, stackId: stack.id }),
    service.prepare({ client, stackId: stack.id }),
  ]);

  expect([first.reused, second.reused].sort()).toEqual([false, true]);
  expect(second.generation).toEqual(first.generation);
  expect(first.generation.endpoints.map(({ port }) => port)).toEqual([43100, 43101]);
  expect(
    registry.database.query('SELECT COUNT(*) AS count FROM stack_generations').get(),
  ).toEqual({ count: 1 });
  registry.close();
});

test('begins atomically, confirms required process evidence, and degrades for a skipped optional endpoint', async () => {
  const { registry, service, stack, listening } = harness();
  const prepared = await service.prepare({ client, stackId: stack.id });
  const begun = await service.begin({
    client,
    generationId: prepared.generation.id,
    skippedEndpoints: [{ component: 'api', endpoint: 'metrics' }],
  });

  expect(begun.activation.state).toBe('starting');
  expect(begun.leases).toHaveLength(1);
  const lease = begun.leases[0];
  if (lease === undefined) throw new Error('Expected required endpoint lease.');
  listening.add(lease.port);
  const confirmed = await service.confirm(begun.activation.id, {
    client,
    leaseId: lease.leaseId,
    leaseToken: lease.leaseToken,
    rootPid: 4242,
  });

  expect(confirmed.state).toBe('degraded');
  expect(confirmed.endpoints.map(({ state }) => state)).toEqual([
    'confirmed',
    'skipped',
  ]);
  registry.close();
});

test('allows only one activation and expires its entire unconfirmed attempt without invalidating the generation', async () => {
  const { registry, service, stack, advance } = harness();
  const prepared = await service.prepare({ client, stackId: stack.id });
  const [first, second] = await Promise.allSettled([
    service.begin({ client, generationId: prepared.generation.id }),
    service.begin({ client, generationId: prepared.generation.id }),
  ]);

  expect([first.status, second.status].sort()).toEqual(['fulfilled', 'rejected']);
  const fulfilled = [first, second].find((result) => result.status === 'fulfilled');
  if (fulfilled?.status !== 'fulfilled') {
    throw new Error('Expected one activation to begin.');
  }
  const begun = fulfilled.value;
  expect(begun.leases).toHaveLength(2);
  advance(15_001);
  expect(service.get(begun.activation.id).state).toBe('failed');
  expect((await service.prepare({ client, stackId: stack.id })).generation.id).toBe(
    prepared.generation.id,
  );
  expect(
    await service.begin({ client, generationId: prepared.generation.id }),
  ).toHaveProperty('activation.state', 'starting');
  registry.close();
});

test('renews an activation lease batch only after validating every token', async () => {
  const { registry, service, stack, advance } = harness();
  const prepared = await service.prepare({ client, stackId: stack.id });
  const begun = await service.begin({ client, generationId: prepared.generation.id });
  const credentials = begun.leases.map(({ leaseId, leaseToken }) => ({
    leaseId,
    leaseToken,
  }));
  advance(5_000);
  const renewed = service.renew(begun.activation.id, { client, leases: credentials });
  expect(new Set(renewed.leases.map(({ expiresAt }) => expiresAt)).size).toBe(1);
  expect(renewed.leases[0]?.expiresAt).toBe('2026-08-06T12:00:20.000Z');
  expect(() =>
    service.renew(begun.activation.id, {
      client,
      leases: [{ ...credentials[0], leaseToken: 'x'.repeat(43) }],
    }),
  ).toThrow(RegistryError);
  registry.close();
});

test('rolls back exact-port preparation when live evidence occupies the port', async () => {
  const { registry, service, stack, listening } = harness();
  listening.add(43100);
  expect(service.prepare({ client, stackId: stack.id })).rejects.toThrow(
    'Exact port 43100 has a live listener',
  );
  expect(
    registry.database.query('SELECT COUNT(*) AS count FROM stack_generations').get(),
  ).toEqual({ count: 0 });
  expect(
    registry.findClaim({
      project: 'caregiver',
      workspaceRoot: '/worktrees/caregiver-a',
      component: 'api',
      endpoint: 'http',
      transport: 'tcp',
    })?.assignedPort,
  ).toBeNull();
  registry.close();
});

test('falls back from an occupied preferred port and refuses an older revision at activation time', async () => {
  const { registry, service, definitionService, stack, listening } = harness();
  listening.add(43101);
  const prepared = await service.prepare({ client, stackId: stack.id });
  expect(
    prepared.generation.endpoints.find(({ endpoint }) => endpoint === 'metrics')?.port,
  ).toBe(10240);

  const changed = definition();
  changed.components.api.endpoints.metrics.required = true;
  definitionService.apply({
    client: { ...client, requiredCapabilities: ['stack-definitions-v1'] },
    workspaceRoot: '/worktrees/caregiver-a',
    definition: changed,
  });
  expect(
    service.begin({ client, generationId: prepared.generation.id }),
  ).rejects.toMatchObject({
    code: 'conflict',
    details: { reason: 'stale_generation' },
  });
  expect(registry.getStackGeneration(prepared.generation.id)?.state).toBe('valid');
  registry.close();
});

test('fails an activation and cancels its remaining leases when a required endpoint is abandoned', async () => {
  const { registry, service, stack } = harness();
  const prepared = await service.prepare({ client, stackId: stack.id });
  const begun = await service.begin({ client, generationId: prepared.generation.id });
  const required = begun.leases.find(({ endpoint }) => endpoint === 'http');
  if (required === undefined) throw new Error('Expected required endpoint lease.');
  const activation = service.abandon(begun.activation.id, {
    client,
    leaseId: required.leaseId,
    leaseToken: required.leaseToken,
    reason: 'startup-error',
  });

  expect(activation.state).toBe('failed');
  expect(activation.endpoints.every(({ state }) => state === 'failed')).toBe(true);
  expect(registry.listPendingLeases()).toEqual([]);
  expect(
    registry.listHistory().filter(({ eventType }) => eventType === 'lease.abandoned'),
  ).toHaveLength(2);
  expect(registry.listHistory().at(-1)).toMatchObject({
    eventType: 'stack.activation.state_changed',
    payload: { from: 'starting', to: 'failed' },
  });
  registry.close();
});

test('requires promotion when a required dependency targets an optional endpoint', async () => {
  const { registry, service, definitionService } = harness();
  const changed = definition();
  changed.components.website = {
    dependencies: {
      metrics: { component: 'api', endpoint: 'metrics' },
    },
  };
  const applied = definitionService.apply({
    client: { ...client, requiredCapabilities: ['stack-definitions-v1'] },
    workspaceRoot: '/worktrees/caregiver-a',
    definition: changed,
  });
  const prepared = await service.prepare({ client, stackId: applied.stack.id });

  expect(
    service.begin({ client, generationId: prepared.generation.id }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    details: { reason: 'optional_required_dependency' },
  });
  const begun = await service.begin({
    client,
    generationId: prepared.generation.id,
    requiredEndpoints: [{ component: 'api', endpoint: 'metrics' }],
  });
  expect(
    begun.activation.endpoints.find(({ endpoint }) => endpoint === 'metrics')?.required,
  ).toBe(true);
  registry.close();
});

test('refuses to end around a live listener and ends after fresh evidence shows it stopped', async () => {
  const { registry, service, stack, listening } = harness();
  const prepared = await service.prepare({ client, stackId: stack.id });
  const begun = await service.begin({
    client,
    generationId: prepared.generation.id,
    skippedEndpoints: [{ component: 'api', endpoint: 'metrics' }],
  });
  const lease = begun.leases[0];
  if (lease === undefined) throw new Error('Expected required endpoint lease.');
  listening.add(lease.port);
  const activation = await service.confirm(begun.activation.id, {
    client,
    leaseId: lease.leaseId,
    leaseToken: lease.leaseToken,
    rootPid: 4242,
  });

  expect(service.end(activation.id, { client })).rejects.toMatchObject({
    code: 'conflict',
    details: { reason: 'listener_present' },
  });
  listening.delete(lease.port);
  expect(await service.end(activation.id, { client })).toMatchObject({
    changed: true,
    activation: { state: 'ended' },
  });
  expect(await service.end(activation.id, { client })).toMatchObject({
    changed: false,
    activation: { state: 'ended' },
  });
  registry.close();
});

test('does not let a stale confirmed run explain a listener whose fresh ownership fails', async () => {
  const { registry, service, stack, listening, setOwnershipVerified } = harness();
  const prepared = await service.prepare({ client, stackId: stack.id });
  const begun = await service.begin({
    client,
    generationId: prepared.generation.id,
    skippedEndpoints: [{ component: 'api', endpoint: 'metrics' }],
  });
  const lease = begun.leases[0];
  if (lease === undefined) throw new Error('Expected required endpoint lease.');
  listening.add(lease.port);
  await service.confirm(begun.activation.id, {
    client,
    leaseId: lease.leaseId,
    leaseToken: lease.leaseToken,
    rootPid: 4242,
  });
  setOwnershipVerified(false);

  expect(service.prepare({ client, stackId: stack.id })).rejects.toMatchObject({
    code: 'conflict',
    details: { reason: 'listener_present' },
  });
  expect(registry.getStackGeneration(prepared.generation.id)?.state).toBe('stale');
  registry.close();
});
