// @ts-check

import { RegistryError } from '../storage/registry.js';

export const DOCKER_LABELS = Object.freeze({
  stackId: 'com.trentbrown.portreeve.stack-id',
  component: 'com.trentbrown.portreeve.component',
  definitionRevision: 'com.trentbrown.portreeve.definition-revision',
  generationId: 'com.trentbrown.portreeve.generation-id',
  activationId: 'com.trentbrown.portreeve.activation-id',
  endpoints: 'com.trentbrown.portreeve.endpoints',
});

/**
 * @param {{
 *   stackId: string,
 *   component: string,
 *   definitionRevision: string,
 *   generationId: string,
 *   activationId: string,
 *   endpoints: Record<string, number>
 * }} identity
 */
export function expectedDockerLabels(identity) {
  return Object.freeze({
    [DOCKER_LABELS.stackId]: identity.stackId,
    [DOCKER_LABELS.component]: identity.component,
    [DOCKER_LABELS.definitionRevision]: identity.definitionRevision,
    [DOCKER_LABELS.generationId]: identity.generationId,
    [DOCKER_LABELS.activationId]: identity.activationId,
    [DOCKER_LABELS.endpoints]: JSON.stringify(
      Object.fromEntries(
        Object.entries(identity.endpoints).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      ),
    ),
  });
}

/**
 * @param {{
 *   container: {id: string, running: boolean, labels: Readonly<Record<string, string>>, ports: ReadonlyArray<{containerPort: number, hostIp: string, hostPort: number}>},
 *   expectedLabels: Record<string, string>,
 *   endpoint: string,
 *   containerPort: number,
 *   hostPort: number
 * }} input
 */
export function verifyDockerEvidence(input) {
  if (!input.container.running) {
    return failure('container-not-running');
  }
  for (const [key, expected] of Object.entries(input.expectedLabels)) {
    if (input.container.labels[key] !== expected) {
      return failure('container-label-mismatch', { label: key });
    }
  }
  const publication = input.container.ports.find(
    (candidate) =>
      candidate.containerPort === input.containerPort &&
      candidate.hostPort === input.hostPort &&
      candidate.hostIp === '127.0.0.1',
  );
  if (publication === undefined) {
    return failure('container-publication-mismatch', {
      endpoint: input.endpoint,
      containerPort: input.containerPort,
      hostPort: input.hostPort,
    });
  }
  return Object.freeze({ verified: true, reason: null, publication });
}

/** @param {string} reason @param {Record<string, unknown>} [details] */
function failure(reason, details = {}) {
  return Object.freeze({ verified: false, reason, details, publication: null });
}

/** @param {ReturnType<typeof verifyDockerEvidence>} result @param {string} containerId */
export function assertDockerEvidence(result, containerId) {
  if (result.verified) return;
  throw new RegistryError(
    'conflict',
    `Container ${containerId} does not match the pending Docker endpoint.`,
    { containerId, reason: result.reason, ...result.details },
  );
}
