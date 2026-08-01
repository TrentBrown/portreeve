// @ts-check

import { z } from 'zod';

const TimestampSchema = z.iso.datetime({ offset: true });
const SemanticVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);

export const DesktopSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    refreshedAt: TimestampSchema,
    stale: z.boolean(),
    lastSuccessfulAt: TimestampSchema.nullable(),
    artifact: z
      .object({
        source: z.enum(['local-release-candidate', 'published']),
        version: SemanticVersionSchema,
        filename: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    lifecycle: z
      .object({
        observedAt: TimestampSchema,
        mode: z.enum(['none', 'manual', 'supervised', 'ambiguous']),
        installation: z
          .object({
            state: z.enum(['absent', 'installed', 'invalid']),
            version: SemanticVersionSchema.nullable(),
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
            })
            .strict()
            .nullable(),
          listeners: z.array(
            z
              .object({
                pid: z.number().int().positive(),
                verified: z.boolean(),
                reason: z.string().min(1),
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

export const IPC_CHANNELS = Object.freeze({
  getSnapshot: 'portreeve:desktop:get-snapshot',
  snapshotChanged: 'portreeve:desktop:snapshot-changed',
  refresh: 'portreeve:desktop:refresh',
});
