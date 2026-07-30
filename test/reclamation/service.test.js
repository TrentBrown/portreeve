// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { AllocationService } from '../../src/allocation/service.js';
import { inspectProcess } from '../../src/inspection/processes.js';
import { ReclamationService } from '../../src/reclamation/service.js';
import { openRegistry } from '../../src/storage/registry.js';

const client = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: [],
};

/** @type {Array<Bun.Subprocess<'ignore', 'pipe', 'pipe'>>} */
const children = [];

afterEach(async () => {
  while (children.length > 0) {
    const child = children.pop();
    if (child !== undefined && child.exitCode === null) {
      child.kill('SIGKILL');
      await child.exited;
    }
  }
});

/**
 * @param {number} pid
 * @param {string} [startTime]
 */
function fingerprint(pid, startTime = '2026-07-30T11:00:00.000Z') {
  return {
    pid,
    parentPid: 1,
    uid: 501,
    startTime,
    executable: '/usr/local/bin/node',
    command: 'node',
    workingDirectory: '/worktrees/test',
  };
}

/**
 * @param {number} port
 * @param {ReturnType<typeof fingerprint>} processFingerprint
 * @param {boolean} [verified]
 */
function listener(port, processFingerprint, verified = true) {
  return {
    pid: processFingerprint.pid,
    port,
    command: 'node',
    names: [`*:${port}`],
    process: processFingerprint,
    ownership: {
      verified,
      reason: verified ? 'verified' : 'not-in-run-lineage',
      lineage: [processFingerprint.pid],
    },
  };
}

/**
 * @param {{
 *   port: number,
 *   listeners: ReturnType<typeof listener>[],
 *   verified?: boolean,
 *   claimed?: boolean,
 *   runId?: string,
 *   rootPid?: number
 * }} evidence
 */
function inventoryEntry({
  port,
  listeners,
  verified = true,
  claimed = true,
  runId = 'run',
  rootPid,
}) {
  return {
    port,
    transport: /** @type {const} */ ('tcp'),
    classification:
      listeners.length === 0
        ? claimed
          ? 'conflicting'
          : 'available'
        : verified
          ? 'verified'
          : claimed
            ? 'mixed'
            : 'unclaimed',
    claim: claimed ? { id: 'claim' } : null,
    lease: null,
    run: claimed ? { id: runId, ...(rootPid === undefined ? {} : { rootPid }) } : null,
    listeners,
  };
}

test('normal dry-run exposes verified targets without signaling', async () => {
  const registry = openRegistry();
  const port = 24_001;
  const target = listener(port, fingerprint(101));
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () => inventoryEntry({ port, listeners: [target] }),
    }),
    signalProcess: (pid, signal) => signals.push([pid, signal]),
  });

  const result = await reclamation.reclaim(port, {
    client,
    policy: 'force-after-grace',
    dryRun: true,
  });

  expect(result).toMatchObject({
    operation: 'reclaim',
    outcome: 'would-terminate',
    dryRun: true,
    targets: [{ pid: 101 }],
    signals: [],
  });
  expect(signals).toEqual([]);
  expect(registry.listHistory().map(({ eventType }) => eventType)).toEqual([
    'reclamation.requested',
    'reclamation.completed',
  ]);
  registry.close();
});

test('normal reclamation refuses mixed ownership', async () => {
  const registry = openRegistry();
  const port = 24_002;
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () =>
        inventoryEntry({
          port,
          listeners: [
            listener(port, fingerprint(102), true),
            listener(port, fingerprint(103), false),
          ],
          verified: false,
        }),
    }),
    signalProcess: () => {
      throw new Error('must not signal');
    },
  });

  expect(
    await reclamation.reclaim(port, {
      client,
      policy: 'graceful',
    }),
  ).toMatchObject({
    outcome: 'refused',
    reason: 'ownership-unverified',
    signals: [],
  });
  registry.close();
});

test('graceful reclamation signals only listeners and observes their exit', async () => {
  const registry = openRegistry();
  const port = 24_003;
  const target = listener(port, fingerprint(104));
  let current = [target];
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () => inventoryEntry({ port, listeners: current }),
    }),
    signalProcess: (pid, signal) => {
      signals.push([pid, signal]);
      current = [];
    },
    sleep: async () => {},
  });

  const result = await reclamation.reclaim(port, {
    client,
    policy: 'graceful',
  });

  expect(result.outcome).toBe('terminated');
  expect(signals).toEqual([[104, 'SIGTERM']]);
  expect(result.signals).toEqual([
    { pid: 104, signal: 'SIGTERM', at: expect.any(String) },
  ]);
  registry.close();
});

test('force-after-grace escalates only while the same process remains', async () => {
  const registry = openRegistry();
  registry.setSettings({
    ...registry.getSettings(),
    gracefulShutdownMilliseconds: 100,
  });
  const port = 24_004;
  const target = listener(port, fingerprint(105));
  let current = [target];
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () => inventoryEntry({ port, listeners: current }),
    }),
    signalProcess: (pid, signal) => {
      signals.push([pid, signal]);
      if (signal === 'SIGKILL') {
        current = [];
      }
    },
    sleep: async () => {},
  });

  const result = await reclamation.reclaim(port, {
    client,
    policy: 'force-after-grace',
  });

  expect(result.outcome).toBe('terminated');
  expect(signals).toEqual([
    [105, 'SIGTERM'],
    [105, 'SIGKILL'],
  ]);
  registry.close();
});

test('replacement process blocks escalation after the graceful signal', async () => {
  const registry = openRegistry();
  const port = 24_005;
  const original = listener(port, fingerprint(106));
  let current = [original];
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () => inventoryEntry({ port, listeners: current }),
    }),
    signalProcess: (pid, signal) => {
      signals.push([pid, signal]);
      current = [listener(port, fingerprint(106, '2026-07-30T11:30:00.000Z'))];
    },
    sleep: async () => {},
  });

  const result = await reclamation.reclaim(port, {
    client,
    policy: 'force-after-grace',
  });

  expect(result).toMatchObject({
    outcome: 'refused',
    reason: 'target-set-changed',
  });
  expect(signals).toEqual([[106, 'SIGTERM']]);
  registry.close();
});

test('a changed confirmed-run context blocks signaling even for the same process', async () => {
  const registry = openRegistry();
  const port = 24_008;
  const target = listener(port, fingerprint(109));
  let inspection = 0;
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () => {
        inspection += 1;
        return inventoryEntry({
          port,
          listeners: [target],
          runId: inspection === 1 ? 'original-run' : 'replacement-run',
        });
      },
    }),
    signalProcess: () => {
      throw new Error('changed run context must not be signaled');
    },
  });

  expect(
    await reclamation.reclaim(port, {
      client,
      policy: 'graceful',
    }),
  ).toMatchObject({
    outcome: 'refused',
    reason: 'ownership-context-changed',
    signals: [],
  });
  registry.close();
});

test('signals descendant listeners before a listening run root', async () => {
  const registry = openRegistry();
  const port = 24_009;
  const root = listener(port, fingerprint(110));
  const child = listener(port, fingerprint(111));
  let current = [root, child];
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () =>
        inventoryEntry({
          port,
          listeners: current,
          rootPid: root.pid,
        }),
    }),
    signalProcess: (pid, signal) => {
      signals.push([pid, signal]);
      current = current.filter((candidate) => candidate.pid !== pid);
    },
    sleep: async () => {},
  });

  expect(
    await reclamation.reclaim(port, {
      client,
      policy: 'graceful',
    }),
  ).toMatchObject({ outcome: 'terminated' });
  expect(signals).toEqual([
    [child.pid, 'SIGTERM'],
    [root.pid, 'SIGTERM'],
  ]);
  registry.close();
});

test('graceful policy returns a structured timeout without SIGKILL', async () => {
  const registry = openRegistry();
  registry.setSettings({
    ...registry.getSettings(),
    gracefulShutdownMilliseconds: 100,
  });
  const port = 24_006;
  const target = listener(port, fingerprint(107));
  /** @type {Array<[number, 'SIGTERM' | 'SIGKILL']>} */
  const signals = [];
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () => inventoryEntry({ port, listeners: [target] }),
    }),
    signalProcess: (pid, signal) => signals.push([pid, signal]),
    sleep: async () => {},
  });

  const result = await reclamation.reclaim(port, {
    client,
    policy: 'graceful',
  });

  expect(result).toMatchObject({
    outcome: 'timeout',
    reason: 'grace-period-expired',
  });
  expect(signals).toEqual([[107, 'SIGTERM']]);
  registry.close();
});

test('unsafe eviction requires explicit intent and remains fingerprint-bound', async () => {
  const registry = openRegistry();
  const port = 24_007;
  const target = listener(port, fingerprint(108), false);
  const reclamation = new ReclamationService({
    registry,
    inventoryService: /** @type {any} */ ({
      inspect: async () =>
        inventoryEntry({
          port,
          listeners: [target],
          claimed: false,
          verified: false,
        }),
    }),
    signalProcess: () => {
      throw new Error('dry-run must not signal');
    },
  });

  await expect(
    reclamation.unsafeEvict(port, {
      client,
      policy: 'graceful',
      dryRun: true,
    }),
  ).rejects.toThrow();
  expect(
    await reclamation.unsafeEvict(port, {
      client,
      unsafeAnyOwner: true,
      policy: 'graceful',
      dryRun: true,
    }),
  ).toMatchObject({
    operation: 'unsafe-eviction',
    outcome: 'would-terminate',
    targets: [{ pid: 108 }],
  });
  registry.close();
});

test('reclaims a verified real child listener with SIGTERM', async () => {
  const fixture = await confirmedChildFixture(false);
  children.push(fixture.child);
  const reclamation = new ReclamationService({ registry: fixture.registry });

  const result = await reclamation.reclaim(fixture.port, {
    client,
    policy: 'graceful',
  });

  expect(result).toMatchObject({
    outcome: 'terminated',
    signals: [{ pid: fixture.child.pid, signal: 'SIGTERM' }],
  });
  expect(await fixture.child.exited).toBe(0);
  expect(fixture.registry.getRun(fixture.runId)?.state).toBe('released');
  children.pop();
  fixture.registry.close();
});

test('reclaims a verified real stubborn child with SIGKILL after grace', async () => {
  const fixture = await confirmedChildFixture(true);
  children.push(fixture.child);
  fixture.registry.setSettings({
    ...fixture.registry.getSettings(),
    gracefulShutdownMilliseconds: 100,
  });
  const reclamation = new ReclamationService({ registry: fixture.registry });

  const result = await reclamation.reclaim(fixture.port, {
    client,
    policy: 'force-after-grace',
  });

  expect(result).toMatchObject({
    outcome: 'terminated',
    signals: [
      { pid: fixture.child.pid, signal: 'SIGTERM' },
      { pid: fixture.child.pid, signal: 'SIGKILL' },
    ],
  });
  await fixture.child.exited;
  children.pop();
  fixture.registry.close();
});

/**
 * @param {boolean} ignoreTerm
 */
async function confirmedChildFixture(ignoreTerm) {
  const registry = openRegistry();
  const allocation = new AllocationService({ registry });
  const probe = Bun.serve({
    port: 0,
    fetch: () => new Response('probe'),
  });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) {
    throw new Error('Probe did not expose a port.');
  }

  const lease = await allocation.acquire({
    client,
    claim: {
      project: 'portreeve-tests',
      workspaceRoot: tmpdir(),
      service: `reclamation-${String(port)}`,
      transport: 'tcp',
    },
    allocation: {
      mode: 'sticky',
      exactPort: port,
      replacementPolicy: 'never',
    },
  });
  const termHandler = ignoreTerm
    ? `process.on('SIGTERM', () => {});`
    : `process.on('SIGTERM', () => server.close(() => process.exit(0)));`;
  const child = Bun.spawn(
    [
      'node',
      '--input-type=module',
      '--eval',
      `import http from 'node:http';
       const server = http.createServer((_request, response) => response.end('ok'));
       server.listen(${String(port)}, () => console.log('ready'));
       ${termHandler}`,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const reader = child.stdout.getReader();
  const ready = await reader.read();
  reader.releaseLock();
  if (!new TextDecoder().decode(ready.value).includes('ready')) {
    child.kill('SIGKILL');
    await child.exited;
    registry.close();
    throw new Error('Child listener did not become ready.');
  }

  const rootFingerprint = await inspectProcess(process.pid);
  if (rootFingerprint === null) {
    child.kill('SIGKILL');
    await child.exited;
    registry.close();
    throw new Error('Test root process was not observable.');
  }
  const run = registry.confirmLease({
    leaseId: lease.leaseId,
    token: lease.leaseToken,
    rootPid: process.pid,
    rootFingerprint,
  });
  return { registry, port, child, runId: run.id };
}
