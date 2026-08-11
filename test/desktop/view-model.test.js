// @ts-check

import { expect, test } from 'bun:test';
import { createDesktopSnapshot } from '../../apps/desktop/main/view-model.js';
import {
  inventoryEntry,
  lifecycleSnapshot,
  provisionalArtifact,
  stackStatus,
  timestamp,
} from './fixtures.js';

test('reduces lifecycle and inventory evidence before it reaches the renderer', () => {
  const snapshot = createDesktopSnapshot({
    artifact: provisionalArtifact(),
    lifecycle: lifecycleSnapshot(),
    ports: [inventoryEntry()],
    refreshedAt: timestamp,
  });
  expect(snapshot.ports[0]).toEqual({
    port: 4173,
    classification: 'verified',
    claim: {
      project: 'caregiver',
      service: 'website',
      component: 'website',
      endpoint: 'default',
      workspaceName: 'caregiver-secret-worktree',
      mode: 'sticky',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUsedAt: timestamp,
      assignmentExpiresAt: null,
    },
    run: {
      state: 'confirmed',
      rootPid: 8181,
      confirmedAt: timestamp,
      releasedAt: null,
    },
    listeners: [
      {
        pid: 9191,
        names: ['*:4173'],
        verified: true,
        reason: 'verified',
        lineage: [9191],
        process: {
          parentPid: 8181,
          uid: 501,
          startTime: timestamp,
          executableName: 'bun',
          workingDirectory: '/Users/example/Code/caregiver-secret-worktree',
        },
      },
    ],
  });
  const serialized = JSON.stringify(snapshot);
  expect(serialized).not.toContain('super-secret-value');
  expect(serialized).not.toContain('secretInternalField');
  expect(serialized).not.toContain('managedExecutablePath');
  expect(serialized).not.toContain('socketPath');
  expect(serialized).not.toContain('github.com');
  expect(snapshot.update).toEqual({
    status: 'not-checked',
    checkedAt: null,
    latestVersion: null,
  });
  expect(snapshot.lifecycle?.installation.managedLocation).toBe(
    '/Users/example/.local/portreeve/bin/portreeve',
  );
  expect(snapshot.artifact.bundledLocation).toBe('/verified/bundled/portreeve');
});

test('reduces stack definitions, activation evidence, and addresses without credentials', () => {
  const snapshot = createDesktopSnapshot({
    artifact: provisionalArtifact(),
    lifecycle: lifecycleSnapshot(),
    ports: [],
    stacks: [stackStatus()],
    refreshedAt: timestamp,
  });
  expect(snapshot.stacks[0]).toMatchObject({
    project: 'caregiver',
    stackRootName: 'caregiver-secret-worktree',
    generation: { state: 'valid', endpoints: [{ port: 4100 }] },
    activation: { state: 'confirmed', endpoints: [{ state: 'confirmed' }] },
    providers: [{ status: 'active', listeners: 1 }],
    resolutions: [
      {
        component: 'website',
        dependencies: [
          {
            alias: 'backend',
            host: { host: '127.0.0.1', port: 4100 },
          },
        ],
      },
    ],
  });
  const serialized = JSON.stringify(snapshot.stacks[0]);
  expect(serialized).not.toContain('claimId');
  expect(serialized).not.toContain('leaseId');
  expect(serialized).not.toContain('runId');
  expect(serialized).not.toContain('/Users/example/Code/');
});

test('represents absent, manual, supervised, and incompatible lifecycle states', () => {
  const base = lifecycleSnapshot();
  const states = [
    lifecycleSnapshot({
      mode: 'none',
      installation: {
        ...base.installation,
        state: 'absent',
        version: null,
      },
      supervisor: {
        ...base.supervisor,
        state: 'unavailable',
        mainPid: null,
      },
      socket: { ...base.socket, state: 'unavailable', server: null },
      versions: { cli: '0.1.0', managed: null, running: null },
    }),
    lifecycleSnapshot({
      mode: 'manual',
      supervisor: { ...base.supervisor, state: 'inactive', mainPid: null },
      socket: {
        ...base.socket,
        server: { ...base.socket.server, mode: 'manual' },
      },
    }),
    base,
    lifecycleSnapshot({
      mode: 'none',
      socket: {
        ...base.socket,
        state: 'incompatible',
        server: null,
        error: { code: 'incompatible', message: 'Newer protocol.' },
      },
      versions: { ...base.versions, running: null },
      limitations: ['running-server-incompatible'],
    }),
  ];
  expect(
    states
      .map((lifecycle) =>
        createDesktopSnapshot({
          artifact: provisionalArtifact(),
          lifecycle,
          ports: [],
          refreshedAt: timestamp,
        }),
      )
      .map(({ lifecycle }) => ({
        mode: lifecycle?.mode,
        installation: lifecycle?.installation.state,
        supervisor: lifecycle?.supervisor.state,
        socket: lifecycle?.socket.state,
      })),
  ).toEqual([
    {
      mode: 'none',
      installation: 'absent',
      supervisor: 'unavailable',
      socket: 'unavailable',
    },
    {
      mode: 'manual',
      installation: 'installed',
      supervisor: 'inactive',
      socket: 'healthy',
    },
    {
      mode: 'supervised',
      installation: 'installed',
      supervisor: 'active',
      socket: 'healthy',
    },
    {
      mode: 'none',
      installation: 'installed',
      supervisor: 'active',
      socket: 'incompatible',
    },
  ]);
});
