// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PortreeveClient,
  PortreeveClientError,
} from '../../packages/client/src/index.js';
import { AllocationService } from '../../src/allocation/service.js';
import { LauncherOperationService } from '../../src/launcher/operation-service.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { startPortreeveServer } from '../../src/server/server.js';
import { StackDefinitionService } from '../../src/stacks/service.js';
import { openRegistry } from '../../src/storage/registry.js';

/** @type {Array<() => Promise<void>>} */
const cleanups = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

async function startFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-server-'));
  const stackRoot = join(directory, 'stack');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  const databasePath = join(directory, 'data', 'registry.sqlite');
  await prepareRuntimeDirectories({
    applicationDirectory: join(directory, 'data'),
    socketPath,
  });
  await mkdir(stackRoot);
  const registry = openRegistry(databasePath);
  const server = await startPortreeveServer({
    socketPath,
    allocationService: new AllocationService({ registry }),
  });
  cleanups.push(async () => {
    await server.stop();
    registry.close();
    await rm(directory, { force: true, recursive: true });
  });
  return { socketPath, stackRoot };
}

test('coordinates launcher operations through the official socket client', async () => {
  const { socketPath, stackRoot } = await startFixture();
  const client = new PortreeveClient({ socketPath });
  expect((await client.health()).capabilities).toContain('launcher-operations-v1');
  const applied = await client.applyStack({
    stackRoot,
    definition: {
      version: 1,
      project: 'launcher-client',
      components: { api: { endpoints: { default: {} } } },
    },
  });
  const session = await client.beginLauncherOperation(applied.stack.id, {
    operation: 'status',
    launcherRevision: 'b'.repeat(64),
  });
  expect(session).toMatchObject({
    operation: {
      stackId: applied.stack.id,
      operation: 'status',
      state: 'active',
    },
    renewAfterMilliseconds: 10_000,
  });
  expect(
    (await client.renewLauncherOperation(session.operation.id, session.credential))
      .operation.state,
  ).toBe('active');
  await expect(
    client.renewLauncherOperation(session.operation.id, 'x'.repeat(43)),
  ).rejects.toMatchObject({
    code: 'invalid_operation_credential',
  });

  const completed = await client.completeLauncherOperation(
    session.operation.id,
    session.credential,
    {
      outcome: 'succeeded',
      exitCode: 0,
      afterEvidence: {
        classification: 'stopped',
        source: 'daemon',
        observedAt: new Date().toISOString(),
        generationId: null,
        activationId: null,
        listenerCount: 0,
        reasonCodes: [],
      },
      integration: {
        mode: 'command-only',
        verified: true,
        upgradeSuggested: true,
        generationId: crypto.randomUUID(),
        activationId: crypto.randomUUID(),
      },
    },
  );
  expect(completed).toMatchObject({
    changed: true,
    operation: {
      state: 'terminal',
      outcome: 'succeeded',
      exitCode: 0,
      integration: { verified: true, upgradeSuggested: true },
    },
  });
  expect(await client.getLauncherOperation(session.operation.id)).toEqual(
    completed.operation,
  );
  expect(await client.listLauncherOperations(applied.stack.id)).toEqual([
    completed.operation,
  ]);
  expect(
    (
      await client.completeLauncherOperation(session.operation.id, session.credential, {
        outcome: 'succeeded',
        exitCode: 0,
        afterEvidence: completed.operation.afterEvidence,
        integration: completed.operation.integration,
      })
    ).changed,
  ).toBe(false);
});

test('official client refuses launcher operations when capability is absent', async () => {
  const client = new PortreeveClient({ socketPath: '/not-used' });
  client.health = async () => ({
    softwareVersion: '0.0.1',
    protocol: { minimum: 1, maximum: 1 },
    capabilities: ['two-phase-allocation-v1'],
    pid: 1,
    mode: 'manual',
  });
  await expect(
    client.beginLauncherOperation(crypto.randomUUID(), {
      operation: 'start',
      launcherRevision: 'c'.repeat(64),
    }),
  ).rejects.toBeInstanceOf(PortreeveClientError);
});

test('server startup expires operation deadlines left by a prior process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-restart-'));
  const stackRoot = join(directory, 'stack');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  const applicationDirectory = join(directory, 'data');
  await mkdir(stackRoot);
  await prepareRuntimeDirectories({ applicationDirectory, socketPath });
  const registry = openRegistry(join(applicationDirectory, 'registry.sqlite'));
  const compatibility = {
    softwareVersion: '0.1.0',
    protocol: { minimum: 1, maximum: 1 },
    requiredCapabilities: ['launcher-operations-v1'],
  };
  const stack = new StackDefinitionService({ registry }).apply({
    client: compatibility,
    stackRoot,
    definition: {
      version: 1,
      project: 'launcher-restart',
      components: { api: { endpoints: { default: {} } } },
    },
  }).stack;
  const beforeRestart = new LauncherOperationService({
    registry,
    now: () => new Date('2026-08-08T12:00:00.000Z'),
  }).begin({
    client: compatibility,
    stackId: stack.id,
    operation: 'start',
    launcherRevision: 'd'.repeat(64),
    callerOperationId: crypto.randomUUID(),
  });
  const afterRestart = new LauncherOperationService({
    registry,
    now: () => new Date('2026-08-08T12:00:31.000Z'),
  });
  const server = await startPortreeveServer({
    socketPath,
    allocationService: new AllocationService({ registry }),
    launcherOperationService: afterRestart,
  });
  cleanups.push(async () => {
    await server.stop();
    registry.close();
    await rm(directory, { force: true, recursive: true });
  });
  const client = new PortreeveClient({ socketPath });
  expect(await client.getLauncherOperation(beforeRestart.operation.id)).toMatchObject({
    state: 'terminal',
    outcome: 'lost',
    completedAt: '2026-08-08T12:00:30.000Z',
  });
});
