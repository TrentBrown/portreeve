// @ts-check

import { lstat } from 'node:fs/promises';
import { DOCKER_LABELS } from '../docker/evidence.js';
import {
  StackPruneRequestSchema,
  StackPruneResultSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { RegistryError } from '../storage/registry.js';

const CAPABILITY = 'stack-activations-v1';

export class StackAdministrationService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   coordinationService: import('./coordination-service.js').StackCoordinationService,
   *   inventoryService: import('../reconciliation/inventory.js').InventoryService,
   *   dockerAdapter?: import('../docker/adapter.js').DockerEvidenceAdapter | null,
   *   pathExists?: (path: string) => Promise<boolean>,
   *   now?: () => Date
   * }} options
   */
  constructor({
    registry,
    coordinationService,
    inventoryService,
    dockerAdapter = null,
    pathExists = workspacePathExists,
    now = () => new Date(),
  }) {
    this.registry = registry;
    this.coordinationService = coordinationService;
    this.inventoryService = inventoryService;
    this.dockerAdapter = dockerAdapter;
    this.pathExists = pathExists;
    this.now = now;
  }

  /** @param {unknown} input */
  async prune(input) {
    const request = StackPruneRequestSchema.parse(input);
    assertCompatible(request.client);
    const plannedAt = this.now();
    const plan = await this.#plan(request.olderThanMilliseconds, plannedAt);
    if (request.dryRun) {
      return StackPruneResultSchema.parse({
        dryRun: true,
        ...plan,
        deletedStackIds: [],
        deletedClaimIds: [],
        skipped: [],
      });
    }

    const deletedStackIds = [];
    const deletedClaimIds = [];
    const skipped = [];
    for (const candidate of plan.candidates) {
      try {
        const stack = this.registry.getStack(candidate.stack.id);
        if (stack === null) {
          skipped.push({ stackId: candidate.stack.id, reason: 'not_found' });
          continue;
        }
        if (await this.pathExists(stack.stackRoot)) {
          skipped.push({ stackId: stack.id, reason: 'stack-root-reappeared' });
          continue;
        }
        const liveActivation = this.registry.getLiveStackActivationForStack(stack.id);
        if (
          liveActivation !== null &&
          ['confirmed', 'degraded'].includes(liveActivation.state)
        ) {
          await this.coordinationService.reconcile(liveActivation.id, {
            client: request.client,
          });
        }
        const fresh = await this.#evaluate(stack, this.now());
        if (fresh.reasons.length > 0) {
          skipped.push({ stackId: stack.id, reason: fresh.reasons.join(',') });
          continue;
        }
        const deleted = this.registry.deleteStack(stack.id, this.now());
        deletedStackIds.push(deleted.stackId);
        deletedClaimIds.push(...deleted.claimIds);
      } catch (error) {
        if (
          error instanceof RegistryError &&
          (error.code === 'conflict' || error.code === 'not_found')
        ) {
          skipped.push({
            stackId: candidate.stack.id,
            reason: String(error.details.reason ?? error.code),
          });
          continue;
        }
        throw error;
      }
    }
    return StackPruneResultSchema.parse({
      dryRun: false,
      ...plan,
      deletedStackIds,
      deletedClaimIds,
      skipped,
    });
  }

  /** @param {number} olderThanMilliseconds @param {Date} now */
  async #plan(olderThanMilliseconds, now) {
    this.registry.expirePendingLeases(now);
    const cutoff = now.getTime() - olderThanMilliseconds;
    const candidates = [];
    const blocked = [];
    for (const stack of this.registry.listStacks()) {
      if (new Date(stack.lastUsedAt).getTime() > cutoff) continue;
      if (await this.pathExists(stack.stackRoot)) continue;
      const evaluation = await this.#evaluate(stack, now);
      if (evaluation.reasons.length === 0) {
        candidates.push({
          stack,
          claimIds: evaluation.claimIds,
          reason: /** @type {const} */ ('stack-root-missing'),
        });
      } else {
        blocked.push({ stack, reasons: evaluation.reasons });
      }
    }
    return { candidates, blocked };
  }

  /**
   * @param {import('zod').infer<typeof import('../protocol/schemas.js').StackRecordSchema>} stack
   * @param {Date} now
   */
  async #evaluate(stack, now) {
    this.registry.expirePendingLeases(now);
    const reasons = new Set();
    const claims = this.registry.listStackClaims(stack.id);
    const liveActivation = this.registry.getLiveStackActivationForStack(stack.id);
    const conclusivelyGoneRunIds = new Set();
    if (liveActivation?.state === 'starting') {
      reasons.add('pending-activation');
    } else if (
      liveActivation !== null &&
      ['confirmed', 'degraded'].includes(liveActivation.state)
    ) {
      const providers = await this.coordinationService.inspectProviders(
        liveActivation.id,
      );
      for (const provider of providers) {
        if (provider.status === 'gone' && provider.runId !== null) {
          conclusivelyGoneRunIds.add(provider.runId);
          continue;
        }
        reasons.add(
          provider.status === 'active'
            ? `provider-active:${provider.component}.${provider.endpoint}`
            : `provider-unobservable:${provider.component}.${provider.endpoint}`,
        );
      }
    }

    let dockerAvailability = null;
    for (const claim of claims) {
      if (this.registry.getPendingLeaseForClaim(claim.id, now) !== null) {
        reasons.add(
          `pending-lease:${claim.identity.component}.${claim.identity.endpoint}`,
        );
      }
      const run = this.registry.getConfirmedRunForClaim(claim.id);
      if (run !== null && !conclusivelyGoneRunIds.has(run.id)) {
        reasons.add(
          `confirmed-run:${claim.identity.component}.${claim.identity.endpoint}`,
        );
      }
      if (claim.assignedPort === null) continue;
      const inventory = await this.inventoryService.inspect(claim.assignedPort);
      if (inventory.listeners.length > 0) {
        reasons.add(`live-listener:${claim.assignedPort}`);
      }
      const definition = stack.definition.components[claim.identity.component];
      const endpoint = definition?.endpoints[claim.identity.endpoint];
      if (definition?.docker === undefined || endpoint?.docker === undefined) continue;
      if (this.dockerAdapter === null) {
        reasons.add('docker-evidence-unavailable');
        continue;
      }
      dockerAvailability ??= await this.dockerAdapter.availability();
      if (!dockerAvailability.available) {
        reasons.add('docker-evidence-unavailable');
        continue;
      }
      const published = await this.dockerAdapter.findPublishedPort(claim.assignedPort);
      if (!published.available) {
        reasons.add('docker-evidence-unavailable');
        continue;
      }
      if (
        published.containers.some(
          (container) =>
            container.running && container.labels[DOCKER_LABELS.stackId] === stack.id,
        )
      ) {
        reasons.add(
          `matching-container:${claim.identity.component}.${claim.identity.endpoint}`,
        );
      }
    }
    return {
      claimIds: claims.map(({ id }) => id),
      reasons: [...reasons].sort(),
    };
  }
}

/** @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, [
    ...new Set([...client.requiredCapabilities, CAPABILITY]),
  ]);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and PortReeve stack administration requirements do not overlap.',
      result,
    );
  }
}

/** @param {string} path */
async function workspacePathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}
