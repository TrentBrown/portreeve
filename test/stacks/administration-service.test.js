// @ts-check

import { expect, test } from 'bun:test';
import { DOCKER_LABELS } from '../../src/docker/evidence.js';
import { StackAdministrationService } from '../../src/stacks/administration-service.js';
import { StackDefinitionService } from '../../src/stacks/service.js';
import { openRegistry } from '../../src/storage/registry.js';

const client = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['stack-activations-v1'],
};
const old = new Date('2026-07-01T12:00:00.000Z');
const now = new Date('2026-08-06T12:00:00.000Z');

/** @param {import('../../src/storage/registry.js').Registry} registry @param {string} workspaceRoot @param {boolean} [docker] */
function applyStack(registry, workspaceRoot, docker = false) {
  return new StackDefinitionService({ registry, now: () => old }).apply({
    client: {
      ...client,
      requiredCapabilities: ['stack-definitions-v1'],
    },
    workspaceRoot,
    definition: {
      version: 1,
      project: 'prune-test',
      components: {
        api: {
          ...(docker ? { docker: { service: 'api' } } : {}),
          endpoints: {
            http: {
              allocation: { preferredPort: 43220 },
              ...(docker ? { docker: { containerPort: 3000 } } : {}),
            },
          },
        },
      },
    },
  }).stack;
}

/** @param {import('../../src/storage/registry.js').Registry} registry @param {string} claimId @param {number} port */
function assignPort(registry, claimId, port) {
  const lease = registry.createPendingLease(
    {
      claimId,
      port,
      expiresAt: '2026-07-01T12:01:00.000Z',
    },
    old,
  );
  const run = registry.confirmLease(
    {
      leaseId: lease.lease.id,
      token: lease.token,
      rootPid: 100,
      rootFingerprint: null,
    },
    old,
  );
  registry.releaseRun(run.id, old);
}

/**
 * @param {{
 *   registry: import('../../src/storage/registry.js').Registry,
 *   pathExists?: (path: string) => Promise<boolean>,
 *   inspect?: (port: number) => Promise<{listeners: unknown[]}>,
 *   dockerAdapter?: import('../../src/docker/adapter.js').DockerEvidenceAdapter | null
 * }} options
 */
function service({
  registry,
  pathExists = async () => false,
  inspect = async () => ({ listeners: [] }),
  dockerAdapter = null,
}) {
  return new StackAdministrationService({
    registry,
    coordinationService: /** @type {any} */ ({
      inspectProviders: async () => [],
      reconcile: async () => {
        throw new Error('Reconciliation was not expected.');
      },
    }),
    inventoryService: /** @type {any} */ ({ inspect }),
    dockerAdapter,
    pathExists,
    now: () => now,
  });
}

test('previews and atomically prunes an old missing-worktree stack while retaining history', async () => {
  const registry = openRegistry();
  const stack = applyStack(registry, '/missing/prune-me');
  const claims = registry.listStackClaims(stack.id);
  const administrator = service({ registry });

  const plan = await administrator.prune({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: true,
  });
  expect(plan).toMatchObject({
    dryRun: true,
    candidates: [{ stack: { id: stack.id }, claimIds: [claims[0]?.id] }],
    blocked: [],
    deletedStackIds: [],
  });
  expect(registry.getStack(stack.id)).not.toBeNull();

  const result = await administrator.prune({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: false,
  });
  expect(result.deletedStackIds).toEqual([stack.id]);
  expect(result.deletedClaimIds).toEqual(claims.map(({ id }) => id));
  expect(registry.getStack(stack.id)).toBeNull();
  expect(claims.map(({ id }) => registry.getClaim(id))).toEqual([null]);
  expect(registry.listHistory({ eventType: 'stack.pruned' })).toContainEqual(
    expect.objectContaining({
      entityId: stack.id,
      payload: expect.objectContaining({
        identity: {
          project: stack.project,
          workspaceRoot: stack.workspaceRoot,
        },
        claimIds: claims.map(({ id }) => id),
      }),
    }),
  );
  registry.close();
});

test('reports pending work and unavailable Docker evidence as explicit prune blockers', async () => {
  const registry = openRegistry();
  const processStack = applyStack(registry, '/missing/pending');
  const processClaim = registry.listStackClaims(processStack.id)[0];
  if (processClaim === undefined) throw new Error('Expected a process claim.');
  registry.createPendingLease(
    {
      claimId: processClaim.id,
      port: 43220,
      expiresAt: '2026-08-06T12:01:00.000Z',
    },
    now,
  );
  const dockerStack = applyStack(registry, '/missing/docker', true);
  const dockerClaim = registry.listStackClaims(dockerStack.id)[0];
  if (dockerClaim === undefined) throw new Error('Expected a Docker claim.');
  assignPort(registry, dockerClaim.id, 43221);
  const administrator = service({
    registry,
    dockerAdapter: {
      availability: async () => ({ available: false, reason: 'docker-offline' }),
      inspect: async () => ({
        status: 'unavailable',
        reason: 'docker-offline',
        container: null,
      }),
      findPublishedPort: async () => ({
        available: false,
        reason: 'docker-offline',
        containers: [],
      }),
    },
  });

  const plan = await administrator.prune({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: true,
  });
  expect(plan.candidates).toEqual([]);
  expect(plan.blocked).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        stack: expect.objectContaining({ id: processStack.id }),
        reasons: expect.arrayContaining(['pending-lease:api.http']),
      }),
      expect.objectContaining({
        stack: expect.objectContaining({ id: dockerStack.id }),
        reasons: ['docker-evidence-unavailable'],
      }),
    ]),
  );
  registry.close();
});

test('blocks pruning when fresh Docker evidence finds a matching running container', async () => {
  const registry = openRegistry();
  const stack = applyStack(registry, '/missing/docker-running', true);
  const claim = registry.listStackClaims(stack.id)[0];
  if (claim === undefined) throw new Error('Expected a Docker claim.');
  assignPort(registry, claim.id, 43222);
  const administrator = service({
    registry,
    dockerAdapter: {
      availability: async () => ({ available: true, reason: null }),
      inspect: async () => ({
        status: 'missing',
        reason: 'not-needed',
        container: null,
      }),
      findPublishedPort: async () => ({
        available: true,
        reason: null,
        containers: [
          {
            id: 'd'.repeat(64),
            running: true,
            labels: { [DOCKER_LABELS.stackId]: stack.id },
            ports: [{ containerPort: 3000, hostIp: '127.0.0.1', hostPort: 43222 }],
          },
        ],
      }),
    },
  });

  expect(
    await administrator.prune({
      client,
      olderThanMilliseconds: 7 * 86_400_000,
      dryRun: true,
    }),
  ).toMatchObject({
    candidates: [],
    blocked: [
      {
        stack: { id: stack.id },
        reasons: ['matching-container:api.http'],
      },
    ],
  });
  expect(registry.getStack(stack.id)).not.toBeNull();
  registry.close();
});

test('execution skips a candidate when its worktree, listener, or container reappears', async () => {
  const worktreeRegistry = openRegistry();
  const worktreeStack = applyStack(worktreeRegistry, '/missing/reappears');
  let pathChecks = 0;
  const worktreeResult = await service({
    registry: worktreeRegistry,
    pathExists: async () => {
      pathChecks += 1;
      return pathChecks > 1;
    },
  }).prune({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: false,
  });
  expect(worktreeResult).toMatchObject({
    deletedStackIds: [],
    skipped: [{ stackId: worktreeStack.id, reason: 'workspace-reappeared' }],
  });
  expect(worktreeRegistry.getStack(worktreeStack.id)).not.toBeNull();
  worktreeRegistry.close();

  const listenerRegistry = openRegistry();
  const listenerStack = applyStack(listenerRegistry, '/missing/listener-race');
  const listenerClaim = listenerRegistry.listStackClaims(listenerStack.id)[0];
  if (listenerClaim === undefined) throw new Error('Expected a listener claim.');
  assignPort(listenerRegistry, listenerClaim.id, 43220);
  let inspections = 0;
  const listenerResult = await service({
    registry: listenerRegistry,
    inspect: async () => {
      inspections += 1;
      return { listeners: inspections > 1 ? [{ pid: 77 }] : [] };
    },
  }).prune({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: false,
  });
  expect(listenerResult).toMatchObject({
    deletedStackIds: [],
    skipped: [{ stackId: listenerStack.id, reason: 'live-listener:43220' }],
  });
  expect(listenerRegistry.getStack(listenerStack.id)).not.toBeNull();
  listenerRegistry.close();

  const containerRegistry = openRegistry();
  const containerStack = applyStack(containerRegistry, '/missing/container-race', true);
  const containerClaim = containerRegistry.listStackClaims(containerStack.id)[0];
  if (containerClaim === undefined) throw new Error('Expected a container claim.');
  assignPort(containerRegistry, containerClaim.id, 43223);
  let containerInspections = 0;
  const containerResult = await service({
    registry: containerRegistry,
    dockerAdapter: {
      availability: async () => ({ available: true, reason: null }),
      inspect: async () => ({
        status: 'missing',
        reason: 'not-needed',
        container: null,
      }),
      findPublishedPort: async () => {
        containerInspections += 1;
        return {
          available: true,
          reason: null,
          containers:
            containerInspections > 1
              ? [
                  {
                    id: 'e'.repeat(64),
                    running: true,
                    labels: { [DOCKER_LABELS.stackId]: containerStack.id },
                    ports: [
                      {
                        containerPort: 3000,
                        hostIp: '127.0.0.1',
                        hostPort: 43223,
                      },
                    ],
                  },
                ]
              : [],
        };
      },
    },
  }).prune({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: false,
  });
  expect(containerResult).toMatchObject({
    deletedStackIds: [],
    skipped: [{ stackId: containerStack.id, reason: 'matching-container:api.http' }],
  });
  expect(containerRegistry.getStack(containerStack.id)).not.toBeNull();
  containerRegistry.close();
});
