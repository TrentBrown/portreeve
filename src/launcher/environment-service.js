// @ts-check

import { z } from 'zod';
import {
  StackActivationSchema,
  StackGenerationSchema,
  StackRecordSchema,
  TimestampSchema,
} from '../protocol/schemas.js';
import { LauncherDefinitionSchema, validateLauncherTopology } from './definition.js';
import { LauncherEnvironmentCacheSchema } from './local-state.js';

const RevisionSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const LauncherExecutionDocumentSchema = z
  .object({
    stackRoot: z.string().min(1),
    revision: RevisionSchema,
    definition: LauncherDefinitionSchema,
  })
  .strict();

export const LauncherResolvedEndpointSchema = z
  .object({
    component: z.string().min(1).max(128),
    endpoint: z.string().min(1).max(128),
    required: z.boolean(),
    host: z
      .object({
        host: z.literal('127.0.0.1'),
        port: z.number().int().min(1).max(65_535),
      })
      .strict(),
    dockerNetwork: z
      .object({ host: z.string().min(1), port: z.number().int().min(1).max(65_535) })
      .strict()
      .nullable(),
  })
  .strict();

export const LauncherResolvedEnvironmentSchema = z
  .object({
    source: z.literal('daemon'),
    reusedGeneration: z.boolean(),
    resolvedAt: TimestampSchema,
    stackRoot: z.string().min(1),
    launcherRevision: RevisionSchema,
    stackId: z.uuid(),
    generationId: z.uuid(),
    activationId: z.uuid().nullable(),
    socketPath: z.string().min(1),
    environment: z.record(z.string(), z.string()),
    endpoints: z.array(LauncherResolvedEndpointSchema),
  })
  .strict();

export class LauncherEnvironmentService {
  /**
   * @param {{
   *   client: Pick<import('../../packages/client/src/client.js').PortreeveClient, 'socketPath' | 'prepareStack'>,
   *   stateStore: ReturnType<typeof import('./local-state.js').createLauncherLocalStateStore>,
   *   now?: () => Date
   * }} options
   */
  constructor({ client, stateStore, now = () => new Date() }) {
    this.client = client;
    this.stateStore = stateStore;
    this.now = now;
  }

  /**
   * Resolve the exact nonsecret environment for one immutable launcher revision.
   * A supplied generation is retained for Stop/Status and partial repair paths; without
   * one, PortReeve prepares or reuses the current generation for Start.
   *
   * @param {{
   *   stack: unknown,
   *   launcher: unknown,
   *   generation?: unknown,
   *   activation?: unknown
   * }} input
   */
  async resolve(input) {
    const stack = StackRecordSchema.parse(input.stack);
    const launcherInput = /** @type {Record<string, unknown>} */ (input.launcher);
    const launcher = LauncherExecutionDocumentSchema.parse({
      stackRoot: launcherInput.stackRoot,
      revision: launcherInput.revision,
      definition: launcherInput.definition,
    });
    if (launcher.stackRoot !== stack.stackRoot) {
      throw environmentError(
        'launcher_stack_mismatch',
        'The launcher root does not match the applied stack root.',
      );
    }
    validateLauncherTopology(launcher.definition, stack.definition);

    if (input.generation === undefined) {
      const prepared = await this.client.prepareStack(stack.id);
      return this.#resolved({
        stack,
        launcher,
        generation: StackGenerationSchema.parse(prepared.generation),
        activation: parseActivation(input.activation),
        reusedGeneration: prepared.reused,
      });
    }
    return this.#resolved({
      stack,
      launcher,
      generation: StackGenerationSchema.parse(input.generation),
      activation: parseActivation(input.activation),
      reusedGeneration: true,
    });
  }

  /**
   * @param {{
   *   stack: z.infer<typeof StackRecordSchema>,
   *   launcher: z.infer<typeof LauncherExecutionDocumentSchema>,
   *   generation: z.infer<typeof StackGenerationSchema>,
   *   activation: z.infer<typeof StackActivationSchema> | null,
   *   reusedGeneration: boolean
   * }} context
   */
  async #resolved({ stack, launcher, generation, activation, reusedGeneration }) {
    assertGeneration(stack, generation);
    assertActivation(stack, generation, activation);
    const endpoints = resolvedEndpoints(stack, generation);
    /** @type {Record<string, string>} */
    const environment = {
      PORTREEVE_STACK_ROOT: stack.stackRoot,
      PORTREEVE_STACK_ID: stack.id,
      PORTREEVE_GENERATION_ID: generation.id,
      PORTREEVE_SOCKET: this.client.socketPath,
      ...(activation === null ? {} : { PORTREEVE_ACTIVATION_ID: activation.id }),
    };
    for (const mapping of launcher.definition.environment) {
      environment[mapping.name] = resolveMapping(mapping, stack, generation);
    }
    const resolvedAt = this.now().toISOString();
    const result = LauncherResolvedEnvironmentSchema.parse({
      source: 'daemon',
      reusedGeneration,
      resolvedAt,
      stackRoot: stack.stackRoot,
      launcherRevision: launcher.revision,
      stackId: stack.id,
      generationId: generation.id,
      activationId: activation?.id ?? null,
      socketPath: this.client.socketPath,
      environment,
      endpoints,
    });
    await this.stateStore.cache(
      stack.stackRoot,
      LauncherEnvironmentCacheSchema.parse({
        revision: launcher.revision,
        resolvedAt,
        stackId: stack.id,
        generationId: generation.id,
        activationId: activation?.id ?? null,
        socketPath: this.client.socketPath,
        stack,
        environment: result.environment,
        endpoints: result.endpoints.map(({ component, endpoint, host, required }) => ({
          component,
          endpoint,
          hostPort: host.port,
          required,
        })),
      }),
    );
    return result;
  }

  /** @param {string} stackRoot @param {string} launcherRevision */
  async cached(stackRoot, launcherRevision) {
    return this.stateStore.cached(stackRoot, launcherRevision);
  }
}

/** @param {unknown} input */
function parseActivation(input) {
  return input === undefined || input === null
    ? null
    : StackActivationSchema.parse(input);
}

/** @param {z.infer<typeof StackRecordSchema>} stack @param {z.infer<typeof StackGenerationSchema>} generation */
function assertGeneration(stack, generation) {
  if (
    generation.stackId !== stack.id ||
    generation.revision !== stack.currentRevision ||
    generation.state !== 'valid'
  ) {
    throw environmentError(
      'launcher_generation_stale',
      'The selected allocation generation is not current for this stack.',
    );
  }
}

/** @param {z.infer<typeof StackRecordSchema>} stack @param {z.infer<typeof StackGenerationSchema>} generation @param {z.infer<typeof StackActivationSchema> | null} activation */
function assertActivation(stack, generation, activation) {
  if (
    activation !== null &&
    (activation.stackId !== stack.id || activation.generationId !== generation.id)
  ) {
    throw environmentError(
      'launcher_activation_mismatch',
      'The selected activation does not belong to this stack generation.',
    );
  }
  if (activation !== null && ['failed', 'lost', 'ended'].includes(activation.state)) {
    throw environmentError(
      'launcher_activation_inactive',
      'An inactive stack activation cannot be injected into a launcher command.',
    );
  }
}

/** @param {z.infer<typeof StackRecordSchema>} stack @param {z.infer<typeof StackGenerationSchema>} generation */
function resolvedEndpoints(stack, generation) {
  return [...generation.endpoints].sort(compareEndpoints).map((endpoint) => {
    const component = stack.definition.components[endpoint.component];
    const definition = component?.endpoints[endpoint.endpoint];
    if (component === undefined || definition === undefined) {
      throw environmentError(
        'launcher_endpoint_missing',
        `The generation endpoint ${endpoint.component}.${endpoint.endpoint} is absent from the stack definition.`,
      );
    }
    return {
      component: endpoint.component,
      endpoint: endpoint.endpoint,
      required: endpoint.required,
      host: { host: /** @type {const} */ ('127.0.0.1'), port: endpoint.port },
      dockerNetwork:
        component.docker === undefined || definition.docker === undefined
          ? null
          : {
              host: component.docker.service,
              port: definition.docker.containerPort,
            },
    };
  });
}

/** @param {import('zod').infer<typeof import('./definition.js').LauncherEnvironmentMappingSchema>} mapping @param {z.infer<typeof StackRecordSchema>} stack @param {z.infer<typeof StackGenerationSchema>} generation */
function resolveMapping(mapping, stack, generation) {
  const component = stack.definition.components[mapping.endpoint.component];
  const definition = component?.endpoints[mapping.endpoint.endpoint];
  if (component === undefined || definition === undefined) {
    throw environmentError(
      'launcher_endpoint_missing',
      `Environment mapping ${mapping.name} references a missing endpoint.`,
    );
  }
  if (mapping.value === 'container-port') {
    if (definition.docker === undefined)
      throw environmentError('launcher_docker_missing');
    return String(definition.docker.containerPort);
  }
  if (mapping.value === 'docker-network-url') {
    if (definition.docker === undefined || component.docker === undefined) {
      throw environmentError('launcher_docker_missing');
    }
    return endpointUrl(
      mapping.scheme,
      component.docker.service,
      definition.docker.containerPort,
    );
  }
  const endpoint = generation.endpoints.find(
    (candidate) =>
      candidate.component === mapping.endpoint.component &&
      candidate.endpoint === mapping.endpoint.endpoint,
  );
  if (endpoint === undefined) {
    throw environmentError(
      'launcher_endpoint_unallocated',
      `Environment mapping ${mapping.name} references an endpoint without a host allocation.`,
    );
  }
  return mapping.value === 'host-port'
    ? String(endpoint.port)
    : endpointUrl(mapping.scheme, endpoint.host, endpoint.port);
}

/** @param {'http' | 'https' | undefined} scheme @param {string} host @param {number} port */
function endpointUrl(scheme, host, port) {
  const value = `${scheme}://${host}:${port}`;
  try {
    new URL(value);
    return value;
  } catch {
    throw environmentError(
      'launcher_endpoint_url_invalid',
      `The endpoint host ${host} cannot be represented as a URL.`,
    );
  }
}

/** @param {{component: string, endpoint: string}} left @param {{component: string, endpoint: string}} right */
function compareEndpoints(left, right) {
  return (
    left.component.localeCompare(right.component) ||
    left.endpoint.localeCompare(right.endpoint)
  );
}

/** @param {string} code @param {string} [message] */
function environmentError(
  code,
  message = 'The launcher environment cannot be resolved.',
) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
