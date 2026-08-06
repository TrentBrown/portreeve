// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';
import { MIGRATIONS } from '../../src/storage/migrations.js';

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

    expect(first.schemaVersion()).toBe(4);
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
    expect(second.schemaVersion()).toBe(4);
    expect(second.findClaim(identity())).toEqual(claim);
    expect(second.listHistory().map(({ eventType }) => eventType)).toEqual([
      'claim.created',
    ]);
    second.close();
  });

  test('migrates version-1 claims and their relationships to default endpoints', async () => {
    const filename = await databasePath();
    const database = new Database(filename, { create: true, strict: true });
    const initialMigration = MIGRATIONS.at(0);
    if (initialMigration === undefined) throw new Error('missing initial migration');
    database.exec('PRAGMA foreign_keys = ON');
    database.exec(initialMigration.sql);
    database.exec(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (1, 'initial-registry', '2026-07-30T12:00:00.000Z');
      PRAGMA user_version = 1;
      INSERT INTO claims (
        id, project, workspace_root, service, transport, mode,
        assigned_port, preferred_port, exact_port, assignment_expires_at,
        created_at, updated_at, last_used_at
      ) VALUES (
        '11111111-1111-4111-8111-111111111111', 'caregiver',
        '/worktrees/caregiver-a', 'website', 'tcp', 'sticky',
        43100, 43100, NULL, NULL,
        '2026-07-30T12:00:00.000Z', '2026-07-30T12:00:01.000Z',
        '2026-07-30T12:00:01.000Z'
      );
      INSERT INTO leases (
        id, claim_id, port, state, token_hash, expires_at, created_at, updated_at
      ) VALUES (
        '22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111', 43100, 'confirmed',
        '${'a'.repeat(64)}', '2026-07-30T12:01:00.000Z',
        '2026-07-30T12:00:00.000Z', '2026-07-30T12:00:01.000Z'
      );
      INSERT INTO runs (
        id, claim_id, lease_id, port, state, root_pid, root_fingerprint_json,
        confirmed_at, released_at
      ) VALUES (
        '33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222', 43100, 'released', 1234,
        '{"pid":1234}', '2026-07-30T12:00:01.000Z',
        '2026-07-30T12:00:02.000Z'
      );
      INSERT INTO listener_fingerprints (
        id, run_id, pid, fingerprint_json, observed_at
      ) VALUES (
        '44444444-4444-4444-8444-444444444444',
        '33333333-3333-4333-8333-333333333333', 1234,
        '{"pid":1234}', '2026-07-30T12:00:01.000Z'
      );
      INSERT INTO history_events (
        id, event_type, entity_type, entity_id, payload_json, occurred_at
      ) VALUES (
        '55555555-5555-4555-8555-555555555555', 'claim.created', 'claim',
        '11111111-1111-4111-8111-111111111111', '{"legacy":true}',
        '2026-07-30T12:00:00.000Z'
      );
    `);
    database.close();

    const registry = openRegistry(filename);
    expect(registry.schemaVersion()).toBe(4);
    expect(registry.getClaim('11111111-1111-4111-8111-111111111111')).toMatchObject({
      identity: {
        service: 'website',
        component: 'website',
        endpoint: 'default',
      },
      assignedPort: 43100,
    });
    expect(registry.getLease('22222222-2222-4222-8222-222222222222')?.claimId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(registry.getRun('33333333-3333-4333-8333-333333333333')?.claimId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(
      registry.listListenerFingerprintsForRun('33333333-3333-4333-8333-333333333333'),
    ).toHaveLength(1);
    expect(registry.listHistory()).toHaveLength(1);
    expect(registry.database.query('PRAGMA foreign_key_check').all()).toEqual([]);
    registry.close();
  });

  test('allows multiple named endpoints for one component', () => {
    const registry = openRegistry();
    const base = {
      project: 'caregiver',
      workspaceRoot: '/worktrees/caregiver-a',
      component: 'api',
      transport: /** @type {'tcp'} */ ('tcp'),
    };
    const http = registry.insertClaim({
      identity: { ...base, endpoint: 'http' },
      mode: 'sticky',
    });
    const metrics = registry.insertClaim({
      identity: { ...base, endpoint: 'metrics' },
      mode: 'sticky',
    });

    expect(http.id).not.toBe(metrics.id);
    expect(registry.findClaim({ ...base, endpoint: 'http' })?.id).toBe(http.id);
    expect(registry.findClaim({ ...base, endpoint: 'metrics' })?.id).toBe(metrics.id);
    registry.close();
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
