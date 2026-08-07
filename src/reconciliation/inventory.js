// @ts-check

import { inspectAllTcpListeners } from '../inspection/listeners.js';
import { verifyProcessLineage } from '../inspection/processes.js';
import { PortSchema } from '../protocol/schemas.js';

export class InventoryService {
  /**
   * @param {{
   *   registry: import('../storage/registry.js').Registry,
   *   inspectListeners?: typeof inspectAllTcpListeners,
   *   verifyLineage?: typeof verifyProcessLineage,
   *   dockerAdapter?: Pick<import('../docker/adapter.js').DockerEvidenceAdapter, 'findPublishedPort'> | null,
   *   now?: () => Date
   * }} dependencies
   */
  constructor({
    registry,
    inspectListeners = inspectAllTcpListeners,
    verifyLineage = verifyProcessLineage,
    dockerAdapter = null,
    now = () => new Date(),
  }) {
    this.registry = registry;
    this.inspectListeners = inspectListeners;
    this.verifyLineage = verifyLineage;
    this.dockerAdapter = dockerAdapter;
    this.now = now;
  }

  /**
   * @param {{
   *   classification?: string,
   *   claimed?: boolean,
   *   listening?: boolean,
   *   project?: string,
   *   workspace?: string,
   *   service?: string,
   *   component?: string,
   *   endpoint?: string,
   *   port?: number
   * }} [filters]
   */
  async list(filters = {}) {
    const now = this.now();
    const [listeners, claims, leases, runs] = await Promise.all([
      this.inspectListeners(),
      Promise.resolve(this.registry.listClaims()),
      Promise.resolve(this.registry.listPendingLeases(now)),
      Promise.resolve(this.registry.listConfirmedRuns()),
    ]);
    const ports = new Set([
      ...listeners.map(({ port }) => port),
      ...claims.flatMap(({ assignedPort }) =>
        assignedPort === null ? [] : [assignedPort],
      ),
      ...leases.map(({ port }) => port),
      ...runs.map(({ port }) => port),
    ]);

    const entries = await Promise.all(
      [...ports]
        .sort((left, right) => left - right)
        .map(async (port) => {
          const lease = leases.find((candidate) => candidate.port === port) ?? null;
          const run = runs.find((candidate) => candidate.port === port) ?? null;
          const claim =
            claims.find(({ assignedPort }) => assignedPort === port) ??
            claims.find(({ id }) => id === lease?.claimId || id === run?.claimId) ??
            null;
          const portListeners = listeners.filter((listener) => listener.port === port);
          const ownership = await this.#ownership(run, portListeners);
          const docker =
            this.dockerAdapter === null ||
            (portListeners.length === 0 && run?.bindingKind !== 'docker')
              ? null
              : publicDockerEvidence(await this.dockerAdapter.findPublishedPort(port));

          return {
            port,
            transport: 'tcp',
            classification: classify({
              claim,
              lease,
              run,
              listeners: portListeners,
              ownership,
              docker,
            }),
            claim,
            lease:
              lease === null
                ? null
                : {
                    id: lease.id,
                    claimId: lease.claimId,
                    port: lease.port,
                    state: lease.state,
                    expiresAt: lease.expiresAt,
                  },
            run:
              run === null
                ? null
                : {
                    ...run,
                    confirmedListenerFingerprints:
                      this.registry.listListenerFingerprintsForRun(run.id),
                  },
            docker,
            listeners: portListeners.map((listener, index) => ({
              ...listener,
              ownership: ownership[index] ?? {
                verified: false,
                reason: 'not-evaluated',
                lineage: [],
              },
            })),
          };
        }),
    );
    return entries.filter((entry) => {
      if (
        filters.classification !== undefined &&
        entry.classification !== filters.classification
      ) {
        return false;
      }
      if (filters.claimed !== undefined && (entry.claim !== null) !== filters.claimed) {
        return false;
      }
      if (
        filters.listening !== undefined &&
        entry.listeners.length > 0 !== filters.listening
      ) {
        return false;
      }
      if (filters.port !== undefined && entry.port !== filters.port) {
        return false;
      }
      const identity = entry.claim?.identity;
      if (filters.project !== undefined && identity?.project !== filters.project) {
        return false;
      }
      if (
        filters.workspace !== undefined &&
        identity?.workspaceRoot !== filters.workspace
      ) {
        return false;
      }
      if (filters.service !== undefined && identity?.component !== filters.service) {
        return false;
      }
      if (
        filters.component !== undefined &&
        identity?.component !== filters.component
      ) {
        return false;
      }
      return filters.endpoint === undefined || identity?.endpoint === filters.endpoint;
    });
  }

  /**
   * @param {number} requestedPort
   */
  async inspect(requestedPort) {
    const port = PortSchema.parse(requestedPort);
    return (
      (await this.list()).find((entry) => entry.port === port) ?? {
        port,
        transport: 'tcp',
        classification: 'available',
        claim: null,
        lease: null,
        run: null,
        docker: null,
        listeners: [],
      }
    );
  }

  /**
   * @param {ReturnType<import('../storage/registry.js').Registry['getRun']>} run
   * @param {Awaited<ReturnType<typeof inspectAllTcpListeners>>} listeners
   */
  async #ownership(run, listeners) {
    if (run === null || run.rootFingerprint === null) {
      return listeners.map(() => ({
        verified: false,
        reason: 'no-confirmed-run-evidence',
        lineage: [],
      }));
    }

    return Promise.all(
      listeners.map((listener) =>
        listener.process === null
          ? {
              verified: false,
              reason: 'process-unobservable',
              lineage: [],
            }
          : this.verifyLineage(listener.process, run.rootFingerprint),
      ),
    );
  }
}

/**
 * @param {{
 *   claim: unknown,
 *   lease: unknown,
 *   run: unknown,
 *   listeners: unknown[],
 *   ownership: Array<{verified: boolean}>,
 *   docker: null | {containers: unknown[]}
 * }} evidence
 */
function classify({ claim, lease, run, listeners, ownership, docker }) {
  if ((docker?.containers?.length ?? 0) > 0) {
    return 'docker-managed';
  }
  if (claim === null && lease === null && listeners.length > 0) {
    return 'unclaimed';
  }
  if (lease !== null) {
    return listeners.length === 0 ? 'pending' : 'pending';
  }
  if (run !== null) {
    if (listeners.length === 0) {
      return 'conflicting';
    }
    const verified = ownership.filter((result) => result.verified).length;
    if (verified === listeners.length) {
      return 'verified';
    }
    return verified > 0 ? 'mixed' : 'conflicting';
  }
  if (claim !== null) {
    return listeners.length === 0 ? 'idle' : 'conflicting';
  }
  return listeners.length === 0 ? 'available' : 'unclaimed';
}

/** @param {Awaited<ReturnType<import('../docker/adapter.js').DockerEvidenceAdapter['findPublishedPort']>>} evidence */
function publicDockerEvidence(evidence) {
  return {
    ...evidence,
    containers: evidence.containers.map((container) => ({
      ...container,
      labels: Object.fromEntries(
        Object.entries(container.labels).filter(([key]) =>
          key.startsWith('com.trentbrown.portreeve.'),
        ),
      ),
    })),
  };
}
