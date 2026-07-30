// @ts-check

import { addMilliseconds } from './time.js';
import { inspectTcpListeners } from '../inspection/listeners.js';
import { inspectProcess, verifyProcessLineage } from '../inspection/processes.js';
import { detectEphemeralPortRange } from '../platform/ephemeral-ports.js';
import {
  AcquireRequestSchema,
  AbandonRequestSchema,
  ConfirmRequestSchema,
  ReleaseRequestSchema,
  negotiateCompatibility,
} from '../protocol/schemas.js';
import { ReclamationService } from '../reclamation/service.js';
import { RegistryError } from '../storage/registry.js';

export class AllocationService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   inspectListeners?: typeof inspectTcpListeners,
   *   inspectProcessInstance?: typeof inspectProcess,
   *   verifyLineage?: typeof verifyProcessLineage,
   *   detectEphemeralRange?: typeof detectEphemeralPortRange,
   *   reclamationService?: ReclamationService,
   *   now?: () => Date
   * }} dependencies
   */
  constructor({
    registry,
    inspectListeners = inspectTcpListeners,
    inspectProcessInstance = inspectProcess,
    verifyLineage = verifyProcessLineage,
    detectEphemeralRange = detectEphemeralPortRange,
    reclamationService = new ReclamationService({ registry }),
    now = () => new Date(),
  }) {
    this.registry = registry;
    this.inspectListeners = inspectListeners;
    this.inspectProcessInstance = inspectProcessInstance;
    this.verifyLineage = verifyLineage;
    this.detectEphemeralRange = detectEphemeralRange;
    this.reclamationService = reclamationService;
    this.now = now;
  }

  /**
   * @param {unknown} input
   */
  async acquire(input) {
    const request = AcquireRequestSchema.parse(input);
    assertCompatible(request.client);
    const now = this.now();
    this.registry.expirePendingLeases(now);
    await this.#clearExpiredEphemeralAssignments(now);

    let claim = this.registry.findClaim(request.claim);
    if (claim === null) {
      claim = this.registry.insertClaim(
        {
          identity: request.claim,
          mode: request.allocation.mode,
          preferredPort: request.allocation.preferredPort,
          exactPort: request.allocation.exactPort,
        },
        now,
      );
    } else {
      if (claim.mode !== request.allocation.mode) {
        throw new RegistryError(
          'conflict',
          `Claim ${claim.id} already exists in ${claim.mode} mode.`,
          { claimId: claim.id, mode: claim.mode },
        );
      }
      if (
        request.allocation.exactPort !== undefined &&
        claim.assignedPort !== null &&
        request.allocation.exactPort !== claim.assignedPort
      ) {
        throw new RegistryError(
          'conflict',
          `Claim ${claim.id} is already assigned port ${claim.assignedPort}.`,
          { claimId: claim.id, assignedPort: claim.assignedPort },
        );
      }
    }

    const activeRun = this.registry.getConfirmedRunForClaim(claim.id);
    if (activeRun !== null) {
      if (request.allocation.replacementPolicy === 'never') {
        throw new RegistryError(
          'conflict',
          `Claim ${claim.id} already has an active run.`,
          { claimId: claim.id, runId: activeRun.id, port: activeRun.port },
        );
      }
      const reclamation = await this.reclamationService.reclaim(activeRun.port, {
        client: request.client,
        policy: request.allocation.replacementPolicy,
        dryRun: false,
      });
      if (
        reclamation.outcome !== 'terminated' &&
        reclamation.outcome !== 'already-free'
      ) {
        throw new RegistryError(
          'conflict',
          `Port ${activeRun.port} could not be reclaimed for claim ${claim.id}.`,
          {
            claimId: claim.id,
            runId: activeRun.id,
            port: activeRun.port,
            reclamation,
          },
        );
      }
      this.registry.releaseRun(activeRun.id, this.now());
    }

    const settings = this.registry.getSettings();
    const ephemeralRange = await this.detectEphemeralRange();
    const candidates = candidatePorts(
      claim,
      request.allocation,
      settings,
      ephemeralRange,
    );
    const reserved = new Set(this.registry.listReservedPorts(now));

    for (const port of candidates) {
      const belongsToClaim = claim.assignedPort === port;
      if (reserved.has(port) && !belongsToClaim) {
        continue;
      }
      if ((await this.inspectListeners(port)).length > 0) {
        if (request.allocation.exactPort === port) {
          throw new RegistryError(
            'conflict',
            `Exact port ${port} has a live listener.`,
            { port },
          );
        }
        continue;
      }

      const expiresAt = addMilliseconds(
        now,
        settings.leaseTtlMilliseconds,
      ).toISOString();
      try {
        const acquired = this.registry.createPendingLease(
          { claimId: claim.id, port, expiresAt },
          now,
        );
        return {
          claimId: claim.id,
          leaseId: acquired.lease.id,
          leaseToken: acquired.token,
          port,
          expiresAt,
          reusedAssignment: belongsToClaim,
        };
      } catch (error) {
        if (
          error instanceof RegistryError &&
          error.code === 'conflict' &&
          (error.details.reason === 'port_pending' ||
            error.details.reason === 'port_assigned') &&
          request.allocation.exactPort === undefined &&
          !belongsToClaim
        ) {
          reserved.add(port);
          continue;
        }
        throw error;
      }
    }

    throw new RegistryError(
      'conflict',
      request.allocation.exactPort === undefined
        ? 'No automatic port candidate is currently available.'
        : `Exact port ${request.allocation.exactPort} is unavailable.`,
    );
  }

  /**
   * @param {unknown} input
   */
  async confirm(input) {
    const request = ConfirmRequestSchema.parse(input);
    assertCompatible(request.client);
    const lease = this.registry.getLease(request.leaseId);
    if (lease === null) {
      throw new RegistryError('not_found', `Lease ${request.leaseId} was not found.`);
    }

    const listeners = await this.inspectListeners(lease.port);
    const rootFingerprint = await this.inspectProcessInstance(request.rootPid);
    if (rootFingerprint === null) {
      throw new RegistryError(
        'conflict',
        `Root PID ${request.rootPid} is not observable.`,
        { port: lease.port, rootPid: request.rootPid },
      );
    }
    const ownership = await Promise.all(
      listeners.map(async (listener) => {
        if (listener.process === null) {
          return { verified: false, reason: 'process-unobservable', lineage: [] };
        }
        return this.verifyLineage(
          listener.process,
          rootFingerprint,
          this.inspectProcessInstance,
        );
      }),
    );
    if (listeners.length === 0 || ownership.some((result) => !result.verified)) {
      throw new RegistryError(
        'conflict',
        `Port ${lease.port} is not exclusively owned by the confirmed run rooted at PID ${request.rootPid}.`,
        {
          port: lease.port,
          rootPid: request.rootPid,
          listeners,
          ownership,
        },
      );
    }

    return this.registry.confirmLease(
      {
        leaseId: request.leaseId,
        token: request.leaseToken,
        rootPid: request.rootPid,
        rootFingerprint,
        listenerFingerprints: listeners.flatMap(({ process }) =>
          process === null ? [] : [process],
        ),
      },
      this.now(),
    );
  }

  /**
   * @param {unknown} input
   */
  abandon(input) {
    const request = AbandonRequestSchema.parse(input);
    assertCompatible(request.client);
    return this.registry.abandonLease(
      {
        leaseId: request.leaseId,
        token: request.leaseToken,
        reason: request.reason,
      },
      this.now(),
    );
  }

  /**
   * @param {unknown} input
   */
  release(input) {
    const request = ReleaseRequestSchema.parse(input);
    assertCompatible(request.client);
    return this.registry.releaseRun(request.runId, this.now());
  }

  /**
   * @param {Date} now
   */
  async #clearExpiredEphemeralAssignments(now) {
    const expired = this.registry.listExpiredEphemeralAssignments(now);
    for (const candidate of expired) {
      if ((await this.inspectListeners(candidate.port)).length === 0) {
        this.registry.clearExpiredEphemeralAssignment(candidate.id, now);
      }
    }
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

/**
 * @param {import('zod').infer<typeof import('../domain/schemas.js').ClaimRecordSchema>} claim
 * @param {import('zod').infer<typeof import('../protocol/schemas.js').AllocationIntentSchema>} allocation
 * @param {import('zod').infer<typeof import('../domain/settings.js').ServerSettingsSchema>} settings
 * @param {{start: number, end: number}} ephemeralRange
 */
function candidatePorts(claim, allocation, settings, ephemeralRange) {
  if (claim.assignedPort !== null) {
    return [claim.assignedPort];
  }
  if (allocation.exactPort !== undefined) {
    return [allocation.exactPort];
  }

  const candidates = [];
  const seen = new Set();
  if (allocation.preferredPort !== undefined) {
    candidates.push(allocation.preferredPort);
    seen.add(allocation.preferredPort);
  }

  const excluded = new Set(settings.excludedPorts);
  for (const range of settings.automaticPortRanges) {
    for (let port = range.start; port <= range.end; port += 1) {
      const isEphemeral = port >= ephemeralRange.start && port <= ephemeralRange.end;
      if (!excluded.has(port) && !isEphemeral && !seen.has(port)) {
        candidates.push(port);
        seen.add(port);
      }
    }
  }
  return candidates;
}
