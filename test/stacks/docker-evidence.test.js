// @ts-check

import { expect, test } from 'bun:test';
import { AllocationService } from '../../src/allocation/service.js';
import { InventoryService } from '../../src/reconciliation/inventory.js';
import { ReclamationService } from '../../src/reclamation/service.js';
import { StackCoordinationService } from '../../src/stacks/coordination-service.js';
import { StackDefinitionService } from '../../src/stacks/service.js';
import { openRegistry } from '../../src/storage/registry.js';

const definitionClient = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['stack-definitions-v1'],
};
const activationClient = {
  ...definitionClient,
  requiredCapabilities: ['stack-activations-v1'],
};
const dockerClient = {
  ...definitionClient,
  requiredCapabilities: ['stack-activations-v1', 'docker-evidence-v1'],
};
const containerId = 'c'.repeat(64);

test('confirms one mixed process and Docker activation from fresh provider evidence', async () => {
  const listeners = new Map();
  /** @type {null | {id: string, running: boolean, labels: Readonly<Record<string, string>>, ports: Array<{containerPort: number, hostIp: string, hostPort: number}>}} */
  let container = null;
  /** @type {import('../../src/docker/adapter.js').DockerEvidenceAdapter} */
  const dockerAdapter = {
    availability: async () => ({ available: true, reason: null }),
    inspect: async (/** @type {string} */ id) => {
      if (id !== containerId || container === null) {
        return { status: 'missing', reason: 'container-missing', container: null };
      }
      return { status: 'ok', reason: null, container };
    },
    findPublishedPort: async (/** @type {number} */ port) => ({
      available: true,
      reason: null,
      containers:
        container?.ports.some((candidate) => candidate.hostPort === port) === true
          ? [container]
          : [],
    }),
  };
  const registry = openRegistry();
  const inspectListeners = async (/** @type {number} */ port) =>
    listeners.get(port) ?? [];
  const allocationService = new AllocationService({
    registry,
    inspectListeners,
    inspectProcessInstance: async (pid) => ({
      pid,
      parentPid: 1,
      uid: 501,
      startTime: '100',
      executable: '/usr/bin/bun',
      command: 'bun',
      workingDirectory: '/worktrees/mixed-docker',
    }),
    verifyLineage: async () => ({ verified: true, reason: 'matched', lineage: [] }),
    detectEphemeralRange: async () => ({ start: 49152, end: 65535, source: 'test' }),
  });
  const inventoryService = new InventoryService({
    registry,
    inspectListeners: async () => [...listeners.values()].flat(),
    verifyLineage: async () => ({ verified: true, reason: 'matched', lineage: [] }),
    dockerAdapter,
  });
  const coordinationService = new StackCoordinationService({
    registry,
    allocationService,
    inventoryService,
    dockerAdapter,
    detectEphemeralRange: async () => ({ start: 49152, end: 65535, source: 'test' }),
  });
  const stack = new StackDefinitionService({ registry }).apply({
    client: definitionClient,
    workspaceRoot: '/worktrees/mixed-docker',
    definition: {
      version: 1,
      project: 'mixed',
      components: {
        api: {
          docker: { service: 'api' },
          endpoints: {
            http: {
              allocation: { exactPort: 43210 },
              docker: { containerPort: 3000 },
            },
          },
        },
        website: {
          endpoints: { http: { allocation: { exactPort: 43211 } } },
          dependencies: { backend: { component: 'api', endpoint: 'http' } },
        },
      },
    },
  }).stack;
  const prepared = await coordinationService.prepare({
    client: activationClient,
    stackId: stack.id,
  });
  const begun = await coordinationService.begin({
    client: dockerClient,
    generationId: prepared.generation.id,
    bindings: { api: 'docker' },
  });
  const apiLease = begun.leases.find(({ component }) => component === 'api');
  const websiteLease = begun.leases.find(({ component }) => component === 'website');
  if (
    apiLease?.docker === null ||
    apiLease === undefined ||
    websiteLease === undefined
  ) {
    throw new Error('Expected one Docker and one process lease.');
  }
  expect(apiLease).toMatchObject({
    bindingKind: 'docker',
    docker: { service: 'api', containerPort: 3000 },
  });
  expect(websiteLease).toMatchObject({ bindingKind: 'process', docker: null });
  container = {
    id: containerId,
    running: true,
    labels: apiLease.docker.requiredLabels,
    ports: [{ containerPort: 3000, hostIp: '127.0.0.1', hostPort: 43210 }],
  };
  listeners.set(43211, [listener(43211, 501)]);

  await coordinationService.confirm(begun.activation.id, {
    client: activationClient,
    leaseId: websiteLease.leaseId,
    leaseToken: websiteLease.leaseToken,
    rootPid: 501,
  });
  const confirmed = await coordinationService.confirm(begun.activation.id, {
    client: dockerClient,
    leaseId: apiLease.leaseId,
    leaseToken: apiLease.leaseToken,
    bindingKind: 'docker',
    containerId,
  });
  expect(confirmed.state).toBe('confirmed');
  expect(registry.listConfirmedRuns()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ bindingKind: 'docker', containerId, rootPid: null }),
      expect.objectContaining({ bindingKind: 'process', containerId: null }),
    ]),
  );
  expect(await inventoryService.inspect(43210)).toMatchObject({
    classification: 'docker-managed',
    docker: { containers: [{ id: containerId }] },
    listeners: [],
  });
  await expect(
    coordinationService.begin({
      client: dockerClient,
      generationId: prepared.generation.id,
      bindings: { api: 'docker' },
    }),
  ).rejects.toMatchObject({
    code: 'conflict',
    details: { reason: 'active_run' },
  });
  expect(registry.getStackGeneration(prepared.generation.id)?.state).toBe('valid');

  listeners.clear();
  expect(
    await coordinationService.reconcile(begun.activation.id, {
      client: activationClient,
    }),
  ).toMatchObject({
    changed: false,
    activation: { state: 'confirmed' },
    providers: expect.arrayContaining([
      expect.objectContaining({
        bindingKind: 'docker',
        status: 'active',
        listeners: 0,
      }),
      expect.objectContaining({
        bindingKind: 'process',
        status: 'gone',
        listeners: 0,
      }),
    ]),
  });
  container = null;
  expect(
    await coordinationService.reconcile(begun.activation.id, {
      client: activationClient,
    }),
  ).toMatchObject({ changed: true, activation: { state: 'lost' } });
  registry.close();
});

test('Docker binding degrades as unavailable without affecting process-only begin', async () => {
  const registry = openRegistry();
  const allocationService = new AllocationService({
    registry,
    inspectListeners: async () => [],
    detectEphemeralRange: async () => ({ start: 49152, end: 65535, source: 'test' }),
  });
  /** @type {import('../../src/docker/adapter.js').DockerEvidenceAdapter} */
  const dockerAdapter = {
    availability: async () => ({ available: false, reason: 'daemon-unavailable' }),
    inspect: async () => ({
      status: 'unavailable',
      reason: 'daemon-unavailable',
      container: null,
    }),
    findPublishedPort: async () => ({
      available: false,
      reason: 'daemon-unavailable',
      containers: [],
    }),
  };
  const coordinationService = new StackCoordinationService({
    registry,
    allocationService,
    dockerAdapter,
    detectEphemeralRange: async () => ({ start: 49152, end: 65535, source: 'test' }),
  });
  const stack = new StackDefinitionService({ registry }).apply({
    client: definitionClient,
    workspaceRoot: '/worktrees/docker-absent',
    definition: {
      version: 1,
      project: 'absent',
      components: {
        api: {
          docker: { service: 'api' },
          endpoints: {
            http: {
              allocation: { exactPort: 43220 },
              docker: { containerPort: 3000 },
            },
          },
        },
      },
    },
  }).stack;
  const prepared = await coordinationService.prepare({
    client: activationClient,
    stackId: stack.id,
  });
  await expect(
    coordinationService.begin({
      client: dockerClient,
      generationId: prepared.generation.id,
      bindings: { api: 'docker' },
    }),
  ).rejects.toMatchObject({ code: 'unavailable' });
  const processOnly = await coordinationService.begin({
    client: activationClient,
    generationId: prepared.generation.id,
  });
  expect(processOnly.activation.endpoints[0]?.bindingKind).toBe('process');
  registry.close();
});

test('normal reclamation and unsafe eviction never signal Docker-managed listeners', async () => {
  const registry = openRegistry();
  const container = {
    id: containerId,
    running: true,
    labels: {
      'com.trentbrown.portreeve.activation-id': 'visible',
      'example.secret': 'must-not-leave-server',
    },
    ports: [{ containerPort: 3000, hostIp: '127.0.0.1', hostPort: 43230 }],
  };
  const inventoryService = new InventoryService({
    registry,
    inspectListeners: async () => [listener(43230, 600)],
    dockerAdapter: {
      findPublishedPort: async () => ({
        available: true,
        reason: null,
        containers: [container],
      }),
    },
  });
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService,
    signalProcess: (pid, signal) => signals.push([pid, signal]),
  });
  const reclaimResult = await reclamation.reclaim(43230, {
    client: {
      ...definitionClient,
      requiredCapabilities: ['reclamation-v1'],
    },
    policy: 'graceful',
    dryRun: false,
  });
  expect(reclaimResult).toMatchObject({
    outcome: 'launcher-action-required',
    reason: 'docker-managed-listener',
    launcherAction: { containerIds: [containerId] },
    signals: [],
  });
  const result = await reclamation.unsafeEvict(43230, {
    client: {
      ...definitionClient,
      requiredCapabilities: ['reclamation-v1'],
    },
    unsafeAnyOwner: true,
    policy: 'force-after-grace',
    dryRun: false,
  });
  expect(result).toMatchObject({
    outcome: 'launcher-action-required',
    reason: 'docker-managed-listener',
    launcherAction: {
      kind: 'docker',
      action: 'stop-container',
      containerIds: [containerId],
    },
    signals: [],
  });
  expect(signals).toEqual([]);
  const inventory = await inventoryService.inspect(43230);
  expect(inventory.docker?.containers[0]?.labels).toEqual({
    'com.trentbrown.portreeve.activation-id': 'visible',
  });
  registry.close();
});

test('unsafe eviction refuses a persisted Docker run when fresh discovery is unavailable', async () => {
  const registry = openRegistry();
  const target = {
    ...listener(43231, 601),
    ownership: { verified: false, reason: 'docker-run', lineage: [] },
  };
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () => ({
        port: 43231,
        transport: 'tcp',
        classification: 'conflicting',
        claim: null,
        lease: null,
        run: { bindingKind: 'docker', containerId },
        docker: null,
        listeners: [target],
      }),
    }),
    signalProcess: (pid, signal) => signals.push([pid, signal]),
  });

  expect(
    await reclamation.unsafeEvict(43231, {
      client: {
        ...definitionClient,
        requiredCapabilities: ['reclamation-v1'],
      },
      unsafeAnyOwner: true,
      policy: 'force-after-grace',
      dryRun: false,
    }),
  ).toMatchObject({
    outcome: 'refused',
    reason: 'docker-evidence-unavailable',
    launcherAction: null,
    signals: [],
  });
  expect(signals).toEqual([]);
  registry.close();
});

/** @param {number} port @param {number} pid */
function listener(port, pid) {
  return {
    pid,
    port,
    command: 'com.docker.backend',
    names: [`127.0.0.1:${port}`],
    process: { pid, startTime: '100', executable: '/Applications/Docker' },
  };
}
