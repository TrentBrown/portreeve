// @ts-check

import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import {
  ClaimRecordSchema,
  HistoryEventSchema,
  LeaseRecordSchema,
  RunRecordSchema,
} from '../domain/schemas.js';
import { createLeaseToken, verifyLeaseToken } from '../domain/lease-token.js';
import { DEFAULT_SERVER_SETTINGS, ServerSettingsSchema } from '../domain/settings.js';
import { hasExpired, toTimestamp } from '../domain/time.js';
import {
  ClaimIdentitySchema,
  ClaimModeSchema,
  IdentifierSchema,
  PortSchema,
  StackDefinitionSchema,
  StackRecordSchema,
  TimestampSchema,
} from '../protocol/schemas.js';
import { applyMigrations } from './migrations.js';

/** @typedef {import('zod').infer<typeof LeaseRecordSchema>} LeaseRecord */

const ClaimRowSchema = z.object({
  id: IdentifierSchema,
  project: z.string(),
  workspace_root: z.string(),
  component: z.string(),
  endpoint: z.string(),
  transport: z.literal('tcp'),
  mode: ClaimModeSchema,
  assigned_port: PortSchema.nullable(),
  preferred_port: PortSchema.nullable(),
  exact_port: PortSchema.nullable(),
  assignment_expires_at: TimestampSchema.nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  last_used_at: TimestampSchema,
});

const LeaseRowSchema = z.object({
  id: IdentifierSchema,
  claim_id: IdentifierSchema,
  port: PortSchema,
  state: z.enum(['pending', 'confirmed', 'abandoned', 'expired', 'collision']),
  token_hash: z.string(),
  expires_at: TimestampSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

const RunRowSchema = z.object({
  id: IdentifierSchema,
  claim_id: IdentifierSchema,
  lease_id: IdentifierSchema,
  port: PortSchema,
  state: z.enum(['confirmed', 'released']),
  root_pid: z.number().int().positive(),
  root_fingerprint_json: z.string().nullable(),
  confirmed_at: TimestampSchema,
  released_at: TimestampSchema.nullable(),
});

const StackRowSchema = z.object({
  id: IdentifierSchema,
  project: z.string(),
  workspace_root: z.string(),
  current_revision: z.string().regex(/^[a-f0-9]{64}$/),
  definition_json: z.string(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  last_used_at: TimestampSchema,
});

export class RegistryError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.details = details;
  }
}

export class Registry {
  /**
   * @param {Database} database
   */
  constructor(database) {
    this.database = database;
  }

  close() {
    this.database.close();
  }

  schemaVersion() {
    const row = /** @type {{user_version: number}} */ (
      this.database.query('PRAGMA user_version').get()
    );
    return row.user_version;
  }

  /**
   * @param {unknown} identity
   */
  findClaim(identity) {
    const parsed = ClaimIdentitySchema.parse(identity);
    const row = this.database
      .query(
        `SELECT * FROM claims
         WHERE project = $project
           AND workspace_root = $workspaceRoot
           AND component = $component
           AND endpoint = $endpoint
           AND transport = $transport`,
      )
      .get({
        project: parsed.project,
        workspaceRoot: parsed.workspaceRoot,
        component: parsed.component,
        endpoint: parsed.endpoint,
        transport: parsed.transport,
      });

    return row === null ? null : claimFromRow(row);
  }

  /**
   * @param {{
   *   identity: unknown,
   *   mode: unknown,
   *   preferredPort?: unknown,
   *   exactPort?: unknown
   * }} input
   * @param {Date} [now]
   */
  insertClaim(input, now = new Date()) {
    const identity = ClaimIdentitySchema.parse(input.identity);
    const mode = ClaimModeSchema.parse(input.mode);
    const preferredPort =
      input.preferredPort === undefined ? null : PortSchema.parse(input.preferredPort);
    const exactPort =
      input.exactPort === undefined ? null : PortSchema.parse(input.exactPort);

    if (preferredPort !== null && exactPort !== null) {
      throw new RegistryError(
        'invalid_input',
        'preferredPort and exactPort are mutually exclusive.',
      );
    }

    const id = randomUUID();
    const timestamp = toTimestamp(now);

    const insert = this.database.transaction(() => {
      this.database
        .query(
          `INSERT INTO claims (
             id, project, workspace_root, component, endpoint, transport, mode,
             assigned_port, preferred_port, exact_port, assignment_expires_at,
             created_at, updated_at, last_used_at
           ) VALUES (
             $id, $project, $workspaceRoot, $component, $endpoint, $transport, $mode,
             NULL, $preferredPort, $exactPort, NULL,
             $timestamp, $timestamp, $timestamp
           )`,
        )
        .run({
          id: id,
          project: identity.project,
          workspaceRoot: identity.workspaceRoot,
          component: identity.component,
          endpoint: identity.endpoint,
          transport: identity.transport,
          mode: mode,
          preferredPort: preferredPort,
          exactPort: exactPort,
          timestamp: timestamp,
        });

      this.#appendHistory(
        'claim.created',
        'claim',
        id,
        { identity, mode, preferredPort, exactPort },
        timestamp,
      );
    });

    insert.immediate();

    const claim = this.getClaim(id);
    if (claim === null) {
      throw new RegistryError('internal', `Claim ${id} disappeared after creation.`);
    }
    return claim;
  }

  /**
   * @param {string} claimId
   */
  getClaim(claimId) {
    const id = IdentifierSchema.parse(claimId);
    const row = this.database
      .query('SELECT * FROM claims WHERE id = $id')
      .get({ id: id });

    return row === null ? null : claimFromRow(row);
  }

  listClaims() {
    return this.database
      .query(
        'SELECT * FROM claims ORDER BY project, workspace_root, component, endpoint',
      )
      .all()
      .map(claimFromRow);
  }

  /**
   * @param {{project?: string, workspaceRoot?: string}} [filters]
   */
  listStacks(filters = {}) {
    const clauses = [];
    /** @type {Record<string, string>} */
    const parameters = {};
    if (filters.project !== undefined) {
      clauses.push('stacks.project = $project');
      parameters.project = filters.project;
    }
    if (filters.workspaceRoot !== undefined) {
      clauses.push('stacks.workspace_root = $workspaceRoot');
      parameters.workspaceRoot = filters.workspaceRoot;
    }
    const where = clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`;
    return this.database
      .query(
        `SELECT stacks.*, stack_definition_revisions.definition_json
         FROM stacks
         JOIN stack_definition_revisions
           ON stack_definition_revisions.stack_id = stacks.id
          AND stack_definition_revisions.revision = stacks.current_revision
         ${where}
         ORDER BY stacks.project, stacks.workspace_root`,
      )
      .all(parameters)
      .map(stackFromRow);
  }

  /** @param {string} stackId */
  getStack(stackId) {
    const id = IdentifierSchema.parse(stackId);
    const row = this.database
      .query(
        `SELECT stacks.*, stack_definition_revisions.definition_json
         FROM stacks
         JOIN stack_definition_revisions
           ON stack_definition_revisions.stack_id = stacks.id
          AND stack_definition_revisions.revision = stacks.current_revision
         WHERE stacks.id = $id`,
      )
      .get({ id });
    return row === null ? null : stackFromRow(row);
  }

  /**
   * @param {{
   *   project: string,
   *   workspaceRoot: string,
   *   revision: string,
   *   definitionJson: string,
   *   definition: unknown
   * }} input
   * @param {Date} [now]
   */
  applyStackDefinition(input, now = new Date()) {
    const definition = StackDefinitionSchema.parse(input.definition);
    const project = z.string().min(1).parse(input.project);
    const workspaceRoot = z.string().min(1).parse(input.workspaceRoot);
    const revision = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.revision);
    const definitionJson = z.string().min(1).parse(input.definitionJson);
    if (definition.project !== project) {
      throw new RegistryError(
        'invalid_input',
        'Stack definition project does not match the requested project.',
        { project, definitionProject: definition.project },
      );
    }
    const persistedDefinition = StackDefinitionSchema.parse(JSON.parse(definitionJson));
    if (!isDeepStrictEqual(definition, persistedDefinition)) {
      throw new RegistryError(
        'invalid_input',
        'Normalized stack definition JSON does not match the definition.',
      );
    }
    const timestamp = toTimestamp(now);
    let stackId = '';
    let changed = false;

    const apply = this.database.transaction(() => {
      const existing = /** @type {{id: string, current_revision: string}|null} */ (
        this.database
          .query(
            `SELECT id, current_revision FROM stacks
             WHERE project = $project AND workspace_root = $workspaceRoot`,
          )
          .get({ project, workspaceRoot })
      );
      stackId = existing?.id ?? randomUUID();
      changed = existing === null || existing.current_revision !== revision;
      if (!changed) return;

      const endpointClaims = [];
      for (const [component, componentDefinition] of Object.entries(
        definition.components,
      )) {
        for (const [endpoint, endpointDefinition] of Object.entries(
          componentDefinition.endpoints,
        )) {
          if (!endpointDefinition.publish) continue;
          const identity = ClaimIdentitySchema.parse({
            project,
            workspaceRoot,
            component,
            endpoint,
            transport: endpointDefinition.transport,
          });
          const row = this.database
            .query(
              `SELECT * FROM claims
               WHERE project = $project
                 AND workspace_root = $workspaceRoot
                 AND component = $component
                 AND endpoint = $endpoint
                 AND transport = $transport`,
            )
            .get({
              project,
              workspaceRoot,
              component,
              endpoint,
              transport: identity.transport,
            });
          const claim = row === null ? null : claimFromRow(row);
          if (claim !== null && claim.mode !== 'sticky') {
            throw new RegistryError(
              'conflict',
              `Stack endpoint ${component}.${endpoint} matches an ephemeral claim.`,
              { claimId: claim.id, component, endpoint, reason: 'claim_mode' },
            );
          }
          const exactPort = endpointDefinition.allocation.exactPort ?? null;
          const preferredPort = endpointDefinition.allocation.preferredPort ?? null;
          if (
            claim?.assignedPort !== null &&
            claim?.assignedPort !== undefined &&
            exactPort !== null &&
            claim.assignedPort !== exactPort
          ) {
            throw new RegistryError(
              'conflict',
              `Stack endpoint ${component}.${endpoint} requires port ${exactPort}, but its claim is assigned ${claim.assignedPort}.`,
              {
                claimId: claim.id,
                component,
                endpoint,
                assignedPort: claim.assignedPort,
                exactPort,
                reason: 'exact_port_mismatch',
              },
            );
          }
          if (exactPort !== null) {
            const assigned = /** @type {{id: string}|null} */ (
              this.database
                .query(
                  `SELECT id FROM claims
                   WHERE transport = 'tcp'
                     AND assigned_port = $exactPort
                     AND id != $claimId`,
                )
                .get({ exactPort, claimId: claim?.id ?? '' })
            );
            if (assigned !== null) {
              throw new RegistryError(
                'conflict',
                `Exact port ${exactPort} is assigned to another claim.`,
                { exactPort, claimId: assigned.id, reason: 'port_assigned' },
              );
            }
          }
          endpointClaims.push({
            identity,
            claim,
            component,
            endpoint,
            preferredPort,
            exactPort,
          });
        }
      }

      if (existing === null) {
        this.database
          .query(
            `INSERT INTO stacks (
               id, project, workspace_root, current_revision,
               created_at, updated_at, last_used_at
             ) VALUES (
               $id, $project, $workspaceRoot, $revision,
               $timestamp, $timestamp, $timestamp
             )`,
          )
          .run({
            id: stackId,
            project,
            workspaceRoot,
            revision,
            timestamp,
          });
      } else {
        this.database
          .query(
            `UPDATE stacks
             SET current_revision = $revision,
                 updated_at = $timestamp,
                 last_used_at = $timestamp
             WHERE id = $stackId`,
          )
          .run({ stackId, revision, timestamp });
      }

      this.database
        .query(
          `INSERT INTO stack_definition_revisions (
             stack_id, revision, definition_json, created_at
           ) VALUES ($stackId, $revision, $definitionJson, $timestamp)
           ON CONFLICT (stack_id, revision) DO NOTHING`,
        )
        .run({ stackId, revision, definitionJson, timestamp });

      this.database
        .query('DELETE FROM stack_endpoint_claims WHERE stack_id = $stackId')
        .run({ stackId });
      for (const endpointClaim of endpointClaims) {
        let claimId = endpointClaim.claim?.id;
        if (claimId === undefined) {
          claimId = randomUUID();
          this.database
            .query(
              `INSERT INTO claims (
                 id, project, workspace_root, component, endpoint, transport, mode,
                 assigned_port, preferred_port, exact_port, assignment_expires_at,
                 created_at, updated_at, last_used_at
               ) VALUES (
                 $id, $project, $workspaceRoot, $component, $endpoint, $transport,
                 'sticky', NULL, $preferredPort, $exactPort, NULL,
                 $timestamp, $timestamp, $timestamp
               )`,
            )
            .run({
              id: claimId,
              project,
              workspaceRoot,
              component: endpointClaim.component,
              endpoint: endpointClaim.endpoint,
              transport: endpointClaim.identity.transport,
              preferredPort: endpointClaim.preferredPort,
              exactPort: endpointClaim.exactPort,
              timestamp,
            });
          this.#appendHistory(
            'claim.created',
            'claim',
            claimId,
            {
              identity: endpointClaim.identity,
              mode: 'sticky',
              preferredPort: endpointClaim.preferredPort,
              exactPort: endpointClaim.exactPort,
              source: 'stack-definition',
            },
            timestamp,
          );
        } else {
          this.database
            .query(
              `UPDATE claims
               SET preferred_port = $preferredPort,
                   exact_port = $exactPort,
                   updated_at = $timestamp,
                   last_used_at = $timestamp
               WHERE id = $claimId`,
            )
            .run({
              claimId,
              preferredPort: endpointClaim.preferredPort,
              exactPort: endpointClaim.exactPort,
              timestamp,
            });
        }
        this.database
          .query(
            `INSERT INTO stack_endpoint_claims (
               stack_id, component, endpoint, claim_id
             ) VALUES ($stackId, $component, $endpoint, $claimId)`,
          )
          .run({
            stackId,
            component: endpointClaim.component,
            endpoint: endpointClaim.endpoint,
            claimId,
          });
      }

      this.#appendHistory(
        existing === null ? 'stack.created' : 'stack.definition.applied',
        'stack',
        stackId,
        { project, workspaceRoot, revision },
        timestamp,
      );
    });
    apply.immediate();

    const stack = this.getStack(stackId);
    if (stack === null) {
      throw new RegistryError('internal', `Stack ${stackId} disappeared after apply.`);
    }
    return { changed, stack };
  }

  /**
   * @param {{claimId: string, port: number, expiresAt: string}} input
   * @param {Date} [now]
   */
  createPendingLease(input, now = new Date()) {
    const claimId = IdentifierSchema.parse(input.claimId);
    const port = PortSchema.parse(input.port);
    const expiresAt = TimestampSchema.parse(input.expiresAt);
    const timestamp = toTimestamp(now);

    if (hasExpired(expiresAt, now)) {
      throw new RegistryError(
        'lease_expired',
        'A pending lease must expire in the future.',
      );
    }

    const id = randomUUID();
    const { token, tokenHash } = createLeaseToken();

    const create = this.database.transaction(() => {
      const claim = this.getClaim(claimId);
      if (claim === null) {
        throw new RegistryError('not_found', `Claim ${claimId} was not found.`);
      }

      const claimPending = this.database
        .query(
          `SELECT id, port FROM leases
           WHERE claim_id = $claimId AND state = 'pending'`,
        )
        .get({ claimId });
      if (claimPending !== null) {
        throw new RegistryError(
          'conflict',
          `Claim ${claimId} already has a pending lease.`,
          { claimId, reason: 'claim_pending' },
        );
      }

      const assigned = this.database
        .query(
          `SELECT id FROM claims
           WHERE transport = 'tcp'
             AND assigned_port = $port
             AND id != $claimId`,
        )
        .get({ port: port, claimId: claimId });
      if (assigned !== null) {
        throw new RegistryError(
          'conflict',
          `Port ${port} is assigned to another claim.`,
          { port, reason: 'port_assigned' },
        );
      }

      const pending = this.database
        .query(
          `SELECT id FROM leases
           WHERE port = $port AND state = 'pending'`,
        )
        .get({ port: port });
      if (pending !== null) {
        throw new RegistryError(
          'conflict',
          `Port ${port} already has a pending lease.`,
          { port, reason: 'port_pending' },
        );
      }

      this.database
        .query(
          `INSERT INTO leases (
             id, claim_id, port, state, token_hash,
             expires_at, created_at, updated_at
           ) VALUES (
             $id, $claimId, $port, 'pending', $tokenHash,
             $expiresAt, $timestamp, $timestamp
           )`,
        )
        .run({
          id: id,
          claimId: claimId,
          port: port,
          tokenHash: tokenHash,
          expiresAt: expiresAt,
          timestamp: timestamp,
        });

      this.database
        .query(
          `UPDATE claims
           SET updated_at = $timestamp,
               last_used_at = $timestamp
           WHERE id = $claimId`,
        )
        .run({ timestamp, claimId });

      this.#appendHistory(
        'lease.acquired',
        'lease',
        id,
        { claimId, port, expiresAt },
        timestamp,
      );
    });

    create.immediate();

    const lease = this.getLease(id);
    if (lease === null) {
      throw new RegistryError('internal', `Lease ${id} disappeared after creation.`);
    }

    return Object.freeze({ lease, token });
  }

  /**
   * @param {string} leaseId
   */
  getLease(leaseId) {
    const id = IdentifierSchema.parse(leaseId);
    const row = this.database
      .query('SELECT * FROM leases WHERE id = $id')
      .get({ id: id });

    return row === null ? null : leaseFromRow(row);
  }

  /**
   * @param {Date} [now]
   */
  listPendingLeases(now = new Date()) {
    const timestamp = toTimestamp(now);
    return this.database
      .query(
        `SELECT * FROM leases
         WHERE state = 'pending' AND expires_at > $timestamp
         ORDER BY port`,
      )
      .all({ timestamp })
      .map(leaseFromRow);
  }

  /**
   * @param {string} claimId
   * @param {Date} [now]
   */
  getPendingLeaseForClaim(claimId, now = new Date()) {
    const id = IdentifierSchema.parse(claimId);
    const timestamp = toTimestamp(now);
    const row = this.database
      .query(
        `SELECT * FROM leases
         WHERE claim_id = $claimId
           AND state = 'pending'
           AND expires_at > $timestamp
         LIMIT 1`,
      )
      .get({ claimId: id, timestamp });
    return row === null ? null : leaseFromRow(row);
  }

  /**
   * @param {Date} [now]
   */
  listReservedPorts(now = new Date()) {
    const timestamp = toTimestamp(now);
    const rows = this.database
      .query(
        `SELECT assigned_port AS port
         FROM claims
         WHERE assigned_port IS NOT NULL
         UNION
         SELECT port
         FROM leases
         WHERE state = 'pending' AND expires_at > $timestamp`,
      )
      .all({ timestamp });

    return rows.map((row) => z.object({ port: PortSchema }).parse(row).port);
  }

  /**
   * @param {string} claimId
   */
  getConfirmedRunForClaim(claimId) {
    const id = IdentifierSchema.parse(claimId);
    const row = this.database
      .query(
        `SELECT * FROM runs
         WHERE claim_id = $claimId AND state = 'confirmed'
         ORDER BY confirmed_at DESC
         LIMIT 1`,
      )
      .get({ claimId: id });

    return row === null ? null : runFromRow(row);
  }

  /**
   * @param {{
   *   leaseId: string,
   *   token: string,
   *   rootPid: number,
   *   rootFingerprint?: Record<string, unknown> | null,
   *   listenerFingerprints?: Record<string, unknown>[]
   * }} input
   * @param {Date} [now]
   */
  confirmLease(input, now = new Date()) {
    const leaseId = IdentifierSchema.parse(input.leaseId);
    const rootPid = z.number().int().positive().parse(input.rootPid);
    const rootFingerprint = input.rootFingerprint ?? null;
    const listenerFingerprints = input.listenerFingerprints ?? [];
    const timestamp = toTimestamp(now);
    const runId = randomUUID();

    const confirm = this.database.transaction(() => {
      const lease = this.getLease(leaseId);
      if (lease === null) {
        throw new RegistryError('not_found', `Lease ${leaseId} was not found.`);
      }
      this.#assertPendingLease(lease, input.token, now);
      const claim = this.getClaim(lease.claimId);
      if (claim === null) {
        throw new RegistryError(
          'internal',
          `Claim ${lease.claimId} disappeared before confirmation.`,
        );
      }
      const settings = this.getSettings();

      this.database
        .query(
          `UPDATE leases
           SET state = 'confirmed', updated_at = $timestamp
           WHERE id = $leaseId AND state = 'pending'`,
        )
        .run({ timestamp: timestamp, leaseId: leaseId });

      this.database
        .query(
          `UPDATE claims
           SET assigned_port = $port,
               assignment_expires_at = $assignmentExpiresAt,
               updated_at = $timestamp,
               last_used_at = $timestamp
           WHERE id = $claimId`,
        )
        .run({
          port: lease.port,
          assignmentExpiresAt:
            claim.mode === 'ephemeral'
              ? new Date(
                  now.getTime() + settings.ephemeralAssignmentTtlMilliseconds,
                ).toISOString()
              : null,
          timestamp: timestamp,
          claimId: lease.claimId,
        });

      this.database
        .query(
          `INSERT INTO runs (
             id, claim_id, lease_id, port, state, root_pid,
             root_fingerprint_json, confirmed_at, released_at
           ) VALUES (
             $id, $claimId, $leaseId, $port, 'confirmed', $rootPid,
             $rootFingerprint, $timestamp, NULL
           )`,
        )
        .run({
          id: runId,
          claimId: lease.claimId,
          leaseId: lease.id,
          port: lease.port,
          rootPid: rootPid,
          rootFingerprint:
            rootFingerprint === null ? null : JSON.stringify(rootFingerprint),
          timestamp: timestamp,
        });

      for (const fingerprint of listenerFingerprints) {
        const parsed = z
          .object({ pid: z.number().int().positive() })
          .passthrough()
          .parse(fingerprint);
        this.database
          .query(
            `INSERT INTO listener_fingerprints (
               id, run_id, pid, fingerprint_json, observed_at
             ) VALUES (
               $id, $runId, $pid, $fingerprint, $observedAt
             )`,
          )
          .run({
            id: randomUUID(),
            runId,
            pid: parsed.pid,
            fingerprint: JSON.stringify(parsed),
            observedAt: timestamp,
          });
      }

      this.#appendHistory(
        'lease.confirmed',
        'lease',
        leaseId,
        { runId, claimId: lease.claimId, port: lease.port, rootPid },
        timestamp,
      );
    });

    confirm.immediate();

    const run = this.getRun(runId);
    if (run === null) {
      throw new RegistryError('internal', `Run ${runId} was not persisted.`);
    }
    return run;
  }

  /**
   * @param {{
   *   leaseId: string,
   *   token: string,
   *   reason: 'address-in-use' | 'startup-error' | 'client-cancelled'
   * }} input
   * @param {Date} [now]
   */
  abandonLease(input, now = new Date()) {
    const leaseId = IdentifierSchema.parse(input.leaseId);
    const reason = z
      .enum(['address-in-use', 'startup-error', 'client-cancelled'])
      .parse(input.reason);
    const timestamp = toTimestamp(now);

    const abandon = this.database.transaction(() => {
      const lease = this.getLease(leaseId);
      if (lease === null) {
        throw new RegistryError('not_found', `Lease ${leaseId} was not found.`);
      }
      this.#assertPendingLease(lease, input.token, now);

      this.database
        .query(
          `UPDATE leases
           SET state = $state, updated_at = $timestamp
           WHERE id = $leaseId AND state = 'pending'`,
        )
        .run({
          state: reason === 'address-in-use' ? 'collision' : 'abandoned',
          timestamp: timestamp,
          leaseId: leaseId,
        });

      this.#appendHistory(
        'lease.abandoned',
        'lease',
        leaseId,
        { reason, port: lease.port },
        timestamp,
      );
    });

    abandon.immediate();
    return this.getLease(leaseId);
  }

  /**
   * @param {Date} [now]
   */
  expirePendingLeases(now = new Date()) {
    const timestamp = toTimestamp(now);
    const pending = this.database
      .query(
        `SELECT id FROM leases
         WHERE state = 'pending' AND expires_at <= $timestamp`,
      )
      .all({ timestamp: timestamp });

    const expire = this.database.transaction(() => {
      for (const candidate of pending) {
        const row = z.object({ id: IdentifierSchema }).parse(candidate);
        this.database
          .query(
            `UPDATE leases
             SET state = 'expired', updated_at = $timestamp
             WHERE id = $id AND state = 'pending'`,
          )
          .run({ timestamp: timestamp, id: row.id });
        this.#appendHistory('lease.expired', 'lease', row.id, {}, timestamp);
      }
    });

    expire.immediate();
    return pending.length;
  }

  /**
   * @param {string} runId
   */
  getRun(runId) {
    const id = IdentifierSchema.parse(runId);
    const row = this.database
      .query('SELECT * FROM runs WHERE id = $id')
      .get({ id: id });

    return row === null ? null : runFromRow(row);
  }

  listConfirmedRuns() {
    return this.database
      .query(
        `SELECT * FROM runs
         WHERE state = 'confirmed'
         ORDER BY port`,
      )
      .all()
      .map(runFromRow);
  }

  /**
   * @param {string} runId
   */
  listListenerFingerprintsForRun(runId) {
    const id = IdentifierSchema.parse(runId);
    return this.database
      .query(
        `SELECT fingerprint_json, observed_at
         FROM listener_fingerprints
         WHERE run_id = $runId
         ORDER BY pid, observed_at`,
      )
      .all({ runId: id })
      .map((row) => {
        const parsed = z
          .object({
            fingerprint_json: z.string(),
            observed_at: TimestampSchema,
          })
          .parse(row);
        return {
          fingerprint: parseJsonObject(parsed.fingerprint_json),
          observedAt: parsed.observed_at,
        };
      });
  }

  /**
   * @param {Date} [now]
   */
  listExpiredEphemeralAssignments(now = new Date()) {
    const timestamp = toTimestamp(now);
    return this.database
      .query(
        `SELECT id, assigned_port AS port
         FROM claims
         WHERE mode = 'ephemeral'
           AND assigned_port IS NOT NULL
           AND assignment_expires_at <= $timestamp
           AND NOT EXISTS (
             SELECT 1 FROM runs
             WHERE runs.claim_id = claims.id AND runs.state = 'confirmed'
           )
           AND NOT EXISTS (
             SELECT 1 FROM leases
             WHERE leases.claim_id = claims.id AND leases.state = 'pending'
           )`,
      )
      .all({ timestamp })
      .map((row) => z.object({ id: IdentifierSchema, port: PortSchema }).parse(row));
  }

  /**
   * @param {string} claimId
   * @param {Date} [now]
   */
  clearExpiredEphemeralAssignment(claimId, now = new Date()) {
    const id = IdentifierSchema.parse(claimId);
    const timestamp = toTimestamp(now);
    let changed = false;
    const clear = this.database.transaction(() => {
      const result = this.database
        .query(
          `UPDATE claims
           SET assigned_port = NULL,
               assignment_expires_at = NULL,
               updated_at = $timestamp
           WHERE id = $id
             AND mode = 'ephemeral'
             AND assignment_expires_at <= $timestamp
             AND NOT EXISTS (
               SELECT 1 FROM runs
               WHERE runs.claim_id = claims.id AND runs.state = 'confirmed'
             )
             AND NOT EXISTS (
               SELECT 1 FROM leases
               WHERE leases.claim_id = claims.id AND leases.state = 'pending'
             )`,
        )
        .run({ id, timestamp });
      changed = result.changes > 0;
      if (changed) {
        this.#appendHistory(
          'claim.ephemeral_assignment_expired',
          'claim',
          id,
          {},
          timestamp,
        );
      }
    });
    clear.immediate();
    return changed;
  }

  /**
   * @param {string} runId
   * @param {Date} [now]
   */
  releaseRun(runId, now = new Date()) {
    const id = IdentifierSchema.parse(runId);
    const timestamp = toTimestamp(now);
    let changed = false;
    const release = this.database.transaction(() => {
      const result = this.database
        .query(
          `UPDATE runs
           SET state = 'released', released_at = $timestamp
           WHERE id = $id AND state = 'confirmed'`,
        )
        .run({ timestamp: timestamp, id: id });

      changed = result.changes > 0;
      if (changed) {
        this.#appendHistory('run.released', 'run', id, {}, timestamp);
      }
    });

    release.immediate();
    return changed;
  }

  /**
   * @param {{
   *   claimId: string,
   *   port: number,
   *   preferredPort?: number | null,
   *   exactPort?: number | null
   * }} input
   * @param {Date} [now]
   */
  reassignClaim(input, now = new Date()) {
    const claimId = IdentifierSchema.parse(input.claimId);
    const port = PortSchema.parse(input.port);
    const preferredPort =
      input.preferredPort === undefined || input.preferredPort === null
        ? null
        : PortSchema.parse(input.preferredPort);
    const exactPort =
      input.exactPort === undefined || input.exactPort === null
        ? null
        : PortSchema.parse(input.exactPort);
    if (preferredPort !== null && exactPort !== null) {
      throw new RegistryError(
        'invalid_input',
        'preferredPort and exactPort are mutually exclusive.',
      );
    }
    const timestamp = toTimestamp(now);

    const reassign = this.database.transaction(() => {
      const claim = this.getClaim(claimId);
      if (claim === null) {
        throw new RegistryError('not_found', `Claim ${claimId} was not found.`);
      }
      this.#assertClaimHasNoActiveWork(claimId, now);
      const assigned = this.database
        .query(
          `SELECT id FROM claims
           WHERE transport = 'tcp'
             AND assigned_port = $port
             AND id != $claimId`,
        )
        .get({ port, claimId });
      if (assigned !== null) {
        throw new RegistryError(
          'conflict',
          `Port ${port} is assigned to another claim.`,
          { port, reason: 'port_assigned' },
        );
      }
      const pending = this.database
        .query(
          `SELECT id FROM leases
           WHERE port = $port
             AND state = 'pending'
             AND expires_at > $timestamp`,
        )
        .get({ port, timestamp });
      if (pending !== null) {
        throw new RegistryError('conflict', `Port ${port} has a pending lease.`, {
          port,
          reason: 'port_pending',
        });
      }
      const settings = this.getSettings();
      this.database
        .query(
          `UPDATE claims
           SET assigned_port = $port,
               preferred_port = $preferredPort,
               exact_port = $exactPort,
               assignment_expires_at = $assignmentExpiresAt,
               updated_at = $timestamp,
               last_used_at = $timestamp
           WHERE id = $claimId`,
        )
        .run({
          port,
          preferredPort,
          exactPort,
          assignmentExpiresAt:
            claim.mode === 'ephemeral'
              ? new Date(
                  now.getTime() + settings.ephemeralAssignmentTtlMilliseconds,
                ).toISOString()
              : null,
          timestamp,
          claimId,
        });
      this.#appendHistory(
        'claim.reassigned',
        'claim',
        claimId,
        { previousPort: claim.assignedPort, port, preferredPort, exactPort },
        timestamp,
      );
    });
    reassign.immediate();

    const claim = this.getClaim(claimId);
    if (claim === null) {
      throw new RegistryError(
        'internal',
        `Claim ${claimId} disappeared after reassignment.`,
      );
    }
    return claim;
  }

  /**
   * @param {string} claimId
   * @param {'deleted' | 'pruned'} reason
   * @param {Date} [now]
   */
  deleteClaim(claimId, reason, now = new Date()) {
    const id = IdentifierSchema.parse(claimId);
    const parsedReason = z.enum(['deleted', 'pruned']).parse(reason);
    const timestamp = toTimestamp(now);
    let deleted = false;

    const remove = this.database.transaction(() => {
      const claim = this.getClaim(id);
      if (claim === null) {
        throw new RegistryError('not_found', `Claim ${id} was not found.`);
      }
      this.#assertClaimHasNoActiveWork(id, now);
      this.database.query('DELETE FROM runs WHERE claim_id = $claimId').run({
        claimId: id,
      });
      this.database.query('DELETE FROM leases WHERE claim_id = $claimId').run({
        claimId: id,
      });
      deleted =
        this.database.query('DELETE FROM claims WHERE id = $id').run({ id }).changes >
        0;
      if (deleted) {
        this.#appendHistory(
          parsedReason === 'pruned' ? 'claim.pruned' : 'claim.deleted',
          'claim',
          id,
          { claim, reason: parsedReason },
          timestamp,
        );
      }
    });
    remove.immediate();
    return deleted;
  }

  getSettings() {
    const row = this.database
      .query(`SELECT value_json FROM settings WHERE key = 'server'`)
      .get();
    if (row === null) {
      return DEFAULT_SERVER_SETTINGS;
    }

    const parsed = z.object({ value_json: z.string() }).parse(row);
    return ServerSettingsSchema.parse(JSON.parse(parsed.value_json));
  }

  /**
   * @param {unknown} settings
   * @param {Date} [now]
   */
  setSettings(settings, now = new Date()) {
    const parsed = ServerSettingsSchema.parse(settings);
    const timestamp = toTimestamp(now);
    const update = this.database.transaction(() => {
      this.database
        .query(
          `INSERT INTO settings (key, value_json, updated_at)
           VALUES ('server', $value, $timestamp)
           ON CONFLICT (key) DO UPDATE
           SET value_json = excluded.value_json,
               updated_at = excluded.updated_at`,
        )
        .run({
          value: JSON.stringify(parsed),
          timestamp: timestamp,
        });
      this.#appendHistory(
        'config.updated',
        'setting',
        'server',
        { settings: parsed },
        timestamp,
      );
    });

    update.immediate();
    return this.getSettings();
  }

  /**
   * @param {{
   *   limit?: number,
   *   eventType?: string,
   *   entityType?: string,
   *   entityId?: string,
   *   since?: string
   * }} [filters]
   */
  listHistory(filters = {}) {
    const limit =
      filters.limit === undefined
        ? undefined
        : z.number().int().min(1).max(10_000).parse(filters.limit);
    const since =
      filters.since === undefined ? undefined : TimestampSchema.parse(filters.since);
    const events = this.database
      .query('SELECT * FROM history_events ORDER BY occurred_at, rowid')
      .all()
      .map((row) => {
        const parsed = z
          .object({
            id: IdentifierSchema,
            event_type: z.string(),
            entity_type: z.string(),
            entity_id: z.string(),
            payload_json: z.string(),
            occurred_at: TimestampSchema,
          })
          .parse(row);
        return HistoryEventSchema.parse({
          id: parsed.id,
          eventType: parsed.event_type,
          entityType: parsed.entity_type,
          entityId: parsed.entity_id,
          payload: parseJsonObject(parsed.payload_json),
          occurredAt: parsed.occurred_at,
        });
      });
    const filtered = events.filter(
      (event) =>
        (filters.eventType === undefined || event.eventType === filters.eventType) &&
        (filters.entityType === undefined || event.entityType === filters.entityType) &&
        (filters.entityId === undefined || event.entityId === filters.entityId) &&
        (since === undefined || event.occurredAt >= since),
    );
    return limit === undefined ? filtered : filtered.slice(-limit);
  }

  /**
   * Persist an operational audit event. Callers provide a single complete
   * stage payload so evidence is never split across mutable tables.
   *
   * @param {{
   *   eventType: string,
   *   entityType: string,
   *   entityId: string,
   *   payload: Record<string, unknown>
   * }} event
   * @param {Date} [now]
   */
  appendHistoryEvent(event, now = new Date()) {
    const parsed = HistoryEventSchema.omit({
      id: true,
      occurredAt: true,
    }).parse(event);
    this.#appendHistory(
      parsed.eventType,
      parsed.entityType,
      parsed.entityId,
      parsed.payload,
      toTimestamp(now),
    );
  }

  /**
   * @param {LeaseRecord} lease
   * @param {string} token
   * @param {Date} now
   */
  #assertPendingLease(lease, token, now) {
    if (lease.state !== 'pending') {
      throw new RegistryError(
        'lease_not_pending',
        `Lease ${lease.id} is ${lease.state}.`,
      );
    }
    if (!verifyLeaseToken(token, lease.tokenHash)) {
      throw new RegistryError('invalid_lease_token', 'Lease token does not match.');
    }
    if (hasExpired(lease.expiresAt, now)) {
      throw new RegistryError('lease_expired', `Lease ${lease.id} has expired.`);
    }
  }

  /**
   * @param {string} claimId
   * @param {Date} now
   */
  #assertClaimHasNoActiveWork(claimId, now) {
    const activeRun = this.getConfirmedRunForClaim(claimId);
    if (activeRun !== null) {
      throw new RegistryError('conflict', `Claim ${claimId} has an active run.`, {
        claimId,
        runId: activeRun.id,
        reason: 'active_run',
      });
    }
    const pendingLease = this.getPendingLeaseForClaim(claimId, now);
    if (pendingLease !== null) {
      throw new RegistryError('conflict', `Claim ${claimId} has a pending lease.`, {
        claimId,
        leaseId: pendingLease.id,
        reason: 'pending_lease',
      });
    }
  }

  /**
   * @param {string} eventType
   * @param {string} entityType
   * @param {string} entityId
   * @param {Record<string, unknown>} payload
   * @param {string} occurredAt
   */
  #appendHistory(eventType, entityType, entityId, payload, occurredAt) {
    this.database
      .query(
        `INSERT INTO history_events (
           id, event_type, entity_type, entity_id, payload_json, occurred_at
         ) VALUES (
           $id, $eventType, $entityType, $entityId, $payload, $occurredAt
         )`,
      )
      .run({
        id: randomUUID(),
        eventType: eventType,
        entityType: entityType,
        entityId: entityId,
        payload: JSON.stringify(payload),
        occurredAt: occurredAt,
      });
    const maximumEvents = this.getSettings().historyMaximumEvents;
    this.database
      .query(
        `DELETE FROM history_events
         WHERE rowid NOT IN (
           SELECT rowid
           FROM history_events
           ORDER BY occurred_at DESC, rowid DESC
           LIMIT $maximumEvents
         )`,
      )
      .run({ maximumEvents });
  }
}

/**
 * @param {string} [filename]
 */
export function openRegistry(filename = ':memory:') {
  const database = new Database(filename, {
    create: true,
    strict: true,
  });
  database.exec('PRAGMA foreign_keys = ON');
  if (filename !== ':memory:') {
    database.exec('PRAGMA journal_mode = WAL');
  }
  applyMigrations(database);
  return new Registry(database);
}

/**
 * @param {unknown} row
 */
function claimFromRow(row) {
  const parsed = ClaimRowSchema.parse(row);
  return ClaimRecordSchema.parse({
    id: parsed.id,
    identity: {
      project: parsed.project,
      workspaceRoot: parsed.workspace_root,
      service: parsed.component,
      component: parsed.component,
      endpoint: parsed.endpoint,
      transport: parsed.transport,
    },
    mode: parsed.mode,
    assignedPort: parsed.assigned_port,
    preferredPort: parsed.preferred_port,
    exactPort: parsed.exact_port,
    assignmentExpiresAt: parsed.assignment_expires_at,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    lastUsedAt: parsed.last_used_at,
  });
}

/**
 * @param {unknown} row
 */
function leaseFromRow(row) {
  const parsed = LeaseRowSchema.parse(row);
  return LeaseRecordSchema.parse({
    id: parsed.id,
    claimId: parsed.claim_id,
    port: parsed.port,
    state: parsed.state,
    tokenHash: parsed.token_hash,
    expiresAt: parsed.expires_at,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  });
}

/**
 * @param {unknown} row
 */
function runFromRow(row) {
  const parsed = RunRowSchema.parse(row);
  return RunRecordSchema.parse({
    id: parsed.id,
    claimId: parsed.claim_id,
    leaseId: parsed.lease_id,
    port: parsed.port,
    state: parsed.state,
    rootPid: parsed.root_pid,
    rootFingerprint:
      parsed.root_fingerprint_json === null
        ? null
        : parseJsonObject(parsed.root_fingerprint_json),
    confirmedAt: parsed.confirmed_at,
    releasedAt: parsed.released_at,
  });
}

/**
 * @param {unknown} row
 */
function stackFromRow(row) {
  const parsed = StackRowSchema.parse(row);
  return StackRecordSchema.parse({
    id: parsed.id,
    project: parsed.project,
    workspaceRoot: parsed.workspace_root,
    currentRevision: parsed.current_revision,
    definition: StackDefinitionSchema.parse(JSON.parse(parsed.definition_json)),
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    lastUsedAt: parsed.last_used_at,
  });
}

/**
 * @param {string} value
 */
function parseJsonObject(value) {
  return z.record(z.string(), z.unknown()).parse(JSON.parse(value));
}
