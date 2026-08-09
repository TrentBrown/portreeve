// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LauncherOperationService } from '../../src/launcher/operation-service.js';
import { StackDefinitionService } from '../../src/stacks/service.js';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';

const client = {
  softwareVersion: '0.1.0',
  protocol: { minimum: 1, maximum: 1 },
  requiredCapabilities: ['launcher-operations-v1'],
};
const launcherRevision = 'a'.repeat(64);
const directories = new Set();

afterEach(async () => {
  await Promise.all(
    [...directories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  directories.clear();
});

/** @param {import('../../src/storage/registry.js').Registry} registry @param {string} project @param {string} stackRoot */
function applyStack(registry, project, stackRoot) {
  return new StackDefinitionService({ registry }).apply({
    client,
    stackRoot,
    definition: {
      version: 1,
      project,
      components: { api: { endpoints: { default: {} } } },
    },
  }).stack;
}

function harness() {
  const registry = openRegistry();
  let now = new Date('2026-08-08T12:00:00.000Z');
  const service = new LauncherOperationService({ registry, now: () => now });
  const first = applyStack(registry, 'first', '/stacks/first');
  const second = applyStack(registry, 'second', '/stacks/second');
  /** @param {Date} value */
  const setNow = (value) => {
    now = value;
  };
  return {
    registry,
    service,
    first,
    second,
    now: () => now,
    setNow,
  };
}

/** @param {LauncherOperationService} service @param {string} stackId @param {Partial<{operation: 'start' | 'stop' | 'restart' | 'status', executionMode: 'finite' | 'attached', callerOperationId: string}>} [options] */
function begin(service, stackId, options = {}) {
  return service.begin({
    client,
    stackId,
    operation: options.operation ?? 'start',
    executionMode: options.executionMode ?? 'finite',
    launcherRevision,
    callerOperationId: options.callerOperationId ?? crypto.randomUUID(),
    generationId: null,
  });
}

test('issues a renewable credential while persisting only its hash', () => {
  const fixture = harness();
  try {
    const begun = begin(fixture.service, fixture.first.id);
    expect(begun.operation).toMatchObject({
      stackId: fixture.first.id,
      stackRoot: '/stacks/first',
      state: 'active',
      outcome: null,
      deadlineAt: '2026-08-08T12:00:30.000Z',
    });
    expect(begun.renewAfterMilliseconds).toBe(10_000);
    const stored = /** @type {{credential_hash: string}} */ (
      fixture.registry.database
        .query('SELECT credential_hash FROM launcher_operations WHERE id = $id')
        .get({ id: begun.operation.id })
    );
    expect(stored.credential_hash).toHaveLength(64);
    expect(stored.credential_hash).not.toContain(begun.credential);

    fixture.setNow(new Date('2026-08-08T12:00:10.000Z'));
    expect(
      fixture.service.renew(begun.operation.id, {
        client,
        credential: begun.credential,
      }).operation,
    ).toMatchObject({
      renewedAt: '2026-08-08T12:00:10.000Z',
      deadlineAt: '2026-08-08T12:00:40.000Z',
    });
  } finally {
    fixture.registry.close();
  }
});

test('completes idempotently only with identical strict safe metadata', () => {
  const fixture = harness();
  try {
    const begun = begin(fixture.service, fixture.first.id, { operation: 'status' });
    const completion = {
      outcome: /** @type {const} */ ('succeeded'),
      exitCode: 0,
      degraded: false,
      afterEvidence: {
        classification: /** @type {const} */ ('fully-observed'),
        source: /** @type {const} */ ('daemon'),
        observedAt: '2026-08-08T12:00:05.000Z',
        generationId: null,
        activationId: null,
        listenerCount: 2,
        reasonCodes: [],
      },
      integration: {
        mode: /** @type {const} */ ('command-only'),
        verified: true,
        upgradeSuggested: true,
        generationId: crypto.randomUUID(),
        activationId: crypto.randomUUID(),
      },
    };
    fixture.setNow(new Date('2026-08-08T12:00:05.000Z'));
    const first = fixture.service.complete(begun.operation.id, {
      client,
      credential: begun.credential,
      completion,
    });
    expect(first).toMatchObject({
      changed: true,
      operation: {
        state: 'terminal',
        outcome: 'succeeded',
        durationMilliseconds: 5_000,
        exitCode: 0,
        integration: completion.integration,
      },
    });
    expect(
      fixture.service.complete(begun.operation.id, {
        client,
        credential: begun.credential,
        completion,
      }).changed,
    ).toBe(false);
    expect(() =>
      fixture.service.complete(begun.operation.id, {
        client,
        credential: begun.credential,
        completion: { ...completion, outcome: 'failed' },
      }),
    ).toThrow(RegistryError);
    expect(() =>
      fixture.service.complete(begun.operation.id, {
        client,
        credential: begun.credential,
        completion: { ...completion, rawOutput: 'must never persist' },
      }),
    ).toThrow();
  } finally {
    fixture.registry.close();
  }
});

test('serializes a root while permitting different roots and attached companions', () => {
  const fixture = harness();
  try {
    const attached = begin(fixture.service, fixture.first.id, {
      executionMode: 'attached',
    });
    const otherRoot = begin(fixture.service, fixture.second.id);
    expect(otherRoot.operation.state).toBe('active');
    const status = begin(fixture.service, fixture.first.id, { operation: 'status' });
    expect(status.operation.operation).toBe('status');
    expect(() =>
      begin(fixture.service, fixture.first.id, { operation: 'stop' }),
    ).toThrow(RegistryError);
    fixture.service.complete(status.operation.id, {
      client,
      credential: status.credential,
      completion: { outcome: 'succeeded', exitCode: 0 },
    });
    expect(
      begin(fixture.service, fixture.first.id, { operation: 'stop' }).operation,
    ).toMatchObject({ operation: 'stop', executionMode: 'finite' });
    expect(() =>
      begin(fixture.service, fixture.first.id, { operation: 'restart' }),
    ).toThrow(RegistryError);
    expect(attached.operation.executionMode).toBe('attached');
  } finally {
    fixture.registry.close();
  }
});

test('enforces root admission across independent database connections', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-concurrency-'));
  directories.add(directory);
  const filename = join(directory, 'registry.sqlite');
  const firstRegistry = openRegistry(filename);
  const firstStack = applyStack(firstRegistry, 'first-db', '/stacks/first-db');
  const secondStack = applyStack(firstRegistry, 'second-db', '/stacks/second-db');
  const secondRegistry = openRegistry(filename);
  const now = () => new Date('2026-08-08T12:00:00.000Z');
  const firstService = new LauncherOperationService({
    registry: firstRegistry,
    now,
  });
  const secondService = new LauncherOperationService({
    registry: secondRegistry,
    now,
  });
  try {
    begin(firstService, firstStack.id);
    expect(() => begin(secondService, firstStack.id)).toThrow(RegistryError);
    expect(begin(secondService, secondStack.id).operation.stackId).toBe(secondStack.id);
  } finally {
    secondRegistry.close();
    firstRegistry.close();
  }
});

test('blocks stack mutation and deletion while launcher work is active', () => {
  const fixture = harness();
  try {
    const session = begin(fixture.service, fixture.first.id);
    expect(() =>
      new StackDefinitionService({
        registry: fixture.registry,
        now: fixture.now,
      }).apply({
        client,
        stackRoot: fixture.first.stackRoot,
        definition: {
          version: 1,
          project: fixture.first.project,
          components: {
            api: { endpoints: { default: {}, metrics: { required: false } } },
          },
        },
      }),
    ).toThrow(RegistryError);
    expect(() => fixture.registry.deleteStack(fixture.first.id, fixture.now())).toThrow(
      RegistryError,
    );
    fixture.service.complete(session.operation.id, {
      client,
      credential: session.credential,
      completion: { outcome: 'succeeded', exitCode: 0 },
    });
    expect(
      new StackDefinitionService({
        registry: fixture.registry,
        now: fixture.now,
      }).apply({
        client,
        stackRoot: fixture.first.stackRoot,
        definition: {
          version: 1,
          project: fixture.first.project,
          components: {
            api: { endpoints: { default: {}, metrics: { required: false } } },
          },
        },
      }).changed,
    ).toBe(true);
  } finally {
    fixture.registry.close();
  }
});

test('rolls back terminal state when its audit event cannot be written', () => {
  const fixture = harness();
  try {
    const session = begin(fixture.service, fixture.first.id);
    fixture.registry.database.exec(`
      CREATE TRIGGER reject_launcher_completion_history
      BEFORE INSERT ON history_events
      WHEN NEW.event_type = 'launcher.operation.completed'
      BEGIN
        SELECT RAISE(ABORT, 'launcher history unavailable');
      END;
    `);
    expect(() =>
      fixture.service.complete(session.operation.id, {
        client,
        credential: session.credential,
        completion: { outcome: 'succeeded', exitCode: 0 },
      }),
    ).toThrow('launcher history unavailable');
    expect(fixture.service.get(session.operation.id)).toMatchObject({
      state: 'active',
      outcome: null,
    });
  } finally {
    fixture.registry.close();
  }
});

test('expires abandoned sessions to lost and recovers that state after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-operation-'));
  directories.add(directory);
  const filename = join(directory, 'registry.sqlite');
  let registry = openRegistry(filename);
  const stack = applyStack(registry, 'restart', '/stacks/restart');
  const firstService = new LauncherOperationService({
    registry,
    now: () => new Date('2026-08-08T12:00:00.000Z'),
  });
  const begun = begin(firstService, stack.id);
  registry.close();

  registry = openRegistry(filename);
  try {
    const restarted = new LauncherOperationService({
      registry,
      now: () => new Date('2026-08-08T12:00:31.000Z'),
    });
    expect(restarted.expire()).toBe(1);
    expect(restarted.get(begun.operation.id)).toMatchObject({
      state: 'terminal',
      outcome: 'lost',
      completedAt: '2026-08-08T12:00:30.000Z',
      durationMilliseconds: 30_000,
      failure: { step: 'coordination', code: 'client_lost' },
    });
    expect(
      registry
        .listHistory({ entityType: 'launcher-operation' })
        .map(({ eventType }) => eventType),
    ).toEqual(['launcher.operation.began', 'launcher.operation.lost']);
  } finally {
    registry.close();
  }
});

test('retains only the latest twenty terminal records per stack', () => {
  const fixture = harness();
  try {
    const operationIds = [];
    for (let index = 0; index < 21; index += 1) {
      fixture.setNow(new Date(Date.UTC(2026, 7, 8, 12, 0, index)));
      const session = begin(fixture.service, fixture.first.id, {
        operation: 'status',
      });
      operationIds.push(session.operation.id);
      fixture.service.complete(session.operation.id, {
        client,
        credential: session.credential,
        completion: { outcome: 'succeeded', exitCode: 0 },
      });
    }
    const recent = fixture.service.recent(fixture.first.id);
    expect(recent).toHaveLength(20);
    expect(recent.map(({ id }) => id)).not.toContain(operationIds[0]);
    expect(recent[0]?.id).toBe(operationIds.at(-1));
  } finally {
    fixture.registry.close();
  }
});
