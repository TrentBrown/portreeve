// @ts-check

import { addMilliseconds } from '../allocation/time.js';
import { detectEphemeralPortRange } from '../platform/ephemeral-ports.js';
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
  StackRenewActivationRequestSchema,
  StackRenewActivationResponseSchema,
  StackSkipEndpointRequestSchema,
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
   *   detectEphemeralRange?: typeof detectEphemeralPortRange,
   *   now?: () => Date
   * }} options
   */
  constructor({
    registry,
    allocationService,
    inventoryService = new InventoryService({ registry }),
    detectEphemeralRange = detectEphemeralPortRange,
    now = () => new Date(),
  }) {
    this.registry = registry;
    this.allocationService = allocationService;
    this.inventoryService = inventoryService;
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
          workspaceRoot: stack.workspaceRoot,
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
    assertCompatible(request.client);
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
        inventory.classification === 'verified' &&
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
    return StackBeginActivationResponseSchema.parse(
      this.registry.beginStackActivation(
        {
          generationId: generation.id,
          requiredEndpoints: request.requiredEndpoints.map(endpointKey),
          skippedEndpoints: request.skippedEndpoints.map(endpointKey),
          expiresAt,
        },
        now,
      ),
    );
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
    assertCompatible(request.client);
    await this.allocationService.confirmForActivation(request, activationId);
    return this.get(activationId);
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
    for (const endpoint of activation.endpoints) {
      if (endpoint.state !== 'confirmed') continue;
      const inventory = await this.inventoryService.inspect(endpoint.port);
      if (inventory.listeners.length > 0) {
        throw new RegistryError(
          'conflict',
          `Activation ${activationId} still has a listener on port ${endpoint.port}.`,
          {
            activationId,
            component: endpoint.component,
            endpoint: endpoint.endpoint,
            port: endpoint.port,
            listeners: inventory.listeners,
            reason: 'listener_present',
          },
        );
      }
    }
    return StackEndActivationResponseSchema.parse(
      this.registry.endStackActivation(activationId, this.now()),
    );
  }

  /** @param {import('zod').infer<typeof StackGenerationSchema>} generation */
  async #generationRemainsValid(generation) {
    for (const endpoint of generation.endpoints) {
      const claim = this.registry.getClaim(endpoint.claimId);
      if (claim?.assignedPort !== endpoint.port) return false;
      const inventory = await this.inventoryService.inspect(endpoint.port);
      if (inventory.listeners.length === 0) continue;
      if (
        inventory.classification !== 'verified' ||
        inventory.run?.claimId !== endpoint.claimId
      ) {
        return false;
      }
    }
    return true;
  }
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
