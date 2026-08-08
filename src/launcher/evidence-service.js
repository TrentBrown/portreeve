// @ts-check

import { z } from 'zod';
import { inspectAllTcpListeners } from '../inspection/listeners.js';
import {
  InventoryEntrySchema,
  LauncherEvidenceSummarySchema,
  StackRecordSchema,
  StackStatusSchema,
} from '../protocol/schemas.js';
import { LauncherEnvironmentCacheSchema } from './local-state.js';

export const LauncherEndpointEvidenceSchema = z
  .object({
    component: z.string().min(1).max(128),
    endpoint: z.string().min(1).max(128),
    port: z.number().int().min(1).max(65_535),
    required: z.boolean(),
    observed: z.boolean(),
    verified: z.boolean(),
    conflicting: z.boolean(),
    listenerCount: z.number().int().min(0).max(10_000),
    reasonCodes: z.array(z.string().min(1).max(64)).max(32),
  })
  .strict();

export const LauncherEvidenceResultSchema = z
  .object({
    summary: LauncherEvidenceSummarySchema,
    endpoints: z.array(LauncherEndpointEvidenceSchema),
  })
  .strict();

export class LauncherEvidenceService {
  /**
   * @param {{
   *   client: Pick<import('../../packages/client/src/client.js').PortreeveClient, 'getStackStatus' | 'inspectPort'>,
   *   inspectListeners?: typeof inspectAllTcpListeners,
   *   now?: () => Date
   * }} options
   */
  constructor({
    client,
    inspectListeners = inspectAllTcpListeners,
    now = () => new Date(),
  }) {
    this.client = client;
    this.inspectListeners = inspectListeners;
    this.now = now;
  }

  /** @param {unknown} stackInput */
  async inspectDaemon(stackInput) {
    const stack = StackRecordSchema.parse(stackInput);
    const status = StackStatusSchema.parse(await this.client.getStackStatus(stack.id));
    if (
      status.stack.id !== stack.id ||
      status.stack.stackRoot !== stack.stackRoot ||
      status.stack.currentRevision !== stack.currentRevision
    ) {
      throw evidenceError(
        'launcher_stack_changed',
        'The applied stack changed while launcher evidence was collected.',
      );
    }
    const generation = status.generation;
    if (
      generation === null ||
      generation.state !== 'valid' ||
      generation.revision !== stack.currentRevision
    ) {
      return result({
        classification: generation === null ? 'stopped' : 'uncertain',
        source: 'daemon',
        observedAt: this.now().toISOString(),
        generationId: generation?.id ?? null,
        activationId: status.activation?.id ?? null,
        endpoints: [],
        reasonCodes:
          generation === null ? ['generation-missing'] : ['generation-stale'],
      });
    }

    const inspections = await Promise.allSettled(
      generation.endpoints.map((endpoint) => this.client.inspectPort(endpoint.port)),
    );
    const providerByEndpoint = new Map(
      status.providers.map((provider) => [endpointKey(provider), provider]),
    );
    const activationByEndpoint = new Map(
      (status.activation?.endpoints ?? []).map((endpoint) => [
        endpointKey(endpoint),
        endpoint,
      ]),
    );
    const activationMatches =
      status.activation !== null &&
      status.activation.stackId === stack.id &&
      status.activation.generationId === generation.id;

    const endpoints = generation.endpoints.map((endpoint, index) => {
      const inspected = inspections[index];
      if (inspected?.status !== 'fulfilled') {
        return {
          component: endpoint.component,
          endpoint: endpoint.endpoint,
          port: endpoint.port,
          required: endpoint.required,
          observed: false,
          verified: false,
          conflicting: false,
          listenerCount: 0,
          reasonCodes: ['inventory-unavailable'],
        };
      }
      const inventory = InventoryEntrySchema.parse(inspected.value);
      const provider = providerByEndpoint.get(endpointKey(endpoint));
      const activationEndpoint = activationByEndpoint.get(endpointKey(endpoint));
      return endpointEvidence({
        endpoint,
        inventory,
        provider,
        activationEndpoint,
        activationMatches,
      });
    });

    const reasonCodes = new Set(endpoints.flatMap((endpoint) => endpoint.reasonCodes));
    const activation = status.activation;
    const currentActivation =
      activationMatches &&
      activation !== null &&
      ['confirmed', 'degraded'].includes(activation.state);
    const requiredVerified = endpoints
      .filter(({ required }) => required)
      .every(({ verified }) => verified);
    const confirmedVerified = endpoints.every((endpoint) => {
      const activationEndpoint = activationByEndpoint.get(endpointKey(endpoint));
      return activationEndpoint?.state !== 'confirmed' || endpoint.verified;
    });
    const anyConflict = endpoints.some(({ conflicting }) => conflicting);
    const anyUncertain = endpoints.some(({ reasonCodes: reasons }) =>
      reasons.some((reason) =>
        ['inventory-unavailable', 'provider-unknown', 'lease-pending'].includes(reason),
      ),
    );
    const observed = endpoints.filter((endpoint) => endpoint.observed).length;
    let classification;
    if (anyConflict) classification = /** @type {const} */ ('conflicting');
    else if (currentActivation && requiredVerified && confirmedVerified) {
      classification = /** @type {const} */ ('verified');
      if (activation?.state === 'degraded') reasonCodes.add('activation-degraded');
    } else if (anyUncertain || activation?.state === 'starting') {
      classification = /** @type {const} */ ('uncertain');
      if (activation?.state === 'starting') reasonCodes.add('activation-starting');
    } else if (observed === 0) classification = /** @type {const} */ ('stopped');
    else if (observed === endpoints.length) {
      classification = /** @type {const} */ ('fully-observed');
    } else classification = /** @type {const} */ ('partial');

    return result({
      classification,
      source: 'daemon',
      observedAt: this.now().toISOString(),
      generationId: generation.id,
      activationId: activation?.id ?? null,
      endpoints,
      reasonCodes: [...reasonCodes],
    });
  }

  /** @param {unknown} cacheInput */
  async inspectLocal(cacheInput) {
    const cache = LauncherEnvironmentCacheSchema.parse(cacheInput);
    if (cache.endpoints.length === 0) {
      return result({
        classification: 'uncertain',
        source: 'local',
        observedAt: this.now().toISOString(),
        generationId: cache.generationId,
        activationId: cache.activationId,
        endpoints: [],
        reasonCodes: ['cache-endpoints-missing'],
      });
    }
    let listeners;
    try {
      listeners = await this.inspectListeners();
    } catch {
      return result({
        classification: 'uncertain',
        source: 'local',
        observedAt: this.now().toISOString(),
        generationId: cache.generationId,
        activationId: cache.activationId,
        endpoints: cache.endpoints.map(cachedEndpointUnavailable),
        reasonCodes: ['local-inspection-failed'],
      });
    }
    const endpoints = cache.endpoints.map((endpoint) => {
      const matching = listeners.filter(({ port }) => port === endpoint.hostPort);
      return {
        component: endpoint.component,
        endpoint: endpoint.endpoint,
        port: endpoint.hostPort,
        required: endpoint.required,
        observed: matching.length > 0,
        verified: false,
        conflicting: false,
        listenerCount: matching.length,
        reasonCodes: [
          matching.length > 0 ? 'local-listener-observed' : 'listener-missing',
        ],
      };
    });
    const observed = endpoints.filter((endpoint) => endpoint.observed).length;
    return result({
      classification:
        observed === 0
          ? 'stopped'
          : observed === endpoints.length
            ? 'fully-observed'
            : 'partial',
      source: 'local',
      observedAt: this.now().toISOString(),
      generationId: cache.generationId,
      activationId: cache.activationId,
      endpoints,
      reasonCodes: ['degraded-uncoordinated'],
    });
  }
}

/**
 * @param {{
 *   endpoint: z.infer<typeof import('../protocol/schemas.js').StackGenerationEndpointSchema>,
 *   inventory: z.infer<typeof InventoryEntrySchema>,
 *   provider: z.infer<typeof import('../protocol/schemas.js').StackProviderEvidenceSchema> | undefined,
 *   activationEndpoint: z.infer<typeof import('../protocol/schemas.js').StackActivationEndpointSchema> | undefined,
 *   activationMatches: boolean
 * }} input
 */
function endpointEvidence({
  endpoint,
  inventory,
  provider,
  activationEndpoint,
  activationMatches,
}) {
  const dockerObserved =
    inventory.docker?.containers.some(
      (container) =>
        container.running &&
        container.ports.some((publication) => publication.hostPort === endpoint.port),
    ) ?? false;
  const observed = inventory.listeners.length > 0 || dockerObserved;
  const claimId = stringField(inventory.claim, 'id');
  const runClaimId = stringField(inventory.run, 'claimId');
  const ownershipConflict =
    (claimId !== null && claimId !== endpoint.claimId) ||
    (runClaimId !== null && runClaimId !== endpoint.claimId) ||
    inventory.classification === 'mixed' ||
    (inventory.classification === 'conflicting' && inventory.run !== null);
  const providerConflict = provider?.status === 'gone' && observed;
  const conflicting = ownershipConflict || providerConflict;
  const verified =
    activationMatches &&
    activationEndpoint?.state === 'confirmed' &&
    provider?.status === 'active' &&
    !conflicting;
  const reasons = new Set();
  if (observed)
    reasons.add(dockerObserved ? 'docker-publication-observed' : 'listener-observed');
  else reasons.add('listener-missing');
  if (inventory.classification === 'pending') reasons.add('lease-pending');
  if (provider?.status === 'unknown') reasons.add('provider-unknown');
  if (providerConflict) reasons.add('provider-replaced');
  if (ownershipConflict) reasons.add('ownership-conflict');
  if (verified) reasons.add('provider-verified');
  return {
    component: endpoint.component,
    endpoint: endpoint.endpoint,
    port: endpoint.port,
    required: endpoint.required,
    observed,
    verified,
    conflicting,
    listenerCount: inventory.listeners.length,
    reasonCodes: [...reasons],
  };
}

/** @param {z.infer<typeof LauncherEnvironmentCacheSchema>['endpoints'][number]} endpoint */
function cachedEndpointUnavailable(endpoint) {
  return {
    component: endpoint.component,
    endpoint: endpoint.endpoint,
    port: endpoint.hostPort,
    required: endpoint.required,
    observed: false,
    verified: false,
    conflicting: false,
    listenerCount: 0,
    reasonCodes: ['local-inspection-failed'],
  };
}

/**
 * @param {{
 *   classification: z.infer<typeof LauncherEvidenceSummarySchema>['classification'],
 *   source: z.infer<typeof LauncherEvidenceSummarySchema>['source'],
 *   observedAt: string | null,
 *   generationId: string | null,
 *   activationId: string | null,
 *   endpoints: unknown[],
 *   reasonCodes: string[]
 * }} input
 */
function result(input) {
  const endpoints = z.array(LauncherEndpointEvidenceSchema).parse(input.endpoints);
  return LauncherEvidenceResultSchema.parse({
    summary: {
      classification: input.classification,
      source: input.source,
      observedAt: input.observedAt,
      generationId: input.generationId,
      activationId: input.activationId,
      listenerCount: endpoints.reduce(
        (total, endpoint) => total + endpoint.listenerCount,
        0,
      ),
      reasonCodes: [...new Set(input.reasonCodes)].sort(),
    },
    endpoints,
  });
}

/** @param {{component: string, endpoint: string}} value */
function endpointKey(value) {
  return `${value.component}\u0000${value.endpoint}`;
}

/** @param {Record<string, unknown> | null} record @param {string} name */
function stringField(record, name) {
  const value = record?.[name];
  return typeof value === 'string' ? value : null;
}

/** @param {string} code @param {string} message */
function evidenceError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
