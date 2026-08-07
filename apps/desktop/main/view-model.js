// @ts-check

import { basename } from 'node:path';
import { DesktopSnapshotSchema } from '../shared/schemas.js';
import { NOT_CHECKED_UPDATE_STATE } from './update.js';

/**
 * @param {{artifact: {source: 'local-release-candidate'|'published', desktopVersion: string, version: string, filename: string, sha256: string}, update?: unknown, lifecycle: unknown, ports: unknown[], stacks?: unknown[], errors?: unknown[], refreshedAt: string, stale?: boolean, lastSuccessfulAt?: string|null}} input
 */
export function createDesktopSnapshot(input) {
  const lifecycle = /** @type {any} */ (input.lifecycle);
  return DesktopSnapshotSchema.parse({
    schemaVersion: 1,
    refreshedAt: input.refreshedAt,
    stale: input.stale ?? false,
    lastSuccessfulAt: input.lastSuccessfulAt ?? input.refreshedAt,
    artifact: {
      source: input.artifact.source,
      desktopVersion: input.artifact.desktopVersion,
      version: input.artifact.version,
      filename: input.artifact.filename,
      sha256: input.artifact.sha256,
    },
    update: input.update ?? NOT_CHECKED_UPDATE_STATE,
    lifecycle:
      lifecycle === null
        ? null
        : {
            observedAt: lifecycle.observedAt,
            mode: lifecycle.mode,
            installation: {
              state: lifecycle.installation.state,
              version: lifecycle.installation.version,
              managedLocation: lifecycle.installation.managedExecutablePath,
              hasError: lifecycle.installation.error !== null,
            },
            supervisor: {
              kind: lifecycle.supervisor.kind,
              state: lifecycle.supervisor.state,
              mainPid: lifecycle.supervisor.mainPid,
              hasError: lifecycle.supervisor.error !== null,
            },
            socket: {
              state: lifecycle.socket.state,
              serverPid: lifecycle.socket.server?.pid ?? null,
              serverVersion: lifecycle.socket.server?.softwareVersion ?? null,
              hasError: lifecycle.socket.error !== null,
            },
            versions: lifecycle.versions,
            limitations: lifecycle.limitations,
          },
    ports: input.ports.map(reducePort),
    stacks: (input.stacks ?? []).map(reduceStack),
    errors: input.errors ?? [],
  });
}

/** @param {any} status */
function reduceStack(status) {
  const { stack, generation, activation } = status;
  return {
    id: stack.id,
    project: stack.project,
    stackRootName: basename(stack.stackRoot),
    currentRevision: stack.currentRevision,
    createdAt: stack.createdAt,
    updatedAt: stack.updatedAt,
    lastUsedAt: stack.lastUsedAt,
    components: Object.entries(stack.definition.components).map(
      ([name, definition]) => ({
        name,
        dockerService: definition.docker?.service ?? null,
        endpoints: Object.entries(definition.endpoints).map(
          ([endpointName, endpoint]) => ({
            name: endpointName,
            publish: endpoint.publish,
            required: endpoint.required,
            preferredPort: endpoint.allocation.preferredPort ?? null,
            exactPort: endpoint.allocation.exactPort ?? null,
            containerPort: endpoint.docker?.containerPort ?? null,
          }),
        ),
        dependencies: Object.entries(definition.dependencies).map(
          ([alias, dependency]) => ({ alias, ...dependency }),
        ),
      }),
    ),
    generation:
      generation === null
        ? null
        : {
            id: generation.id,
            revision: generation.revision,
            state: generation.state,
            createdAt: generation.createdAt,
            invalidatedAt: generation.invalidatedAt,
            endpoints: generation.endpoints.map((/** @type {any} */ endpoint) => ({
              component: endpoint.component,
              endpoint: endpoint.endpoint,
              host: endpoint.host,
              port: endpoint.port,
              required: endpoint.required,
            })),
          },
    activation:
      activation === null
        ? null
        : {
            id: activation.id,
            generationId: activation.generationId,
            state: activation.state,
            createdAt: activation.createdAt,
            updatedAt: activation.updatedAt,
            confirmedAt: activation.confirmedAt,
            endedAt: activation.endedAt,
            endpoints: activation.endpoints.map((/** @type {any} */ endpoint) => ({
              component: endpoint.component,
              endpoint: endpoint.endpoint,
              port: endpoint.port,
              required: endpoint.required,
              bindingKind: endpoint.bindingKind,
              state: endpoint.state,
              expiresAt: endpoint.expiresAt,
              failureReason: endpoint.failureReason,
              updatedAt: endpoint.updatedAt,
            })),
          },
    providers: status.providers.map((/** @type {any} */ provider) => ({
      component: provider.component,
      endpoint: provider.endpoint,
      port: provider.port,
      bindingKind: provider.bindingKind,
      status: provider.status,
      reason: provider.reason,
      listeners: provider.listeners,
      containerId: provider.containerId,
    })),
    resolutions: status.resolutions.map((/** @type {any} */ entry) => ({
      component: entry.component,
      definitionRevision: entry.resolution?.definitionRevision ?? null,
      generationId: entry.resolution?.generationId ?? null,
      activationId: entry.resolution?.activationId ?? null,
      own: reduceResolvedMap(entry.resolution?.own ?? {}),
      dependencies: reduceResolvedMap(entry.resolution?.dependencies ?? {}),
      error: entry.error,
    })),
  };
}

/** @param {Record<string, any>} entries */
function reduceResolvedMap(entries) {
  return Object.entries(entries).map(([alias, endpoint]) => ({ alias, ...endpoint }));
}

/** @param {any} snapshot */
export function reduceStackEndpointSnapshot(snapshot) {
  return {
    schemaVersion: 1,
    definitionRevision: snapshot.definitionRevision,
    generationId: snapshot.generationId,
    activationId: snapshot.activationId,
    component: snapshot.component,
    own: reduceSnapshotMap(snapshot.own),
    dependencies: reduceSnapshotMap(snapshot.dependencies),
  };
}

/** @param {Record<string, any>} entries */
function reduceSnapshotMap(entries) {
  return Object.entries(entries).map(([alias, endpoint]) => ({
    alias,
    component: endpoint.component,
    endpoint: endpoint.endpoint,
    host: endpoint.address,
    dockerNetwork: null,
  }));
}

/** @param {any} entry */
function reducePort(entry) {
  const identity = entry.claim?.identity;
  return {
    port: entry.port,
    classification: entry.classification,
    claim:
      identity === undefined
        ? null
        : {
            project: String(identity.project),
            service: String(identity.service),
            component: String(identity.component),
            endpoint: String(identity.endpoint),
            workspaceName: basename(String(identity.workspaceRoot)),
            mode: entry.claim.mode,
            createdAt: entry.claim.createdAt,
            updatedAt: entry.claim.updatedAt,
            lastUsedAt: entry.claim.lastUsedAt,
            assignmentExpiresAt: entry.claim.assignmentExpiresAt,
          },
    run:
      entry.run === null
        ? null
        : {
            state: entry.run.state,
            rootPid: entry.run.rootPid,
            confirmedAt: entry.run.confirmedAt,
            releasedAt: entry.run.releasedAt,
          },
    listeners: entry.listeners.map(reduceListener),
  };
}

/** @param {any} listener */
function reduceListener(listener) {
  return {
    pid: listener.pid,
    names: listener.names,
    verified: listener.ownership.verified,
    reason: listener.ownership.reason,
    lineage: listener.ownership.lineage,
    process:
      listener.process === null
        ? null
        : {
            parentPid: listener.process.parentPid,
            uid: listener.process.uid,
            startTime: listener.process.startTime,
            executableName: basename(listener.process.executable),
            workingDirectory: listener.process.workingDirectory,
          },
  };
}
