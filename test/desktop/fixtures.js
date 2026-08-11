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
    executablePath: '/verified/bundled/portreeve',
    sha256: 'a'.repeat(64),
    controller: {
      version: '0.1.0',
      mutationsEnabled: true,
      error: null,
    },
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

export function stackStatus() {
  return {
    stack: {
      id: '44444444-4444-4444-8444-444444444444',
      project: 'caregiver',
      stackRoot: '/Users/example/Code/caregiver-secret-worktree',
      currentRevision: 'b'.repeat(64),
      definition: {
        version: 1,
        project: 'caregiver',
        components: {
          api: {
            endpoints: {
              default: {
                transport: 'tcp',
                publish: true,
                required: true,
                allocation: { preferredPort: 4100 },
              },
            },
            dependencies: {},
          },
          website: {
            endpoints: {
              default: {
                transport: 'tcp',
                publish: true,
                required: true,
                allocation: {},
                docker: { containerPort: 3000 },
              },
            },
            dependencies: {
              backend: {
                component: 'api',
                endpoint: 'default',
                required: true,
              },
            },
            docker: { service: 'website' },
          },
        },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUsedAt: timestamp,
    },
    generation: {
      id: '55555555-5555-4555-8555-555555555555',
      stackId: '44444444-4444-4444-8444-444444444444',
      revision: 'b'.repeat(64),
      state: 'valid',
      endpoints: [
        {
          claimId: '11111111-1111-4111-8111-111111111111',
          component: 'api',
          endpoint: 'default',
          transport: 'tcp',
          host: '127.0.0.1',
          port: 4100,
          required: true,
        },
      ],
      createdAt: timestamp,
      invalidatedAt: null,
    },
    activation: {
      id: '66666666-6666-4666-8666-666666666666',
      stackId: '44444444-4444-4444-8444-444444444444',
      generationId: '55555555-5555-4555-8555-555555555555',
      state: 'confirmed',
      endpoints: [
        {
          component: 'api',
          endpoint: 'default',
          claimId: '11111111-1111-4111-8111-111111111111',
          port: 4100,
          required: true,
          bindingKind: 'process',
          state: 'confirmed',
          leaseId: '77777777-7777-4777-8777-777777777777',
          runId: '88888888-8888-4888-8888-888888888888',
          expiresAt: null,
          failureReason: null,
          updatedAt: timestamp,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmedAt: timestamp,
      endedAt: null,
    },
    providers: [
      {
        component: 'api',
        endpoint: 'default',
        port: 4100,
        bindingKind: 'process',
        status: 'active',
        reason: 'listener matches the confirmed run',
        listeners: 1,
        runId: '88888888-8888-4888-8888-888888888888',
        containerId: null,
      },
    ],
    resolutions: [
      {
        component: 'website',
        resolution: {
          schemaVersion: 1,
          definitionRevision: 'b'.repeat(64),
          generationId: '55555555-5555-4555-8555-555555555555',
          activationId: '66666666-6666-4666-8666-666666666666',
          component: 'website',
          own: {},
          dependencies: {
            backend: {
              component: 'api',
              endpoint: 'default',
              host: { transport: 'tcp', host: '127.0.0.1', port: 4100 },
              dockerNetwork: null,
            },
          },
        },
        error: null,
      },
    ],
  };
}
