// @ts-check

import { expect, test } from 'bun:test';
import { ProcessFingerprintSchema } from '../../src/inspection/processes.js';
import { InventoryService } from '../../src/reconciliation/inventory.js';
import { openRegistry } from '../../src/storage/registry.js';

const now = new Date('2026-07-30T12:00:00.000Z');

/** @param {string} service */
function identity(service) {
  return {
    project: 'caregiver',
    workspaceRoot: `/worktrees/${service}`,
    service,
    transport: 'tcp',
  };
}

/**
 * @param {number} pid
 * @param {number} [parentPid]
 */
function fingerprint(pid, parentPid = 1) {
  return {
    pid,
    parentPid,
    uid: 501,
    startTime: '2026-07-30T11:00:00.000Z',
    executable: '/usr/local/bin/bun',
    command: 'bun',
    workingDirectory: '/worktrees/test',
  };
}

/**
 * @param {number} port
 * @param {number} pid
 */
function listener(port, pid) {
  return {
    pid,
    port,
    command: 'bun',
    names: [`*:${port}`],
    process: fingerprint(pid),
  };
}

test('reconciles durable claims with complete live listener evidence', async () => {
  const registry = openRegistry();

  const idleClaim = registry.insertClaim(
    { identity: identity('idle'), mode: 'sticky' },
    now,
  );
  const idleLease = registry.createPendingLease(
    {
      claimId: idleClaim.id,
      port: 20_000,
      expiresAt: '2026-07-30T12:01:00.000Z',
    },
    now,
  );
  const idleRun = registry.confirmLease(
    {
      leaseId: idleLease.lease.id,
      token: idleLease.token,
      rootPid: 100,
      rootFingerprint: fingerprint(100),
    },
    now,
  );
  registry.releaseRun(idleRun.id, now);

  const pendingClaim = registry.insertClaim(
    { identity: identity('pending'), mode: 'sticky' },
    now,
  );
  registry.createPendingLease(
    {
      claimId: pendingClaim.id,
      port: 20_001,
      expiresAt: '2026-07-30T12:01:00.000Z',
    },
    now,
  );

  const activeClaim = registry.insertClaim(
    { identity: identity('active'), mode: 'sticky' },
    now,
  );
  const activeLease = registry.createPendingLease(
    {
      claimId: activeClaim.id,
      port: 20_002,
      expiresAt: '2026-07-30T12:01:00.000Z',
    },
    now,
  );
  registry.confirmLease(
    {
      leaseId: activeLease.lease.id,
      token: activeLease.token,
      rootPid: 200,
      rootFingerprint: fingerprint(200),
    },
    now,
  );

  const conflictingClaim = registry.insertClaim(
    { identity: identity('conflicting'), mode: 'sticky' },
    now,
  );
  const conflictingLease = registry.createPendingLease(
    {
      claimId: conflictingClaim.id,
      port: 20_004,
      expiresAt: '2026-07-30T12:01:00.000Z',
    },
    now,
  );
  registry.confirmLease(
    {
      leaseId: conflictingLease.lease.id,
      token: conflictingLease.token,
      rootPid: 400,
      rootFingerprint: fingerprint(400),
    },
    now,
  );

  const inventory = new InventoryService({
    registry,
    inspectListeners: async () => [
      listener(20_002, 200),
      listener(20_002, 201),
      listener(20_003, 300),
      listener(20_004, 401),
    ],
    verifyLineage: async (process, root) => {
      const current = ProcessFingerprintSchema.parse(process);
      const expectedRoot = ProcessFingerprintSchema.parse(root);
      return {
        verified: current.pid === expectedRoot.pid,
        reason: current.pid === expectedRoot.pid ? 'verified' : 'not-in-run-lineage',
        lineage: [current.pid],
      };
    },
    now: () => now,
  });

  const entries = await inventory.list();
  expect(entries.map(({ port, classification }) => [port, classification])).toEqual([
    [20_000, 'idle'],
    [20_001, 'pending'],
    [20_002, 'mixed'],
    [20_003, 'unclaimed'],
    [20_004, 'conflicting'],
  ]);
  expect(entries.find(({ port }) => port === 20_001)?.lease).not.toHaveProperty(
    'tokenHash',
  );
  expect(
    (await inventory.list({ classification: 'unclaimed' })).map(({ port }) => port),
  ).toEqual([20_003]);
  expect(
    (await inventory.list({ project: 'caregiver', listening: false })).map(
      ({ port }) => port,
    ),
  ).toEqual([20_000, 20_001]);
  expect(
    (await inventory.list({ component: 'active', endpoint: 'default' })).map(
      ({ port }) => port,
    ),
  ).toEqual([20_002]);
  expect((await inventory.list({ service: 'active' })).map(({ port }) => port)).toEqual(
    [20_002],
  );
  expect((await inventory.inspect(20_005)).classification).toBe('available');
  registry.close();
});
