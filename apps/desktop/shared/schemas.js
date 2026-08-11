// @ts-check

import { z } from 'zod';
import {
  LauncherEvidenceSummarySchema,
  LauncherFailureSummarySchema,
  LauncherIntegrationSummarySchema,
  StackDefinitionSchema,
} from '../../../src/protocol/schemas.js';
import { LauncherDefinitionSchema } from '../../../src/launcher/definition.js';
import { LauncherEnvironmentMappingSchema } from '../../../src/launcher/definition.js';
import { McpSetupRequestSchema, McpSetupResultSchema } from '../../../src/mcp/setup.js';

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

export const DesktopMcpSetupRequestSchema = McpSetupRequestSchema;
export const DesktopMcpSetupResultSchema = McpSetupResultSchema;

const DesktopLauncherFileStateSchema = z.enum(['missing', 'valid', 'invalid']);
const DesktopLauncherOperationSchema = z.enum(['start', 'stop', 'restart', 'status']);
const DesktopLauncherOutcomeSchema = z.enum([
  'succeeded',
  'failed',
  'cancelled',
  'timed-out',
  'lost',
]);
const DesktopLauncherOutputChunkSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    stream: z.enum(['stdout', 'stderr', 'system']),
    text: z.string().max(262_144),
  })
  .strict();

const DesktopLauncherCommandSuggestionSchema = z
  .object({
    command: z.string().min(1).max(65_536),
    provenance: z
      .object({
        kind: z.enum(['package-script', 'make-target', 'docker-compose']),
        filename: z.string().min(1).max(255),
        detail: z.string().min(1).max(128),
      })
      .strict(),
  })
  .strict();

const DesktopLauncherSuggestionsSchema = z
  .object({
    inspectedFiles: z.array(z.string().min(1).max(255)).max(32),
    operations: z
      .record(
        DesktopLauncherOperationSchema,
        z
          .object({
            suggestion: DesktopLauncherCommandSuggestionSchema.nullable(),
            candidates: z.array(DesktopLauncherCommandSuggestionSchema).max(16),
          })
          .strict(),
      )
      .refine((operations) => Object.keys(operations).length === 4),
    environment: z.array(LauncherEnvironmentMappingSchema).max(4_096),
    error: SafeErrorSchema.nullable(),
  })
  .strict();

export const DesktopLauncherOutputSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: IdentifierSchema,
    stackId: IdentifierSchema,
    operation: DesktopLauncherOperationSchema,
    chunks: z.array(DesktopLauncherOutputChunkSchema),
    truncated: z.boolean(),
    retainedBytes: z.number().int().nonnegative().max(1_048_576),
    totalBytes: z.number().int().nonnegative(),
  })
  .strict();

export const DesktopLauncherOutputEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: IdentifierSchema,
    stackId: IdentifierSchema,
    operation: DesktopLauncherOperationSchema,
    chunk: DesktopLauncherOutputChunkSchema,
  })
  .strict();

const DesktopLauncherHistoryRecordSchema = z
  .object({
    id: IdentifierSchema,
    operation: DesktopLauncherOperationSchema,
    executionMode: z.enum(['finite', 'attached']),
    launcherRevision: z.string().regex(/^[a-f0-9]{64}$/),
    generationId: IdentifierSchema.nullable(),
    state: z.enum(['active', 'terminal']),
    outcome: DesktopLauncherOutcomeSchema.nullable(),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
    durationMilliseconds: z.number().int().nonnegative().nullable(),
    exitCode: z.number().int().min(0).max(255).nullable(),
    signal: z.string().min(1).max(32).nullable(),
    degraded: z.boolean(),
    beforeEvidence: LauncherEvidenceSummarySchema.nullable(),
    afterEvidence: LauncherEvidenceSummarySchema.nullable(),
    failure: LauncherFailureSummarySchema.nullable(),
    integration: LauncherIntegrationSummarySchema.nullable(),
  })
  .strict();

const DesktopLauncherSummarySchema = z
  .object({
    stackId: IdentifierSchema,
    project: z.string().min(1),
    stackRootName: z.string().min(1),
    fileState: DesktopLauncherFileStateSchema,
    revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    trusted: z.boolean(),
    integrationMode: z.enum(['command-only', 'verified-activation']).nullable(),
    startMode: z.enum(['finite', 'attached']).nullable(),
    attached: z.boolean(),
    evidence: LauncherEvidenceSummarySchema.nullable(),
    history: z.array(DesktopLauncherHistoryRecordSchema).max(20),
    error: SafeErrorSchema.nullable(),
  })
  .strict();

export const DesktopLauncherSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    observedAt: TimestampSchema,
    stale: z.boolean(),
    launchers: z.array(DesktopLauncherSummarySchema),
    errors: z.array(
      z
        .object({
          stackId: IdentifierSchema.nullable(),
          code: z.string().min(1),
          message: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const DesktopLauncherDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentId: IdentifierSchema,
    stackId: IdentifierSchema,
    project: z.string().min(1),
    stackRootName: z.string().min(1),
    fileState: DesktopLauncherFileStateSchema,
    revision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    trusted: z.boolean(),
    canonical: z.boolean(),
    definition: LauncherDefinitionSchema.nullable(),
    suggestions: DesktopLauncherSuggestionsSchema,
    error: SafeErrorSchema.nullable(),
  })
  .strict();

export const DesktopLauncherDocumentOpenRequestSchema = z
  .object({ stackId: IdentifierSchema })
  .strict();

export const DesktopLauncherDocumentSaveRequestSchema = z
  .object({
    documentId: IdentifierSchema,
    definition: LauncherDefinitionSchema,
    overwrite: z.boolean().default(false),
    confirmDowngrade: z.boolean().default(false),
  })
  .strict();

export const DesktopLauncherDocumentMutationResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentId: IdentifierSchema,
    outcome: z.enum(['saved-and-trusted', 'conflict', 'invalid', 'failed']),
    saved: z.boolean(),
    trusted: z.boolean(),
    message: z.string().min(1),
    document: DesktopLauncherDocumentSchema.nullable(),
    error: SafeErrorSchema.nullable(),
  })
  .strict();

export const DesktopLauncherActionRequestSchema = z
  .object({
    stackId: IdentifierSchema,
    operation: DesktopLauncherOperationSchema,
    runStartAnyway: z.boolean().default(false),
    allowDegraded: z.boolean().default(false),
  })
  .strict();

export const DesktopLauncherSessionRequestSchema = z
  .object({ sessionId: IdentifierSchema })
  .strict();

export const DesktopLauncherStackRequestSchema = z
  .object({ stackId: IdentifierSchema })
  .strict();

const DesktopLauncherResultSchema = z
  .object({
    outcome: z.enum(['succeeded', 'failed', 'cancelled', 'timed-out']),
    degraded: z.boolean(),
    environmentSource: z.string().min(1).nullable(),
    beforeEvidence: LauncherEvidenceSummarySchema.nullable(),
    afterEvidence: LauncherEvidenceSummarySchema.nullable(),
    failure: LauncherFailureSummarySchema.nullable(),
    integration: LauncherIntegrationSummarySchema.nullable(),
    steps: z.array(
      z
        .object({
          step: DesktopLauncherOperationSchema,
          outcome: z.enum(['succeeded', 'failed', 'cancelled', 'timed-out']),
          startedAt: TimestampSchema,
          completedAt: TimestampSchema,
          durationMilliseconds: z.number().int().nonnegative(),
          exitCode: z.number().int().min(0).max(255).nullable(),
          signal: z.string().min(1).max(32).nullable(),
          failure: SafeErrorSchema.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const DesktopLauncherSessionSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: IdentifierSchema,
    stackId: IdentifierSchema,
    operation: DesktopLauncherOperationSchema,
    state: z.enum(['running', 'terminal']),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
    result: DesktopLauncherResultSchema.nullable(),
    output: DesktopLauncherOutputSchema,
  })
  .strict();

export const DesktopLauncherSessionEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: IdentifierSchema,
    stackId: IdentifierSchema,
    operation: DesktopLauncherOperationSchema,
    state: z.enum(['running', 'terminal']),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
    result: DesktopLauncherResultSchema.nullable(),
  })
  .strict();

export const DesktopLauncherTerminationResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    stackId: IdentifierSchema,
    requested: z.boolean(),
  })
  .strict();

export const DesktopLauncherSaveOutputResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    outcome: z.enum(['saved', 'cancelled']),
    filename: z.string().min(1).nullable(),
  })
  .strict();

export const DesktopLauncherCloseStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    allowed: z.boolean(),
    attached: z.array(
      z
        .object({
          stackId: IdentifierSchema,
          project: z.string().min(1),
          stackRootName: z.string().min(1),
          startedAt: TimestampSchema,
        })
        .strict(),
    ),
  })
  .strict();

const DesktopActiveLifecycleSchema = z
  .object({
    operation: z.enum([
      'install-and-start',
      'start',
      'stop',
      'stop-manual',
      'restart',
      'upgrade',
      'uninstall',
      'purge',
    ]),
    startedAt: TimestampSchema,
  })
  .strict();

export const DesktopApplicationCloseStateSchema =
  DesktopLauncherCloseStateSchema.extend({
    lifecycle: DesktopActiveLifecycleSchema.nullable(),
  }).strict();

export const DesktopLifecycleActivitySchema = z
  .object({
    schemaVersion: z.literal(1),
    active: DesktopActiveLifecycleSchema.nullable(),
  })
  .strict();

const DesktopStackDocumentIssueSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])),
  })
  .strict();

export const DesktopStackDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentId: IdentifierSchema,
    stackId: IdentifierSchema.nullable(),
    stackRootName: z.string().min(1),
    fileState: z.enum(['valid', 'missing', 'invalid']),
    seedSource: z.enum(['file', 'applied', 'new']),
    definition: StackDefinitionSchema.nullable(),
    suggestedProject: z.string().min(1),
    issues: z.array(DesktopStackDocumentIssueSchema),
  })
  .strict();

export const DesktopStackDocumentOpenResultSchema = z.discriminatedUnion('outcome', [
  z
    .object({
      schemaVersion: z.literal(1),
      outcome: z.literal('opened'),
      document: DesktopStackDocumentSchema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      outcome: z.literal('cancelled'),
      document: z.null(),
    })
    .strict(),
]);

export const DesktopStackDocumentSaveRequestSchema = z
  .object({
    documentId: IdentifierSchema,
    content: z.string().max(1_048_576),
    conflictToken: IdentifierSchema.nullable().optional(),
  })
  .strict();

export const DesktopStackDocumentRetryRequestSchema = z
  .object({ documentId: IdentifierSchema })
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
        controller: z
          .object({
            version: SemanticVersionSchema,
            mutationsEnabled: z.boolean(),
            error: SafeErrorSchema.nullable(),
          })
          .strict()
          .refine(
            ({ mutationsEnabled, error }) => mutationsEnabled === (error === null),
            'Lifecycle controller compatibility evidence is inconsistent.',
          ),
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

const DesktopLifecycleEvidenceSchema = z
  .object({
    mode: z.enum(['none', 'manual', 'supervised', 'ambiguous']),
    installation: z.enum(['absent', 'installed', 'invalid']),
    supervisor: z.enum(['unavailable', 'inactive', 'starting', 'active', 'failed']),
    socket: z.enum(['unavailable', 'healthy', 'unhealthy', 'incompatible']),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

const DesktopLifecycleErrorCodeSchema = z.enum([
  'lifecycle_busy',
  'lifecycle_timeout',
  'conflict',
  'incompatible_protocol',
  'not_found',
  'unsupported_platform',
  'controller_artifact_version_mismatch',
  'invalid_lifecycle_result',
  'invalid_lifecycle_status',
  'invalid_purge_preview',
  'invalid_purge_result',
  'purge_preview_required',
  'supervised_health_verification_failed',
  'unavailable',
  'lifecycle_unavailable',
  'internal',
]);

const DesktopLifecycleSafeErrorSchema = z
  .object({
    code: DesktopLifecycleErrorCodeSchema,
    message: z.string().min(1).max(512),
  })
  .strict();

const DesktopLifecycleFailureSchema = z
  .object({
    operation: z.enum([
      'install-and-start',
      'start',
      'stop',
      'stop-manual',
      'restart',
      'upgrade',
      'uninstall',
      'purge',
    ]),
    layer: z.enum([
      'controller',
      'install',
      'start',
      'stop',
      'stop-manual',
      'restart',
      'uninstall',
      'health-verification',
      'purge',
    ]),
    outcome: z.enum(['refused', 'partial', 'failed']),
    code: DesktopLifecycleErrorCodeSchema,
    message: z.string().min(1),
    timedOut: z.boolean(),
    nativeExitCode: z.number().int().min(0).max(255).nullable(),
    before: DesktopLifecycleEvidenceSchema.nullable(),
    after: DesktopLifecycleEvidenceSchema.nullable(),
    recovery: z.array(z.string().min(1).max(512)).min(1).max(4),
  })
  .strict();

export const DesktopLifecycleActionResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    action: DesktopLifecycleActionSchema,
    outcome: DesktopMutationOutcomeSchema,
    changed: z.boolean(),
    message: z.string().min(1),
    errorCode: DesktopLifecycleErrorCodeSchema.nullable(),
    error: DesktopLifecycleSafeErrorSchema.nullable(),
    failure: DesktopLifecycleFailureSchema.nullable(),
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
          errorCode: DesktopLifecycleErrorCodeSchema.nullable(),
          error: DesktopLifecycleSafeErrorSchema.nullable(),
          startedAt: TimestampSchema,
          completedAt: TimestampSchema,
          before: DesktopLifecycleEvidenceSchema,
          after: DesktopLifecycleEvidenceSchema,
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

export const DesktopStackDocumentMutationResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentId: IdentifierSchema,
    outcome: z.enum([
      'invalid',
      'conflict',
      'saved-and-applied',
      'saved-not-applied',
      'applied',
      'failed',
    ]),
    saved: z.boolean(),
    applied: z.boolean(),
    changed: z.boolean().nullable(),
    stackId: IdentifierSchema.nullable(),
    message: z.string().min(1),
    conflict: z
      .object({
        reason: z.enum([
          'appeared-after-open',
          'changed-after-open',
          'invalid-file-replacement',
          'changed-before-retry',
        ]),
        token: IdentifierSchema.nullable(),
      })
      .strict()
      .nullable(),
    issues: z.array(DesktopStackDocumentIssueSchema),
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
    outcome: z.enum(['succeeded', 'refused', 'partial', 'failed']),
    message: z.string().min(1),
    removed: z.array(z.string().min(1)),
    retained: z.array(z.string().min(1)),
    missing: z.array(z.string().min(1)),
    refused: z.array(DesktopPurgeRefusalSchema),
    errorCode: DesktopLifecycleErrorCodeSchema.nullable(),
    error: DesktopLifecycleSafeErrorSchema.nullable(),
    failure: DesktopLifecycleFailureSchema.nullable(),
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
  openStackDocument: 'portreeve:desktop:open-stack-document',
  openKnownStackDocument: 'portreeve:desktop:open-known-stack-document',
  saveStackDocument: 'portreeve:desktop:save-stack-document',
  retryStackDocumentApply: 'portreeve:desktop:retry-stack-document-apply',
  prepareStack: 'portreeve:desktop:prepare-stack',
  reconcileStack: 'portreeve:desktop:reconcile-stack',
  endStack: 'portreeve:desktop:end-stack',
  previewStackPrune: 'portreeve:desktop:preview-stack-prune',
  executeStackPrune: 'portreeve:desktop:execute-stack-prune',
  previewStackSnapshot: 'portreeve:desktop:preview-stack-snapshot',
  getLauncherSnapshot: 'portreeve:desktop:get-launcher-snapshot',
  openLauncherDocument: 'portreeve:desktop:open-launcher-document',
  saveLauncherDocument: 'portreeve:desktop:save-launcher-document',
  beginLauncherAction: 'portreeve:desktop:begin-launcher-action',
  getLauncherSession: 'portreeve:desktop:get-launcher-session',
  cancelLauncherSession: 'portreeve:desktop:cancel-launcher-session',
  terminateLauncherAttached: 'portreeve:desktop:terminate-launcher-attached',
  getLauncherOutput: 'portreeve:desktop:get-launcher-output',
  saveLauncherOutput: 'portreeve:desktop:save-launcher-output',
  launcherOutput: 'portreeve:desktop:launcher-output',
  launcherSessionChanged: 'portreeve:desktop:launcher-session-changed',
  lifecycleActivityChanged: 'portreeve:desktop:lifecycle-activity-changed',
  applicationCloseBlocked: 'portreeve:desktop:application-close-blocked',
  copyText: 'portreeve:desktop:copy-text',
  generateMcpSetup: 'portreeve:desktop:generate-mcp-setup',
});
