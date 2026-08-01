// @ts-check

import { basename } from 'node:path';
import { DesktopSnapshotSchema } from '../shared/schemas.js';

/**
 * @param {{artifact: {source: 'local-release-candidate'|'published', desktopVersion: string, version: string, filename: string, sha256: string}, lifecycle: unknown, ports: unknown[], errors?: unknown[], refreshedAt: string, stale?: boolean, lastSuccessfulAt?: string|null}} input
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
    errors: input.errors ?? [],
  });
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
