// @ts-check

export const MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'initial-registry',
    sql: `
      CREATE TABLE claims (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        workspace_root TEXT NOT NULL,
        service TEXT NOT NULL,
        transport TEXT NOT NULL CHECK (transport = 'tcp'),
        mode TEXT NOT NULL CHECK (mode IN ('sticky', 'ephemeral')),
        assigned_port INTEGER
          CHECK (assigned_port IS NULL OR assigned_port BETWEEN 1 AND 65535),
        preferred_port INTEGER
          CHECK (preferred_port IS NULL OR preferred_port BETWEEN 1 AND 65535),
        exact_port INTEGER
          CHECK (exact_port IS NULL OR exact_port BETWEEN 1 AND 65535),
        assignment_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        CHECK (preferred_port IS NULL OR exact_port IS NULL),
        UNIQUE (project, workspace_root, service, transport)
      );

      CREATE UNIQUE INDEX claims_assigned_transport_port
        ON claims (transport, assigned_port)
        WHERE assigned_port IS NOT NULL;

      CREATE TABLE leases (
        id TEXT PRIMARY KEY,
        claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
        state TEXT NOT NULL
          CHECK (state IN ('pending', 'confirmed', 'abandoned', 'expired', 'collision')),
        token_hash TEXT NOT NULL UNIQUE
          CHECK (length(token_hash) = 64),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX leases_pending_port
        ON leases (port)
        WHERE state = 'pending';

      CREATE UNIQUE INDEX leases_pending_claim
        ON leases (claim_id)
        WHERE state = 'pending';

      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
        lease_id TEXT NOT NULL UNIQUE REFERENCES leases(id) ON DELETE RESTRICT,
        port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
        state TEXT NOT NULL CHECK (state IN ('confirmed', 'released')),
        root_pid INTEGER NOT NULL CHECK (root_pid > 0),
        root_fingerprint_json TEXT,
        confirmed_at TEXT NOT NULL,
        released_at TEXT
      );

      CREATE UNIQUE INDEX runs_confirmed_claim
        ON runs (claim_id)
        WHERE state = 'confirmed';

      CREATE TABLE listener_fingerprints (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        pid INTEGER NOT NULL CHECK (pid > 0),
        fingerprint_json TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        UNIQUE (run_id, pid, observed_at)
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE history_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );

      CREATE INDEX history_events_occurred_at
        ON history_events (occurred_at);

      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `,
  }),
]);

export const LATEST_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;

/**
 * @param {import('bun:sqlite').Database} database
 * @param {Date} now
 */
export function applyMigrations(database, now = new Date()) {
  database.exec('PRAGMA foreign_keys = ON');

  const versionRow = /** @type {{user_version: number}} */ (
    database.query('PRAGMA user_version').get()
  );
  let currentVersion = versionRow.user_version;

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema ${currentVersion} is newer than supported schema ${LATEST_SCHEMA_VERSION}.`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    const migrate = database.transaction(() => {
      database.exec(migration.sql);
      database
        .query(
          `INSERT INTO schema_migrations (version, name, applied_at)
           VALUES ($version, $name, $appliedAt)`,
        )
        .run({
          version: migration.version,
          name: migration.name,
          appliedAt: now.toISOString(),
        });
      database.exec(`PRAGMA user_version = ${migration.version}`);
    });

    migrate.immediate();
    currentVersion = migration.version;
  }

  return currentVersion;
}
