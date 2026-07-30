// @ts-check

import { z } from 'zod';
import { PORTREEVE_VERSION } from '../version.js';
import {
  CAPABILITIES,
  ERROR_CODES,
  PROTOCOL_RANGE,
  PROTOCOL_VERSION,
} from './constants.js';

export const PortSchema = z.number().int().min(1).max(65_535);
export const TimestampSchema = z.iso.datetime({ offset: true });
export const IdentifierSchema = z.uuid();
export const LeaseTokenSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const ProtocolRangeSchema = z
  .object({
    minimum: z.number().int().positive(),
    maximum: z.number().int().positive(),
  })
  .refine(({ maximum, minimum }) => minimum <= maximum, {
    message: 'minimum protocol version must not exceed maximum',
  });

export const ClientCompatibilitySchema = z.object({
  softwareVersion: z.string().min(1),
  protocol: ProtocolRangeSchema,
  requiredCapabilities: z.array(z.string().min(1)).default([]),
});

export const ClaimIdentitySchema = z.object({
  project: z.string().trim().min(1).max(128),
  workspaceRoot: z.string().min(1),
  service: z.string().trim().min(1).max(128),
  transport: z.literal('tcp'),
});

export const ClaimModeSchema = z.enum(['sticky', 'ephemeral']);
export const ReplacementPolicySchema = z.enum([
  'never',
  'graceful',
  'force-after-grace',
]);

export const AllocationIntentSchema = z
  .object({
    mode: ClaimModeSchema.default('sticky'),
    preferredPort: PortSchema.optional(),
    exactPort: PortSchema.optional(),
    replacementPolicy: ReplacementPolicySchema.default('never'),
  })
  .refine(
    ({ exactPort, preferredPort }) =>
      exactPort === undefined || preferredPort === undefined,
    {
      message: 'preferredPort and exactPort are mutually exclusive',
    },
  );

export const AcquireRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  claim: ClaimIdentitySchema,
  allocation: AllocationIntentSchema,
});

export const AcquireResponseSchema = z.object({
  claimId: IdentifierSchema,
  leaseId: IdentifierSchema,
  leaseToken: LeaseTokenSchema,
  port: PortSchema,
  expiresAt: TimestampSchema,
  reusedAssignment: z.boolean(),
});

export const ConfirmRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  leaseId: IdentifierSchema,
  leaseToken: LeaseTokenSchema,
  rootPid: z.number().int().positive(),
});

export const ConfirmResponseSchema = z.object({
  claimId: IdentifierSchema,
  leaseId: IdentifierSchema,
  runId: IdentifierSchema,
  port: PortSchema,
  confirmedAt: TimestampSchema,
});

export const AbandonRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  leaseId: IdentifierSchema,
  leaseToken: LeaseTokenSchema,
  reason: z.enum(['address-in-use', 'startup-error', 'client-cancelled']),
});

export const ReleaseRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  runId: IdentifierSchema,
});

export const MutationAcknowledgementSchema = z.object({
  changed: z.boolean(),
  at: TimestampSchema,
});

export const HealthResponseSchema = z.object({
  softwareVersion: z.string().min(1),
  protocol: ProtocolRangeSchema,
  capabilities: z.array(z.string().min(1)).readonly(),
  pid: z.number().int().positive(),
  mode: z.enum(['manual', 'supervised']),
});

export const InventoryClassificationSchema = z.enum([
  'available',
  'verified',
  'idle',
  'pending',
  'unclaimed',
  'conflicting',
  'mixed',
]);

export const OwnershipEvidenceSchema = z.object({
  verified: z.boolean(),
  reason: z.string().min(1),
  lineage: z.array(z.number().int().positive()),
});

export const ListenerEvidenceSchema = z.object({
  pid: z.number().int().positive(),
  port: PortSchema,
  command: z.string().nullable(),
  names: z.array(z.string()),
  process: z.record(z.string(), z.unknown()).nullable(),
  ownership: OwnershipEvidenceSchema,
});

export const InventoryEntrySchema = z.object({
  port: PortSchema,
  transport: z.literal('tcp'),
  classification: InventoryClassificationSchema,
  claim: z.record(z.string(), z.unknown()).nullable(),
  lease: z.record(z.string(), z.unknown()).nullable(),
  run: z.record(z.string(), z.unknown()).nullable(),
  listeners: z.array(ListenerEvidenceSchema),
});

export const InventoryListSchema = z.array(InventoryEntrySchema);

export const ClaimRecordResponseSchema = z.object({
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
});

export const ClaimsListSchema = z.array(ClaimRecordResponseSchema);

export const ClaimReassignRequestSchema = z
  .object({
    client: ClientCompatibilitySchema,
    preferredPort: PortSchema.optional(),
    exactPort: PortSchema.optional(),
  })
  .refine(
    ({ exactPort, preferredPort }) =>
      exactPort === undefined || preferredPort === undefined,
    { message: 'preferredPort and exactPort are mutually exclusive' },
  );

export const ClaimDeleteRequestSchema = z.object({
  client: ClientCompatibilitySchema,
});

export const ClaimPruneRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  olderThanMilliseconds: z.number().int().min(0).max(315_576_000_000),
  dryRun: z.boolean(),
});

export const ClaimPruneCandidateSchema = z.object({
  claim: ClaimRecordResponseSchema,
  reason: z.literal('workspace-missing'),
});

export const ClaimPruneResultSchema = z.object({
  dryRun: z.boolean(),
  candidates: z.array(ClaimPruneCandidateSchema),
  deletedClaimIds: z.array(IdentifierSchema),
  skipped: z.array(
    z.object({
      claimId: IdentifierSchema,
      reason: z.string().min(1),
    }),
  ),
});

const ServerPortRangeResponseSchema = z.object({
  start: PortSchema,
  end: PortSchema,
});

export const ServerSettingsResponseSchema = z
  .object({
    automaticPortRanges: z.array(ServerPortRangeResponseSchema),
    excludedPorts: z.array(PortSchema),
    leaseTtlMilliseconds: z.number().int(),
    ephemeralAssignmentTtlMilliseconds: z.number().int(),
    gracefulShutdownMilliseconds: z.number().int(),
    historyMaximumEvents: z.number().int(),
    diagnosticLogMaximumBytes: z.number().int(),
    diagnosticLogFiles: z.number().int(),
  })
  .strict();

export const ConfigSetRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  updates: ServerSettingsResponseSchema.partial().refine(
    (updates) => Object.keys(updates).length > 0,
    { message: 'At least one setting update is required.' },
  ),
});

export const HistoryEventResponseSchema = z.object({
  id: IdentifierSchema,
  eventType: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: TimestampSchema,
});

export const HistoryListSchema = z.array(HistoryEventResponseSchema);

export const DiagnosticLogEntrySchema = z.object({
  timestamp: TimestampSchema,
  level: z.enum(['debug', 'info', 'warn', 'error']),
  component: z.string().min(1).max(64),
  message: z.string().min(1).max(1_024),
  details: z.record(z.string(), z.unknown()),
});

export const DiagnosticLogListSchema = z.array(DiagnosticLogEntrySchema);

export const ReclaimRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  policy: ReplacementPolicySchema,
  dryRun: z.boolean().default(false),
});

export const UnsafeEvictionRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  unsafeAnyOwner: z.literal(true),
  policy: z.enum(['graceful', 'force-after-grace']).default('graceful'),
  dryRun: z.boolean().default(false),
});

export const ReclamationSignalSchema = z.object({
  pid: z.number().int().positive(),
  signal: z.enum(['SIGTERM', 'SIGKILL']),
  at: TimestampSchema,
});

export const ReclamationResultSchema = z.object({
  operationId: IdentifierSchema,
  operation: z.enum(['reclaim', 'unsafe-eviction']),
  port: PortSchema,
  policy: ReplacementPolicySchema,
  dryRun: z.boolean(),
  outcome: z.enum([
    'already-free',
    'would-terminate',
    'terminated',
    'refused',
    'timeout',
  ]),
  reason: z.string().min(1).nullable(),
  targets: z.array(ListenerEvidenceSchema),
  signals: z.array(ReclamationSignalSchema),
});

export const ErrorCodeSchema = z.enum([
  ERROR_CODES.conflict,
  ERROR_CODES.incompatibleProtocol,
  ERROR_CODES.invalidInput,
  ERROR_CODES.invalidLeaseToken,
  ERROR_CODES.leaseExpired,
  ERROR_CODES.leaseNotPending,
  ERROR_CODES.notFound,
  ERROR_CODES.unavailable,
  ERROR_CODES.internal,
]);

export const ErrorBodySchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).default({}),
});

/**
 * @template {z.ZodType} T
 * @param {T} dataSchema
 */
export function successEnvelopeSchema(dataSchema) {
  return z.object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    requestId: IdentifierSchema,
    data: dataSchema,
  });
}

export const ErrorEnvelopeSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: IdentifierSchema,
  error: ErrorBodySchema,
});

export const PORTREEVE_HEALTH = Object.freeze({
  softwareVersion: PORTREEVE_VERSION,
  protocol: PROTOCOL_RANGE,
  capabilities: CAPABILITIES,
  pid: process.pid,
  mode: /** @type {'manual' | 'supervised'} */ ('manual'),
});

/**
 * @param {{minimum: number, maximum: number}} clientRange
 * @param {readonly string[]} requiredCapabilities
 */
export function negotiateCompatibility(clientRange, requiredCapabilities) {
  const range = ProtocolRangeSchema.parse(clientRange);
  const overlap =
    range.minimum <= PROTOCOL_RANGE.maximum && range.maximum >= PROTOCOL_RANGE.minimum;
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !CAPABILITIES.includes(capability),
  );

  return Object.freeze({
    compatible: overlap && missingCapabilities.length === 0,
    negotiatedProtocol: overlap
      ? Math.min(range.maximum, PROTOCOL_RANGE.maximum)
      : null,
    missingCapabilities,
  });
}
