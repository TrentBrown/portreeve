// @ts-check

import { describe, expect, test } from 'bun:test';
import { AllocationService } from '../../src/allocation/service.js';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';

const client = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['two-phase-allocation-v1'],
};

/**
 * @param {string} service
 * @param {Record<string, unknown>} [allocation]
 */
function request(service, allocation = {}) {
  return {
    client,
    claim: {
      project: 'caregiver',
      workspaceRoot: `/worktrees/${service}`,
      service,
      transport: 'tcp',
    },
    allocation: {
      mode: 'sticky',
      replacementPolicy: 'never',
      ...allocation,
    },
  };
}

/**
 * @param {import('../../src/storage/registry.js').Registry} registry
 * @param {Map<number, Array<{pid: number, command: string | null, names: string[]}>>} [listeners]
 */
function service(registry, listeners = new Map()) {
  /** @param {number} pid */
  const fingerprint = (pid) => ({
    pid,
    parentPid: 1,
    uid: 501,
    startTime: '2026-07-30T11:00:00.000Z',
    executable: '/usr/local/bin/bun',
    command: 'bun',
    workingDirectory: '/worktrees/test',
  });
  return new AllocationService({
    registry,
    inspectListeners: async (port) =>
      (listeners.get(port) ?? []).map((listener) => ({
        ...listener,
        port,
        process: fingerprint(listener.pid),
      })),
    inspectProcessInstance: async (pid) => fingerprint(pid),
    detectEphemeralRange: async () => ({
      start: 30_000,
      end: 40_000,
      source: 'test',
    }),
    now: () => new Date('2026-07-30T12:00:00.000Z'),
  });
}

describe('allocation service', () => {
  test('prefers the requested port and falls back around listeners', async () => {
    const registry = openRegistry();
    const allocation = service(
      registry,
      new Map([[20_000, [{ pid: 10, command: 'other', names: ['*:20000'] }]]]),
    );
    registry.setSettings({
      ...registry.getSettings(),
      automaticPortRanges: [{ start: 20_001, end: 20_010 }],
    });

    const acquired = await allocation.acquire(
      request('website', { preferredPort: 20_000 }),
    );
    expect(acquired.port).toBe(20_001);
    expect(acquired.reusedAssignment).toBe(false);
    registry.close();
  });

  test('never substitutes another port for an exact request', async () => {
    const registry = openRegistry();
    const allocation = service(
      registry,
      new Map([[20_000, [{ pid: 10, command: 'other', names: ['*:20000'] }]]]),
    );

    expect(
      allocation.acquire(request('website', { exactPort: 20_000 })),
    ).rejects.toBeInstanceOf(RegistryError);
    registry.close();
  });

  test('excludes detected ephemeral ports from automatic allocation', async () => {
    const registry = openRegistry();
    const allocation = service(registry);
    registry.setSettings({
      ...registry.getSettings(),
      automaticPortRanges: [
        { start: 29_999, end: 30_001 },
        { start: 40_001, end: 40_001 },
      ],
      excludedPorts: [29_999],
    });

    expect((await allocation.acquire(request('api'))).port).toBe(40_001);
    registry.close();
  });

  test('requires every current listener to match the confirming root PID', async () => {
    const registry = openRegistry();
    const listeners = new Map();
    const allocation = service(registry, listeners);
    const acquired = await allocation.acquire(
      request('website', { exactPort: 20_000 }),
    );
    listeners.set(20_000, [
      { pid: 1234, command: 'bun', names: ['*:20000'] },
      { pid: 5678, command: 'other', names: ['*:20000'] },
    ]);

    expect(
      allocation.confirm({
        client,
        leaseId: acquired.leaseId,
        leaseToken: acquired.leaseToken,
        rootPid: 1234,
      }),
    ).rejects.toThrow('not exclusively owned');
    registry.close();
  });

  test('renews a pending standalone lease only with its credential', async () => {
    const registry = openRegistry();
    const allocation = service(registry);
    const acquired = await allocation.acquire(
      request('renewable', { exactPort: 20_000 }),
    );

    expect(
      allocation.renew({
        client,
        leaseId: acquired.leaseId,
        leaseToken: acquired.leaseToken,
      }),
    ).toEqual({
      leaseId: acquired.leaseId,
      expiresAt: acquired.expiresAt,
    });
    expect(() =>
      allocation.renew({
        client,
        leaseId: acquired.leaseId,
        leaseToken: 'x'.repeat(43),
      }),
    ).toThrow('Lease token does not match');
    registry.close();
  });

  test('reuses an expired ephemeral assignment only after listeners disappear', async () => {
    const registry = openRegistry();
    let now = new Date('2026-07-30T12:00:00.000Z');
    /** @type {Map<number, Array<{pid: number, command: string | null, names: string[]}>>} */
    const listeners = new Map();
    const allocation = new AllocationService({
      registry,
      inspectListeners: async (port) =>
        (listeners.get(port) ?? []).map((listener) => ({
          ...listener,
          port,
          process: {
            pid: listener.pid,
            parentPid: 1,
            uid: 501,
            startTime: '2026-07-30T11:00:00.000Z',
            executable: '/usr/local/bin/bun',
            command: 'bun',
            workingDirectory: '/worktrees/test',
          },
        })),
      inspectProcessInstance: async (pid) => ({
        pid,
        parentPid: 1,
        uid: 501,
        startTime: '2026-07-30T11:00:00.000Z',
        executable: '/usr/local/bin/bun',
        command: 'bun',
        workingDirectory: '/worktrees/test',
      }),
      detectEphemeralRange: async () => ({
        start: 30_000,
        end: 40_000,
        source: 'test',
      }),
      now: () => now,
    });
    registry.setSettings({
      ...registry.getSettings(),
      ephemeralAssignmentTtlMilliseconds: 1_000,
    });

    const lease = await allocation.acquire(
      request('preview', { mode: 'ephemeral', exactPort: 20_000 }),
    );
    listeners.set(20_000, [{ pid: 1234, command: 'bun', names: ['*:20000'] }]);
    const run = await allocation.confirm({
      client,
      leaseId: lease.leaseId,
      leaseToken: lease.leaseToken,
      rootPid: 1234,
    });
    allocation.release({ client, runId: run.id });

    now = new Date('2026-07-30T12:00:01.000Z');
    await expect(
      allocation.acquire(request('other', { exactPort: 20_000 })),
    ).rejects.toBeInstanceOf(RegistryError);

    listeners.delete(20_000);
    expect(
      (await allocation.acquire(request('other', { exactPort: 20_000 }))).port,
    ).toBe(20_000);
    registry.close();
  });

  test('replacement policy reclaims the same claim before issuing a new lease', async () => {
    const registry = openRegistry();
    const listeners = new Map();
    const firstAllocation = service(registry, listeners);
    const firstLease = await firstAllocation.acquire(
      request('replaceable', { exactPort: 20_000 }),
    );
    listeners.set(20_000, [{ pid: 1234, command: 'bun', names: ['*:20000'] }]);
    const firstRun = await firstAllocation.confirm({
      client,
      leaseId: firstLease.leaseId,
      leaseToken: firstLease.leaseToken,
      rootPid: 1234,
    });
    /** @type {Array<{port: number, input: Record<string, unknown>}>} */
    const requests = [];
    const replacementAllocation = new AllocationService({
      registry,
      inspectListeners: async () => [],
      detectEphemeralRange: async () => ({
        start: 30_000,
        end: 40_000,
        source: 'test',
      }),
      reclamationService: /** @type {any} */ ({
        /** @param {number} port @param {Record<string, unknown>} input */
        reclaim: async (port, input) => {
          requests.push({ port, input });
          return { outcome: 'terminated' };
        },
      }),
      now: () => new Date('2026-07-30T12:01:00.000Z'),
    });

    const replacementLease = await replacementAllocation.acquire(
      request('replaceable', {
        exactPort: 20_000,
        replacementPolicy: 'force-after-grace',
      }),
    );

    expect(replacementLease.port).toBe(20_000);
    expect(registry.getRun(firstRun.id)?.state).toBe('released');
    expect(requests).toEqual([
      {
        port: 20_000,
        input: {
          client,
          policy: 'force-after-grace',
          dryRun: false,
        },
      },
    ]);
    registry.close();
  });
});
