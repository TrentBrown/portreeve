// @ts-check

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  PortreeveClient,
  PortreeveClientError,
  defaultSocketPath,
} from '../../packages/client/src/index.js';
import { PORTREEVE_VERSION } from '../version.js';
import {
  ConfirmResponseSchema,
  HealthResponseSchema,
  HistoryPageSchema,
  IdentifierSchema,
  InventoryClassificationSchema,
  InventoryEntrySchema,
  PortSchema,
  PageInfoSchema,
  MutationAcknowledgementSchema,
  ServerSettingsResponseSchema,
  StackActivationLeaseSchema,
  StackEndActivationResponseSchema,
  StackActivationSchema,
  StackGenerationSchema,
  StackPrepareResponseSchema,
  StackReconcileActivationResponseSchema,
  StackRecordSchema,
  StackResolutionSchema,
  StackStatusSchema,
  TimestampSchema,
} from '../protocol/schemas.js';
import { CredentialCustody, CredentialCustodyError } from './credential-custody.js';
import { LauncherCredentialCustody } from './launcher-credential-custody.js';
import { registerCatalogCompletionTools } from './catalog-completion-tools.js';
import { registerConsequentialTools } from './consequential-tools.js';
import { MCP_MAX_PAGE_SIZE, pageMcpValues } from './pagination.js';

const REQUIRED_CAPABILITY = 'mcp-foundations-v1';
const IdentifierInputSchema = z.object({ id: z.uuid() }).strict();
const PageInputSchema = z
  .object({
    limit: z.number().int().min(1).max(MCP_MAX_PAGE_SIZE).default(50),
    afterCursor: z.string().min(1).optional(),
  })
  .strict();
const ErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()),
  })
  .strict();
const ClaimDataSchema = z
  .object({
    id: IdentifierSchema,
    identity: z
      .object({
        project: z.string(),
        workspaceRoot: z.string(),
        service: z.string(),
        component: z.string(),
        endpoint: z.string(),
        transport: z.literal('tcp'),
      })
      .strict(),
    mode: z.enum(['sticky', 'ephemeral']),
    assignedPort: PortSchema.nullable(),
    preferredPort: PortSchema.nullable(),
    exactPort: PortSchema.nullable(),
    assignmentExpiresAt: TimestampSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    lastUsedAt: TimestampSchema,
  })
  .strict();
const DiagnosticsDataSchema = z
  .object({
    bridge: z
      .object({
        runId: z.uuid(),
        label: z.string().nullable(),
        transport: z.literal('stdio'),
        socketPath: z.string(),
      })
      .strict(),
    daemon: z
      .object({
        available: z.boolean(),
        compatible: z.boolean(),
        health: HealthResponseSchema.nullable(),
      })
      .strict(),
    guidance: z.string().nullable(),
    error: ErrorSchema.optional(),
  })
  .strict();

const READ_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});
const MUTATION_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

const CredentialHandleSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const StackEndpointReferenceInputSchema = z
  .object({
    component: z.string().min(1).max(128),
    endpoint: z.string().min(1).max(128).default('default'),
  })
  .strict();
const CustodySummarySchema = z
  .object({
    custodyExpiresAt: TimestampSchema,
    maximumCustodyExpiresAt: TimestampSchema,
    credentialCount: z.number().int().min(0),
  })
  .strict();
const HeldCredentialSchema = CustodySummarySchema.extend({
  credentialHandle: CredentialHandleSchema,
  leaseId: IdentifierSchema,
  leaseExpiresAt: TimestampSchema,
}).strict();
const SafeActivationLeaseSchema = StackActivationLeaseSchema.omit({
  leaseToken: true,
  expiresAt: true,
})
  .extend({
    credentialHandle: CredentialHandleSchema,
    leaseExpiresAt: TimestampSchema,
    custodyExpiresAt: TimestampSchema,
    maximumCustodyExpiresAt: TimestampSchema,
  })
  .strict();
const LeaseAcquireInputSchema = z
  .object({
    claim: z
      .object({
        project: z.string().trim().min(1).max(128),
        workspaceRoot: z.string().min(1),
        service: z.string().trim().min(1).max(128).optional(),
        component: z.string().trim().min(1).max(128).optional(),
        endpoint: z.string().trim().min(1).max(128).default('default'),
        transport: z.literal('tcp').default('tcp'),
      })
      .strict()
      .superRefine(({ component, service }, context) => {
        if (component === undefined && service === undefined) {
          context.addIssue({
            code: 'custom',
            message: 'claim requires component or service',
            path: ['component'],
          });
        }
        if (component !== undefined && service !== undefined && component !== service) {
          context.addIssue({
            code: 'custom',
            message: 'service and component must match',
            path: ['service'],
          });
        }
      }),
    allocation: z
      .object({
        mode: z.enum(['sticky', 'ephemeral']).default('sticky'),
        preferredPort: PortSchema.optional(),
        exactPort: PortSchema.optional(),
        replacementPolicy: z
          .enum(['never', 'graceful', 'force-after-grace'])
          .default('never'),
      })
      .strict()
      .refine(
        ({ exactPort, preferredPort }) =>
          exactPort === undefined || preferredPort === undefined,
        { message: 'preferredPort and exactPort are mutually exclusive' },
      )
      .default({ mode: 'sticky', replacementPolicy: 'never' }),
  })
  .strict();
const LeaseAcquireDataSchema = HeldCredentialSchema.omit({
  credentialCount: true,
}).extend({
  changed: z.boolean(),
  claimId: IdentifierSchema,
  port: PortSchema,
  reusedAssignment: z.boolean(),
});
const ConfirmationDataSchema = ConfirmResponseSchema.extend({
  changed: z.boolean(),
}).strict();
const ActivationMutationDataSchema = z
  .object({ changed: z.boolean(), activation: StackActivationSchema })
  .strict();

/**
 * @param {{
 *   socketPath?: string,
 *   label?: string,
 *   runId?: string,
 *   clientFactory?: (options: ConstructorParameters<typeof PortreeveClient>[0]) => PortreeveClient
 * }} [options]
 */
export function createPortreeveMcpServer(options = {}) {
  const runId = options.runId ?? randomUUID();
  const label = options.label;
  const socketPath = options.socketPath ?? defaultSocketPath();
  const clientFactory =
    options.clientFactory ?? ((clientOptions) => new PortreeveClient(clientOptions));
  const client = clientFactory({
    socketPath,
    origin: {
      kind: 'mcp',
      runId,
      ...(label === undefined ? {} : { label }),
    },
  });
  const custody = new CredentialCustody({
    renewLease: (credential) => client.renewLease(credential),
    renewActivation: (activationId, credentials) =>
      client.renewStackActivation(activationId, credentials),
  });
  const launcherCustody = new LauncherCredentialCustody({
    renewOperation: (operationId, credential) =>
      client.renewLauncherOperation(operationId, credential),
  });
  /** @type {Map<string, unknown>} */
  const mutationResults = new Map();
  const server = new McpServer(
    { name: 'portreeve', version: PORTREEVE_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        'Inspect and coordinate local development ports through the single PortReeve daemon authority.',
    },
  );

  const localDiagnostic = async () => {
    try {
      const health = await client.health();
      const compatibility = compatibilityFor(health);
      return success({
        bridge: { runId, label: label ?? null, transport: 'stdio', socketPath },
        daemon: { available: true, compatible: compatibility.compatible, health },
        guidance: compatibility.compatible ? null : compatibility.guidance,
      });
    } catch (error) {
      return success({
        bridge: { runId, label: label ?? null, transport: 'stdio', socketPath },
        daemon: { available: false, compatible: false, health: null },
        guidance:
          'Start PortReeve with `portreeve start`, or use Install and Start PortReeve in the Desktop Overview.',
        error: errorBody(error),
      });
    }
  };

  register(server, {
    name: 'portreeve_diagnostics',
    title: 'PortReeve diagnostics',
    description:
      'Report bridge identity plus current daemon availability and compatibility.',
    inputSchema: z.object({}).strict(),
    outputDataSchema: DiagnosticsDataSchema,
    run: localDiagnostic,
  });
  register(server, {
    name: 'portreeve_compatibility',
    title: 'PortReeve compatibility',
    description: 'Check whether the current daemon supports this MCP bridge.',
    inputSchema: z.object({}).strict(),
    outputDataSchema: DiagnosticsDataSchema,
    run: localDiagnostic,
  });
  register(server, {
    name: 'portreeve_health',
    title: 'PortReeve health',
    description: 'Read compatible daemon health and capability evidence.',
    inputSchema: z.object({}).strict(),
    outputDataSchema: HealthResponseSchema,
    run: () => daemonRead(client, () => client.health()),
  });
  register(server, {
    name: 'portreeve_settings_get',
    title: 'Get PortReeve settings',
    description: 'Read the current global daemon settings.',
    inputSchema: z.object({}).strict(),
    outputDataSchema: ServerSettingsResponseSchema,
    run: () => daemonRead(client, () => client.getConfig()),
  });
  register(server, {
    name: 'portreeve_ports_list',
    title: 'List ports',
    description: 'List globally observed development ports with explicit filters.',
    inputSchema: PageInputSchema.extend({
      classification: InventoryClassificationSchema.optional(),
      claimed: z.boolean().optional(),
      listening: z.boolean().optional(),
      project: z.string().optional(),
      workspace: z.string().optional(),
      component: z.string().optional(),
      endpoint: z.string().optional(),
      port: z.number().int().min(1).max(65_535).optional(),
    }).strict(),
    outputDataSchema: pageSchema(InventoryEntrySchema),
    run: (input) =>
      daemonRead(client, async () =>
        pageMcpValues(await client.listPorts(withoutPage(input)), input, (entry) =>
          String(entry.port).padStart(5, '0'),
        ),
      ),
  });
  register(server, {
    name: 'portreeve_port_inspect',
    title: 'Inspect a port',
    description: 'Inspect durable and live evidence for one exact TCP port.',
    inputSchema: z.object({ port: z.number().int().min(1).max(65_535) }).strict(),
    outputDataSchema: InventoryEntrySchema,
    run: ({ port }) => daemonRead(client, () => client.inspectPort(port)),
  });
  register(server, {
    name: 'portreeve_claims_list',
    title: 'List claims',
    description: 'List durable claims globally with explicit identity filters.',
    inputSchema: PageInputSchema.extend({
      project: z.string().optional(),
      workspaceRoot: z.string().optional(),
      component: z.string().optional(),
      endpoint: z.string().optional(),
    }).strict(),
    outputDataSchema: pageSchema(ClaimDataSchema),
    run: (input) =>
      daemonRead(client, async () =>
        pageMcpValues(
          await client.listClaims(withoutPage(input)),
          input,
          (claim) => claim.id,
        ),
      ),
  });
  register(server, {
    name: 'portreeve_claim_get',
    title: 'Get a claim',
    description: 'Read one durable claim by explicit identifier.',
    inputSchema: IdentifierInputSchema,
    outputDataSchema: ClaimDataSchema,
    run: ({ id }) => daemonRead(client, () => client.getClaim(id)),
  });
  register(server, {
    name: 'portreeve_stacks_list',
    title: 'List stacks',
    description: 'List registered stacks globally with explicit filters.',
    inputSchema: PageInputSchema.extend({
      project: z.string().optional(),
      stackRoot: z.string().optional(),
    }).strict(),
    outputDataSchema: pageSchema(StackRecordSchema),
    run: (input) =>
      daemonRead(client, async () =>
        pageMcpValues(
          await client.listStacks(withoutPage(input)),
          input,
          (stack) => stack.id,
        ),
      ),
  });
  register(server, {
    name: 'portreeve_stack_get',
    title: 'Get a stack',
    description: 'Read one registered stack by explicit identifier.',
    inputSchema: IdentifierInputSchema,
    outputDataSchema: StackRecordSchema,
    run: ({ id }) => daemonRead(client, () => client.getStack(id)),
  });
  register(server, {
    name: 'portreeve_generations_list',
    title: 'List generations',
    description: 'List stack generations globally with explicit filters.',
    inputSchema: PageInputSchema.extend({
      stackId: z.uuid().optional(),
      state: z.enum(['valid', 'stale']).optional(),
    }).strict(),
    outputDataSchema: pageSchema(StackGenerationSchema),
    run: (input) =>
      daemonRead(client, async () =>
        pageMcpValues(
          await client.listStackGenerations(withoutPage(input)),
          input,
          (generation) => generation.id,
        ),
      ),
  });
  register(server, {
    name: 'portreeve_generation_get',
    title: 'Get a generation',
    description: 'Read one stack generation by explicit identifier.',
    inputSchema: IdentifierInputSchema,
    outputDataSchema: StackGenerationSchema,
    run: ({ id }) => daemonRead(client, () => client.getStackGeneration(id)),
  });
  register(server, {
    name: 'portreeve_activations_list',
    title: 'List activations',
    description: 'List stack activations globally with explicit filters.',
    inputSchema: PageInputSchema.extend({
      stackId: z.uuid().optional(),
      generationId: z.uuid().optional(),
      state: z
        .enum(['starting', 'confirmed', 'degraded', 'failed', 'lost', 'ended'])
        .optional(),
    }).strict(),
    outputDataSchema: pageSchema(StackActivationSchema),
    run: (input) =>
      daemonRead(client, async () =>
        pageMcpValues(
          await client.listStackActivations(withoutPage(input)),
          input,
          (activation) => activation.id,
        ),
      ),
  });
  register(server, {
    name: 'portreeve_activation_get',
    title: 'Get an activation',
    description: 'Read one stack activation by explicit identifier.',
    inputSchema: IdentifierInputSchema,
    outputDataSchema: StackActivationSchema,
    run: ({ id }) => daemonRead(client, () => client.getStackActivation(id)),
  });
  register(server, {
    name: 'portreeve_history_list',
    title: 'List history',
    description: 'Read bounded structured history with explicit filters.',
    inputSchema: PageInputSchema.extend({
      eventType: z.string().optional(),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      since: z.iso.datetime({ offset: true }).optional(),
    }).strict(),
    outputDataSchema: HistoryPageSchema,
    run: (input) => daemonRead(client, () => client.historyPage(input)),
  });

  registerCoordinationTools({ server, client, custody, mutationResults });
  registerConsequentialTools({
    client,
    registerTool: (definition) => register(server, definition),
    daemonOperation: (operation) => daemonRead(client, operation),
  });
  registerCatalogCompletionTools({
    client,
    custody: launcherCustody,
    mutationResults,
    registerTool: (definition) => register(server, definition),
    daemonOperation: (operation) => daemonRead(client, operation),
  });

  const closeServer = server.close.bind(server);
  server.close = async () => {
    custody.close();
    launcherCustody.close();
    await closeServer();
  };

  return server;
}

/**
 * @param {{
 *   server: McpServer,
 *   client: PortreeveClient,
 *   custody: CredentialCustody,
 *   mutationResults: Map<string, unknown>
 * }} context
 */
function registerCoordinationTools({ server, client, custody, mutationResults }) {
  register(server, {
    name: 'portreeve_lease_acquire',
    title: 'Acquire a port lease',
    description:
      'Acquire one standalone port lease and retain its credential in this bridge behind an opaque handle.',
    inputSchema: LeaseAcquireInputSchema,
    outputDataSchema: LeaseAcquireDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      daemonRead(client, async () => {
        const key = mutationKey('lease_acquire', input);
        const cached = /** @type {any} */ (mutationResults.get(key));
        if (cached !== undefined && custody.isHeld(cached.credentialHandle)) {
          return { ...cached, changed: false };
        }
        const acquired = await client.acquire(input);
        const held = custody.holdLease(acquired);
        const result = {
          changed: true,
          claimId: acquired.claimId,
          leaseId: acquired.leaseId,
          port: acquired.port,
          leaseExpiresAt: acquired.expiresAt,
          reusedAssignment: acquired.reusedAssignment,
          credentialHandle: held.credentialHandle,
          custodyExpiresAt: held.custodyExpiresAt,
          maximumCustodyExpiresAt: held.maximumCustodyExpiresAt,
        };
        rememberMutation(mutationResults, key, result);
        return result;
      }),
  });
  register(server, {
    name: 'portreeve_lease_confirm',
    title: 'Confirm a port lease',
    description:
      'Confirm listener ownership for a standalone lease held by this bridge.',
    inputSchema: z
      .object({
        credentialHandle: CredentialHandleSchema,
        rootPid: z.number().int().positive(),
      })
      .strict(),
    outputDataSchema: ConfirmationDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      daemonRead(client, async () => {
        const key = mutationKey('lease_confirm', input);
        const replay = replayMutation(mutationResults, key);
        if (replay !== undefined) return replay;
        const credential = custody.get(input.credentialHandle, { kind: 'lease' });
        const confirmed = await client.confirm(credential, {
          rootPid: input.rootPid,
        });
        custody.settle(input.credentialHandle);
        const result = { changed: true, ...confirmed };
        rememberMutation(mutationResults, key, result);
        return result;
      }),
  });
  register(server, {
    name: 'portreeve_lease_abandon',
    title: 'Abandon a port lease',
    description:
      'Abandon a standalone lease held by this bridge and immediately erase its credential.',
    inputSchema: z
      .object({
        credentialHandle: CredentialHandleSchema,
        reason: z.enum(['address-in-use', 'startup-error', 'client-cancelled']),
      })
      .strict(),
    outputDataSchema: MutationAcknowledgementSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      daemonRead(client, async () => {
        const key = mutationKey('lease_abandon', input);
        const replay = replayMutation(mutationResults, key);
        if (replay !== undefined) return replay;
        const credential = custody.get(input.credentialHandle, { kind: 'lease' });
        const result = await client.abandon(credential, input.reason);
        custody.settle(input.credentialHandle);
        rememberMutation(mutationResults, key, result);
        return result;
      }),
  });
  register(server, {
    name: 'portreeve_run_release',
    title: 'Release a confirmed run',
    description: 'Release one confirmed run by explicit durable identifier.',
    inputSchema: z.object({ runId: IdentifierSchema }).strict(),
    outputDataSchema: MutationAcknowledgementSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: ({ runId }) => daemonRead(client, () => client.release(runId)),
  });
  register(server, {
    name: 'portreeve_stack_status',
    title: 'Get stack status',
    description: 'Inspect current generation, activation, and provider evidence.',
    inputSchema: z.object({ stackId: IdentifierSchema }).strict(),
    outputDataSchema: StackStatusSchema,
    run: ({ stackId }) => daemonRead(client, () => client.getStackStatus(stackId)),
  });
  register(server, {
    name: 'portreeve_stack_prepare',
    title: 'Prepare a stack generation',
    description:
      'Prepare or reuse one valid allocation generation for an explicit stack.',
    inputSchema: z.object({ stackId: IdentifierSchema }).strict(),
    outputDataSchema: StackPrepareResponseSchema.extend({
      changed: z.boolean(),
    }).strict(),
    annotations: MUTATION_ANNOTATIONS,
    run: ({ stackId }) =>
      daemonRead(client, async () => {
        const prepared = await client.prepareStack(stackId);
        return { changed: !prepared.reused, ...prepared };
      }),
  });
  register(server, {
    name: 'portreeve_activation_begin',
    title: 'Begin stack activation',
    description:
      'Begin an activation and retain all pending endpoint credentials in bounded bridge custody.',
    inputSchema: z
      .object({
        generationId: IdentifierSchema,
        requiredEndpoints: z.array(StackEndpointReferenceInputSchema).default([]),
        skippedEndpoints: z.array(StackEndpointReferenceInputSchema).default([]),
        bindings: z
          .record(z.string().min(1).max(128), z.enum(['process', 'docker']))
          .default({}),
      })
      .strict(),
    outputDataSchema: z
      .object({
        changed: z.boolean(),
        activation: StackActivationSchema,
        leases: z.array(SafeActivationLeaseSchema),
        custodyExpiresAt: TimestampSchema,
        maximumCustodyExpiresAt: TimestampSchema,
        credentialCount: z.number().int().min(0),
      })
      .strict(),
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      daemonRead(client, async () => {
        const key = mutationKey('activation_begin', input);
        const cached = /** @type {any} */ (mutationResults.get(key));
        if (cached !== undefined) {
          const leases = cached.leases.filter(
            (/** @type {{credentialHandle: string}} */ { credentialHandle }) =>
              custody.isHeld(credentialHandle),
          );
          return {
            ...cached,
            changed: false,
            leases,
            credentialCount: leases.length,
            activation: await client.getStackActivation(cached.activation.id),
          };
        }
        const begun = await client.beginStackActivation(input.generationId, input);
        const held = custody.holdActivation(
          begun.activation.id,
          begun.leases.map(({ leaseId, leaseToken, expiresAt }) => ({
            leaseId,
            leaseToken,
            expiresAt,
          })),
        );
        const heldByLease = new Map(
          held.credentials.map((credential) => [credential.leaseId, credential]),
        );
        const leases = begun.leases.map((lease) => {
          const credential = heldByLease.get(lease.leaseId);
          if (credential === undefined) {
            throw new Error('Activation credential custody is incomplete.');
          }
          return {
            component: lease.component,
            endpoint: lease.endpoint,
            leaseId: lease.leaseId,
            port: lease.port,
            bindingKind: lease.bindingKind,
            docker: lease.docker,
            credentialHandle: credential.credentialHandle,
            leaseExpiresAt: credential.leaseExpiresAt,
            custodyExpiresAt: credential.custodyExpiresAt,
            maximumCustodyExpiresAt: credential.maximumCustodyExpiresAt,
          };
        });
        const result = {
          changed: true,
          activation: begun.activation,
          leases,
          custodyExpiresAt: held.custodyExpiresAt,
          maximumCustodyExpiresAt: held.maximumCustodyExpiresAt,
          credentialCount: held.credentialCount,
        };
        rememberMutation(mutationResults, key, result);
        return result;
      }),
  });
  register(server, {
    name: 'portreeve_activation_custody_extend',
    title: 'Extend activation custody',
    description:
      'Extend this bridge custody for pending activation leases up to sixty minutes from acquisition.',
    inputSchema: z
      .object({
        activationId: IdentifierSchema,
        custodyMinutes: z.number().int().min(10).max(60),
      })
      .strict(),
    outputDataSchema: CustodySummarySchema.extend({
      changed: z.boolean(),
      activationId: IdentifierSchema,
    }).strict(),
    annotations: MUTATION_ANNOTATIONS,
    run: ({ activationId, custodyMinutes }) =>
      daemonRead(client, async () =>
        custody.extendActivation(activationId, custodyMinutes * 60_000),
      ),
  });
  register(server, {
    name: 'portreeve_activation_resolve',
    title: 'Resolve activation endpoints',
    description:
      'Resolve one component own and dependency addresses within an activation.',
    inputSchema: z
      .object({
        activationId: IdentifierSchema,
        component: z.string().min(1).max(128),
      })
      .strict(),
    outputDataSchema: StackResolutionSchema,
    run: ({ activationId, component }) =>
      daemonRead(client, () => client.resolveStackEndpoints(activationId, component)),
  });
  register(server, {
    name: 'portreeve_activation_confirm_endpoint',
    title: 'Confirm an activation endpoint',
    description:
      'Confirm process or Docker binding evidence using a credential held by this bridge.',
    inputSchema: z.union([
      z
        .object({
          activationId: IdentifierSchema,
          credentialHandle: CredentialHandleSchema,
          bindingKind: z.literal('process'),
          rootPid: z.number().int().positive(),
        })
        .strict(),
      z
        .object({
          activationId: IdentifierSchema,
          credentialHandle: CredentialHandleSchema,
          bindingKind: z.literal('docker'),
          containerId: z.string().regex(/^[a-f0-9]{12,64}$/u),
        })
        .strict(),
    ]),
    outputDataSchema: ActivationMutationDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      daemonRead(client, async () => {
        const key = mutationKey('activation_confirm', input);
        const replay = replayMutation(mutationResults, key);
        if (replay !== undefined) return replay;
        const credential = custody.get(input.credentialHandle, {
          kind: 'activation',
          activationId: input.activationId,
        });
        const evidence =
          input.bindingKind === 'docker'
            ? {
                ...credential,
                bindingKind: /** @type {const} */ ('docker'),
                containerId: input.containerId,
              }
            : {
                ...credential,
                bindingKind: /** @type {const} */ ('process'),
                rootPid: input.rootPid,
              };
        const activation = await client.confirmStackEndpoint(
          input.activationId,
          evidence,
        );
        retainPendingActivationCredentials(custody, activation);
        const result = { changed: true, activation };
        rememberMutation(mutationResults, key, result);
        return result;
      }),
  });
  register(server, {
    name: 'portreeve_activation_skip_endpoint',
    title: 'Skip an activation endpoint',
    description: 'Skip one optional activation endpoint and erase its held credential.',
    inputSchema: activationCredentialInputSchema(),
    outputDataSchema: ActivationMutationDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      settleActivationCredential({
        client,
        custody,
        mutationResults,
        input,
        operation: 'activation_skip',
        invoke: (credential) =>
          client.skipStackEndpoint(input.activationId, credential),
      }),
  });
  register(server, {
    name: 'portreeve_activation_abandon_endpoint',
    title: 'Abandon an activation endpoint',
    description: 'Mark one activation endpoint failed and erase its held credential.',
    inputSchema: activationCredentialInputSchema().extend({
      reason: z.enum(['address-in-use', 'startup-error', 'client-cancelled']),
    }),
    outputDataSchema: ActivationMutationDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      settleActivationCredential({
        client,
        custody,
        mutationResults,
        input,
        operation: 'activation_abandon',
        invoke: (credential) =>
          client.abandonStackEndpoint(input.activationId, {
            ...credential,
            reason: input.reason,
          }),
      }),
  });
  register(server, {
    name: 'portreeve_activation_reconcile',
    title: 'Reconcile an activation',
    description: 'Refresh durable activation state from current provider evidence.',
    inputSchema: z.object({ activationId: IdentifierSchema }).strict(),
    outputDataSchema: StackReconcileActivationResponseSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: ({ activationId }) =>
      daemonRead(client, () => client.reconcileStackActivation(activationId)),
  });
  register(server, {
    name: 'portreeve_activation_end',
    title: 'End an activation',
    description: 'End an activation after all endpoint leases and providers settle.',
    inputSchema: z.object({ activationId: IdentifierSchema }).strict(),
    outputDataSchema: StackEndActivationResponseSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: ({ activationId }) =>
      daemonRead(client, () => client.endStackActivation(activationId)),
  });
}

function activationCredentialInputSchema() {
  return z
    .object({
      activationId: IdentifierSchema,
      credentialHandle: CredentialHandleSchema,
    })
    .strict();
}

/**
 * @param {{
 *   client: PortreeveClient,
 *   custody: CredentialCustody,
 *   mutationResults: Map<string, unknown>,
 *   input: {activationId: string, credentialHandle: string} & Record<string, unknown>,
 *   operation: string,
 *   invoke: (credential: {leaseId: string, leaseToken: string}) => Promise<import('zod').infer<typeof StackActivationSchema>>
 * }} options
 */
function settleActivationCredential(options) {
  return daemonRead(options.client, async () => {
    const key = mutationKey(options.operation, options.input);
    const replay = replayMutation(options.mutationResults, key);
    if (replay !== undefined) return replay;
    const credential = options.custody.get(options.input.credentialHandle, {
      kind: 'activation',
      activationId: options.input.activationId,
    });
    const activation = await options.invoke(credential);
    retainPendingActivationCredentials(options.custody, activation);
    const result = { changed: true, activation };
    rememberMutation(options.mutationResults, key, result);
    return result;
  });
}

/** @param {CredentialCustody} custody @param {import('zod').infer<typeof StackActivationSchema>} activation */
function retainPendingActivationCredentials(custody, activation) {
  custody.retainActivationLeases(
    activation.id,
    activation.endpoints.flatMap(({ leaseId, state }) =>
      state === 'leased' && leaseId !== null ? [leaseId] : [],
    ),
  );
}

/** @param {string} operation @param {unknown} input */
function mutationKey(operation, input) {
  return `${operation}:${JSON.stringify(sortJson(input))}`;
}

/** @param {unknown} value @returns {unknown} */
function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

/** @param {Map<string, unknown>} results @param {string} key */
function replayMutation(results, key) {
  const result = results.get(key);
  return result !== undefined && result !== null && typeof result === 'object'
    ? { ...result, changed: false }
    : result;
}

/** @param {Map<string, unknown>} results @param {string} key @param {unknown} result */
function rememberMutation(results, key, result) {
  results.set(key, result);
  if (results.size > 1_000) {
    const oldest = results.keys().next().value;
    if (oldest !== undefined) results.delete(oldest);
  }
}

/** @param {McpServer} server @param {{name: string, title: string, description: string, inputSchema: z.ZodType, outputDataSchema: z.ZodType, annotations?: Readonly<{readOnlyHint: boolean, destructiveHint: boolean, idempotentHint: boolean, openWorldHint: boolean}>, run: (input: any) => Promise<any>}} definition */
function register(server, definition) {
  const outputSchema = toolResultSchema(definition.outputDataSchema);
  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema,
      annotations: definition.annotations ?? READ_ANNOTATIONS,
    },
    async (input) => {
      const output = outputSchema.parse(await definition.run(input));
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );
}

/** @param {z.ZodType} dataSchema */
function toolResultSchema(dataSchema) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data: dataSchema }).strict(),
    z.object({ ok: z.literal(false), error: ErrorSchema }).strict(),
  ]);
}

/** @param {z.ZodType} itemSchema */
function pageSchema(itemSchema) {
  return z.object({ items: z.array(itemSchema), page: PageInfoSchema }).strict();
}

/** @param {PortreeveClient} client @param {() => Promise<unknown>} operation */
async function daemonRead(client, operation) {
  try {
    const health = await client.health();
    const compatibility = compatibilityFor(health);
    if (!compatibility.compatible) {
      return failure(
        'portreeve_incompatible',
        'The running PortReeve daemon is incompatible with this MCP bridge.',
        false,
        { health, guidance: compatibility.guidance },
      );
    }
    return success(await operation());
  } catch (error) {
    return { ok: false, error: errorBody(error) };
  }
}

/** @param {any} health */
function compatibilityFor(health) {
  const protocol = health?.protocol;
  const protocolCompatible =
    typeof protocol?.minimum === 'number' &&
    typeof protocol?.maximum === 'number' &&
    protocol.minimum <= 1 &&
    protocol.maximum >= 1;
  const capabilityCompatible =
    Array.isArray(health?.capabilities) &&
    health.capabilities.includes(REQUIRED_CAPABILITY);
  const compatible = protocolCompatible && capabilityCompatible;
  return {
    compatible,
    guidance: compatible
      ? null
      : 'Update PortReeve so the daemon and MCP bridge share protocol 1 and mcp-foundations-v1, then restart the daemon.',
  };
}

/** @param {unknown} data */
function success(data) {
  return { ok: true, data };
}

/** @param {string} code @param {string} message @param {boolean} retryable @param {Record<string, unknown>} details */
function failure(code, message, retryable, details = {}) {
  return { ok: false, error: { code, message, retryable, details } };
}

/** @param {unknown} error */
function errorBody(error) {
  if (error instanceof CredentialCustodyError) {
    return {
      code: `portreeve_${error.code}`,
      message: error.message,
      retryable: false,
      details: {},
    };
  }
  if (error instanceof PortreeveClientError) {
    return {
      code:
        error.code === 'unavailable'
          ? 'portreeve_unavailable'
          : error.code === 'incompatible_protocol'
            ? 'portreeve_incompatible'
            : `portreeve_${error.code}`,
      message: error.message,
      retryable: error.code === 'unavailable' ? true : error.retryable,
      details: error.details,
    };
  }
  return {
    code: 'portreeve_internal',
    message: 'The PortReeve MCP bridge encountered an internal error.',
    retryable: false,
    details: {},
  };
}

/** @param {Record<string, unknown>} input */
function withoutPage(input) {
  const filters = { ...input };
  delete filters.limit;
  delete filters.afterCursor;
  return filters;
}
