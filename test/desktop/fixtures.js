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
      identity: {
        project: 'caregiver',
        workspaceRoot: '/Users/example/Code/caregiver-secret-worktree',
        service: 'website',
        transport: 'tcp',
      },
    },
    lease: null,
    run: { secretInternalField: 'do-not-render' },
    listeners: [
      {
        pid: 9191,
        port: 4173,
        command: 'bun --token super-secret-value',
        names: ['*:4173'],
        process: { executable: '/private/toolchains/bun' },
        ownership: { verified: true, reason: 'verified', lineage: [9191] },
      },
    ],
  };
}
