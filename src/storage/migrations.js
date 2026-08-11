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
  Object.freeze({
    version: 2,
    name: 'component-endpoint-claim-identity',
    rebuildsForeignKeyTable: true,
    sql: `
      CREATE TABLE claims_next (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        workspace_root TEXT NOT NULL,
        component TEXT NOT NULL,
        endpoint TEXT NOT NULL,
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
        UNIQUE (project, workspace_root, component, endpoint, transport)
      );

      INSERT INTO claims_next (
        id, project, workspace_root, component, endpoint, transport, mode,
        assigned_port, preferred_port, exact_port, assignment_expires_at,
        created_at, updated_at, last_used_at
      )
      SELECT
        id, project, workspace_root, service, 'default', transport, mode,
        assigned_port, preferred_port, exact_port, assignment_expires_at,
        created_at, updated_at, last_used_at
      FROM claims;

      DROP TABLE claims;
      ALTER TABLE claims_next RENAME TO claims;

      CREATE UNIQUE INDEX claims_assigned_transport_port
        ON claims (transport, assigned_port)
        WHERE assigned_port IS NOT NULL;
    `,
  }),
  Object.freeze({
    version: 3,
    name: 'stack-definitions',
    sql: `
      CREATE TABLE stacks (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        workspace_root TEXT NOT NULL,
        current_revision TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        UNIQUE (project, workspace_root)
      );

      CREATE INDEX stacks_workspace_root
        ON stacks (workspace_root);

      CREATE TABLE stack_definition_revisions (
        stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
        revision TEXT NOT NULL CHECK (length(revision) = 64),
        definition_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (stack_id, revision)
      );

      CREATE TABLE stack_endpoint_claims (
        stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
        component TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        PRIMARY KEY (stack_id, component, endpoint),
        UNIQUE (claim_id)
      );
    `,
  }),
  Object.freeze({
    version: 4,
    name: 'stack-generations-and-activations',
    sql: `
      CREATE TABLE stack_generations (
        id TEXT PRIMARY KEY,
        stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
        revision TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('valid', 'stale')),
        created_at TEXT NOT NULL,
        invalidated_at TEXT,
        FOREIGN KEY (stack_id, revision)
          REFERENCES stack_definition_revisions(stack_id, revision)
          ON DELETE RESTRICT
      );

      CREATE INDEX stack_generations_stack_revision
        ON stack_generations (stack_id, revision, created_at DESC);

      CREATE TABLE stack_generation_endpoints (
        generation_id TEXT NOT NULL
          REFERENCES stack_generations(id) ON DELETE CASCADE,
        claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
        component TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        transport TEXT NOT NULL CHECK (transport = 'tcp'),
        host TEXT NOT NULL CHECK (host = '127.0.0.1'),
        port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
        required INTEGER NOT NULL CHECK (required IN (0, 1)),
        PRIMARY KEY (generation_id, component, endpoint),
        UNIQUE (generation_id, port)
      );

      CREATE TABLE stack_activations (
        id TEXT PRIMARY KEY,
        stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
        generation_id TEXT NOT NULL
          REFERENCES stack_generations(id) ON DELETE RESTRICT,
        state TEXT NOT NULL
          CHECK (state IN ('starting', 'confirmed', 'degraded', 'failed', 'ended')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confirmed_at TEXT,
        ended_at TEXT
      );

      CREATE UNIQUE INDEX stack_activations_one_live_per_stack
        ON stack_activations (stack_id)
        WHERE state IN ('starting', 'confirmed', 'degraded');

      CREATE INDEX stack_activations_generation
        ON stack_activations (generation_id, created_at DESC);

      CREATE TABLE stack_activation_endpoints (
        activation_id TEXT NOT NULL
          REFERENCES stack_activations(id) ON DELETE CASCADE,
        component TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
        port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
        required INTEGER NOT NULL CHECK (required IN (0, 1)),
        binding_kind TEXT NOT NULL CHECK (binding_kind IN ('process', 'docker')),
        state TEXT NOT NULL
          CHECK (state IN ('leased', 'confirmed', 'skipped', 'failed', 'released')),
        lease_id TEXT UNIQUE REFERENCES leases(id) ON DELETE RESTRICT,
        run_id TEXT UNIQUE REFERENCES runs(id) ON DELETE RESTRICT,
        failure_reason TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (activation_id, component, endpoint)
      );
    `,
  }),
  Object.freeze({
    version: 5,
    name: 'docker-provider-evidence',
    rebuildsForeignKeyTable: true,
    sql: `
      CREATE TABLE runs_next (
        id TEXT PRIMARY KEY,
        claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
        lease_id TEXT NOT NULL UNIQUE REFERENCES leases(id) ON DELETE RESTRICT,
        port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
        state TEXT NOT NULL CHECK (state IN ('confirmed', 'released')),
        binding_kind TEXT NOT NULL CHECK (binding_kind IN ('process', 'docker')),
        root_pid INTEGER CHECK (root_pid IS NULL OR root_pid > 0),
        root_fingerprint_json TEXT,
        container_id TEXT,
        provider_evidence_json TEXT,
        confirmed_at TEXT NOT NULL,
        released_at TEXT,
        CHECK (
          (binding_kind = 'process' AND root_pid IS NOT NULL AND container_id IS NULL)
          OR
          (binding_kind = 'docker' AND root_pid IS NULL AND container_id IS NOT NULL)
        )
      );

      INSERT INTO runs_next (
        id, claim_id, lease_id, port, state, binding_kind, root_pid,
        root_fingerprint_json, container_id, provider_evidence_json,
        confirmed_at, released_at
      )
      SELECT
        id, claim_id, lease_id, port, state, 'process', root_pid,
        root_fingerprint_json, NULL, NULL, confirmed_at, released_at
      FROM runs;

      DROP TABLE runs;
      ALTER TABLE runs_next RENAME TO runs;

      CREATE UNIQUE INDEX runs_confirmed_claim
        ON runs (claim_id)
        WHERE state = 'confirmed';

      CREATE INDEX runs_confirmed_container
        ON runs (container_id)
        WHERE state = 'confirmed' AND binding_kind = 'docker';
    `,
  }),
  Object.freeze({
    version: 6,
    name: 'lost-stack-activations',
    rebuildsForeignKeyTable: true,
    sql: `
      CREATE TABLE stack_activations_next (
        id TEXT PRIMARY KEY,
        stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
        generation_id TEXT NOT NULL
          REFERENCES stack_generations(id) ON DELETE RESTRICT,
        state TEXT NOT NULL
          CHECK (
            state IN (
              'starting', 'confirmed', 'degraded', 'failed', 'lost', 'ended'
            )
          ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confirmed_at TEXT,
        ended_at TEXT
      );

      INSERT INTO stack_activations_next (
        id, stack_id, generation_id, state, created_at, updated_at,
        confirmed_at, ended_at
      )
      SELECT
        id, stack_id, generation_id, state, created_at, updated_at,
        confirmed_at, ended_at
      FROM stack_activations;

      DROP TABLE stack_activations;
      ALTER TABLE stack_activations_next RENAME TO stack_activations;

      CREATE UNIQUE INDEX stack_activations_one_live_per_stack
        ON stack_activations (stack_id)
        WHERE state IN ('starting', 'confirmed', 'degraded');

      CREATE INDEX stack_activations_generation
        ON stack_activations (generation_id, created_at DESC);
    `,
  }),
  Object.freeze({
    version: 7,
    name: 'launcher-operation-coordination',
    sql: `
      CREATE TABLE launcher_operations (
        id TEXT PRIMARY KEY,
        stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
        operation TEXT NOT NULL
          CHECK (operation IN ('start', 'stop', 'restart', 'status')),
        execution_mode TEXT NOT NULL
          CHECK (execution_mode IN ('finite', 'attached')),
        launcher_revision TEXT NOT NULL CHECK (length(launcher_revision) = 64),
        caller_operation_id TEXT NOT NULL,
        generation_id TEXT REFERENCES stack_generations(id) ON DELETE SET NULL,
        state TEXT NOT NULL CHECK (state IN ('active', 'terminal')),
        credential_hash TEXT NOT NULL UNIQUE CHECK (length(credential_hash) = 64),
        deadline_at TEXT NOT NULL,
        started_at TEXT NOT NULL,
        renewed_at TEXT NOT NULL,
        completed_at TEXT,
        completion_json TEXT,
        CHECK (execution_mode = 'finite' OR operation = 'start'),
        CHECK (
          (state = 'active' AND completed_at IS NULL AND completion_json IS NULL)
          OR
          (state = 'terminal' AND completed_at IS NOT NULL AND completion_json IS NOT NULL)
        ),
        UNIQUE (stack_id, caller_operation_id)
      );

      CREATE INDEX launcher_operations_stack_recent
        ON launcher_operations (stack_id, started_at DESC);

      CREATE INDEX launcher_operations_active_deadline
        ON launcher_operations (deadline_at)
        WHERE state = 'active';
    `,
  }),
  Object.freeze({
    version: 8,
    name: 'mcp-protocol-foundations',
    sql: `
      ALTER TABLE history_events ADD COLUMN origin_json TEXT;

      CREATE INDEX history_events_stable_order
        ON history_events (occurred_at DESC, id DESC);

      CREATE TABLE action_receipts (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        evidence_hash TEXT NOT NULL CHECK (length(evidence_hash) = 64),
        idempotency_key TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
        result_json TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        CHECK (
          (state = 'pending' AND result_json IS NULL AND completed_at IS NULL)
          OR
          (state = 'completed' AND result_json IS NOT NULL AND completed_at IS NOT NULL)
        )
      );

      CREATE INDEX action_receipts_expiry
        ON action_receipts (expires_at)
        WHERE state = 'pending';
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

    const rebuildsForeignKeyTable =
      'rebuildsForeignKeyTable' in migration &&
      migration.rebuildsForeignKeyTable === true;
    if (rebuildsForeignKeyTable) {
      database.exec('PRAGMA foreign_keys = OFF');
    }
    try {
      const migrate = database.transaction(() => {
        database.exec(migration.sql);
        if (rebuildsForeignKeyTable) {
          const violations = database.query('PRAGMA foreign_key_check').all();
          if (violations.length > 0) {
            throw new Error(
              `Migration ${migration.version} introduced foreign key violations.`,
            );
          }
        }
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
    } finally {
      if (rebuildsForeignKeyTable) {
        database.exec('PRAGMA foreign_keys = ON');
      }
    }
    currentVersion = migration.version;
  }

  return currentVersion;
}
