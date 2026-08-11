// @ts-check

import { z } from 'zod';
import { LAUNCHER_OPERATION_HISTORY_LIMIT } from '../protocol/constants.js';
import {
  IdentifierSchema,
  LauncherOperationCompletionSchema,
  LauncherOperationRecordSchema,
  PageInfoSchema,
  StackEndpointSnapshotSchema,
  TimestampSchema,
} from '../protocol/schemas.js';
import { pageMcpValues } from './pagination.js';

const MUTATION_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});
const CredentialHandleSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const StackNameInputSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim(), {
    message: 'stack names must not begin or end with whitespace',
  });
const LauncherCustodySchema = z
  .object({
    credentialHandle: CredentialHandleSchema,
    operationId: IdentifierSchema,
    operationDeadlineAt: TimestampSchema,
    custodyExpiresAt: TimestampSchema,
    maximumCustodyExpiresAt: TimestampSchema,
  })
  .strict();
const LauncherBeginInputSchema = z
  .object({
    stackId: IdentifierSchema,
    operation: z.enum(['start', 'stop', 'restart', 'status']),
    executionMode: z.enum(['finite', 'attached']).default('finite'),
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
const LauncherBeginDataSchema = LauncherCustodySchema.extend({
  changed: z.boolean(),
  operation: LauncherOperationRecordSchema,
  renewAfterMilliseconds: z.literal(10_000),
}).strict();
const LauncherRenewDataSchema = LauncherBeginDataSchema.extend({
  custodyChanged: z.boolean(),
}).strict();
const LauncherCompletionDataSchema = z
  .object({
    changed: z.boolean(),
    operation: LauncherOperationRecordSchema,
  })
  .strict();
const LauncherPageSchema = z
  .object({
    items: z.array(LauncherOperationRecordSchema),
    page: PageInfoSchema,
  })
  .strict();

/**
 * @param {{
 *   client: import('../../packages/client/src/index.js').PortreeveClient,
 *   custody: import('./launcher-credential-custody.js').LauncherCredentialCustody,
 *   mutationResults: Map<string, unknown>,
 *   registerTool: (definition: {name: string, title: string, description: string, inputSchema: z.ZodType, outputDataSchema: z.ZodType, annotations?: typeof MUTATION_ANNOTATIONS, run: (input: any) => Promise<any>}) => void,
 *   daemonOperation: (operation: () => Promise<unknown>) => Promise<unknown>
 * }} context
 */
export function registerCatalogCompletionTools({
  client,
  custody,
  mutationResults,
  registerTool,
  daemonOperation,
}) {
  registerTool({
    name: 'portreeve_stack_snapshot',
    title: 'Create a stack endpoint snapshot',
    description:
      'Return one structured redacted gateway-rewritten endpoint snapshot without writing a file or orchestrating its consumer.',
    inputSchema: z
      .object({
        activationId: IdentifierSchema,
        component: StackNameInputSchema,
        gatewayHost: z
          .string()
          .min(1)
          .max(255)
          .refine((value) => !/[\s/]/u.test(value), {
            message: 'snapshot gateway hosts must not contain whitespace or slashes',
          }),
      })
      .strict(),
    outputDataSchema: StackEndpointSnapshotSchema,
    run: ({ activationId, component, gatewayHost }) =>
      daemonOperation(() =>
        client.createStackEndpointSnapshot(activationId, {
          component,
          gatewayHost,
        }),
      ),
  });

  registerTool({
    name: 'portreeve_launcher_operation_begin',
    title: 'Begin launcher coordination',
    description:
      'Begin one launcher operation without executing project commands and retain its credential behind an opaque bridge-local handle.',
    inputSchema: LauncherBeginInputSchema,
    outputDataSchema: LauncherBeginDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      daemonOperation(async () => {
        const key = mutationKey('launcher_begin', input);
        const cached = /** @type {any} */ (mutationResults.get(key));
        if (cached !== undefined && custody.isHeld(cached.credentialHandle)) {
          return {
            ...cached,
            changed: false,
            operation: await client.getLauncherOperation(cached.operation.id),
          };
        }
        const session = await client.beginLauncherOperation(input.stackId, input);
        try {
          const held = custody.hold(session);
          const result = {
            changed: true,
            operation: session.operation,
            renewAfterMilliseconds: session.renewAfterMilliseconds,
            ...held,
          };
          rememberMutation(mutationResults, key, result);
          return result;
        } catch (error) {
          await client
            .completeLauncherOperation(session.operation.id, session.credential, {
              outcome: 'cancelled',
              failure: {
                step: 'credential-custody',
                code: 'custody-failed',
                message:
                  'PortReeve could not retain the launcher operation credential.',
              },
            })
            .catch(() => {});
          throw error;
        }
      }),
  });

  registerTool({
    name: 'portreeve_launcher_operation_renew',
    title: 'Renew launcher coordination',
    description:
      'Refresh one launcher operation held by this bridge and optionally extend total custody up to sixty minutes.',
    inputSchema: z
      .object({
        operationId: IdentifierSchema,
        credentialHandle: CredentialHandleSchema,
        custodyMinutes: z.number().int().min(10).max(60).optional(),
      })
      .strict(),
    outputDataSchema: LauncherRenewDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: ({ operationId, credentialHandle, custodyMinutes }) =>
      daemonOperation(() =>
        custody.renew(
          credentialHandle,
          operationId,
          custodyMinutes === undefined ? undefined : custodyMinutes * 60_000,
        ),
      ),
  });

  registerTool({
    name: 'portreeve_launcher_operation_complete',
    title: 'Complete launcher coordination',
    description:
      'Complete one launcher operation held by this bridge and erase its credential immediately.',
    inputSchema: z
      .object({
        operationId: IdentifierSchema,
        credentialHandle: CredentialHandleSchema,
        completion: LauncherOperationCompletionSchema,
      })
      .strict(),
    outputDataSchema: LauncherCompletionDataSchema,
    annotations: MUTATION_ANNOTATIONS,
    run: (input) =>
      daemonOperation(async () => {
        const key = mutationKey('launcher_complete', input);
        const replay = replayMutation(mutationResults, key);
        if (replay !== undefined) return replay;
        const { credential } = custody.get(input.credentialHandle, input.operationId);
        const result = await client.completeLauncherOperation(
          input.operationId,
          credential,
          input.completion,
        );
        custody.settle(input.credentialHandle);
        rememberMutation(mutationResults, key, result);
        return result;
      }),
  });

  registerTool({
    name: 'portreeve_launcher_operation_get',
    title: 'Get launcher coordination',
    description: 'Read one launcher operation by explicit durable identifier.',
    inputSchema: z.object({ operationId: IdentifierSchema }).strict(),
    outputDataSchema: LauncherOperationRecordSchema,
    run: ({ operationId }) =>
      daemonOperation(() => client.getLauncherOperation(operationId)),
  });

  registerTool({
    name: 'portreeve_launcher_operations_list',
    title: 'List launcher coordination history',
    description:
      'Read the daemon-bounded launcher operation history for one explicit stack using opaque cursor pagination.',
    inputSchema: z
      .object({
        stackId: IdentifierSchema,
        limit: z
          .number()
          .int()
          .min(1)
          .max(LAUNCHER_OPERATION_HISTORY_LIMIT)
          .default(LAUNCHER_OPERATION_HISTORY_LIMIT),
        afterCursor: z.string().min(1).optional(),
      })
      .strict(),
    outputDataSchema: LauncherPageSchema,
    run: (input) =>
      daemonOperation(async () =>
        pageMcpValues(
          await client.listLauncherOperations(input.stackId, {
            limit: LAUNCHER_OPERATION_HISTORY_LIMIT,
          }),
          input,
          (operation) => `${operation.startedAt}:${operation.id}`,
        ),
      ),
  });
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
