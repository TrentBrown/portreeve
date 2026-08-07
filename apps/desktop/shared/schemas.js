// @ts-check

import { z } from 'zod';

const TimestampSchema = z.iso.datetime({ offset: true });
const SemanticVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const IdentifierSchema = z.uuid();
const SafeErrorSchema = z
  .object({ code: z.string().min(1), message: z.string().min(1) })
  .strict();
const StackAddressSchema = z
  .object({
    transport: z.literal('tcp'),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65_535),
  })
  .strict();
const DesktopStackResolvedEndpointSchema = z
  .object({
    alias: z.string().min(1),
    component: z.string().min(1),
    endpoint: z.string().min(1),
    host: StackAddressSchema,
    dockerNetwork: StackAddressSchema.nullable(),
  })
  .strict();
const DesktopStackSchema = z
  .object({
    id: IdentifierSchema,
    project: z.string().min(1),
    stackRootName: z.string().min(1),
    currentRevision: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    lastUsedAt: TimestampSchema,
    components: z.array(
      z
        .object({
          name: z.string().min(1),
          dockerService: z.string().min(1).nullable(),
          endpoints: z.array(
            z
              .object({
                name: z.string().min(1),
                publish: z.boolean(),
                required: z.boolean(),
                preferredPort: z.number().int().min(1).max(65_535).nullable(),
                exactPort: z.number().int().min(1).max(65_535).nullable(),
                containerPort: z.number().int().min(1).max(65_535).nullable(),
              })
              .strict(),
          ),
          dependencies: z.array(
            z
              .object({
                alias: z.string().min(1),
                component: z.string().min(1),
                endpoint: z.string().min(1),
                required: z.boolean(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    generation: z
      .object({
        id: IdentifierSchema,
        revision: z.string().regex(/^[a-f0-9]{64}$/),
        state: z.enum(['valid', 'stale']),
        createdAt: TimestampSchema,
        invalidatedAt: TimestampSchema.nullable(),
        endpoints: z.array(
          z
            .object({
              component: z.string().min(1),
              endpoint: z.string().min(1),
              host: z.literal('127.0.0.1'),
              port: z.number().int().min(1).max(65_535),
              required: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    activation: z
      .object({
        id: IdentifierSchema,
        generationId: IdentifierSchema,
        state: z.enum(['starting', 'confirmed', 'degraded', 'failed', 'lost', 'ended']),
        createdAt: TimestampSchema,
        updatedAt: TimestampSchema,
        confirmedAt: TimestampSchema.nullable(),
        endedAt: TimestampSchema.nullable(),
        endpoints: z.array(
          z
            .object({
              component: z.string().min(1),
              endpoint: z.string().min(1),
              port: z.number().int().min(1).max(65_535),
              required: z.boolean(),
              bindingKind: z.enum(['process', 'docker']),
              state: z.enum(['leased', 'confirmed', 'skipped', 'failed', 'released']),
              expiresAt: TimestampSchema.nullable(),
              failureReason: z.string().nullable(),
              updatedAt: TimestampSchema,
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    providers: z.array(
      z
        .object({
          component: z.string().min(1),
          endpoint: z.string().min(1),
          port: z.number().int().min(1).max(65_535),
          bindingKind: z.enum(['process', 'docker']),
          status: z.enum(['active', 'gone', 'unknown']),
          reason: z.string().min(1),
          listeners: z.number().int().nonnegative(),
          containerId: z.string().min(12).max(64).nullable(),
        })
        .strict(),
    ),
    resolutions: z.array(
      z
        .object({
          component: z.string().min(1),
          definitionRevision: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .nullable(),
          generationId: IdentifierSchema.nullable(),
          activationId: IdentifierSchema.nullable(),
          own: z.array(DesktopStackResolvedEndpointSchema),
          dependencies: z.array(DesktopStackResolvedEndpointSchema),
          error: SafeErrorSchema.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const DesktopUpdateManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    desktopVersion: SemanticVersionSchema,
  })
  .strict();

export const DesktopUpdateStateSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('not-checked'),
      checkedAt: z.null(),
      latestVersion: z.null(),
    })
    .strict(),
  z
    .object({
      status: z.literal('unavailable'),
      checkedAt: TimestampSchema,
      latestVersion: z.null(),
    })
    .strict(),
  z
    .object({
      status: z.enum(['current', 'available']),
      checkedAt: TimestampSchema,
      latestVersion: SemanticVersionSchema,
    })
    .strict(),
]);

export const DesktopOpenDownloadResultSchema = z
  .object({ schemaVersion: z.literal(1), opened: z.literal(true) })
  .strict();

export const DesktopCopyTextRequestSchema = z
  .object({ text: z.string().max(65_536) })
  .strict();

export const DesktopCopyTextResultSchema = z
  .object({ schemaVersion: z.literal(1), copied: z.literal(true) })
  .strict();

export const DesktopSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    refreshedAt: TimestampSchema,
    stale: z.boolean(),
    lastSuccessfulAt: TimestampSchema.nullable(),
    artifact: z
      .object({
        source: z.enum(['local-release-candidate', 'published']),
        desktopVersion: SemanticVersionSchema,
        version: SemanticVersionSchema,
        filename: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    update: DesktopUpdateStateSchema,
    lifecycle: z
      .object({
        observedAt: TimestampSchema,
        mode: z.enum(['none', 'manual', 'supervised', 'ambiguous']),
        installation: z
          .object({
            state: z.enum(['absent', 'installed', 'invalid']),
            version: SemanticVersionSchema.nullable(),
            managedLocation: z.string().min(1),
            hasError: z.boolean(),
          })
          .strict(),
        supervisor: z
          .object({
            kind: z.string().min(1),
            state: z.enum(['unavailable', 'inactive', 'starting', 'active', 'failed']),
            mainPid: z.number().int().positive().nullable(),
            hasError: z.boolean(),
          })
          .strict(),
        socket: z
          .object({
            state: z.enum(['unavailable', 'healthy', 'unhealthy', 'incompatible']),
            serverPid: z.number().int().positive().nullable(),
            serverVersion: SemanticVersionSchema.nullable(),
            hasError: z.boolean(),
          })
          .strict(),
        versions: z
          .object({
            cli: SemanticVersionSchema,
            managed: SemanticVersionSchema.nullable(),
            running: SemanticVersionSchema.nullable(),
          })
          .strict(),
        limitations: z.array(z.string().min(1)),
      })
      .strict()
      .nullable(),
    ports: z.array(
      z
        .object({
          port: z.number().int().min(1).max(65_535),
          classification: z.enum([
            'available',
            'verified',
            'idle',
            'pending',
            'unclaimed',
            'conflicting',
            'mixed',
            'docker-managed',
          ]),
          claim: z
            .object({
              project: z.string().min(1),
              service: z.string().min(1),
              component: z.string().min(1),
              endpoint: z.string().min(1),
              workspaceName: z.string().min(1),
              mode: z.enum(['sticky', 'ephemeral']),
              createdAt: TimestampSchema,
              updatedAt: TimestampSchema,
              lastUsedAt: TimestampSchema,
              assignmentExpiresAt: TimestampSchema.nullable(),
            })
            .strict()
            .nullable(),
          run: z
            .object({
              state: z.enum(['confirmed', 'released']),
              rootPid: z.number().int().positive(),
              confirmedAt: TimestampSchema,
              releasedAt: TimestampSchema.nullable(),
            })
            .strict()
            .nullable(),
          listeners: z.array(
            z
              .object({
                pid: z.number().int().positive(),
                names: z.array(z.string().min(1)),
                verified: z.boolean(),
                reason: z.string().min(1),
                lineage: z.array(z.number().int().positive()),
                process: z
                  .object({
                    parentPid: z.number().int().nonnegative(),
                    uid: z.number().int().nonnegative(),
                    startTime: TimestampSchema,
                    executableName: z.string().min(1),
                    workingDirectory: z.string().min(1),
                  })
                  .strict()
                  .nullable(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    stacks: z.array(DesktopStackSchema),
    errors: z.array(
      z
        .object({
          source: z.enum(['lifecycle', 'inventory', 'stacks']),
          code: z.string().min(1),
          message: z.string().min(1),
          observedAt: TimestampSchema,
        })
        .strict(),
    ),
  })
  .strict();

export const DesktopLifecycleActionSchema = z.enum([
  'install-and-start',
  'start',
  'stop',
  'stop-manual',
  'restart',
  'upgrade',
  'uninstall',
]);

const DesktopMutationOutcomeSchema = z.enum([
  'succeeded',
  'no-change',
  'refused',
  'partial',
  'failed',
]);

export const DesktopLifecycleActionResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    action: DesktopLifecycleActionSchema,
    outcome: DesktopMutationOutcomeSchema,
    changed: z.boolean(),
    message: z.string().min(1),
    errorCode: z.string().min(1).nullable(),
    error: SafeErrorSchema.nullable(),
    steps: z.array(
      z
        .object({
          operation: z.enum([
            'install',
            'start',
            'stop',
            'stop-manual',
            'restart',
            'uninstall',
          ]),
          outcome: DesktopMutationOutcomeSchema,
          changed: z.boolean(),
          errorCode: z.string().min(1).nullable(),
          error: SafeErrorSchema.nullable(),
        })
        .strict(),
    ),
    snapshot: DesktopSnapshotSchema,
  })
  .strict();

export const DesktopStackActionRequestSchema = z
  .object({ id: IdentifierSchema })
  .strict();

export const DesktopStackSnapshotRequestSchema = z
  .object({
    activationId: IdentifierSchema,
    component: z.string().min(1).max(128),
    gatewayHost: z.string().min(1).max(253),
  })
  .strict();

export const DesktopStackActionResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    action: z.enum(['apply', 'prepare', 'reconcile', 'end']),
    outcome: z.enum(['succeeded', 'no-change', 'cancelled', 'failed']),
    changed: z.boolean(),
    message: z.string().min(1),
    error: SafeErrorSchema.nullable(),
    snapshot: DesktopSnapshotSchema,
  })
  .strict();

const DesktopStackPruneCandidateSchema = z
  .object({
    stackId: IdentifierSchema,
    project: z.string().min(1),
    stackRootName: z.string().min(1),
    claimCount: z.number().int().nonnegative(),
    reason: z.literal('stack-root-missing'),
  })
  .strict();

export const DesktopStackPrunePreviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    olderThanDays: z.number().int().positive(),
    candidates: z.array(DesktopStackPruneCandidateSchema),
    blocked: z.array(
      z
        .object({
          stackId: IdentifierSchema,
          project: z.string().min(1),
          stackRootName: z.string().min(1),
          reasons: z.array(z.string().min(1)),
        })
        .strict(),
    ),
  })
  .strict();

export const DesktopStackPruneExecutionRequestSchema = z
  .object({ confirmation: z.literal('PRUNE') })
  .strict();

export const DesktopStackPruneResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    outcome: z.enum(['succeeded', 'no-change', 'partial']),
    message: z.string().min(1),
    deletedStacks: z.number().int().nonnegative(),
    deletedClaims: z.number().int().nonnegative(),
    skipped: z.array(
      z.object({ stackId: IdentifierSchema, reason: z.string().min(1) }).strict(),
    ),
    snapshot: DesktopSnapshotSchema,
  })
  .strict();

export const DesktopStackEndpointSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    definitionRevision: z.string().regex(/^[a-f0-9]{64}$/),
    generationId: IdentifierSchema,
    activationId: IdentifierSchema,
    component: z.string().min(1),
    own: z.array(DesktopStackResolvedEndpointSchema),
    dependencies: z.array(DesktopStackResolvedEndpointSchema),
  })
  .strict();

const DesktopPurgeRefusalSchema = z
  .object({
    path: z.string().min(1).nullable(),
    reason: z.string().min(1),
  })
  .strict();

export const DesktopPurgePreviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    allowed: z.boolean(),
    root: z.string().min(1),
    paths: z.array(
      z
        .object({
          path: z.string().min(1),
          type: z.enum(['directory', 'file', 'socket', 'symlink', 'other']),
          size: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    refused: z.array(DesktopPurgeRefusalSchema),
  })
  .strict();

export const DesktopPurgeExecutionRequestSchema = z
  .object({ confirmation: z.literal('DELETE') })
  .strict();

export const DesktopPurgeResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    outcome: z.enum(['succeeded', 'refused', 'partial']),
    message: z.string().min(1),
    removed: z.array(z.string().min(1)),
    retained: z.array(z.string().min(1)),
    missing: z.array(z.string().min(1)),
    refused: z.array(DesktopPurgeRefusalSchema),
    snapshot: DesktopSnapshotSchema,
  })
  .strict();

export const IPC_CHANNELS = Object.freeze({
  getSnapshot: 'portreeve:desktop:get-snapshot',
  snapshotChanged: 'portreeve:desktop:snapshot-changed',
  refresh: 'portreeve:desktop:refresh',
  installAndStart: 'portreeve:desktop:install-and-start',
  start: 'portreeve:desktop:start',
  stop: 'portreeve:desktop:stop',
  stopManual: 'portreeve:desktop:stop-manual',
  restart: 'portreeve:desktop:restart',
  upgrade: 'portreeve:desktop:upgrade',
  uninstall: 'portreeve:desktop:uninstall',
  previewPurge: 'portreeve:desktop:preview-purge',
  executePurge: 'portreeve:desktop:execute-purge',
  openDownloadPage: 'portreeve:desktop:open-download-page',
  applyStackDefinition: 'portreeve:desktop:apply-stack-definition',
  prepareStack: 'portreeve:desktop:prepare-stack',
  reconcileStack: 'portreeve:desktop:reconcile-stack',
  endStack: 'portreeve:desktop:end-stack',
  previewStackPrune: 'portreeve:desktop:preview-stack-prune',
  executeStackPrune: 'portreeve:desktop:execute-stack-prune',
  previewStackSnapshot: 'portreeve:desktop:preview-stack-snapshot',
  copyText: 'portreeve:desktop:copy-text',
});
