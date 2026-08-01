// @ts-check

import { z } from 'zod';

const TimestampSchema = z.iso.datetime({ offset: true });
const SemanticVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);

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
          ]),
          claim: z
            .object({
              project: z.string().min(1),
              service: z.string().min(1),
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
    errors: z.array(
      z
        .object({
          source: z.enum(['lifecycle', 'inventory']),
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
        })
        .strict(),
    ),
    snapshot: DesktopSnapshotSchema,
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
});
