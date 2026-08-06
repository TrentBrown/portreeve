// @ts-check

export const timestamp = '2026-08-01T12:00:00.000Z';

/** @param {Record<string, unknown>} [overrides] */
export function lifecycleSnapshot(overrides = {}) {
  return {
    observedAt: timestamp,
    installation: {
      state: 'installed',
      managedExecutablePath: '/Users/example/.local/portreeve/bin/portreeve',
      version: '0.1.0',
      error: null,
    },
    supervisor: {
      kind: 'launchd',
      state: 'active',
      mainPid: 4242,
      error: null,
    },
    socket: {
      path: '/Users/example/Library/Application Support/Portreeve/portreeve.sock',
      state: 'healthy',
      server: {
        softwareVersion: '0.1.0',
        protocol: { minimum: 1, maximum: 1 },
        capabilities: ['two-phase-allocation-v1'],
        pid: 4242,
        mode: 'supervised',
      },
      error: null,
    },
    mode: 'supervised',
    versions: { cli: '0.1.0', managed: '0.1.0', running: '0.1.0' },
    limitations: [],
    ...overrides,
  };
}

export function provisionalArtifact() {
  return {
    source: /** @type {'local-release-candidate'} */ ('local-release-candidate'),
    desktopVersion: '0.1.0',
    version: '0.1.0',
    filename: 'portreeve-v0.1.0-macos-x64',
    sha256: 'a'.repeat(64),
  };
}

export function inventoryEntry() {
  return {
    port: 4173,
    transport: 'tcp',
    classification: 'verified',
    claim: {
      id: '11111111-1111-4111-8111-111111111111',
      identity: {
        project: 'caregiver',
        workspaceRoot: '/Users/example/Code/caregiver-secret-worktree',
        service: 'website',
        component: 'website',
        endpoint: 'default',
        transport: 'tcp',
      },
      mode: 'sticky',
      assignedPort: 4173,
      preferredPort: 4173,
      exactPort: null,
      assignmentExpiresAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUsedAt: timestamp,
    },
    lease: null,
    docker: null,
    run: {
      id: '22222222-2222-4222-8222-222222222222',
      claimId: '11111111-1111-4111-8111-111111111111',
      leaseId: '33333333-3333-4333-8333-333333333333',
      port: 4173,
      state: 'confirmed',
      rootPid: 8181,
      rootFingerprint: null,
      confirmedAt: timestamp,
      releasedAt: null,
      secretInternalField: 'do-not-render',
    },
    listeners: [
      {
        pid: 9191,
        port: 4173,
        command: 'bun --token super-secret-value',
        names: ['*:4173'],
        process: {
          pid: 9191,
          parentPid: 8181,
          uid: 501,
          startTime: timestamp,
          executable: '/private/toolchains/bun',
          command: 'bun --token super-secret-value',
          workingDirectory: '/Users/example/Code/caregiver-secret-worktree',
        },
        ownership: { verified: true, reason: 'verified', lineage: [9191] },
      },
    ],
  };
}
