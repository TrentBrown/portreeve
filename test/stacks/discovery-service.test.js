// @ts-check

import { expect, test } from 'bun:test';
import { AllocationService } from '../../src/allocation/service.js';
import { InventoryService } from '../../src/reconciliation/inventory.js';
import { StackCoordinationService } from '../../src/stacks/coordination-service.js';
import { StackDiscoveryService } from '../../src/stacks/discovery-service.js';
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
const discoveryClient = {
  ...definitionClient,
  requiredCapabilities: ['stack-discovery-v1'],
};

/** @returns {any} */
function definition() {
  return {
    version: 1,
    project: 'caregiver',
    components: {
      api: {
        endpoints: {
          http: {
            allocation: { exactPort: 43100 },
            docker: { containerPort: 3000 },
          },
          metrics: {
            required: false,
            allocation: { exactPort: 43101 },
          },
        },
        dependencies: {
          website: { component: 'website', endpoint: 'http', required: false },
        },
        docker: { service: 'api' },
      },
      website: {
        endpoints: {
          http: {
            allocation: { exactPort: 43102 },
            docker: { containerPort: 8080 },
          },
        },
        dependencies: {
          backend: { component: 'api', endpoint: 'http' },
        },
        docker: { service: 'website' },
      },
      admin: {
        endpoints: {
          http: { allocation: { exactPort: 43103 } },
        },
      },
    },
  };
}

function harness() {
  const registry = openRegistry();
  const allocationService = new AllocationService({
    registry,
    inspectListeners: async () => [],
    detectEphemeralRange: async () => ({
      start: 49152,
      end: 65535,
      source: 'test',
    }),
  });
  const inventoryService = new InventoryService({
    registry,
    inspectListeners: async () => [],
  });
  const coordinationService = new StackCoordinationService({
    registry,
    allocationService,
    inventoryService,
    detectEphemeralRange: async () => ({
      start: 49152,
      end: 65535,
      source: 'test',
    }),
  });
  const definitionService = new StackDefinitionService({ registry });
  const discoveryService = new StackDiscoveryService({
    registry,
    coordinationService,
  });
  return {
    registry,
    coordinationService,
    definitionService,
    discoveryService,
  };
}

async function activeHarness() {
  const services = harness();
  const stack = services.definitionService.apply({
    client: definitionClient,
    workspaceRoot: '/worktrees/caregiver-discovery',
    definition: definition(),
  }).stack;
  const prepared = await services.coordinationService.prepare({
    client: activationClient,
    stackId: stack.id,
  });
  const begun = await services.coordinationService.begin({
    client: activationClient,
    generationId: prepared.generation.id,
  });
  return { ...services, stack, prepared, begun };
}

test('resolves only one component own endpoints and declared dependency aliases', async () => {
  const { registry, discoveryService, begun, prepared } = await activeHarness();
  const resolution = discoveryService.resolve(begun.activation.id, {
    client: discoveryClient,
    component: 'website',
  });

  expect(resolution).toEqual({
    schemaVersion: 1,
    definitionRevision: prepared.generation.revision,
    generationId: prepared.generation.id,
    activationId: begun.activation.id,
    component: 'website',
    own: {
      http: {
        component: 'website',
        endpoint: 'http',
        host: { transport: 'tcp', host: '127.0.0.1', port: 43102 },
        dockerNetwork: { transport: 'tcp', host: 'website', port: 8080 },
      },
    },
    dependencies: {
      backend: {
        component: 'api',
        endpoint: 'http',
        host: { transport: 'tcp', host: '127.0.0.1', port: 43100 },
        dockerNetwork: { transport: 'tcp', host: 'api', port: 3000 },
      },
    },
  });
  expect(JSON.stringify(resolution)).not.toContain('admin');
  expect(JSON.stringify(resolution)).not.toContain('metrics');
  registry.close();
});

test('permits circular address references because every address shares one generation', async () => {
  const { registry, discoveryService, begun } = await activeHarness();
  expect(
    discoveryService.resolve(begun.activation.id, {
      client: discoveryClient,
      component: 'api',
    }),
  ).toMatchObject({
    component: 'api',
    dependencies: {
      website: {
        component: 'website',
        endpoint: 'http',
        host: { port: 43102 },
      },
    },
  });
  registry.close();
});

test('renders a deterministic redacted sandbox snapshot from launcher gateway input', async () => {
  const { registry, discoveryService, begun } = await activeHarness();
  const snapshot = discoveryService.snapshot(begun.activation.id, {
    client: discoveryClient,
    component: 'website',
    gatewayHost: 'host.docker.internal',
  });

  expect(snapshot).toMatchObject({
    schemaVersion: 1,
    activationId: begun.activation.id,
    component: 'website',
    own: {
      http: {
        component: 'website',
        endpoint: 'http',
        address: { host: 'host.docker.internal', port: 43102 },
      },
    },
    dependencies: {
      backend: {
        component: 'api',
        endpoint: 'http',
        address: { host: 'host.docker.internal', port: 43100 },
      },
    },
  });
  const serialized = JSON.stringify(snapshot);
  for (const prohibited of [
    '/worktrees/',
    'claimId',
    'leaseId',
    'leaseToken',
    'runId',
    'socket',
    'dockerNetwork',
  ]) {
    expect(serialized).not.toContain(prohibited);
  }
  expect(
    discoveryService.snapshot(begun.activation.id, {
      client: discoveryClient,
      component: 'website',
      gatewayHost: 'host.docker.internal',
    }),
  ).toEqual(snapshot);
  expect(
    discoveryService.snapshot(begun.activation.id, {
      client: discoveryClient,
      component: 'website',
      gatewayHost: '172.17.0.1',
    }),
  ).toMatchObject({
    own: { http: { address: { host: '172.17.0.1' } } },
    dependencies: { backend: { address: { host: '172.17.0.1' } } },
  });
  registry.close();
});

test('refuses discovery after definition drift', async () => {
  const { registry, definitionService, discoveryService, stack, begun } =
    await activeHarness();
  const changed = definition();
  changed.components.admin.endpoints.http.required = false;
  definitionService.apply({
    client: definitionClient,
    workspaceRoot: stack.workspaceRoot,
    definition: changed,
  });

  expect(() =>
    discoveryService.resolve(begun.activation.id, {
      client: discoveryClient,
      component: 'website',
    }),
  ).toThrow('is stale and cannot publish discovery');
  registry.close();
});

test('refuses discovery from a failed activation', async () => {
  const { registry, coordinationService, discoveryService, begun } =
    await activeHarness();
  const required = begun.leases.find(
    ({ component, endpoint }) => component === 'api' && endpoint === 'http',
  );
  if (required === undefined) throw new Error('Expected required API lease.');
  coordinationService.abandon(begun.activation.id, {
    client: activationClient,
    leaseId: required.leaseId,
    leaseToken: required.leaseToken,
    reason: 'startup-error',
  });
  expect(() =>
    discoveryService.resolve(begun.activation.id, {
      client: discoveryClient,
      component: 'website',
    }),
  ).toThrow('is failed and cannot publish discovery');
  registry.close();
});
