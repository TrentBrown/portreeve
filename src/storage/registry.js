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
  StackActivationSchema,
  StackDefinitionSchema,
  StackGenerationSchema,
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
  binding_kind: z.enum(['process', 'docker']),
  root_pid: z.number().int().positive().nullable(),
  root_fingerprint_json: z.string().nullable(),
  container_id: z.string().nullable(),
  provider_evidence_json: z.string().nullable(),
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

  /** @param {string} stackId */
  listStackClaims(stackId) {
    const id = IdentifierSchema.parse(stackId);
    return this.database
      .query(
        `SELECT claims.*
         FROM stack_endpoint_claims endpoints
         JOIN claims ON claims.id = endpoints.claim_id
         WHERE endpoints.stack_id = $stackId
         ORDER BY claims.component, claims.endpoint`,
      )
      .all({ stackId: id })
      .map(claimFromRow);
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

  /** @param {string} generationId */
  getStackGeneration(generationId) {
    const id = IdentifierSchema.parse(generationId);
    const row = this.database
      .query('SELECT * FROM stack_generations WHERE id = $id')
      .get({ id });
    if (row === null) return null;
    const parsed = z
      .object({
        id: IdentifierSchema,
        stack_id: IdentifierSchema,
        revision: z.string().regex(/^[a-f0-9]{64}$/),
        state: z.enum(['valid', 'stale']),
        created_at: TimestampSchema,
        invalidated_at: TimestampSchema.nullable(),
      })
      .parse(row);
    const endpoints = this.database
      .query(
        `SELECT * FROM stack_generation_endpoints
         WHERE generation_id = $generationId
         ORDER BY component, endpoint`,
      )
      .all({ generationId: id })
      .map((endpointRow) => {
        const endpoint = z
          .object({
            claim_id: IdentifierSchema,
            component: z.string().min(1),
            endpoint: z.string().min(1),
            transport: z.literal('tcp'),
            host: z.literal('127.0.0.1'),
            port: PortSchema,
            required: z.union([z.literal(0), z.literal(1)]),
          })
          .parse(endpointRow);
        return {
          claimId: endpoint.claim_id,
          component: endpoint.component,
          endpoint: endpoint.endpoint,
          transport: endpoint.transport,
          host: endpoint.host,
          port: endpoint.port,
          required: endpoint.required === 1,
        };
      });
    return StackGenerationSchema.parse({
      id: parsed.id,
      stackId: parsed.stack_id,
      revision: parsed.revision,
      state: parsed.state,
      endpoints,
      createdAt: parsed.created_at,
      invalidatedAt: parsed.invalidated_at,
    });
  }

  /** @param {string} stackId @param {string} revision */
  getLatestValidStackGeneration(stackId, revision) {
    const parsedStackId = IdentifierSchema.parse(stackId);
    const parsedRevision = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(revision);
    const row = /** @type {{id: string}|null} */ (
      this.database
        .query(
          `SELECT id FROM stack_generations
           WHERE stack_id = $stackId AND revision = $revision AND state = 'valid'
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get({ stackId: parsedStackId, revision: parsedRevision })
    );
    return row === null ? null : this.getStackGeneration(row.id);
  }

  /** @param {string} stackId */
  getLatestStackGenerationForStack(stackId) {
    const id = IdentifierSchema.parse(stackId);
    const row = /** @type {{id: string}|null} */ (
      this.database
        .query(
          `SELECT id FROM stack_generations
           WHERE stack_id = $stackId
           ORDER BY created_at DESC, rowid DESC
           LIMIT 1`,
        )
        .get({ stackId: id })
    );
    return row === null ? null : this.getStackGeneration(row.id);
  }

  /**
   * @param {{
   *   stackId: string,
   *   revision: string,
   *   endpoints: Array<{
   *     claimId: string,
   *     component: string,
   *     endpoint: string,
   *     transport: 'tcp',
   *     host: '127.0.0.1',
   *     port: number,
   *     required: boolean
   *   }>
   * }} input
   * @param {Date} [now]
   */
  createStackGeneration(input, now = new Date()) {
    const stackId = IdentifierSchema.parse(input.stackId);
    const revision = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.revision);
    const endpoints = input.endpoints.map((endpoint) =>
      z
        .object({
          claimId: IdentifierSchema,
          component: z.string().min(1),
          endpoint: z.string().min(1),
          transport: z.literal('tcp'),
          host: z.literal('127.0.0.1'),
          port: PortSchema,
          required: z.boolean(),
        })
        .parse(endpoint),
    );
    const timestamp = toTimestamp(now);
    /** @type {string} */
    let generationId = randomUUID();
    let reused = false;

    const create = this.database.transaction(() => {
      const stack = /** @type {{current_revision: string}|null} */ (
        this.database
          .query('SELECT current_revision FROM stacks WHERE id = $stackId')
          .get({ stackId })
      );
      if (stack === null) {
        throw new RegistryError('not_found', `Stack ${stackId} was not found.`);
      }
      if (stack.current_revision !== revision) {
        throw new RegistryError(
          'conflict',
          `Stack ${stackId} changed while its generation was being prepared.`,
          { stackId, revision, currentRevision: stack.current_revision },
        );
      }
      const existing = /** @type {{id: string}|null} */ (
        this.database
          .query(
            `SELECT id FROM stack_generations
             WHERE stack_id = $stackId AND revision = $revision AND state = 'valid'
             ORDER BY created_at DESC LIMIT 1`,
          )
          .get({ stackId, revision })
      );
      if (existing !== null) {
        generationId = existing.id;
        reused = true;
        return;
      }

      for (const endpoint of endpoints) {
        const linked = this.database
          .query(
            `SELECT 1 FROM stack_endpoint_claims
             WHERE stack_id = $stackId AND component = $component
               AND endpoint = $endpoint AND claim_id = $claimId`,
          )
          .get({
            stackId,
            component: endpoint.component,
            endpoint: endpoint.endpoint,
            claimId: endpoint.claimId,
          });
        if (linked === null) {
          throw new RegistryError(
            'conflict',
            `Stack endpoint ${endpoint.component}.${endpoint.endpoint} is not linked to claim ${endpoint.claimId}.`,
          );
        }
        const assigned = /** @type {{id: string}|null} */ (
          this.database
            .query(
              `SELECT id FROM claims
               WHERE transport = 'tcp' AND assigned_port = $port AND id != $claimId`,
            )
            .get({ port: endpoint.port, claimId: endpoint.claimId })
        );
        if (assigned !== null) {
          throw new RegistryError('conflict', `Port ${endpoint.port} is assigned.`, {
            port: endpoint.port,
            claimId: assigned.id,
            reason: 'port_assigned',
          });
        }
        const pending = this.database
          .query(`SELECT id FROM leases WHERE port = $port AND state = 'pending'`)
          .get({ port: endpoint.port });
        if (pending !== null) {
          throw new RegistryError('conflict', `Port ${endpoint.port} is leased.`, {
            port: endpoint.port,
            reason: 'port_pending',
          });
        }
      }

      this.database
        .query(
          `INSERT INTO stack_generations (
             id, stack_id, revision, state, created_at, invalidated_at
           ) VALUES ($id, $stackId, $revision, 'valid', $timestamp, NULL)`,
        )
        .run({ id: generationId, stackId, revision, timestamp });
      for (const endpoint of endpoints) {
        this.database
          .query(
            `UPDATE stack_generations
             SET state = 'stale', invalidated_at = $timestamp
             WHERE state = 'valid' AND id != $generationId
               AND EXISTS (
                 SELECT 1 FROM stack_generation_endpoints prior
                 WHERE prior.generation_id = stack_generations.id
                   AND prior.claim_id = $claimId AND prior.port != $port
               )`,
          )
          .run({
            timestamp,
            generationId,
            claimId: endpoint.claimId,
            port: endpoint.port,
          });
        this.database
          .query(
            `UPDATE claims
             SET assigned_port = $port, assignment_expires_at = NULL,
                 updated_at = $timestamp, last_used_at = $timestamp
             WHERE id = $claimId`,
          )
          .run({ port: endpoint.port, timestamp, claimId: endpoint.claimId });
        this.database
          .query(
            `INSERT INTO stack_generation_endpoints (
               generation_id, claim_id, component, endpoint,
               transport, host, port, required
             ) VALUES (
               $generationId, $claimId, $component, $endpoint,
               $transport, $host, $port, $required
             )`,
          )
          .run({
            generationId,
            claimId: endpoint.claimId,
            component: endpoint.component,
            endpoint: endpoint.endpoint,
            transport: endpoint.transport,
            host: endpoint.host,
            port: endpoint.port,
            required: endpoint.required ? 1 : 0,
          });
      }
      this.#appendHistory(
        'stack.generation.prepared',
        'stack-generation',
        generationId,
        { stackId, revision, endpointCount: endpoints.length },
        timestamp,
      );
    });
    create.immediate();
    const generation = this.getStackGeneration(generationId);
    if (generation === null) {
      throw new RegistryError(
        'internal',
        `Stack generation ${generationId} disappeared after preparation.`,
      );
    }
    return { reused, generation };
  }

  /** @param {string} generationId @param {Date} [now] */
  invalidateStackGeneration(generationId, now = new Date()) {
    const id = IdentifierSchema.parse(generationId);
    const timestamp = toTimestamp(now);
    const result = this.database
      .query(
        `UPDATE stack_generations
         SET state = 'stale', invalidated_at = $timestamp
         WHERE id = $id AND state = 'valid'`,
      )
      .run({ id, timestamp });
    if (result.changes > 0) {
      this.#appendHistory(
        'stack.generation.invalidated',
        'stack-generation',
        id,
        {},
        timestamp,
      );
    }
    return result.changes > 0;
  }

  /** @param {string} activationId */
  getStackActivation(activationId) {
    const id = IdentifierSchema.parse(activationId);
    const row = this.database
      .query('SELECT * FROM stack_activations WHERE id = $id')
      .get({ id });
    if (row === null) return null;
    const parsed = z
      .object({
        id: IdentifierSchema,
        stack_id: IdentifierSchema,
        generation_id: IdentifierSchema,
        state: z.enum(['starting', 'confirmed', 'degraded', 'failed', 'lost', 'ended']),
        created_at: TimestampSchema,
        updated_at: TimestampSchema,
        confirmed_at: TimestampSchema.nullable(),
        ended_at: TimestampSchema.nullable(),
      })
      .parse(row);
    const endpoints = this.database
      .query(
        `SELECT endpoint.*, leases.expires_at
         FROM stack_activation_endpoints endpoint
         LEFT JOIN leases ON leases.id = endpoint.lease_id
         WHERE endpoint.activation_id = $activationId
         ORDER BY endpoint.component, endpoint.endpoint`,
      )
      .all({ activationId: id })
      .map((endpointRow) => {
        const endpoint = z
          .object({
            component: z.string().min(1),
            endpoint: z.string().min(1),
            claim_id: IdentifierSchema,
            port: PortSchema,
            required: z.union([z.literal(0), z.literal(1)]),
            binding_kind: z.enum(['process', 'docker']),
            state: z.enum(['leased', 'confirmed', 'skipped', 'failed', 'released']),
            lease_id: IdentifierSchema.nullable(),
            run_id: IdentifierSchema.nullable(),
            expires_at: TimestampSchema.nullable(),
            failure_reason: z.string().nullable(),
            updated_at: TimestampSchema,
          })
          .parse(endpointRow);
        return {
          component: endpoint.component,
          endpoint: endpoint.endpoint,
          claimId: endpoint.claim_id,
          port: endpoint.port,
          required: endpoint.required === 1,
          bindingKind: endpoint.binding_kind,
          state: endpoint.state,
          leaseId: endpoint.lease_id,
          runId: endpoint.run_id,
          expiresAt: endpoint.expires_at,
          failureReason: endpoint.failure_reason,
          updatedAt: endpoint.updated_at,
        };
      });
    return StackActivationSchema.parse({
      id: parsed.id,
      stackId: parsed.stack_id,
      generationId: parsed.generation_id,
      state: parsed.state,
      endpoints,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
      confirmedAt: parsed.confirmed_at,
      endedAt: parsed.ended_at,
    });
  }

  /** @param {string} stackId */
  getLiveStackActivationForStack(stackId) {
    const id = IdentifierSchema.parse(stackId);
    const row = /** @type {{id: string} | null} */ (
      this.database
        .query(
          `SELECT id FROM stack_activations
           WHERE stack_id = $stackId
             AND state IN ('starting', 'confirmed', 'degraded')
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get({ stackId: id })
    );
    return row === null ? null : this.getStackActivation(row.id);
  }

  /** @param {string} stackId */
  getLatestStackActivationForStack(stackId) {
    const id = IdentifierSchema.parse(stackId);
    const row = /** @type {{id: string} | null} */ (
      this.database
        .query(
          `SELECT id FROM stack_activations
           WHERE stack_id = $stackId
           ORDER BY created_at DESC, rowid DESC
           LIMIT 1`,
        )
        .get({ stackId: id })
    );
    return row === null ? null : this.getStackActivation(row.id);
  }

  /**
   * @param {string} activationId
   * @param {Array<{component: string, endpoint: string, bindingKind: 'process' | 'docker', status: string, reason: string}>} providers
   * @param {Date} [now]
   */
  markStackActivationLost(activationId, providers, now = new Date()) {
    const id = IdentifierSchema.parse(activationId);
    const timestamp = toTimestamp(now);
    let changed = false;
    const markLost = this.database.transaction(() => {
      const activation = this.getStackActivation(id);
      if (activation === null) {
        throw new RegistryError('not_found', `Activation ${id} was not found.`);
      }
      if (activation.state === 'lost') return;
      if (!['confirmed', 'degraded'].includes(activation.state)) {
        throw new RegistryError(
          'conflict',
          `Activation ${id} is ${activation.state} and cannot become lost.`,
          { activationId: id, reason: 'activation_not_reconcilable' },
        );
      }
      if (providers.some(({ status }) => status !== 'gone')) {
        throw new RegistryError(
          'conflict',
          `Activation ${id} still has active or unobservable providers.`,
          { activationId: id, reason: 'provider_not_gone' },
        );
      }
      const releasedRuns = this.database
        .query(
          `SELECT id FROM runs
           WHERE state = 'confirmed' AND id IN (
             SELECT run_id FROM stack_activation_endpoints
             WHERE activation_id = $activationId AND run_id IS NOT NULL
           )`,
        )
        .all({ activationId: id })
        .map((row) => z.object({ id: IdentifierSchema }).parse(row));
      this.database
        .query(
          `UPDATE runs
           SET state = 'released', released_at = $timestamp
           WHERE state = 'confirmed' AND id IN (
             SELECT run_id FROM stack_activation_endpoints
             WHERE activation_id = $activationId AND run_id IS NOT NULL
           )`,
        )
        .run({ timestamp, activationId: id });
      for (const run of releasedRuns) {
        this.#appendHistory(
          'run.released',
          'run',
          run.id,
          { activationId: id, reason: 'provider-lost' },
          timestamp,
        );
      }
      this.database
        .query(
          `UPDATE stack_activation_endpoints
           SET state = 'released', failure_reason = 'provider-lost',
               updated_at = $timestamp
           WHERE activation_id = $activationId AND state = 'confirmed'`,
        )
        .run({ timestamp, activationId: id });
      this.database
        .query(
          `UPDATE stack_activations
           SET state = 'lost', updated_at = $timestamp
           WHERE id = $activationId
             AND state IN ('confirmed', 'degraded')`,
        )
        .run({ timestamp, activationId: id });
      changed = true;
      this.#appendHistory(
        'stack.activation.lost',
        'stack-activation',
        id,
        {
          providers: providers.map((provider) => ({
            component: provider.component,
            endpoint: provider.endpoint,
            bindingKind: provider.bindingKind,
            status: provider.status,
            reason: provider.reason,
          })),
        },
        timestamp,
      );
    });
    markLost.immediate();
    const activation = this.getStackActivation(id);
    if (activation === null) {
      throw new RegistryError('internal', `Activation ${id} disappeared.`);
    }
    return { changed, activation };
  }

  /** @param {string} activationId @param {Date} [now] */
  endStackActivation(activationId, now = new Date()) {
    const id = IdentifierSchema.parse(activationId);
    const timestamp = toTimestamp(now);
    let changed = false;
    const end = this.database.transaction(() => {
      const activation = this.getStackActivation(id);
      if (activation === null) {
        throw new RegistryError('not_found', `Activation ${id} was not found.`);
      }
      if (activation.state === 'ended') return;
      if (activation.endpoints.some(({ state }) => state === 'leased')) {
        throw new RegistryError(
          'conflict',
          `Activation ${id} still has pending endpoint leases.`,
          { activationId: id, reason: 'leases_pending' },
        );
      }
      const releasedRuns = this.database
        .query(
          `SELECT id FROM runs
           WHERE state = 'confirmed' AND id IN (
             SELECT run_id FROM stack_activation_endpoints
             WHERE activation_id = $activationId AND run_id IS NOT NULL
           )`,
        )
        .all({ activationId: id })
        .map((row) => z.object({ id: IdentifierSchema }).parse(row));
      this.database
        .query(
          `UPDATE runs
           SET state = 'released', released_at = $timestamp
           WHERE state = 'confirmed' AND id IN (
             SELECT run_id FROM stack_activation_endpoints
             WHERE activation_id = $activationId AND run_id IS NOT NULL
           )`,
        )
        .run({ timestamp, activationId: id });
      for (const run of releasedRuns) {
        this.#appendHistory(
          'run.released',
          'run',
          run.id,
          { activationId: id },
          timestamp,
        );
      }
      this.database
        .query(
          `UPDATE stack_activation_endpoints
           SET state = 'released', updated_at = $timestamp
           WHERE activation_id = $activationId AND state = 'confirmed'`,
        )
        .run({ timestamp, activationId: id });
      this.database
        .query(
          `UPDATE stack_activations
           SET state = 'ended', updated_at = $timestamp, ended_at = $timestamp
           WHERE id = $activationId AND state != 'ended'`,
        )
        .run({ timestamp, activationId: id });
      changed = true;
      this.#appendHistory(
        'stack.activation.ended',
        'stack-activation',
        id,
        {},
        timestamp,
      );
    });
    end.immediate();
    const activation = this.getStackActivation(id);
    if (activation === null) {
      throw new RegistryError('internal', `Activation ${id} disappeared.`);
    }
    return { changed, activation };
  }

  /**
   * @param {{
   *   generationId: string,
   *   requiredEndpoints: string[],
   *   skippedEndpoints: string[],
   *   bindings: Record<string, 'process' | 'docker'>,
   *   expiresAt: string
   * }} input
   * @param {Date} [now]
   */
  beginStackActivation(input, now = new Date()) {
    const generationId = IdentifierSchema.parse(input.generationId);
    const requiredEndpoints = new Set(input.requiredEndpoints);
    const skippedEndpoints = new Set(input.skippedEndpoints);
    const bindings = z
      .record(z.string(), z.enum(['process', 'docker']))
      .parse(input.bindings);
    const expiresAt = TimestampSchema.parse(input.expiresAt);
    const timestamp = toTimestamp(now);
    const activationId = randomUUID();
    /** @type {Array<{component: string, endpoint: string, leaseId: string, leaseToken: string, port: number, expiresAt: string}>} */
    const leases = [];

    const begin = this.database.transaction(() => {
      const generation = this.getStackGeneration(generationId);
      if (generation === null) {
        throw new RegistryError(
          'not_found',
          `Stack generation ${generationId} was not found.`,
        );
      }
      if (generation.state !== 'valid') {
        throw new RegistryError(
          'conflict',
          `Stack generation ${generationId} is stale.`,
          { generationId, reason: 'stale_generation' },
        );
      }
      const stack =
        /** @type {{workspace_root: string, current_revision: string}|null} */ (
          this.database
            .query(
              'SELECT workspace_root, current_revision FROM stacks WHERE id = $stackId',
            )
            .get({ stackId: generation.stackId })
        );
      if (stack === null || stack.current_revision !== generation.revision) {
        throw new RegistryError(
          'conflict',
          `Stack generation ${generationId} does not match the current definition.`,
          {
            generationId,
            generationRevision: generation.revision,
            currentRevision: stack?.current_revision,
            reason: 'stale_generation',
          },
        );
      }
      const live = this.database
        .query(
          `SELECT activation.id FROM stack_activations activation
           JOIN stacks owner ON owner.id = activation.stack_id
           WHERE owner.workspace_root = $workspaceRoot
             AND activation.state IN ('starting', 'confirmed', 'degraded')
           LIMIT 1`,
        )
        .get({ workspaceRoot: stack.workspace_root });
      if (live !== null) {
        throw new RegistryError(
          'conflict',
          `Worktree ${stack.workspace_root} already has a live activation.`,
          { workspaceRoot: stack.workspace_root, reason: 'activation_live' },
        );
      }

      const keys = new Set(
        generation.endpoints.map(
          ({ component, endpoint }) => `${component}\u0000${endpoint}`,
        ),
      );
      for (const key of [...requiredEndpoints, ...skippedEndpoints]) {
        if (!keys.has(key)) {
          throw new RegistryError(
            'invalid_input',
            'Activation selection names an unknown endpoint.',
            {
              endpoint: key.replace('\u0000', '.'),
            },
          );
        }
      }
      for (const key of skippedEndpoints) {
        const endpoint = generation.endpoints.find(
          (candidate) => `${candidate.component}\u0000${candidate.endpoint}` === key,
        );
        if (endpoint?.required || requiredEndpoints.has(key)) {
          throw new RegistryError(
            'invalid_input',
            `Required endpoint ${key.replace('\u0000', '.')} cannot be skipped.`,
          );
        }
      }

      this.database
        .query(
          `INSERT INTO stack_activations (
             id, stack_id, generation_id, state, created_at, updated_at,
             confirmed_at, ended_at
           ) VALUES (
             $id, $stackId, $generationId, 'starting', $timestamp, $timestamp,
             NULL, NULL
           )`,
        )
        .run({
          id: activationId,
          stackId: generation.stackId,
          generationId,
          timestamp,
        });

      for (const endpoint of generation.endpoints) {
        const key = `${endpoint.component}\u0000${endpoint.endpoint}`;
        const required = endpoint.required || requiredEndpoints.has(key);
        const bindingKind = bindings[endpoint.component] ?? 'process';
        if (skippedEndpoints.has(key)) {
          this.database
            .query(
              `INSERT INTO stack_activation_endpoints (
                 activation_id, component, endpoint, claim_id, port, required,
                 binding_kind, state, lease_id, run_id, failure_reason, updated_at
               ) VALUES (
                 $activationId, $component, $endpoint, $claimId, $port, $required,
                 $bindingKind, 'skipped', NULL, NULL, 'caller-skipped', $timestamp
               )`,
            )
            .run({
              activationId,
              component: endpoint.component,
              endpoint: endpoint.endpoint,
              claimId: endpoint.claimId,
              port: endpoint.port,
              required: required ? 1 : 0,
              bindingKind,
              timestamp,
            });
          continue;
        }
        this.#assertClaimHasNoActiveWork(endpoint.claimId, now);
        const leaseId = randomUUID();
        const { token, tokenHash } = createLeaseToken();
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
            id: leaseId,
            claimId: endpoint.claimId,
            port: endpoint.port,
            tokenHash,
            expiresAt,
            timestamp,
          });
        this.database
          .query(
            `INSERT INTO stack_activation_endpoints (
               activation_id, component, endpoint, claim_id, port, required,
               binding_kind, state, lease_id, run_id, failure_reason, updated_at
             ) VALUES (
               $activationId, $component, $endpoint, $claimId, $port, $required,
               $bindingKind, 'leased', $leaseId, NULL, NULL, $timestamp
             )`,
          )
          .run({
            activationId,
            component: endpoint.component,
            endpoint: endpoint.endpoint,
            claimId: endpoint.claimId,
            port: endpoint.port,
            required: required ? 1 : 0,
            bindingKind,
            leaseId,
            timestamp,
          });
        this.#appendHistory(
          'lease.acquired',
          'lease',
          leaseId,
          {
            claimId: endpoint.claimId,
            port: endpoint.port,
            expiresAt,
            activationId,
          },
          timestamp,
        );
        leases.push({
          component: endpoint.component,
          endpoint: endpoint.endpoint,
          leaseId,
          leaseToken: token,
          port: endpoint.port,
          expiresAt,
        });
      }
      this.#refreshStackActivationState(activationId, timestamp);
      this.#appendHistory(
        'stack.activation.began',
        'stack-activation',
        activationId,
        { stackId: generation.stackId, generationId, leaseCount: leases.length },
        timestamp,
      );
    });
    begin.immediate();
    const activation = this.getStackActivation(activationId);
    if (activation === null) {
      throw new RegistryError(
        'internal',
        `Stack activation ${activationId} disappeared after creation.`,
      );
    }
    return { activation, leases };
  }

  /**
   * @param {{activationId: string, leases: Array<{leaseId: string, leaseToken: string}>, expiresAt: string}} input
   * @param {Date} [now]
   */
  renewStackActivation(input, now = new Date()) {
    const activationId = IdentifierSchema.parse(input.activationId);
    const expiresAt = TimestampSchema.parse(input.expiresAt);
    const timestamp = toTimestamp(now);
    const credentials = input.leases.map(({ leaseId, leaseToken }) => ({
      leaseId: IdentifierSchema.parse(leaseId),
      leaseToken,
    }));
    const renewed = this.database.transaction(() => {
      const activation = this.getStackActivation(activationId);
      if (activation === null) {
        throw new RegistryError(
          'not_found',
          `Activation ${activationId} was not found.`,
        );
      }
      if (activation.state !== 'starting') {
        throw new RegistryError(
          'conflict',
          `Activation ${activationId} is ${activation.state}; its leases cannot be renewed.`,
        );
      }
      for (const credential of credentials) {
        const lease = this.getLease(credential.leaseId);
        if (lease === null) {
          throw new RegistryError(
            'not_found',
            `Lease ${credential.leaseId} was not found.`,
          );
        }
        this.#assertPendingLease(lease, credential.leaseToken, now);
        const linked = this.database
          .query(
            `SELECT 1 FROM stack_activation_endpoints
             WHERE activation_id = $activationId AND lease_id = $leaseId
               AND state = 'leased'`,
          )
          .get({ activationId, leaseId: credential.leaseId });
        if (linked === null) {
          throw new RegistryError(
            'conflict',
            `Lease ${credential.leaseId} does not belong to activation ${activationId}.`,
          );
        }
      }
      for (const credential of credentials) {
        this.database
          .query(
            `UPDATE leases SET expires_at = $expiresAt, updated_at = $timestamp
             WHERE id = $leaseId AND state = 'pending'`,
          )
          .run({ expiresAt, timestamp, leaseId: credential.leaseId });
      }
      this.database
        .query('UPDATE stack_activations SET updated_at = $timestamp WHERE id = $id')
        .run({ timestamp, id: activationId });
      this.#appendHistory(
        'stack.activation.renewed',
        'stack-activation',
        activationId,
        { leaseIds: credentials.map(({ leaseId }) => leaseId), expiresAt },
        timestamp,
      );
    });
    renewed.immediate();
    const activation = this.getStackActivation(activationId);
    if (activation === null) {
      throw new RegistryError('internal', `Activation ${activationId} disappeared.`);
    }
    return {
      activation,
      leases: credentials.map(({ leaseId }) => ({ leaseId, expiresAt })),
    };
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
   *   listenerFingerprints?: Record<string, unknown>[],
   *   activationId?: string
   * }} input
   * @param {Date} [now]
   */
  confirmLease(input, now = new Date()) {
    const leaseId = IdentifierSchema.parse(input.leaseId);
    const rootPid = z.number().int().positive().parse(input.rootPid);
    const rootFingerprint = input.rootFingerprint ?? null;
    const listenerFingerprints = input.listenerFingerprints ?? [];
    const activationId =
      input.activationId === undefined
        ? null
        : IdentifierSchema.parse(input.activationId);
    const timestamp = toTimestamp(now);
    const runId = randomUUID();

    const confirm = this.database.transaction(() => {
      const lease = this.getLease(leaseId);
      if (lease === null) {
        throw new RegistryError('not_found', `Lease ${leaseId} was not found.`);
      }
      this.#assertPendingLease(lease, input.token, now);
      if (activationId !== null) {
        const endpoint = this.database
          .query(
            `SELECT 1 FROM stack_activation_endpoints endpoint
             JOIN stack_activations activation ON activation.id = endpoint.activation_id
             WHERE endpoint.activation_id = $activationId
               AND endpoint.lease_id = $leaseId
               AND endpoint.state = 'leased'
               AND activation.state = 'starting'`,
          )
          .get({ activationId, leaseId });
        if (endpoint === null) {
          throw new RegistryError(
            'conflict',
            `Lease ${leaseId} is not confirmable for activation ${activationId}.`,
          );
        }
      }
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
             id, claim_id, lease_id, port, state, binding_kind, root_pid,
             root_fingerprint_json, container_id, provider_evidence_json,
             confirmed_at, released_at
           ) VALUES (
             $id, $claimId, $leaseId, $port, 'confirmed', 'process', $rootPid,
             $rootFingerprint, NULL, NULL, $timestamp, NULL
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

      if (activationId !== null) {
        this.database
          .query(
            `UPDATE stack_activation_endpoints
             SET state = 'confirmed', run_id = $runId,
                 failure_reason = NULL, updated_at = $timestamp
             WHERE activation_id = $activationId AND lease_id = $leaseId
               AND state = 'leased'`,
          )
          .run({ runId, timestamp, activationId, leaseId });
        this.#refreshStackActivationState(activationId, timestamp);
      }

      this.#appendHistory(
        'lease.confirmed',
        'lease',
        leaseId,
        {
          runId,
          claimId: lease.claimId,
          port: lease.port,
          rootPid,
          ...(activationId === null ? {} : { activationId }),
        },
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
   *   containerId: string,
   *   providerEvidence: Record<string, unknown>,
   *   activationId: string
   * }} input
   * @param {Date} [now]
   */
  confirmDockerLease(input, now = new Date()) {
    const leaseId = IdentifierSchema.parse(input.leaseId);
    const activationId = IdentifierSchema.parse(input.activationId);
    const containerId = z
      .string()
      .regex(/^[a-f0-9]{12,64}$/u)
      .parse(input.containerId);
    const providerEvidence = z
      .record(z.string(), z.unknown())
      .parse(input.providerEvidence);
    const timestamp = toTimestamp(now);
    const runId = randomUUID();

    const confirm = this.database.transaction(() => {
      const lease = this.getLease(leaseId);
      if (lease === null) {
        throw new RegistryError('not_found', `Lease ${leaseId} was not found.`);
      }
      this.#assertPendingLease(lease, input.token, now);
      const endpoint = this.database
        .query(
          `SELECT 1 FROM stack_activation_endpoints endpoint
           JOIN stack_activations activation ON activation.id = endpoint.activation_id
           WHERE endpoint.activation_id = $activationId
             AND endpoint.lease_id = $leaseId
             AND endpoint.binding_kind = 'docker'
             AND endpoint.state = 'leased'
             AND activation.state = 'starting'`,
        )
        .get({ activationId, leaseId });
      if (endpoint === null) {
        throw new RegistryError(
          'conflict',
          `Lease ${leaseId} is not Docker-confirmable for activation ${activationId}.`,
        );
      }
      const claim = this.getClaim(lease.claimId);
      if (claim === null) {
        throw new RegistryError(
          'internal',
          `Claim ${lease.claimId} disappeared before Docker confirmation.`,
        );
      }
      const settings = this.getSettings();
      this.database
        .query(
          `UPDATE leases SET state = 'confirmed', updated_at = $timestamp
           WHERE id = $leaseId AND state = 'pending'`,
        )
        .run({ timestamp, leaseId });
      this.database
        .query(
          `UPDATE claims
           SET assigned_port = $port, assignment_expires_at = $assignmentExpiresAt,
               updated_at = $timestamp, last_used_at = $timestamp
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
          timestamp,
          claimId: lease.claimId,
        });
      this.database
        .query(
          `INSERT INTO runs (
             id, claim_id, lease_id, port, state, binding_kind, root_pid,
             root_fingerprint_json, container_id, provider_evidence_json,
             confirmed_at, released_at
           ) VALUES (
             $id, $claimId, $leaseId, $port, 'confirmed', 'docker', NULL,
             NULL, $containerId, $providerEvidence, $timestamp, NULL
           )`,
        )
        .run({
          id: runId,
          claimId: lease.claimId,
          leaseId,
          port: lease.port,
          containerId,
          providerEvidence: JSON.stringify(providerEvidence),
          timestamp,
        });
      this.database
        .query(
          `UPDATE stack_activation_endpoints
           SET state = 'confirmed', run_id = $runId,
               failure_reason = NULL, updated_at = $timestamp
           WHERE activation_id = $activationId AND lease_id = $leaseId
             AND binding_kind = 'docker' AND state = 'leased'`,
        )
        .run({ runId, timestamp, activationId, leaseId });
      this.#refreshStackActivationState(activationId, timestamp);
      this.#appendHistory(
        'lease.confirmed',
        'lease',
        leaseId,
        {
          runId,
          claimId: lease.claimId,
          port: lease.port,
          bindingKind: 'docker',
          containerId,
          activationId,
        },
        timestamp,
      );
    });
    confirm.immediate();
    const run = this.getRun(runId);
    if (run === null) {
      throw new RegistryError('internal', `Docker run ${runId} was not persisted.`);
    }
    return run;
  }

  /**
   * @param {{
   *   leaseId: string,
   *   token: string,
   *   reason: 'address-in-use' | 'startup-error' | 'client-cancelled',
   *   activationId?: string,
   *   endpointOutcome?: 'failed' | 'skipped'
   * }} input
   * @param {Date} [now]
   */
  abandonLease(input, now = new Date()) {
    const leaseId = IdentifierSchema.parse(input.leaseId);
    const reason = z
      .enum(['address-in-use', 'startup-error', 'client-cancelled'])
      .parse(input.reason);
    const timestamp = toTimestamp(now);
    const activationId =
      input.activationId === undefined
        ? null
        : IdentifierSchema.parse(input.activationId);
    const endpointOutcome = z
      .enum(['failed', 'skipped'])
      .optional()
      .parse(input.endpointOutcome);

    const abandon = this.database.transaction(() => {
      const lease = this.getLease(leaseId);
      if (lease === null) {
        throw new RegistryError('not_found', `Lease ${leaseId} was not found.`);
      }
      this.#assertPendingLease(lease, input.token, now);
      if (activationId !== null) {
        const endpoint = /** @type {{required: number}|null} */ (
          this.database
            .query(
              `SELECT required FROM stack_activation_endpoints
               WHERE activation_id = $activationId AND lease_id = $leaseId
                 AND state = 'leased'`,
            )
            .get({ activationId, leaseId })
        );
        if (endpoint === null) {
          throw new RegistryError(
            'conflict',
            `Lease ${leaseId} does not belong to activation ${activationId}.`,
          );
        }
        if (endpointOutcome === 'skipped' && endpoint.required === 1) {
          throw new RegistryError(
            'invalid_input',
            'A required endpoint cannot be skipped.',
          );
        }
      }

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
      if (activationId !== null) {
        const outcome = endpointOutcome ?? 'failed';
        this.database
          .query(
            `UPDATE stack_activation_endpoints
             SET state = $outcome, failure_reason = $reason, updated_at = $timestamp
             WHERE activation_id = $activationId AND lease_id = $leaseId
               AND state = 'leased'`,
          )
          .run({ outcome, reason, timestamp, activationId, leaseId });
        this.#refreshStackActivationState(activationId, timestamp);
      }
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
      const affectedActivations = new Set();
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
        const activationRows = this.database
          .query(
            `SELECT activation_id FROM stack_activation_endpoints
             WHERE lease_id = $leaseId AND state = 'leased'`,
          )
          .all({ leaseId: row.id });
        for (const activationRow of activationRows) {
          const parsedActivation = z
            .object({ activation_id: IdentifierSchema })
            .parse(activationRow);
          affectedActivations.add(parsedActivation.activation_id);
        }
        this.database
          .query(
            `UPDATE stack_activation_endpoints
             SET state = 'failed', failure_reason = 'lease-expired',
                 updated_at = $timestamp
             WHERE lease_id = $leaseId AND state = 'leased'`,
          )
          .run({ timestamp, leaseId: row.id });
      }
      for (const activationId of affectedActivations) {
        this.#refreshStackActivationState(String(activationId), timestamp);
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

  /** @param {string} stackId @param {Date} [now] */
  deleteStack(stackId, now = new Date()) {
    const id = IdentifierSchema.parse(stackId);
    const timestamp = toTimestamp(now);
    const remove = this.database.transaction(() => {
      const stack = this.getStack(id);
      if (stack === null) {
        throw new RegistryError('not_found', `Stack ${id} was not found.`);
      }
      const liveActivation = this.getLiveStackActivationForStack(id);
      if (liveActivation !== null) {
        throw new RegistryError(
          'conflict',
          `Stack ${id} still has a live activation.`,
          {
            stackId: id,
            activationId: liveActivation.id,
            reason: 'activation_live',
          },
        );
      }
      const claims = this.listStackClaims(id);
      for (const claim of claims) {
        this.#assertClaimHasNoActiveWork(claim.id, now);
      }
      const counts = {
        revisions: countFor(
          this.database,
          'SELECT COUNT(*) AS count FROM stack_definition_revisions WHERE stack_id = $id',
          id,
        ),
        generations: countFor(
          this.database,
          'SELECT COUNT(*) AS count FROM stack_generations WHERE stack_id = $id',
          id,
        ),
        activations: countFor(
          this.database,
          'SELECT COUNT(*) AS count FROM stack_activations WHERE stack_id = $id',
          id,
        ),
        claims: claims.length,
      };
      this.database.query('DELETE FROM stacks WHERE id = $id').run({ id });
      for (const claim of claims) {
        this.database.query('DELETE FROM runs WHERE claim_id = $claimId').run({
          claimId: claim.id,
        });
        this.database.query('DELETE FROM leases WHERE claim_id = $claimId').run({
          claimId: claim.id,
        });
        this.database.query('DELETE FROM claims WHERE id = $claimId').run({
          claimId: claim.id,
        });
        this.#appendHistory(
          'claim.pruned',
          'claim',
          claim.id,
          { claim, reason: 'pruned', source: 'stack-prune', stackId: id },
          timestamp,
        );
      }
      this.#appendHistory(
        'stack.pruned',
        'stack',
        id,
        {
          identity: {
            project: stack.project,
            workspaceRoot: stack.workspaceRoot,
          },
          currentRevision: stack.currentRevision,
          claimIds: claims.map(({ id: claimId }) => claimId),
          counts,
        },
        timestamp,
      );
      return {
        stackId: id,
        claimIds: claims.map(({ id: claimId }) => claimId),
        counts,
      };
    });
    return remove.immediate();
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

  /** @param {string} activationId @param {string} timestamp */
  #refreshStackActivationState(activationId, timestamp) {
    const current = /** @type {{state: string}|null} */ (
      this.database
        .query('SELECT state FROM stack_activations WHERE id = $activationId')
        .get({ activationId })
    );
    if (current === null || ['lost', 'ended'].includes(current.state)) return;
    const endpoints = this.database
      .query(
        `SELECT required, state FROM stack_activation_endpoints
         WHERE activation_id = $activationId`,
      )
      .all({ activationId })
      .map((row) =>
        z
          .object({
            required: z.union([z.literal(0), z.literal(1)]),
            state: z.enum(['leased', 'confirmed', 'skipped', 'failed', 'released']),
          })
          .parse(row),
      );
    const requiredFailed = endpoints.some(
      ({ required, state }) =>
        required === 1 && ['failed', 'skipped', 'released'].includes(state),
    );
    if (requiredFailed) {
      const cancelledLeases = this.database
        .query(
          `SELECT lease_id, port FROM stack_activation_endpoints
           WHERE activation_id = $activationId AND state = 'leased'
             AND lease_id IS NOT NULL`,
        )
        .all({ activationId })
        .map((row) =>
          z.object({ lease_id: IdentifierSchema, port: PortSchema }).parse(row),
        );
      this.database
        .query(
          `UPDATE leases
           SET state = 'abandoned', updated_at = $timestamp
           WHERE state = 'pending' AND id IN (
             SELECT lease_id FROM stack_activation_endpoints
             WHERE activation_id = $activationId AND state = 'leased'
               AND lease_id IS NOT NULL
           )`,
        )
        .run({ timestamp, activationId });
      for (const lease of cancelledLeases) {
        this.#appendHistory(
          'lease.abandoned',
          'lease',
          lease.lease_id,
          {
            reason: 'activation-failed',
            activationId,
            port: lease.port,
          },
          timestamp,
        );
      }
      this.database
        .query(
          `UPDATE stack_activation_endpoints
           SET state = 'failed',
               failure_reason = COALESCE(failure_reason, 'activation-failed'),
               updated_at = $timestamp
           WHERE activation_id = $activationId AND state = 'leased'`,
        )
        .run({ timestamp, activationId });
    }
    const pending = endpoints.some(({ state }) => state === 'leased');
    const degraded = endpoints.some(
      ({ required, state }) =>
        required === 0 && ['failed', 'skipped', 'released'].includes(state),
    );
    const state = requiredFailed
      ? 'failed'
      : pending
        ? 'starting'
        : degraded
          ? 'degraded'
          : 'confirmed';
    this.database
      .query(
        `UPDATE stack_activations
         SET state = $state, updated_at = $timestamp,
             confirmed_at = CASE
               WHEN $state IN ('confirmed', 'degraded')
                 THEN COALESCE(confirmed_at, $timestamp)
               ELSE confirmed_at
             END
         WHERE id = $activationId`,
      )
      .run({ state, timestamp, activationId });
    if (current.state !== state) {
      this.#appendHistory(
        'stack.activation.state_changed',
        'stack-activation',
        activationId,
        { from: current.state, to: state },
        timestamp,
      );
    }
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
    bindingKind: parsed.binding_kind,
    rootPid: parsed.root_pid,
    rootFingerprint:
      parsed.root_fingerprint_json === null
        ? null
        : parseJsonObject(parsed.root_fingerprint_json),
    containerId: parsed.container_id,
    providerEvidence:
      parsed.provider_evidence_json === null
        ? null
        : parseJsonObject(parsed.provider_evidence_json),
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

/** @param {Database} database @param {string} sql @param {string} id */
function countFor(database, sql, id) {
  const row = database.query(sql).get({ id });
  return z.object({ count: z.number().int().min(0) }).parse(row).count;
}
