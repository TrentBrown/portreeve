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
  HealthResponseSchema,
  HistoryPageSchema,
  IdentifierSchema,
  InventoryClassificationSchema,
  InventoryEntrySchema,
  PortSchema,
  PageInfoSchema,
  ServerSettingsResponseSchema,
  StackActivationSchema,
  StackGenerationSchema,
  StackRecordSchema,
  TimestampSchema,
} from '../protocol/schemas.js';
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

  return server;
}

/** @param {McpServer} server @param {{name: string, title: string, description: string, inputSchema: z.ZodType, outputDataSchema: z.ZodType, run: (input: any) => Promise<any>}} definition */
function register(server, definition) {
  const outputSchema = toolResultSchema(definition.outputDataSchema);
  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema,
      annotations: READ_ANNOTATIONS,
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
