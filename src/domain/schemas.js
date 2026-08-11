// @ts-check

import { z } from 'zod';
import {
  ClaimIdentitySchema,
  ClaimModeSchema,
  IdentifierSchema,
  OperationOriginSchema,
  PortSchema,
  TimestampSchema,
} from '../protocol/schemas.js';

export const ClaimRecordSchema = z
  .object({
    id: IdentifierSchema,
    identity: ClaimIdentitySchema,
    mode: ClaimModeSchema,
    assignedPort: PortSchema.nullable(),
    preferredPort: PortSchema.nullable(),
    exactPort: PortSchema.nullable(),
    assignmentExpiresAt: TimestampSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    lastUsedAt: TimestampSchema,
  })
  .refine(
    ({ exactPort, preferredPort }) => exactPort === null || preferredPort === null,
    {
      message: 'preferredPort and exactPort are mutually exclusive',
    },
  );

export const LeaseStateSchema = z.enum([
  'pending',
  'confirmed',
  'abandoned',
  'expired',
  'collision',
]);

export const LeaseRecordSchema = z.object({
  id: IdentifierSchema,
  claimId: IdentifierSchema,
  port: PortSchema,
  state: LeaseStateSchema,
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: TimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const RunStateSchema = z.enum(['confirmed', 'released']);

export const RunRecordSchema = z
  .object({
    id: IdentifierSchema,
    claimId: IdentifierSchema,
    leaseId: IdentifierSchema,
    port: PortSchema,
    state: RunStateSchema,
    bindingKind: z.enum(['process', 'docker']),
    rootPid: z.number().int().positive().nullable(),
    rootFingerprint: z.record(z.string(), z.unknown()).nullable(),
    containerId: z.string().min(12).max(64).nullable(),
    providerEvidence: z.record(z.string(), z.unknown()).nullable(),
    confirmedAt: TimestampSchema,
    releasedAt: TimestampSchema.nullable(),
  })
  .superRefine((run, context) => {
    if (run.bindingKind === 'process' && run.rootPid === null) {
      context.addIssue({ code: 'custom', message: 'process runs require rootPid' });
    }
    if (run.bindingKind === 'docker' && run.containerId === null) {
      context.addIssue({ code: 'custom', message: 'docker runs require containerId' });
    }
  });

export const HistoryEventSchema = z.object({
  id: IdentifierSchema,
  eventType: z.string().min(1).max(128),
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  origin: OperationOriginSchema.nullable().default(null),
  occurredAt: TimestampSchema,
});
