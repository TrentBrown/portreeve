// @ts-check

import { lstat } from 'node:fs/promises';
import { detectEphemeralPortRange } from '../platform/ephemeral-ports.js';
import {
  ClaimDeleteRequestSchema,
  ClaimPruneRequestSchema,
  ClaimReassignRequestSchema,
  IdentifierSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { InventoryService } from '../reconciliation/inventory.js';
import { RegistryError } from '../storage/registry.js';

export class AdministrationService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   inventoryService?: InventoryService,
   *   detectEphemeralRange?: typeof detectEphemeralPortRange,
   *   pathExists?: (path: string) => Promise<boolean>,
   *   now?: () => Date
   * }} dependencies
   */
  constructor({
    registry,
    inventoryService = new InventoryService({ registry }),
    detectEphemeralRange = detectEphemeralPortRange,
    pathExists = workspacePathExists,
    now = () => new Date(),
  }) {
    this.registry = registry;
    this.inventoryService = inventoryService;
    this.detectEphemeralRange = detectEphemeralRange;
    this.pathExists = pathExists;
    this.now = now;
  }

  /** @param {{project?: string, workspaceRoot?: string, component?: string, endpoint?: string}} [filters] */
  listClaims(filters = {}) {
    return this.registry.listClaims(filters);
  }

  /**
   * @param {string} claimId
   */
  getClaim(claimId) {
    const id = IdentifierSchema.parse(claimId);
    const claim = this.registry.getClaim(id);
    if (claim === null) {
      throw new RegistryError('not_found', `Claim ${id} was not found.`);
    }
    return claim;
  }

  /**
   * @param {string} claimId
   * @param {unknown} input
   */
  async reassignClaim(claimId, input) {
    const id = IdentifierSchema.parse(claimId);
    const request = ClaimReassignRequestSchema.parse(input);
    assertCompatible(request.client);
    const now = this.now();
    const claim = this.getClaim(id);
    await this.#assertIdle(claim, now);

    const settings = this.registry.getSettings();
    const ephemeralRange = await this.detectEphemeralRange();
    const reserved = new Set(this.registry.listReservedPorts(now));
    if (claim.assignedPort !== null) {
      reserved.delete(claim.assignedPort);
    }
    const candidates = reassignmentCandidates(request, settings, ephemeralRange);

    for (const port of candidates) {
      if (port === claim.assignedPort || reserved.has(port)) {
        if (request.exactPort === port) {
          throw new RegistryError(
            'conflict',
            `Exact reassignment port ${port} is unavailable.`,
            { port, reason: port === claim.assignedPort ? 'unchanged' : 'reserved' },
          );
        }
        continue;
      }
      if ((await this.inventoryService.inspect(port)).listeners.length > 0) {
        if (request.exactPort === port) {
          throw new RegistryError(
            'conflict',
            `Exact reassignment port ${port} has a live listener.`,
            { port, reason: 'live_listener' },
          );
        }
        continue;
      }
      await this.#assertIdle(claim, now);
      if ((await this.inventoryService.inspect(port)).listeners.length > 0) {
        if (request.exactPort === port) {
          throw new RegistryError(
            'conflict',
            `Exact reassignment port ${port} changed before mutation.`,
            { port, reason: 'live_listener' },
          );
        }
        continue;
      }
      return this.registry.reassignClaim(
        {
          claimId: id,
          port,
          preferredPort: request.preferredPort ?? null,
          exactPort: request.exactPort ?? null,
        },
        now,
      );
    }

    throw new RegistryError(
      'conflict',
      request.exactPort === undefined
        ? 'No reassignment candidate is currently available.'
        : `Exact reassignment port ${request.exactPort} is unavailable.`,
    );
  }

  /**
   * @param {string} claimId
   * @param {unknown} input
   */
  async deleteClaim(claimId, input) {
    const id = IdentifierSchema.parse(claimId);
    const request = ClaimDeleteRequestSchema.parse(input);
    assertCompatible(request.client);
    const now = this.now();
    const claim = this.getClaim(id);
    await this.#assertIdle(claim, now);
    return this.registry.deleteClaim(id, 'deleted', now);
  }

  /**
   * @param {unknown} input
   */
  async pruneClaims(input) {
    const request = ClaimPruneRequestSchema.parse(input);
    assertCompatible(request.client);
    const now = this.now();
    const cutoff = now.getTime() - request.olderThanMilliseconds;
    const candidates = [];

    for (const claim of this.registry.listClaims()) {
      if (new Date(claim.lastUsedAt).getTime() > cutoff) {
        continue;
      }
      if (await this.pathExists(claim.identity.workspaceRoot)) {
        continue;
      }
      if (
        this.registry.getPendingLeaseForClaim(claim.id, now) !== null ||
        this.registry.getConfirmedRunForClaim(claim.id) !== null
      ) {
        continue;
      }
      if (
        claim.assignedPort !== null &&
        (await this.inventoryService.inspect(claim.assignedPort)).listeners.length > 0
      ) {
        continue;
      }
      candidates.push({
        claim,
        reason: /** @type {const} */ ('workspace-missing'),
      });
    }

    if (request.dryRun) {
      return {
        dryRun: true,
        candidates,
        deletedClaimIds: [],
        skipped: [],
      };
    }

    const deletedClaimIds = [];
    const skipped = [];
    for (const candidate of candidates) {
      try {
        const freshClaim = this.getClaim(candidate.claim.id);
        if (await this.pathExists(freshClaim.identity.workspaceRoot)) {
          skipped.push({
            claimId: freshClaim.id,
            reason: 'workspace-reappeared',
          });
          continue;
        }
        await this.#assertIdle(freshClaim, now);
        if (this.registry.deleteClaim(freshClaim.id, 'pruned', now)) {
          deletedClaimIds.push(freshClaim.id);
        }
      } catch (error) {
        if (
          error instanceof RegistryError &&
          (error.code === 'conflict' || error.code === 'not_found')
        ) {
          skipped.push({
            claimId: candidate.claim.id,
            reason: String(error.details.reason ?? error.code),
          });
          continue;
        }
        throw error;
      }
    }

    return {
      dryRun: false,
      candidates,
      deletedClaimIds,
      skipped,
    };
  }

  /**
   * @param {ReturnType<import('../storage/registry.js').Registry['getClaim']>} claim
   * @param {Date} now
   */
  async #assertIdle(claim, now) {
    if (claim === null) {
      throw new RegistryError('not_found', 'Claim was not found.');
    }
    const activeRun = this.registry.getConfirmedRunForClaim(claim.id);
    if (activeRun !== null) {
      throw new RegistryError('conflict', `Claim ${claim.id} has an active run.`, {
        claimId: claim.id,
        runId: activeRun.id,
        reason: 'active_run',
      });
    }
    const pendingLease = this.registry.getPendingLeaseForClaim(claim.id, now);
    if (pendingLease !== null) {
      throw new RegistryError('conflict', `Claim ${claim.id} has a pending lease.`, {
        claimId: claim.id,
        leaseId: pendingLease.id,
        reason: 'pending_lease',
      });
    }
    if (
      claim.assignedPort !== null &&
      (await this.inventoryService.inspect(claim.assignedPort)).listeners.length > 0
    ) {
      throw new RegistryError(
        'conflict',
        `Claim ${claim.id} has an unresolved listener on port ${claim.assignedPort}.`,
        {
          claimId: claim.id,
          port: claim.assignedPort,
          reason: 'live_listener',
        },
      );
    }
  }
}

/**
 * @param {import('zod').infer<typeof ClaimReassignRequestSchema>} request
 * @param {import('zod').infer<typeof import('../domain/settings.js').ServerSettingsSchema>} settings
 * @param {{start: number, end: number}} ephemeralRange
 */
function reassignmentCandidates(request, settings, ephemeralRange) {
  if (request.exactPort !== undefined) {
    return [request.exactPort];
  }
  const candidates = [];
  const seen = new Set();
  if (request.preferredPort !== undefined) {
    candidates.push(request.preferredPort);
    seen.add(request.preferredPort);
  }
  const excluded = new Set(settings.excludedPorts);
  for (const range of settings.automaticPortRanges) {
    for (let port = range.start; port <= range.end; port += 1) {
      const ephemeral = port >= ephemeralRange.start && port <= ephemeralRange.end;
      if (!ephemeral && !excluded.has(port) && !seen.has(port)) {
        candidates.push(port);
        seen.add(port);
      }
    }
  }
  return candidates;
}

/**
 * @param {string} path
 */
async function workspacePathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      /** @type {{code?: string}} */ (error).code === 'ENOENT'
    ) {
      return false;
    }
    return true;
  }
}

/**
 * @param {{protocol: {minimum: number, maximum: number}, requiredCapabilities: string[]}} client
 */
function assertCompatible(client) {
  const result = negotiateCompatibility(client.protocol, client.requiredCapabilities);
  if (!result.compatible) {
    throw new RegistryError(
      'incompatible_protocol',
      'Client and server protocol capabilities are incompatible.',
      result,
    );
  }
}
