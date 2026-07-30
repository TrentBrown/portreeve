// @ts-check

import { expect, test } from 'bun:test';
import { AdministrationService } from '../../src/administration/service.js';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';

const client = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['administration-v1'],
};

const old = new Date('2026-07-01T12:00:00.000Z');
const now = new Date('2026-07-30T12:00:00.000Z');

/**
 * @param {string} service
 * @param {string} [workspaceRoot]
 */
function identity(service, workspaceRoot = `/missing/${service}`) {
  return {
    project: 'caregiver',
    workspaceRoot,
    service,
    transport: /** @type {const} */ ('tcp'),
  };
}

/**
 * @param {import('../../src/storage/registry.js').Registry} registry
 * @param {string} service
 * @param {number} port
 * @param {Date} [timestamp]
 */
function idleAssignedClaim(registry, service, port, timestamp = old) {
  const claim = registry.insertClaim(
    { identity: identity(service), mode: 'sticky' },
    timestamp,
  );
  const lease = registry.createPendingLease(
    {
      claimId: claim.id,
      port,
      expiresAt: new Date(timestamp.getTime() + 60_000).toISOString(),
    },
    timestamp,
  );
  const run = registry.confirmLease(
    {
      leaseId: lease.lease.id,
      token: lease.token,
      rootPid: 100,
      rootFingerprint: null,
    },
    timestamp,
  );
  registry.releaseRun(run.id, timestamp);
  const assigned = registry.getClaim(claim.id);
  if (assigned === null) {
    throw new Error('Assigned claim disappeared.');
  }
  return assigned;
}

/**
 * @param {{
 *   registry: import('../../src/storage/registry.js').Registry,
 *   listeners?: Map<number, unknown[]>,
 *   existingPaths?: Set<string>
 * }} options
 */
function administration({
  registry,
  listeners = new Map(),
  existingPaths = new Set(),
}) {
  return new AdministrationService({
    registry,
    inventoryService: /** @type {any} */ ({
      /** @param {number} port */
      inspect: async (port) => ({
        port,
        listeners: listeners.get(port) ?? [],
      }),
    }),
    detectEphemeralRange: async () => ({
      start: 30_000,
      end: 40_000,
      source: 'test',
    }),
    pathExists: async (path) => existingPaths.has(path),
    now: () => now,
  });
}

test('reassigns an idle claim while preserving identity', async () => {
  const registry = openRegistry();
  registry.setSettings({
    ...registry.getSettings(),
    automaticPortRanges: [{ start: 20_001, end: 20_010 }],
  });
  const claim = idleAssignedClaim(registry, 'website', 20_000);
  const service = administration({ registry });

  const reassigned = await service.reassignClaim(claim.id, {
    client,
    preferredPort: 20_005,
  });

  expect(reassigned).toMatchObject({
    id: claim.id,
    identity: claim.identity,
    assignedPort: 20_005,
    preferredPort: 20_005,
    exactPort: null,
  });
  expect(
    registry.listHistory({ eventType: 'claim.reassigned' }).at(-1)?.payload,
  ).toMatchObject({
    previousPort: 20_000,
    port: 20_005,
  });
  registry.close();
});

test('reassignment refuses current and target listeners', async () => {
  const registry = openRegistry();
  const claim = idleAssignedClaim(registry, 'api', 20_010);
  const currentListener = new Map([[20_010, [{ pid: 10 }]]]);
  await expect(
    administration({ registry, listeners: currentListener }).reassignClaim(claim.id, {
      client,
      exactPort: 20_011,
    }),
  ).rejects.toMatchObject({
    code: 'conflict',
    details: { reason: 'live_listener' },
  });

  currentListener.delete(20_010);
  currentListener.set(20_011, [{ pid: 11 }]);
  await expect(
    administration({ registry, listeners: currentListener }).reassignClaim(claim.id, {
      client,
      exactPort: 20_011,
    }),
  ).rejects.toMatchObject({
    code: 'conflict',
    details: { reason: 'live_listener' },
  });
  registry.close();
});

test('deletes only idle listener-free claims and preserves audit history', async () => {
  const registry = openRegistry();
  const claim = idleAssignedClaim(registry, 'worker', 20_020);
  const service = administration({ registry });

  expect(await service.deleteClaim(claim.id, { client })).toBe(true);
  expect(registry.getClaim(claim.id)).toBeNull();
  expect(
    registry.listHistory({ eventType: 'claim.deleted' }).at(-1)?.payload,
  ).toMatchObject({
    claim: { id: claim.id, assignedPort: 20_020 },
  });
  registry.close();
});

test('prune honors age, missing path, active work, listeners, and dry-run', async () => {
  const registry = openRegistry();
  const eligible = idleAssignedClaim(registry, 'eligible', 20_030);
  const tooRecent = idleAssignedClaim(
    registry,
    'recent',
    20_031,
    new Date('2026-07-29T12:00:00.000Z'),
  );
  const listening = idleAssignedClaim(registry, 'listening', 20_032);
  const existing = idleAssignedClaim(registry, 'existing', 20_033);
  const pending = registry.insertClaim(
    { identity: identity('pending'), mode: 'sticky' },
    old,
  );
  registry.createPendingLease(
    {
      claimId: pending.id,
      port: 20_034,
      expiresAt: '2026-07-30T12:01:00.000Z',
    },
    now,
  );
  const service = administration({
    registry,
    listeners: new Map([[20_032, [{ pid: 32 }]]]),
    existingPaths: new Set([existing.identity.workspaceRoot]),
  });

  const plan = await service.pruneClaims({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: true,
  });
  expect(plan.candidates.map(({ claim }) => claim.id)).toEqual([eligible.id]);
  expect(plan.deletedClaimIds).toEqual([]);
  expect(registry.getClaim(eligible.id)).not.toBeNull();

  const result = await service.pruneClaims({
    client,
    olderThanMilliseconds: 7 * 86_400_000,
    dryRun: false,
  });
  expect(result.deletedClaimIds).toEqual([eligible.id]);
  expect(registry.getClaim(eligible.id)).toBeNull();
  expect(registry.getClaim(tooRecent.id)).not.toBeNull();
  expect(registry.getClaim(listening.id)).not.toBeNull();
  expect(registry.getClaim(existing.id)).not.toBeNull();
  expect(registry.getClaim(pending.id)).not.toBeNull();
  registry.close();
});

test('registry rejects deleting a claim whose state changes after inspection', () => {
  const registry = openRegistry();
  const claim = registry.insertClaim(
    { identity: identity('pending-race'), mode: 'sticky' },
    now,
  );
  registry.createPendingLease(
    {
      claimId: claim.id,
      port: 20_040,
      expiresAt: '2026-07-30T12:01:00.000Z',
    },
    now,
  );

  expect(() => registry.deleteClaim(claim.id, 'pruned', now)).toThrow(RegistryError);
  expect(registry.getClaim(claim.id)).not.toBeNull();
  registry.close();
});

test('registry prevents reassignment across a newly pending target lease', () => {
  const registry = openRegistry();
  const reassigned = idleAssignedClaim(registry, 'reassign-race', 20_050);
  const competing = registry.insertClaim(
    { identity: identity('competing'), mode: 'sticky' },
    now,
  );
  registry.createPendingLease(
    {
      claimId: competing.id,
      port: 20_051,
      expiresAt: '2026-07-30T12:01:00.000Z',
    },
    now,
  );

  expect(() =>
    registry.reassignClaim(
      { claimId: reassigned.id, port: 20_051, exactPort: 20_051 },
      now,
    ),
  ).toThrow(RegistryError);
  expect(registry.getClaim(reassigned.id)?.assignedPort).toBe(20_050);
  registry.close();
});
