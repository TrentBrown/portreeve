// @ts-check

import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { StackDefinitionSchema } from '../protocol/schemas.js';

export const LAUNCHER_DEFINITION_FILENAME = 'portreeve.launcher.json';
export const MAX_LAUNCHER_DEFINITION_BYTES = 1_048_576;

const NameSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim(), {
    message: 'names must not begin or end with whitespace',
  });
const CommandSchema = z
  .string()
  .min(1)
  .max(65_536)
  .refine((value) => value.trim().length > 0, { message: 'command must not be blank' });
const TimeoutSchema = z.number().int().min(1).max(86_400);
const EnvironmentNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'invalid environment variable name')
  .refine((value) => !value.startsWith('PORTREEVE_'), {
    message: 'PORTREEVE_ environment names are reserved',
  });

const IntegrationSchema = z
  .object({
    mode: z.enum(['command-only', 'verified-activation']).default('command-only'),
  })
  .strict()
  .default({ mode: 'command-only' });

const StartOperationSchema = z
  .object({
    command: CommandSchema,
    mode: z.enum(['finite', 'attached']).default('finite'),
    timeoutSeconds: TimeoutSchema.optional(),
  })
  .strict()
  .superRefine(({ mode, timeoutSeconds }, context) => {
    if (mode === 'attached' && timeoutSeconds !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'attached Start must not declare a timeout',
        path: ['timeoutSeconds'],
      });
    }
  })
  .transform((operation) =>
    operation.mode === 'finite'
      ? { ...operation, timeoutSeconds: operation.timeoutSeconds ?? 300 }
      : operation,
  );

/** @param {number} defaultTimeoutSeconds */
function finiteOperationSchema(defaultTimeoutSeconds) {
  return z
    .object({ command: CommandSchema, timeoutSeconds: TimeoutSchema.optional() })
    .strict()
    .transform((operation) => ({
      ...operation,
      timeoutSeconds: operation.timeoutSeconds ?? defaultTimeoutSeconds,
    }));
}

const OperationsSchema = z
  .object({
    start: StartOperationSchema,
    stop: finiteOperationSchema(120),
    restart: finiteOperationSchema(420).optional(),
    status: finiteOperationSchema(30).optional(),
  })
  .strict()
  .superRefine(({ restart, start }, context) => {
    if (start.mode === 'attached' && restart !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'attached Start always uses composed Restart',
        path: ['restart'],
      });
    }
  });

export const LauncherEndpointReferenceSchema = z
  .object({ component: NameSchema, endpoint: NameSchema.default('default') })
  .strict();

export const LauncherEnvironmentMappingSchema = z
  .object({
    name: EnvironmentNameSchema,
    endpoint: LauncherEndpointReferenceSchema,
    value: z.enum(['host-port', 'host-url', 'container-port', 'docker-network-url']),
    scheme: z.enum(['http', 'https']).optional(),
  })
  .strict()
  .superRefine(({ scheme, value }, context) => {
    const isUrl = value === 'host-url' || value === 'docker-network-url';
    if (isUrl && scheme === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'URL mappings require a scheme',
        path: ['scheme'],
      });
    }
    if (!isUrl && scheme !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'port mappings must not declare a scheme',
        path: ['scheme'],
      });
    }
  });

export const LauncherDefinitionSchema = z
  .object({
    version: z.literal(1),
    integration: IntegrationSchema,
    shell: z.enum(['system', 'bash', 'zsh']).default('system'),
    workingDirectory: z
      .string()
      .min(1)
      .max(4_096)
      .refine((value) => !value.includes('\0'), {
        message: 'invalid working directory',
      })
      .refine((value) => !isAbsolute(value), {
        message: 'workingDirectory must be relative to the stack root',
      })
      .default('.'),
    operations: OperationsSchema,
    environment: z.array(LauncherEnvironmentMappingSchema).max(4_096).default([]),
  })
  .strict()
  .superRefine(({ environment }, context) => {
    const names = new Set();
    for (let index = 0; index < environment.length; index += 1) {
      const name = environment[index]?.name;
      if (name !== undefined && names.has(name)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate environment name ${name}`,
          path: ['environment', index, 'name'],
        });
      }
      names.add(name);
    }
  });

/** @typedef {z.infer<typeof LauncherDefinitionSchema>} LauncherDefinition */

/** @param {unknown} input */
export function normalizeLauncherDefinition(input) {
  const definition = LauncherDefinitionSchema.parse(input);
  const content = `${JSON.stringify(sortObject(definition), null, 2)}\n`;
  return Object.freeze({
    definition,
    content,
    revision: launcherRevision(content),
  });
}

/** @param {string | Buffer} content */
export function launcherRevision(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * @param {LauncherDefinition} launcher
 * @param {unknown} stackInput
 */
export function validateLauncherTopology(launcher, stackInput) {
  const stack = StackDefinitionSchema.parse(stackInput);
  for (const [index, mapping] of launcher.environment.entries()) {
    const component = stack.components[mapping.endpoint.component];
    if (component === undefined) {
      throw topologyError(
        `environment mapping ${mapping.name} references unknown component ${mapping.endpoint.component}`,
        ['environment', index, 'endpoint', 'component'],
      );
    }
    const endpoint = component.endpoints[mapping.endpoint.endpoint];
    if (endpoint === undefined) {
      throw topologyError(
        `environment mapping ${mapping.name} references unknown endpoint ${mapping.endpoint.component}.${mapping.endpoint.endpoint}`,
        ['environment', index, 'endpoint', 'endpoint'],
      );
    }
    if (['host-port', 'host-url'].includes(mapping.value) && !endpoint.publish) {
      throw topologyError(
        `environment mapping ${mapping.name} requires a published endpoint`,
        ['environment', index, 'value'],
      );
    }
    if (
      ['container-port', 'docker-network-url'].includes(mapping.value) &&
      (component.docker === undefined || endpoint.docker === undefined)
    ) {
      throw topologyError(
        `environment mapping ${mapping.name} requires Docker component and endpoint facts`,
        ['environment', index, 'value'],
      );
    }
  }
  return launcher;
}

/**
 * Validate the only maturity transition that loses activation guarantees. The caller
 * remains responsible for writing and trusting the resulting exact file revision.
 *
 * @param {unknown} previousInput
 * @param {unknown} nextInput
 * @param {{confirmDowngrade?: boolean}} [options]
 */
export function validateLauncherIntegrationTransition(
  previousInput,
  nextInput,
  options = {},
) {
  const previous = LauncherDefinitionSchema.parse(previousInput);
  const next = LauncherDefinitionSchema.parse(nextInput);
  if (
    previous.integration.mode === 'verified-activation' &&
    next.integration.mode === 'command-only' &&
    options.confirmDowngrade !== true
  ) {
    throw definitionError(
      'launcher_integration_downgrade_confirmation_required',
      'Downgrading verified activation requires explicit confirmation and a newly trusted revision.',
    );
  }
  return next;
}

/** @param {unknown} value @returns {any} */
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortObject(child)]),
  );
}

/** @param {string} message @param {(string|number)[]} path */
function topologyError(message, path) {
  return new z.ZodError([{ code: 'custom', message, path }]);
}

/** @param {string} code @param {string} message */
function definitionError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
