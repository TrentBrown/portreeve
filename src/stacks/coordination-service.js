// @ts-check

import { addMilliseconds } from '../allocation/time.js';
import { DockerCliAdapter } from '../docker/adapter.js';
import {
  assertDockerEvidence,
  expectedDockerLabels,
  publishedContainerPorts,
  verifyDockerEvidence,
} from '../docker/evidence.js';
import { detectEphemeralPortRange } from '../platform/ephemeral-ports.js';
import { CAPABILITIES, DOCKER_CAPABILITY } from '../protocol/constants.js';
import {
  StackAbandonEndpointRequestSchema,
  StackActivationSchema,
  StackBeginActivationRequestSchema,
  StackBeginActivationResponseSchema,
  StackConfirmEndpointRequestSchema,
  StackEndActivationRequestSchema,
  StackEndActivationResponseSchema,
  StackGenerationSchema,
  StackPrepareRequestSchema,
  StackPrepareResponseSchema,
  StackReconcileActivationRequestSchema,
  StackReconcileActivationResponseSchema,
  StackRenewActivationRequestSchema,
  StackRenewActivationResponseSchema,
  StackSkipEndpointRequestSchema,
  StackStatusRequestSchema,
  StackStatusSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { InventoryService } from '../reconciliation/inventory.js';
import { RegistryError } from '../storage/registry.js';

const CAPABILITY = 'stack-activations-v1';

export class StackCoordinationService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   allocationService: import('../allocation/service.js').AllocationService,
   *   inventoryService?: InventoryService,
   *   dockerAdapter?: import('../docker/adapter.js').DockerEvidenceAdapter,
   *   detectEphemeralRange?: typeof detectEphemeralPortRange,
   *   now?: () => Date
   * }} options
   */
  constructor({
    registry,
    allocationService,
    inventoryService = new InventoryService({ registry }),
    dockerAdapter = new DockerCliAdapter(),
    detectEphemeralRange = detectEphemeralPortRange,
    now = () => new Date(),
  }) {
    this.registry = registry;
    this.allocationService = allocationService;
    this.inventoryService = inventoryService;
    this.dockerAdapter = dockerAdapter;
    this.detectEphemeralRange = detectEphemeralRange;
    this.now = now;
  }

  /** @param {unknown} input */
  async prepare(input) {
    const request = StackPrepareRequestSchema.parse(input);
    assertCompatible(request.client);
    const now = this.now();
    this.registry.expirePendingLeases(now);
    const stack = this.registry.getStack(request.stackId);
    if (stack === null) {
      throw new RegistryError('not_found', `Stack ${request.stackId} was not found.`);
    }

    const existing = this.registry.getLatestValidStackGeneration(
      stack.id,
      stack.currentRevision,
    );
    if (existing !== null && (await this.#generationRemainsValid(existing))) {
      return StackPrepareResponseSchema.parse({ reused: true, generation: existing });
    }
    if (existing !== null) {
      this.registry.invalidateStackGeneration(existing.id, now);
    }

    const settings = this.registry.getSettings();
    const ephemeralRange = await this.detectEphemeralRange();
    const assignedOwners = new Map(
      this.registry
        .listClaims()
        .filter(({ assignedPort }) => assignedPort !== null)
        .map((claim) => [claim.assignedPort, claim.id]),
    );
    const reserved = new Set(this.registry.listReservedPorts(now));
    const selected = new Set();
    const endpoints = [];

    for (const [component, componentDefinition] of Object.entries(
      stack.definition.components,
    )) {
      for (const [endpoint, endpointDefinition] of Object.entries(
        componentDefinition.endpoints,
      )) {
        if (!endpointDefinition.publish) continue;
        const claim = this.registry.findClaim({
          project: stack.project,
          workspaceRoot: stack.stackRoot,
          component,
          endpoint,
          transport: endpointDefinition.transport,
        });
        if (claim === null) {
          throw new RegistryError(
            'internal',
            `Stack endpoint ${component}.${endpoint} has no canonical claim.`,
          );
        }
        const candidates = candidatePorts(
          claim.assignedPort,
          {
            ...(endpointDefinition.allocation.preferredPort === undefined
              ? {}
              : { preferredPort: endpointDefinition.allocation.preferredPort }),
            ...(endpointDefinition.allocation.exactPort === undefined
              ? {}
              : { exactPort: endpointDefinition.allocation.exactPort }),
          },
          settings,
          ephemeralRange,
        );
        let port = null;
        for (const candidate of candidates) {
          if (selected.has(candidate)) continue;
          const assignedOwner = assignedOwners.get(candidate);
          if (assignedOwner !== undefined && assignedOwner !== claim.id) continue;
          if (reserved.has(candidate) && assignedOwner !== claim.id) {
            continue;
          }
          const pending = this.registry.getPendingLeaseForClaim(claim.id, now);
          if (pending !== null) continue;
          const inventory = await this.inventoryService.inspect(candidate);
          if (inventory.listeners.length > 0) {
            if (
              inventory.classification !== 'verified' ||
              inventory.run?.claimId !== claim.id
            ) {
              if (endpointDefinition.allocation.exactPort === candidate) {
                throw new RegistryError(
                  'conflict',
                  `Exact port ${candidate} has a live listener.`,
                  {
                    stackId: stack.id,
                    component,
                    endpoint,
                    port: candidate,
                    reason: 'listener_present',
                  },
                );
              }
              continue;
            }
          }
          port = candidate;
          break;
        }
        if (port === null) {
          throw new RegistryError(
            'conflict',
            endpointDefinition.allocation.exactPort === undefined
              ? `No port is available for ${component}.${endpoint}.`
              : `Exact port ${endpointDefinition.allocation.exactPort} is unavailable.`,
            { stackId: stack.id, component, endpoint },
          );
        }
        selected.add(port);
        endpoints.push({
          claimId: claim.id,
          component,
          endpoint,
          transport: endpointDefinition.transport,
          host: /** @type {const} */ ('127.0.0.1'),
          port,
          required: endpointDefinition.required,
        });
      }
    }

    return StackPrepareResponseSchema.parse(
      this.registry.createStackGeneration(
        {
          stackId: stack.id,
          revision: stack.currentRevision,
          endpoints,
        },
        now,
      ),
    );
  }

  /** @param {unknown} input */
  async begin(input) {
    const request = StackBeginActivationRequestSchema.parse(input);
    if (Object.values(request.bindings).includes('docker')) {
      await this.#assertDockerAvailable(request.client);
    } else {
      assertCompatible(request.client);
    }
    const now = this.now();
    this.registry.expirePendingLeases(now);
    const generation = this.registry.getStackGeneration(request.generationId);
    if (generation === null) {
      throw new RegistryError(
        'not_found',
        `Stack generation ${request.generationId} was not found.`,
      );
    }
    const stack = this.registry.getStack(generation.stackId);
    if (stack === null) {
      throw new RegistryError(
        'internal',
        `Stack ${generation.stackId} disappeared before activation.`,
      );
    }
    for (const [component, bindingKind] of Object.entries(request.bindings)) {
      const definition = stack.definition.components[component];
      if (definition === undefined) {
        throw new RegistryError(
          'invalid_input',
          `Activation binding names unknown component ${component}.`,
          { component, reason: 'binding_component_unknown' },
        );
      }
      if (bindingKind !== 'docker') continue;
      if (definition.docker === undefined) {
        throw new RegistryError(
          'invalid_input',
          `Component ${component} has no Docker service definition.`,
          { component, reason: 'docker_definition_missing' },
        );
      }
      for (const endpoint of generation.endpoints.filter(
        (candidate) => candidate.component === component,
      )) {
        if (definition.endpoints[endpoint.endpoint]?.docker === undefined) {
          throw new RegistryError(
            'invalid_input',
            `Docker component ${component} lacks container-port data for ${endpoint.endpoint}.`,
            {
              component,
              endpoint: endpoint.endpoint,
              reason: 'docker_endpoint_definition_missing',
            },
          );
        }
      }
    }
    const promoted = new Set(request.requiredEndpoints.map(endpointKey));
    for (const [consumer, component] of Object.entries(stack.definition.components)) {
      for (const [alias, dependency] of Object.entries(component.dependencies)) {
        if (!dependency.required) continue;
        const provider = generation.endpoints.find(
          (endpoint) =>
            endpoint.component === dependency.component &&
            endpoint.endpoint === dependency.endpoint,
        );
        if (
          provider !== undefined &&
          !provider.required &&
          !promoted.has(endpointKey(provider))
        ) {
          throw new RegistryError(
            'invalid_input',
            `Required dependency ${consumer}.${alias} targets optional endpoint ${provider.component}.${provider.endpoint}; promote it for this activation.`,
            {
              consumer,
              alias,
              component: provider.component,
              endpoint: provider.endpoint,
              reason: 'optional_required_dependency',
            },
          );
        }
      }
    }
    const skipped = new Set(request.skippedEndpoints.map(endpointKey));
    for (const endpoint of generation.endpoints) {
      if (skipped.has(endpointKey(endpoint))) continue;
      const inventory = await this.inventoryService.inspect(endpoint.port);
      if (inventory.listeners.length === 0) continue;
      if (
        ['verified', 'docker-managed'].includes(inventory.classification) &&
        inventory.run?.claimId === endpoint.claimId
      ) {
        throw new RegistryError(
          'conflict',
          `Endpoint ${endpoint.component}.${endpoint.endpoint} already has an active run.`,
          {
            claimId: endpoint.claimId,
            runId: inventory.run.id,
            port: endpoint.port,
            reason: 'active_run',
          },
        );
      }
      this.registry.invalidateStackGeneration(generation.id, now);
      throw new RegistryError(
        'conflict',
        `Generation ${generation.id} is stale because port ${endpoint.port} has a live listener.`,
        {
          generationId: generation.id,
          component: endpoint.component,
          endpoint: endpoint.endpoint,
          port: endpoint.port,
          reason: 'stale_generation',
        },
      );
    }
    const expiresAt = addMilliseconds(
      now,
      this.registry.getSettings().leaseTtlMilliseconds,
    ).toISOString();
    const begun = this.registry.beginStackActivation(
      {
        generationId: generation.id,
        requiredEndpoints: request.requiredEndpoints.map(endpointKey),
        skippedEndpoints: request.skippedEndpoints.map(endpointKey),
        bindings: request.bindings,
        expiresAt,
      },
      now,
    );
    return StackBeginActivationResponseSchema.parse({
      activation: begun.activation,
      leases: begun.leases.map((lease) => {
        const activationEndpoint = begun.activation.endpoints.find(
          (candidate) =>
            candidate.component === lease.component &&
            candidate.endpoint === lease.endpoint,
        );
        const bindingKind = activationEndpoint?.bindingKind ?? 'process';
        const component = stack.definition.components[lease.component];
        const endpoint = component?.endpoints[lease.endpoint];
        const docker =
          bindingKind === 'docker' &&
          component?.docker !== undefined &&
          endpoint?.docker !== undefined
            ? {
                service: component.docker.service,
                containerPort: endpoint.docker.containerPort,
                requiredLabels: expectedDockerLabels({
                  stackId: stack.id,
                  component: lease.component,
                  definitionRevision: generation.revision,
                  generationId: generation.id,
                  activationId: begun.activation.id,
                  endpoints: publishedContainerPorts(component),
                }),
              }
            : null;
        return { ...lease, bindingKind, docker };
      }),
    });
  }

  /** @param {string} activationId @param {unknown} input */
  renew(activationId, input) {
    const request = StackRenewActivationRequestSchema.parse(input);
    assertCompatible(request.client);
    const now = this.now();
    this.registry.expirePendingLeases(now);
    const expiresAt = addMilliseconds(
      now,
      this.registry.getSettings().leaseTtlMilliseconds,
    ).toISOString();
    return StackRenewActivationResponseSchema.parse(
      this.registry.renewStackActivation(
        { activationId, leases: request.leases, expiresAt },
        now,
      ),
    );
  }

  /** @param {string} activationId @param {unknown} input */
  async confirm(activationId, input) {
    const request = StackConfirmEndpointRequestSchema.parse(input);
    if (request.bindingKind === 'docker') {
      await this.#confirmDocker(activationId, request);
    } else {
      assertCompatible(request.client);
      const activation = this.get(activationId);
      const endpoint = activation.endpoints.find(
        (candidate) => candidate.leaseId === request.leaseId,
      );
      if (endpoint?.bindingKind !== 'process') {
        throw new RegistryError(
          'conflict',
          `Lease ${request.leaseId} is not process-backed.`,
          { leaseId: request.leaseId, reason: 'binding_kind_mismatch' },
        );
      }
      await this.allocationService.confirmForActivation(request, activationId);
    }
    return this.get(activationId);
  }

  /**
   * @param {string} activationId
   * @param {Extract<import('zod').infer<typeof StackConfirmEndpointRequestSchema>, {bindingKind: 'docker'}>} request
   */
  async #confirmDocker(activationId, request) {
    await this.#assertDockerAvailable(request.client);
    const activation = this.get(activationId);
    const endpoint = activation.endpoints.find(
      (candidate) => candidate.leaseId === request.leaseId,
    );
    if (endpoint?.bindingKind !== 'docker') {
      throw new RegistryError(
        'conflict',
        `Lease ${request.leaseId} is not Docker-backed.`,
        { leaseId: request.leaseId, reason: 'binding_kind_mismatch' },
      );
    }
    const binding = this.#resolveDockerBinding(activation, endpoint);
    if (binding === null) {
      throw new RegistryError(
        'conflict',
        `Docker definition for ${endpoint.component}.${endpoint.endpoint} is unavailable.`,
        { reason: 'docker_definition_missing' },
      );
    }
    const inspected = await this.dockerAdapter.inspect(request.containerId);
    if (inspected.status !== 'ok') {
      throw new RegistryError(
        inspected.status === 'unavailable' ? 'unavailable' : 'conflict',
        `Container ${request.containerId} could not be freshly inspected.`,
        { containerId: request.containerId, reason: inspected.reason },
      );
    }
    const { expectedLabels, verification } = verifyDockerBinding({
      activationId: activation.id,
      binding,
      container: inspected.container,
      endpoint,
    });
    assertDockerEvidence(verification, request.containerId);
    this.registry.confirmDockerLease(
      {
        leaseId: request.leaseId,
        token: request.leaseToken,
        containerId: inspected.container.id,
        providerEvidence: {
          expectedLabels,
          endpoint: endpoint.endpoint,
          containerPort: binding.containerPort,
          hostPort: endpoint.port,
        },
        activationId,
      },
      this.now(),
    );
  }

  /**
   * Resolve the definition backing one Docker endpoint of an activation, or
   * `null` when the stack no longer defines that Docker binding.
   *
   * @param {{stackId: string, generationId: string}} activation
   * @param {{component: string, endpoint: string}} endpoint
   */
  #resolveDockerBinding(activation, endpoint) {
    const generation = this.getGeneration(activation.generationId);
    const stack = this.registry.getStack(activation.stackId);
    const component = stack?.definition.components[endpoint.component];
    const endpointDefinition = component?.endpoints[endpoint.endpoint];
    if (
      stack === null ||
      stack === undefined ||
      component?.docker === undefined ||
      endpointDefinition?.docker === undefined
    ) {
      return null;
    }
    return {
      stack,
      component,
      containerPort: endpointDefinition.docker.containerPort,
      generation,
    };
  }

  /** @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client */
  async #assertDockerAvailable(client) {
    const availability = await this.dockerAdapter.availability();
    const availableCapabilities = availability.available
      ? [...CAPABILITIES, DOCKER_CAPABILITY]
      : CAPABILITIES;
    const result = negotiateCompatibility(
      client.protocol,
      [...new Set([...client.requiredCapabilities, CAPABILITY, DOCKER_CAPABILITY])],
      availableCapabilities,
    );
    if (!result.compatible) {
      throw new RegistryError(
        availability.available ? 'incompatible_protocol' : 'unavailable',
        'Docker evidence is not available for this Portreeve server.',
        { ...result, docker: availability },
      );
    }
  }

  /** @param {string} activationId @param {unknown} input */
  abandon(activationId, input) {
    const request = StackAbandonEndpointRequestSchema.parse(input);
    assertCompatible(request.client);
    this.registry.abandonLease(
      {
        leaseId: request.leaseId,
        token: request.leaseToken,
        reason: request.reason,
        activationId,
        endpointOutcome: 'failed',
      },
      this.now(),
    );
    return this.get(activationId);
  }

  /** @param {string} activationId @param {unknown} input */
  skip(activationId, input) {
    const request = StackSkipEndpointRequestSchema.parse(input);
    assertCompatible(request.client);
    this.registry.abandonLease(
      {
        leaseId: request.leaseId,
        token: request.leaseToken,
        reason: 'client-cancelled',
        activationId,
        endpointOutcome: 'skipped',
      },
      this.now(),
    );
    return this.get(activationId);
  }

  /** @param {string} activationId */
  get(activationId) {
    this.registry.expirePendingLeases(this.now());
    const activation = this.registry.getStackActivation(activationId);
    if (activation === null) {
      throw new RegistryError('not_found', `Activation ${activationId} was not found.`);
    }
    return StackActivationSchema.parse(activation);
  }

  /** @param {string} generationId */
  getGeneration(generationId) {
    const generation = this.registry.getStackGeneration(generationId);
    if (generation === null) {
      throw new RegistryError(
        'not_found',
        `Stack generation ${generationId} was not found.`,
      );
    }
    return StackGenerationSchema.parse(generation);
  }

  /** @param {string} stackId @param {unknown} input */
  async status(stackId, input) {
    const request = StackStatusRequestSchema.parse(input);
    assertCompatible(request.client);
    this.registry.expirePendingLeases(this.now());
    const stack = this.registry.getStack(stackId);
    if (stack === null) {
      throw new RegistryError('not_found', `Stack ${stackId} was not found.`);
    }
    const generation = this.registry.getLatestStackGenerationForStack(stack.id);
    const activation = this.registry.getLatestStackActivationForStack(stack.id);
    const providers =
      activation === null ? [] : await this.inspectProviders(activation.id);
    return StackStatusSchema.parse({ stack, generation, activation, providers });
  }

  /** @param {string} activationId @param {unknown} input */
  async reconcile(activationId, input) {
    const request = StackReconcileActivationRequestSchema.parse(input);
    assertCompatible(request.client);
    const activation = this.get(activationId);
    if (!['confirmed', 'degraded'].includes(activation.state)) {
      return StackReconcileActivationResponseSchema.parse({
        changed: false,
        activation,
        providers: [],
      });
    }
    const providers = await this.inspectProviders(activation.id);
    if (providers.length > 0 && providers.every(({ status }) => status === 'gone')) {
      const result = this.registry.markStackActivationLost(
        activation.id,
        providers,
        this.now(),
      );
      return StackReconcileActivationResponseSchema.parse({
        ...result,
        providers,
      });
    }
    return StackReconcileActivationResponseSchema.parse({
      changed: false,
      activation: this.get(activation.id),
      providers,
    });
  }

  /** @param {string} activationId */
  async inspectProviders(activationId) {
    const activation = this.get(activationId);
    return Promise.all(
      activation.endpoints
        .filter(({ state }) => state === 'confirmed')
        .map((endpoint) => this.#inspectProvider(activation, endpoint)),
    );
  }

  /** @param {string} activationId @param {unknown} input */
  async end(activationId, input) {
    const request = StackEndActivationRequestSchema.parse(input);
    assertCompatible(request.client);
    const activation = this.get(activationId);
    if (activation.state === 'ended') {
      return StackEndActivationResponseSchema.parse({
        changed: false,
        activation,
      });
    }
    if (activation.endpoints.some(({ state }) => state === 'leased')) {
      throw new RegistryError(
        'conflict',
        `Activation ${activationId} still has pending endpoint leases.`,
        { activationId, reason: 'leases_pending' },
      );
    }
    const providers = await this.inspectProviders(activation.id);
    const blocker = providers.find(
      ({ status, listeners }) => status !== 'gone' || listeners > 0,
    );
    if (blocker !== undefined) {
      throw new RegistryError(
        blocker.status === 'unknown' ? 'unavailable' : 'conflict',
        `Activation ${activationId} still has provider evidence for ${blocker.component}.${blocker.endpoint}.`,
        {
          activationId,
          provider: blocker,
          reason:
            blocker.status === 'unknown'
              ? 'provider_unobservable'
              : blocker.listeners > 0
                ? 'listener_present'
                : 'provider_present',
        },
      );
    }
    return StackEndActivationResponseSchema.parse(
      this.registry.endStackActivation(activationId, this.now()),
    );
  }

  /**
   * @param {import('zod').infer<typeof StackActivationSchema>} activation
   * @param {import('zod').infer<typeof import('../protocol/schemas.js').StackActivationEndpointSchema>} endpoint
   */
  async #inspectProvider(activation, endpoint) {
    const run = endpoint.runId === null ? null : this.registry.getRun(endpoint.runId);
    const inventory = await this.inventoryService.inspect(endpoint.port);
    const base = {
      component: endpoint.component,
      endpoint: endpoint.endpoint,
      port: endpoint.port,
      bindingKind: endpoint.bindingKind,
      listeners: inventory.listeners.length,
      runId: endpoint.runId,
      containerId: run?.containerId ?? null,
    };
    if (endpoint.runId === null || run === null) {
      return {
        ...base,
        status: /** @type {const} */ ('unknown'),
        reason: 'run-evidence-missing',
      };
    }
    if (run.state !== 'confirmed') {
      return {
        ...base,
        status: /** @type {const} */ ('gone'),
        reason: 'run-released',
      };
    }
    if (endpoint.bindingKind === 'process') {
      if (inventory.listeners.length === 0) {
        return {
          ...base,
          status: /** @type {const} */ ('gone'),
          reason: 'listener-missing',
        };
      }
      if (inventory.run?.id !== run.id) {
        return {
          ...base,
          status: /** @type {const} */ ('gone'),
          reason: 'provider-replaced',
        };
      }
      return {
        ...base,
        status: /** @type {'active' | 'unknown'} */ (
          inventory.classification === 'verified' ? 'active' : 'unknown'
        ),
        reason:
          inventory.classification === 'verified'
            ? 'process-ownership-verified'
            : 'process-ownership-unverified',
      };
    }

    if (run.containerId === null) {
      return {
        ...base,
        status: /** @type {const} */ ('unknown'),
        reason: 'container-evidence-missing',
      };
    }
    const availability = await this.dockerAdapter.availability();
    if (!availability.available) {
      return {
        ...base,
        status: /** @type {const} */ ('unknown'),
        reason: availability.reason ?? 'docker-unavailable',
      };
    }
    const inspected = await this.dockerAdapter.inspect(run.containerId);
    if (inspected.status === 'missing') {
      return {
        ...base,
        status: /** @type {const} */ ('gone'),
        reason: inspected.reason ?? 'container-missing',
      };
    }
    if (inspected.status !== 'ok') {
      return {
        ...base,
        status: /** @type {const} */ ('unknown'),
        reason: inspected.reason ?? 'container-unobservable',
      };
    }
    const binding = this.#resolveDockerBinding(activation, endpoint);
    if (binding === null) {
      return {
        ...base,
        status: /** @type {const} */ ('unknown'),
        reason: 'docker-definition-missing',
      };
    }
    const { verification } = verifyDockerBinding({
      activationId: activation.id,
      binding,
      container: inspected.container,
      endpoint,
    });
    return verification.verified
      ? {
          ...base,
          status: /** @type {const} */ ('active'),
          reason:
            inventory.listeners.length > 0
              ? 'docker-provider-verified'
              : 'docker-provider-running-listener-missing',
        }
      : {
          ...base,
          status: /** @type {const} */ ('gone'),
          reason: verification.reason ?? 'docker-provider-mismatch',
        };
  }

  /** @param {import('zod').infer<typeof StackGenerationSchema>} generation */
  async #generationRemainsValid(generation) {
    for (const endpoint of generation.endpoints) {
      const claim = this.registry.getClaim(endpoint.claimId);
      if (claim?.assignedPort !== endpoint.port) return false;
      const inventory = await this.inventoryService.inspect(endpoint.port);
      if (inventory.listeners.length === 0) continue;
      if (
        !['verified', 'docker-managed'].includes(inventory.classification) ||
        inventory.run?.claimId !== endpoint.claimId
      ) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Verify freshly inspected container evidence against the labels the recorded
 * Docker binding requires.
 *
 * @param {{
 *   activationId: string,
 *   binding: {
 *     stack: {id: string},
 *     component: Parameters<typeof publishedContainerPorts>[0],
 *     containerPort: number,
 *     generation: {id: string, revision: string}
 *   },
 *   container: Parameters<typeof verifyDockerEvidence>[0]['container'],
 *   endpoint: {component: string, endpoint: string, port: number}
 * }} input
 */
function verifyDockerBinding(input) {
  const expectedLabels = expectedDockerLabels({
    stackId: input.binding.stack.id,
    component: input.endpoint.component,
    definitionRevision: input.binding.generation.revision,
    generationId: input.binding.generation.id,
    activationId: input.activationId,
    endpoints: publishedContainerPorts(input.binding.component),
  });
  const verification = verifyDockerEvidence({
    container: input.container,
    expectedLabels,
    endpoint: input.endpoint.endpoint,
    containerPort: input.binding.containerPort,
    hostPort: input.endpoint.port,
  });
  return { expectedLabels, verification };
}

/** @param {{component: string, endpoint: string}} endpoint */
function endpointKey(endpoint) {
  return `${endpoint.component}\u0000${endpoint.endpoint}`;
}

/**
 * @param {number | null} assignedPort
 * @param {{preferredPort?: number, exactPort?: number}} allocation
 * @param {import('zod').infer<typeof import('../domain/settings.js').ServerSettingsSchema>} settings
 * @param {{start: number, end: number}} ephemeralRange
 */
function candidatePorts(assignedPort, allocation, settings, ephemeralRange) {
  if (allocation.exactPort !== undefined) return [allocation.exactPort];
  const candidates = [];
  const seen = new Set();
  for (const candidate of [assignedPort, allocation.preferredPort]) {
    if (candidate !== null && candidate !== undefined && !seen.has(candidate)) {
      candidates.push(candidate);
      seen.add(candidate);
    }
  }
  const excluded = new Set(settings.excludedPorts);
  for (const range of settings.automaticPortRanges) {
    for (let port = range.start; port <= range.end; port += 1) {
      const ephemeral = port >= ephemeralRange.start && port <= ephemeralRange.end;
      if (!excluded.has(port) && !ephemeral && !seen.has(port)) {
        candidates.push(port);
        seen.add(port);
      }
    }
  }
  return candidates;
}

/** @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, [
    ...new Set([...client.requiredCapabilities, CAPABILITY]),
  ]);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and Portreeve stack activation requirements do not overlap.',
      result,
    );
  }
}
