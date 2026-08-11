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

export const OperationOriginSchema = z
  .object({
    kind: z.enum(['library', 'cli', 'desktop', 'mcp']),
    runId: IdentifierSchema.optional(),
    label: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const ClientCompatibilitySchema = z.object({
  softwareVersion: z.string().min(1),
  protocol: ProtocolRangeSchema,
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  origin: OperationOriginSchema.optional(),
});

const IdentityNameSchema = z.string().trim().min(1).max(128);

export const ClaimIdentitySchema = z
  .object({
    project: IdentityNameSchema,
    workspaceRoot: z.string().min(1),
    service: IdentityNameSchema.optional(),
    component: IdentityNameSchema.optional(),
    endpoint: IdentityNameSchema.optional(),
    transport: z.literal('tcp'),
  })
  .superRefine(({ component, service }, context) => {
    if (component === undefined && service === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'claim identity requires component or service',
        path: ['component'],
      });
    }
    if (component !== undefined && service !== undefined && component !== service) {
      context.addIssue({
        code: 'custom',
        message: 'service and component must match when both are provided',
        path: ['service'],
      });
    }
  })
  .transform(({ component, endpoint, project, service, transport, workspaceRoot }) => {
    const canonicalComponent = component ?? service;
    if (canonicalComponent === undefined) {
      throw new Error('claim identity normalization failed');
    }
    return {
      project,
      workspaceRoot,
      service: canonicalComponent,
      component: canonicalComponent,
      endpoint: endpoint ?? 'default',
      transport,
    };
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

const StackNameSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim(), {
    message: 'stack names must not begin or end with whitespace',
  });
const StackAllocationSchema = z
  .object({
    preferredPort: PortSchema.optional(),
    exactPort: PortSchema.optional(),
  })
  .strict()
  .refine(
    ({ exactPort, preferredPort }) =>
      exactPort === undefined || preferredPort === undefined,
    { message: 'preferredPort and exactPort are mutually exclusive' },
  );
const StackDockerEndpointSchema = z.object({ containerPort: PortSchema }).strict();
const StackEndpointDefinitionSchema = z
  .object({
    transport: z.literal('tcp').default('tcp'),
    publish: z.boolean().default(true),
    required: z.boolean().default(true),
    allocation: StackAllocationSchema.default({}),
    docker: StackDockerEndpointSchema.optional(),
  })
  .strict();
const StackDependencyDefinitionSchema = z
  .object({
    component: StackNameSchema,
    endpoint: StackNameSchema.default('default'),
    required: z.boolean().default(true),
  })
  .strict();
const StackDockerComponentSchema = z.object({ service: StackNameSchema }).strict();
const StackComponentDefinitionSchema = z
  .object({
    endpoints: z.record(StackNameSchema, StackEndpointDefinitionSchema).default({}),
    dependencies: z
      .record(StackNameSchema, StackDependencyDefinitionSchema)
      .default({}),
    docker: StackDockerComponentSchema.optional(),
  })
  .strict();

export const StackDefinitionSchema = z
  .object({
    version: z.literal(1),
    project: StackNameSchema,
    components: z
      .record(StackNameSchema, StackComponentDefinitionSchema)
      .refine((components) => Object.keys(components).length > 0, {
        message: 'a stack definition requires at least one component',
      }),
  })
  .strict()
  .superRefine(({ components }, context) => {
    for (const [consumerName, component] of Object.entries(components)) {
      for (const [alias, dependency] of Object.entries(component.dependencies)) {
        const provider = components[dependency.component];
        if (provider === undefined) {
          context.addIssue({
            code: 'custom',
            message: `dependency ${alias} references unknown component ${dependency.component}`,
            path: ['components', consumerName, 'dependencies', alias, 'component'],
          });
          continue;
        }
        const providerEndpoint = provider.endpoints[dependency.endpoint];
        if (providerEndpoint === undefined) {
          context.addIssue({
            code: 'custom',
            message: `dependency ${alias} references unknown endpoint ${dependency.component}.${dependency.endpoint}`,
            path: ['components', consumerName, 'dependencies', alias, 'endpoint'],
          });
        } else if (!providerEndpoint.publish) {
          context.addIssue({
            code: 'custom',
            message: `dependency ${alias} references unpublished endpoint ${dependency.component}.${dependency.endpoint}`,
            path: ['components', consumerName, 'dependencies', alias, 'endpoint'],
          });
        }
      }
      for (const [endpointName, endpoint] of Object.entries(component.endpoints)) {
        if (endpoint.docker !== undefined && component.docker === undefined) {
          context.addIssue({
            code: 'custom',
            message: `endpoint ${endpointName} has a Docker port but component ${consumerName} has no Docker service`,
            path: ['components', consumerName, 'endpoints', endpointName, 'docker'],
          });
        }
      }
    }
  });

export const StackRecordSchema = z.object({
  id: IdentifierSchema,
  project: StackNameSchema,
  stackRoot: z.string().min(1),
  currentRevision: z.string().regex(/^[a-f0-9]{64}$/),
  definition: StackDefinitionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastUsedAt: TimestampSchema,
});

export const StackApplyRequestSchema = z
  .object({
    client: ClientCompatibilitySchema,
    stackRoot: z.string().min(1),
    definition: StackDefinitionSchema,
  })
  .strict();

export const StackApplyResponseSchema = z.object({
  changed: z.boolean(),
  stack: StackRecordSchema,
});

export const StackListSchema = z.array(StackRecordSchema);

export const StackEndpointReferenceSchema = z
  .object({
    component: StackNameSchema,
    endpoint: StackNameSchema.default('default'),
  })
  .strict();

export const StackGenerationEndpointSchema = z.object({
  claimId: IdentifierSchema,
  component: StackNameSchema,
  endpoint: StackNameSchema,
  transport: z.literal('tcp'),
  host: z.literal('127.0.0.1'),
  port: PortSchema,
  required: z.boolean(),
});

export const StackGenerationSchema = z.object({
  id: IdentifierSchema,
  stackId: IdentifierSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(['valid', 'stale']),
  endpoints: z.array(StackGenerationEndpointSchema),
  createdAt: TimestampSchema,
  invalidatedAt: TimestampSchema.nullable(),
});

export const StackPrepareRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  stackId: IdentifierSchema,
});

export const StackPrepareResponseSchema = z.object({
  reused: z.boolean(),
  generation: StackGenerationSchema,
});

export const StackActivationEndpointStateSchema = z.enum([
  'leased',
  'confirmed',
  'skipped',
  'failed',
  'released',
]);

export const StackActivationEndpointSchema = z.object({
  component: StackNameSchema,
  endpoint: StackNameSchema,
  claimId: IdentifierSchema,
  port: PortSchema,
  required: z.boolean(),
  bindingKind: z.enum(['process', 'docker']),
  state: StackActivationEndpointStateSchema,
  leaseId: IdentifierSchema.nullable(),
  runId: IdentifierSchema.nullable(),
  expiresAt: TimestampSchema.nullable(),
  failureReason: z.string().nullable(),
  updatedAt: TimestampSchema,
});

export const StackActivationStateSchema = z.enum([
  'starting',
  'confirmed',
  'degraded',
  'failed',
  'lost',
  'ended',
]);

export const StackActivationSchema = z.object({
  id: IdentifierSchema,
  stackId: IdentifierSchema,
  generationId: IdentifierSchema,
  state: StackActivationStateSchema,
  endpoints: z.array(StackActivationEndpointSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  confirmedAt: TimestampSchema.nullable(),
  endedAt: TimestampSchema.nullable(),
});

export const StackActivationLeaseSchema = z.object({
  component: StackNameSchema,
  endpoint: StackNameSchema,
  leaseId: IdentifierSchema,
  leaseToken: LeaseTokenSchema,
  port: PortSchema,
  expiresAt: TimestampSchema,
  bindingKind: z.enum(['process', 'docker']),
  docker: z
    .object({
      service: StackNameSchema,
      containerPort: PortSchema,
      requiredLabels: z.record(z.string(), z.string()),
    })
    .nullable(),
});

export const StackBeginActivationRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  generationId: IdentifierSchema,
  requiredEndpoints: z.array(StackEndpointReferenceSchema).default([]),
  skippedEndpoints: z.array(StackEndpointReferenceSchema).default([]),
  bindings: z.record(StackNameSchema, z.enum(['process', 'docker'])).default({}),
});

export const StackBeginActivationResponseSchema = z.object({
  activation: StackActivationSchema,
  leases: z.array(StackActivationLeaseSchema),
});

const StackLeaseCredentialSchema = z
  .object({
    leaseId: IdentifierSchema,
    leaseToken: LeaseTokenSchema,
  })
  .strict();

export const StackRenewActivationRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  leases: z.array(StackLeaseCredentialSchema).min(1),
});

export const StackRenewActivationResponseSchema = z.object({
  activation: StackActivationSchema,
  leases: z.array(
    z.object({
      leaseId: IdentifierSchema,
      expiresAt: TimestampSchema,
    }),
  ),
});

const StackProcessConfirmationSchema = z
  .object({
    client: ClientCompatibilitySchema,
    leaseId: IdentifierSchema,
    leaseToken: LeaseTokenSchema,
    bindingKind: z.literal('process').optional(),
    rootPid: z.number().int().positive(),
  })
  .strict()
  .transform((value) => ({ ...value, bindingKind: /** @type {const} */ ('process') }));

const StackDockerConfirmationSchema = z
  .object({
    client: ClientCompatibilitySchema,
    leaseId: IdentifierSchema,
    leaseToken: LeaseTokenSchema,
    bindingKind: z.literal('docker'),
    containerId: z.string().regex(/^[a-f0-9]{12,64}$/u),
  })
  .strict();

export const StackConfirmEndpointRequestSchema = z.union([
  StackProcessConfirmationSchema,
  StackDockerConfirmationSchema,
]);

export const StackAbandonEndpointRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  leaseId: IdentifierSchema,
  leaseToken: LeaseTokenSchema,
  reason: z.enum(['address-in-use', 'startup-error', 'client-cancelled']),
});

export const StackSkipEndpointRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  leaseId: IdentifierSchema,
  leaseToken: LeaseTokenSchema,
});

export const StackEndActivationRequestSchema = z.object({
  client: ClientCompatibilitySchema,
});

export const StackEndActivationResponseSchema = z.object({
  changed: z.boolean(),
  activation: StackActivationSchema,
});

export const StackReconcileActivationRequestSchema = z.object({
  client: ClientCompatibilitySchema,
});

export const StackProviderEvidenceSchema = z.object({
  component: StackNameSchema,
  endpoint: StackNameSchema,
  port: PortSchema,
  bindingKind: z.enum(['process', 'docker']),
  status: z.enum(['active', 'gone', 'unknown']),
  reason: z.string().min(1),
  listeners: z.number().int().min(0),
  runId: IdentifierSchema.nullable(),
  containerId: z.string().min(12).max(64).nullable(),
});

export const StackReconcileActivationResponseSchema = z.object({
  changed: z.boolean(),
  activation: StackActivationSchema,
  providers: z.array(StackProviderEvidenceSchema),
});

export const StackStatusRequestSchema = z.object({
  client: ClientCompatibilitySchema,
});

export const StackStatusSchema = z.object({
  stack: StackRecordSchema,
  generation: StackGenerationSchema.nullable(),
  activation: StackActivationSchema.nullable(),
  providers: z.array(StackProviderEvidenceSchema),
});

export const LauncherOperationNameSchema = z.enum([
  'start',
  'stop',
  'restart',
  'status',
]);

export const LauncherExecutionModeSchema = z.enum(['finite', 'attached']);

export const LauncherEvidenceSummarySchema = z
  .object({
    classification: z.enum([
      'stopped',
      'partial',
      'fully-observed',
      'verified',
      'conflicting',
      'uncertain',
    ]),
    source: z.enum(['daemon', 'local', 'cached', 'unavailable']),
    observedAt: TimestampSchema.nullable(),
    generationId: IdentifierSchema.nullable(),
    activationId: IdentifierSchema.nullable(),
    listenerCount: z.number().int().min(0).max(10_000),
    reasonCodes: z
      .array(
        z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9_-]+$/u),
      )
      .max(32),
  })
  .strict();

export const LauncherFailureSummarySchema = z
  .object({
    step: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_-]+$/u),
    code: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_-]+$/u),
    message: z.string().min(1).max(1_024),
  })
  .strict();

export const LauncherIntegrationSummarySchema = z
  .object({
    mode: z.enum(['command-only', 'verified-activation']),
    verified: z.boolean(),
    upgradeSuggested: z.boolean(),
    generationId: IdentifierSchema.nullable(),
    activationId: IdentifierSchema.nullable(),
  })
  .strict()
  .superRefine((integration, context) => {
    if (
      integration.upgradeSuggested &&
      (integration.mode !== 'command-only' || !integration.verified)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['upgradeSuggested'],
        message: 'an upgrade suggestion requires verified command-only evidence',
      });
    }
    if (
      integration.verified !==
      (integration.generationId !== null && integration.activationId !== null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['verified'],
        message: 'verified integration requires generation and activation identities',
      });
    }
  });

export const LauncherOperationCompletionSchema = z
  .object({
    outcome: z.enum(['succeeded', 'failed', 'cancelled', 'timed-out']),
    exitCode: z.number().int().min(0).max(255).nullable().default(null),
    signal: z
      .string()
      .min(4)
      .max(32)
      .regex(/^SIG[A-Z0-9]+$/u)
      .nullable()
      .default(null),
    degraded: z.boolean().default(false),
    beforeEvidence: LauncherEvidenceSummarySchema.nullable().default(null),
    afterEvidence: LauncherEvidenceSummarySchema.nullable().default(null),
    failure: LauncherFailureSummarySchema.nullable().default(null),
    integration: LauncherIntegrationSummarySchema.nullable().default(null),
  })
  .strict();

export const LauncherOperationOutcomeSchema = z.enum([
  'succeeded',
  'failed',
  'cancelled',
  'timed-out',
  'lost',
]);

export const LauncherOperationTerminalMetadataSchema =
  LauncherOperationCompletionSchema.extend({
    outcome: LauncherOperationOutcomeSchema,
  }).strict();

export const LauncherOperationRecordSchema = z
  .object({
    id: IdentifierSchema,
    stackId: IdentifierSchema,
    stackRoot: z.string().min(1),
    operation: LauncherOperationNameSchema,
    executionMode: LauncherExecutionModeSchema,
    launcherRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    callerOperationId: IdentifierSchema,
    generationId: IdentifierSchema.nullable(),
    state: z.enum(['active', 'terminal']),
    outcome: LauncherOperationOutcomeSchema.nullable(),
    deadlineAt: TimestampSchema,
    startedAt: TimestampSchema,
    renewedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
    durationMilliseconds: z.number().int().min(0).nullable(),
    exitCode: z.number().int().min(0).max(255).nullable(),
    signal: z
      .string()
      .min(4)
      .max(32)
      .regex(/^SIG[A-Z0-9]+$/u)
      .nullable(),
    degraded: z.boolean(),
    beforeEvidence: LauncherEvidenceSummarySchema.nullable(),
    afterEvidence: LauncherEvidenceSummarySchema.nullable(),
    failure: LauncherFailureSummarySchema.nullable(),
    integration: LauncherIntegrationSummarySchema.nullable(),
  })
  .strict()
  .superRefine((operation, context) => {
    if (operation.executionMode === 'attached' && operation.operation !== 'start') {
      context.addIssue({
        code: 'custom',
        path: ['executionMode'],
        message: 'attached execution is available only for Start',
      });
    }
    const hasTerminalIdentity =
      operation.outcome !== null &&
      operation.completedAt !== null &&
      operation.durationMilliseconds !== null;
    const hasTerminalDetails =
      operation.exitCode !== null ||
      operation.signal !== null ||
      operation.degraded ||
      operation.beforeEvidence !== null ||
      operation.afterEvidence !== null ||
      operation.failure !== null ||
      operation.integration !== null;
    if (
      (operation.state === 'active' && (hasTerminalIdentity || hasTerminalDetails)) ||
      (operation.state === 'terminal' && !hasTerminalIdentity)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message:
          'active operations cannot contain terminal fields and terminal operations require outcome timing',
      });
    }
  });

export const LauncherOperationBeginRequestSchema = z
  .object({
    client: ClientCompatibilitySchema,
    stackId: IdentifierSchema,
    operation: LauncherOperationNameSchema,
    executionMode: LauncherExecutionModeSchema.default('finite'),
    launcherRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    callerOperationId: IdentifierSchema,
    generationId: IdentifierSchema.nullable().default(null),
  })
  .strict()
  .refine(
    ({ executionMode, operation }) =>
      executionMode === 'finite' || operation === 'start',
    {
      path: ['executionMode'],
      message: 'attached execution is available only for Start',
    },
  );

export const LauncherOperationBeginResponseSchema = z
  .object({
    operation: LauncherOperationRecordSchema,
    credential: LeaseTokenSchema,
    renewAfterMilliseconds: z.literal(10_000),
  })
  .strict();

export const LauncherOperationRenewRequestSchema = z
  .object({
    client: ClientCompatibilitySchema,
    credential: LeaseTokenSchema,
  })
  .strict();

export const LauncherOperationRenewResponseSchema = z
  .object({
    operation: LauncherOperationRecordSchema,
    renewAfterMilliseconds: z.literal(10_000),
  })
  .strict();

export const LauncherOperationCompleteRequestSchema = z
  .object({
    client: ClientCompatibilitySchema,
    credential: LeaseTokenSchema,
    completion: LauncherOperationCompletionSchema,
  })
  .strict();

export const LauncherOperationCompleteResponseSchema = z
  .object({
    changed: z.boolean(),
    operation: LauncherOperationRecordSchema,
  })
  .strict();

export const LauncherOperationListSchema = z.array(LauncherOperationRecordSchema);

export const StackPruneRequestSchema = z.object({
  client: ClientCompatibilitySchema,
  olderThanMilliseconds: z.number().int().min(0).max(315_576_000_000),
  dryRun: z.boolean(),
});

export const StackPruneCandidateSchema = z.object({
  stack: StackRecordSchema,
  claimIds: z.array(IdentifierSchema),
  reason: z.literal('stack-root-missing'),
});

export const StackPruneBlockerSchema = z.object({
  stack: StackRecordSchema,
  reasons: z.array(z.string().min(1)).min(1),
});

export const StackPruneResultSchema = z.object({
  dryRun: z.boolean(),
  candidates: z.array(StackPruneCandidateSchema),
  blocked: z.array(StackPruneBlockerSchema),
  deletedStackIds: z.array(IdentifierSchema),
  deletedClaimIds: z.array(IdentifierSchema),
  skipped: z.array(
    z.object({
      stackId: IdentifierSchema,
      reason: z.string().min(1),
    }),
  ),
});

const StackNetworkHostSchema = z
  .string()
  .min(1)
  .max(253)
  .refine((value) => value === value.trim(), {
    message: 'network hosts must not begin or end with whitespace',
  });

export const StackAddressSchema = z
  .object({
    transport: z.literal('tcp'),
    host: StackNetworkHostSchema,
    port: PortSchema,
  })
  .strict();

export const StackResolvedEndpointSchema = z
  .object({
    component: StackNameSchema,
    endpoint: StackNameSchema,
    host: StackAddressSchema,
    dockerNetwork: StackAddressSchema.nullable(),
  })
  .strict();

export const StackResolutionSchema = z
  .object({
    schemaVersion: z.literal(1),
    definitionRevision: z.string().regex(/^[a-f0-9]{64}$/),
    generationId: IdentifierSchema,
    activationId: IdentifierSchema,
    component: StackNameSchema,
    own: z.record(StackNameSchema, StackResolvedEndpointSchema),
    dependencies: z.record(StackNameSchema, StackResolvedEndpointSchema),
  })
  .strict();

export const StackResolveRequestSchema = z
  .object({
    client: ClientCompatibilitySchema,
    component: StackNameSchema,
  })
  .strict();

export const StackSnapshotEndpointSchema = z
  .object({
    component: StackNameSchema,
    endpoint: StackNameSchema,
    address: StackAddressSchema,
  })
  .strict();

export const StackEndpointSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    definitionRevision: z.string().regex(/^[a-f0-9]{64}$/),
    generationId: IdentifierSchema,
    activationId: IdentifierSchema,
    component: StackNameSchema,
    own: z.record(StackNameSchema, StackSnapshotEndpointSchema),
    dependencies: z.record(StackNameSchema, StackSnapshotEndpointSchema),
  })
  .strict();

export const StackSnapshotRequestSchema = z
  .object({
    client: ClientCompatibilitySchema,
    component: StackNameSchema,
    gatewayHost: StackNetworkHostSchema.refine((value) => !/[\s/]/u.test(value), {
      message: 'sandbox gateway hosts must not contain whitespace or slashes',
    }),
  })
  .strict();

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
  'docker-managed',
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
  docker: z
    .object({
      available: z.boolean(),
      reason: z.string().nullable(),
      containers: z.array(
        z.object({
          id: z.string(),
          running: z.boolean(),
          labels: z.record(z.string(), z.string()),
          ports: z.array(
            z.object({
              containerPort: PortSchema,
              hostIp: z.string(),
              hostPort: PortSchema,
            }),
          ),
        }),
      ),
    })
    .nullable(),
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
  origin: OperationOriginSchema.nullable(),
  occurredAt: TimestampSchema,
});

export const HistoryListSchema = z.array(HistoryEventResponseSchema);

export const PageInfoSchema = z
  .object({
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export const HistoryPageSchema = z
  .object({
    items: HistoryListSchema,
    page: PageInfoSchema,
  })
  .strict();

export const ActionReceiptStateSchema = z.enum(['pending', 'completed']);

export const ActionReceiptSchema = z
  .object({
    id: IdentifierSchema,
    action: z.string().min(1).max(128),
    targetType: z.string().min(1).max(64),
    targetId: z.string().min(1).max(1_024),
    evidence: z.record(z.string(), z.unknown()),
    evidenceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    idempotencyKey: z.string().min(1).max(256),
    state: ActionReceiptStateSchema,
    result: z.record(z.string(), z.unknown()).nullable(),
    expiresAt: TimestampSchema,
    createdAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
  })
  .strict();

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
    'launcher-action-required',
  ]),
  reason: z.string().min(1).nullable(),
  launcherAction: z
    .object({
      kind: z.literal('docker'),
      action: z.literal('stop-container'),
      containerIds: z.array(z.string().regex(/^[a-f0-9]{12,64}$/u)).min(1),
    })
    .nullable(),
  targets: z.array(ListenerEvidenceSchema),
  signals: z.array(ReclamationSignalSchema),
});

export const ErrorCodeSchema = z.enum([
  ERROR_CODES.conflict,
  ERROR_CODES.incompatibleProtocol,
  ERROR_CODES.invalidInput,
  ERROR_CODES.invalidLeaseToken,
  ERROR_CODES.invalidOperationCredential,
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
export function negotiateCompatibility(
  clientRange,
  requiredCapabilities,
  availableCapabilities = CAPABILITIES,
) {
  const range = ProtocolRangeSchema.parse(clientRange);
  const overlap =
    range.minimum <= PROTOCOL_RANGE.maximum && range.maximum >= PROTOCOL_RANGE.minimum;
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !availableCapabilities.includes(capability),
  );

  return Object.freeze({
    compatible: overlap && missingCapabilities.length === 0,
    negotiatedProtocol: overlap
      ? Math.min(range.maximum, PROTOCOL_RANGE.maximum)
      : null,
    missingCapabilities,
  });
}
