// @ts-check

import {
  StackEndpointSnapshotSchema,
  StackResolutionSchema,
  StackResolveRequestSchema,
  StackSnapshotRequestSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { RegistryError } from '../storage/registry.js';

const CAPABILITY = 'stack-discovery-v1';

export class StackDiscoveryService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   coordinationService: import('./coordination-service.js').StackCoordinationService
   * }} options
   */
  constructor({ registry, coordinationService }) {
    this.registry = registry;
    this.coordinationService = coordinationService;
  }

  /** @param {string} activationId @param {unknown} input */
  resolve(activationId, input) {
    const request = StackResolveRequestSchema.parse(input);
    assertCompatible(request.client);
    const context = this.#context(activationId, request.component);
    return StackResolutionSchema.parse({
      schemaVersion: 1,
      definitionRevision: context.generation.revision,
      generationId: context.generation.id,
      activationId: context.activation.id,
      component: request.component,
      own: mapRecord(context.own, ([endpoint]) => [
        endpoint,
        resolvedEndpoint(context, request.component, endpoint),
      ]),
      dependencies: mapRecord(context.dependencies, ([alias, dependency]) => [
        alias,
        resolvedEndpoint(context, dependency.component, dependency.endpoint),
      ]),
    });
  }

  /** @param {string} activationId @param {unknown} input */
  snapshot(activationId, input) {
    const request = StackSnapshotRequestSchema.parse(input);
    assertCompatible(request.client);
    const resolution = this.resolve(activationId, {
      client: request.client,
      component: request.component,
    });
    return StackEndpointSnapshotSchema.parse({
      schemaVersion: 1,
      definitionRevision: resolution.definitionRevision,
      generationId: resolution.generationId,
      activationId: resolution.activationId,
      component: resolution.component,
      own: mapRecord(resolution.own, ([endpoint, value]) => [
        endpoint,
        sandboxEndpoint(value, request.gatewayHost),
      ]),
      dependencies: mapRecord(resolution.dependencies, ([alias, value]) => [
        alias,
        sandboxEndpoint(value, request.gatewayHost),
      ]),
    });
  }

  /** @param {string} activationId @param {string} component */
  #context(activationId, component) {
    const activation = this.coordinationService.get(activationId);
    if (['failed', 'lost', 'ended'].includes(activation.state)) {
      throw new RegistryError(
        'conflict',
        `Activation ${activation.id} is ${activation.state} and cannot publish discovery.`,
        { activationId: activation.id, reason: 'activation_inactive' },
      );
    }
    const generation = this.coordinationService.getGeneration(activation.generationId);
    const stack = this.registry.getStack(activation.stackId);
    if (stack === null) {
      throw new RegistryError(
        'internal',
        `Stack ${activation.stackId} disappeared during discovery.`,
      );
    }
    if (generation.state !== 'valid' || generation.revision !== stack.currentRevision) {
      throw new RegistryError(
        'conflict',
        `Generation ${generation.id} is stale and cannot publish discovery.`,
        {
          generationId: generation.id,
          definitionRevision: generation.revision,
          currentRevision: stack.currentRevision,
          reason: 'stale_generation',
        },
      );
    }
    const definition = stack.definition.components[component];
    if (definition === undefined) {
      throw new RegistryError(
        'not_found',
        `Component ${component} was not found in stack ${stack.id}.`,
        { stackId: stack.id, component },
      );
    }
    for (const [alias, dependency] of Object.entries(definition.dependencies)) {
      if (!dependency.required) continue;
      const endpoint = activation.endpoints.find(
        (candidate) =>
          candidate.component === dependency.component &&
          candidate.endpoint === dependency.endpoint,
      );
      if (
        endpoint === undefined ||
        !endpoint.required ||
        ['skipped', 'failed', 'released'].includes(endpoint.state)
      ) {
        throw new RegistryError(
          'conflict',
          `Required dependency ${component}.${alias} is unavailable in activation ${activation.id}.`,
          {
            activationId: activation.id,
            component,
            alias,
            reason: 'required_dependency_unavailable',
          },
        );
      }
    }
    return {
      activation,
      generation,
      stack,
      own: Object.fromEntries(
        Object.entries(definition.endpoints).filter(([, endpoint]) => endpoint.publish),
      ),
      dependencies: definition.dependencies,
    };
  }
}

/**
 * @param {{
 *   activation: import('zod').infer<typeof import('../protocol/schemas.js').StackActivationSchema>,
 *   generation: import('zod').infer<typeof import('../protocol/schemas.js').StackGenerationSchema>,
 *   stack: import('zod').infer<typeof import('../protocol/schemas.js').StackRecordSchema>
 * }} context
 * @param {string} component
 * @param {string} endpoint
 */
function resolvedEndpoint(context, component, endpoint) {
  const generationEndpoint = context.generation.endpoints.find(
    (candidate) => candidate.component === component && candidate.endpoint === endpoint,
  );
  if (generationEndpoint === undefined) {
    throw new RegistryError(
      'conflict',
      `Endpoint ${component}.${endpoint} is absent from generation ${context.generation.id}.`,
      {
        generationId: context.generation.id,
        component,
        endpoint,
        reason: 'generation_endpoint_missing',
      },
    );
  }
  const provider = context.stack.definition.components[component];
  const endpointDefinition = provider?.endpoints[endpoint];
  if (provider === undefined || endpointDefinition === undefined) {
    throw new RegistryError(
      'internal',
      `Definition endpoint ${component}.${endpoint} disappeared during discovery.`,
    );
  }
  return {
    component,
    endpoint,
    host: {
      transport: 'tcp',
      host: generationEndpoint.host,
      port: generationEndpoint.port,
    },
    dockerNetwork:
      provider.docker === undefined || endpointDefinition.docker === undefined
        ? null
        : {
            transport: 'tcp',
            host: provider.docker.service,
            port: endpointDefinition.docker.containerPort,
          },
  };
}

/** @param {{component: string, endpoint: string, host: {port: number}}} value @param {string} gatewayHost */
function sandboxEndpoint(value, gatewayHost) {
  return {
    component: value.component,
    endpoint: value.endpoint,
    address: {
      transport: 'tcp',
      host: gatewayHost,
      port: value.host.port,
    },
  };
}

/**
 * @template T, U
 * @param {Record<string, T>} record
 * @param {(entry: [string, T]) => [string, U]} transform
 */
function mapRecord(record, transform) {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => compareNames(left, right))
      .map(transform),
  );
}

/** @param {string} left @param {string} right */
function compareNames(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, [
    ...new Set([...client.requiredCapabilities, CAPABILITY]),
  ]);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and PortReeve stack discovery requirements do not overlap.',
      result,
    );
  }
}
