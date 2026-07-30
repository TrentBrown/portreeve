// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';

const directories = new Set();

afterEach(async () => {
  await Promise.all(
    [...directories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  directories.clear();
});

function identity(service = 'website') {
  return {
    project: 'caregiver',
    workspaceRoot: '/worktrees/caregiver-a',
    service,
    transport: 'tcp',
  };
}

async function databasePath() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-registry-'));
  directories.add(directory);
  return join(directory, 'registry.sqlite');
}

describe('SQLite registry', () => {
  test('migrates once and preserves a claim across restart', async () => {
    const filename = await databasePath();
    const createdAt = new Date('2026-07-30T12:00:00.000Z');
    const first = openRegistry(filename);

    expect(first.schemaVersion()).toBe(1);
    const claim = first.insertClaim(
      {
        identity: identity(),
        mode: 'sticky',
        preferredPort: 43100,
      },
      createdAt,
    );
    first.close();

    const second = openRegistry(filename);
    expect(second.schemaVersion()).toBe(1);
    expect(second.findClaim(identity())).toEqual(claim);
    expect(second.listHistory().map(({ eventType }) => eventType)).toEqual([
      'claim.created',
    ]);
    second.close();
  });

  test('acquires, confirms, and releases while preserving a sticky assignment', () => {
    const registry = openRegistry();
    const now = new Date('2026-07-30T12:00:00.000Z');
    const claim = registry.insertClaim({ identity: identity(), mode: 'sticky' }, now);
    const acquired = registry.createPendingLease(
      {
        claimId: claim.id,
        port: 43100,
        expiresAt: '2026-07-30T12:00:30.000Z',
      },
      now,
    );

    expect(acquired.lease.state).toBe('pending');
    expect(acquired.lease.tokenHash).not.toContain(acquired.token);

    const run = registry.confirmLease(
      {
        leaseId: acquired.lease.id,
        token: acquired.token,
        rootPid: 1234,
        rootFingerprint: { startTime: '123' },
      },
      new Date('2026-07-30T12:00:01.000Z'),
    );

    expect(run.state).toBe('confirmed');
    expect(registry.getClaim(claim.id)?.assignedPort).toBe(43100);
    expect(registry.releaseRun(run.id, new Date('2026-07-30T12:00:02.000Z'))).toBe(
      true,
    );
    expect(registry.getClaim(claim.id)?.assignedPort).toBe(43100);
    expect(registry.getRun(run.id)?.state).toBe('released');
    registry.close();
  });

  test('prevents two claims from holding pending leases for one port', () => {
    const registry = openRegistry();
    const now = new Date('2026-07-30T12:00:00.000Z');
    const first = registry.insertClaim(
      { identity: identity('website'), mode: 'sticky' },
      now,
    );
    const second = registry.insertClaim(
      { identity: identity('api'), mode: 'sticky' },
      now,
    );

    registry.createPendingLease(
      {
        claimId: first.id,
        port: 43100,
        expiresAt: '2026-07-30T12:00:30.000Z',
      },
      now,
    );

    expect(() =>
      registry.createPendingLease(
        {
          claimId: second.id,
          port: 43100,
          expiresAt: '2026-07-30T12:00:30.000Z',
        },
        now,
      ),
    ).toThrow(RegistryError);
    registry.close();
  });

  test('serializes pending-port claims across database connections', async () => {
    const filename = await databasePath();
    const firstConnection = openRegistry(filename);
    const secondConnection = openRegistry(filename);
    const now = new Date('2026-07-30T12:00:00.000Z');
    const firstClaim = firstConnection.insertClaim(
      { identity: identity('website'), mode: 'sticky' },
      now,
    );
    const secondClaim = secondConnection.insertClaim(
      { identity: identity('api'), mode: 'sticky' },
      now,
    );

    firstConnection.createPendingLease(
      {
        claimId: firstClaim.id,
        port: 43100,
        expiresAt: '2026-07-30T12:00:30.000Z',
      },
      now,
    );

    expect(() =>
      secondConnection.createPendingLease(
        {
          claimId: secondClaim.id,
          port: 43100,
          expiresAt: '2026-07-30T12:00:30.000Z',
        },
        now,
      ),
    ).toThrow(RegistryError);
    firstConnection.close();
    secondConnection.close();
  });

  test('expires abandoned candidates and makes the port reusable', () => {
    const registry = openRegistry();
    const now = new Date('2026-07-30T12:00:00.000Z');
    const first = registry.insertClaim(
      { identity: identity('website'), mode: 'ephemeral' },
      now,
    );
    const second = registry.insertClaim(
      { identity: identity('api'), mode: 'ephemeral' },
      now,
    );
    const acquired = registry.createPendingLease(
      {
        claimId: first.id,
        port: 43100,
        expiresAt: '2026-07-30T12:00:30.000Z',
      },
      now,
    );

    expect(() =>
      registry.confirmLease(
        {
          leaseId: acquired.lease.id,
          token: acquired.token,
          rootPid: 1234,
        },
        new Date('2026-07-30T12:00:30.000Z'),
      ),
    ).toThrow('expired');
    expect(registry.expirePendingLeases(new Date('2026-07-30T12:00:30.000Z'))).toBe(1);

    expect(
      registry.createPendingLease(
        {
          claimId: second.id,
          port: 43100,
          expiresAt: '2026-07-30T12:01:00.000Z',
        },
        new Date('2026-07-30T12:00:31.000Z'),
      ).lease.port,
    ).toBe(43100);
    registry.close();
  });

  test('rejects corrupt persisted JSON when records are read', () => {
    const registry = openRegistry();
    registry.database
      .query(
        `INSERT INTO history_events (
           id, event_type, entity_type, entity_id, payload_json, occurred_at
         ) VALUES ($id, 'test.corrupt', 'test', 'test', '[]', $occurredAt)`,
      )
      .run({
        id: crypto.randomUUID(),
        occurredAt: '2026-07-30T12:00:00.000Z',
      });

    expect(() => registry.listHistory()).toThrow();
    registry.close();
  });

  test('refuses a database schema newer than this binary supports', async () => {
    const filename = await databasePath();
    const database = new Database(filename, { create: true });
    database.exec('PRAGMA user_version = 99');
    database.close();

    expect(() => openRegistry(filename)).toThrow('newer than supported');
  });

  test('validates and persists server settings with audit history', async () => {
    const filename = await databasePath();
    const registry = openRegistry(filename);

    expect(registry.getSettings().leaseTtlMilliseconds).toBe(15_000);
    expect(() =>
      registry.setSettings({
        ...registry.getSettings(),
        automaticPortRanges: [
          { start: 20_000, end: 30_000 },
          { start: 29_000, end: 31_000 },
        ],
      }),
    ).toThrow('must not overlap');

    const settings = registry.setSettings(
      {
        ...registry.getSettings(),
        excludedPorts: [20_080, 20_443],
        leaseTtlMilliseconds: 30_000,
      },
      new Date('2026-07-30T12:00:00.000Z'),
    );
    expect(settings.leaseTtlMilliseconds).toBe(30_000);
    registry.close();

    const reopened = openRegistry(filename);
    expect(reopened.getSettings()).toEqual(settings);
    expect(reopened.listHistory().at(-1)?.eventType).toBe('config.updated');
    reopened.close();
  });

  test('rolls back a mutation when its audit event cannot be written', () => {
    const registry = openRegistry();
    registry.database.exec(`
      CREATE TRIGGER reject_claim_history
      BEFORE INSERT ON history_events
      WHEN NEW.event_type = 'claim.created'
      BEGIN
        SELECT RAISE(ABORT, 'history unavailable');
      END
    `);

    expect(() =>
      registry.insertClaim(
        { identity: identity(), mode: 'sticky' },
        new Date('2026-07-30T12:00:00.000Z'),
      ),
    ).toThrow('history unavailable');
    expect(registry.findClaim(identity())).toBeNull();
    registry.close();
  });

  test('bounds structured history to the configured newest events', () => {
    const registry = openRegistry();
    registry.setSettings({
      ...registry.getSettings(),
      historyMaximumEvents: 100,
    });

    for (let index = 0; index < 150; index += 1) {
      registry.appendHistoryEvent(
        {
          eventType: 'test.retention',
          entityType: 'test',
          entityId: `event-${String(index)}`,
          payload: { index },
        },
        new Date(1_800_000_000_000 + index),
      );
    }

    const events = registry.listHistory({ eventType: 'test.retention' });
    expect(events).toHaveLength(100);
    expect(events[0]?.entityId).toBe('event-50');
    expect(events.at(-1)?.entityId).toBe('event-149');
    expect(registry.listHistory({ limit: 3 })).toHaveLength(3);
    registry.close();
  });

  test('treats a new pending lease as meaningful claim use for pruning age', () => {
    const registry = openRegistry();
    const claim = registry.insertClaim(
      { identity: identity('recently-used'), mode: 'sticky' },
      new Date('2026-07-01T12:00:00.000Z'),
    );
    const now = new Date('2026-07-30T12:00:00.000Z');

    registry.createPendingLease(
      {
        claimId: claim.id,
        port: 43_200,
        expiresAt: '2026-07-30T12:00:30.000Z',
      },
      now,
    );

    expect(registry.getClaim(claim.id)?.lastUsedAt).toBe(now.toISOString());
    registry.close();
  });
});
