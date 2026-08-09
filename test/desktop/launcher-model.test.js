// @ts-check

import { expect, test } from 'bun:test';
import {
  buildLauncherDefinition,
  createLauncherDraft,
  launcherAvailability,
  launcherDraftSignature,
  launcherEnvironmentPreview,
} from '../../apps/desktop/renderer/launcher-model.js';

test('seeds a missing launcher from safe command and endpoint suggestions', () => {
  const draft = createLauncherDraft(missingDocument());

  expect(draft).toMatchObject({
    integrationMode: 'command-only',
    shell: 'system',
    workingDirectory: '.',
    start: { command: 'bun run start', mode: 'finite' },
    stop: { command: 'bun run stop' },
    environment: [
      {
        name: 'API_PORT',
        component: 'api',
        endpoint: 'default',
        value: 'host-port',
      },
    ],
  });
  expect(launcherDraftSignature(draft)).toBe(launcherDraftSignature(draft));
  expect(
    launcherDraftSignature({ ...draft, workingDirectory: 'services/api' }),
  ).not.toBe(launcherDraftSignature(draft));
});

test('builds a canonical launcher without persisting assigned port numbers', () => {
  const draft = createLauncherDraft(missingDocument());
  const built = buildLauncherDefinition(draft, desktopStack());

  expect(built.issues).toEqual([]);
  expect(built.definition).toMatchObject({
    version: 1,
    operations: {
      start: { command: 'bun run start', timeoutSeconds: 300 },
      stop: { command: 'bun run stop', timeoutSeconds: 120 },
    },
    environment: [
      {
        name: 'API_PORT',
        endpoint: { component: 'api', endpoint: 'default' },
        value: 'host-port',
      },
    ],
  });
  expect(built.content.endsWith('\n')).toBe(true);
  expect(built.content).not.toContain('4100');

  draft.workingDirectory = '/outside';
  draft.environment.push({ ...draft.environment[0], id: 'duplicate' });
  const invalid = buildLauncherDefinition(draft, desktopStack());
  expect(invalid.issues.map(({ message }) => message)).toEqual(
    expect.arrayContaining([
      'Working directory must be a relative path inside the stack root.',
      'Environment names must be unique.',
    ]),
  );
});

test('previews operation-time host and Docker endpoint values from reduced stack facts', () => {
  const definition = {
    environment: [
      endpointMapping('HOST_PORT', 'host-port'),
      endpointMapping('HOST_URL', 'host-url'),
      endpointMapping('CONTAINER_PORT', 'container-port'),
      endpointMapping('DOCKER_URL', 'docker-network-url'),
    ],
  };
  expect(launcherEnvironmentPreview(definition, desktopStack())).toEqual([
    expect.objectContaining({ name: 'HOST_PORT', value: '4100' }),
    expect.objectContaining({ name: 'HOST_URL', value: 'http://127.0.0.1:4100' }),
    expect.objectContaining({ name: 'CONTAINER_PORT', value: '3000' }),
    expect.objectContaining({ name: 'DOCKER_URL', value: 'http://api:3000' }),
  ]);
});

test('withholds launcher actions until the exact definition is trusted and evidence is safe', () => {
  const definition = { definition: { operations: { start: { mode: 'finite' } } } };
  const base = {
    fileState: 'valid',
    trusted: true,
    evidence: { classification: 'stopped' },
  };
  expect(launcherAvailability(base, definition, null).actions).toEqual([
    'start',
    'stop',
    'restart',
    'status',
  ]);
  expect(launcherAvailability({ ...base, trusted: false }, definition, null)).toEqual({
    actions: [],
    reasons: ['Save and Trust this exact launcher revision first.'],
  });
  expect(
    launcherAvailability(
      { ...base, evidence: { classification: 'conflicting' } },
      definition,
      null,
    ).actions,
  ).toEqual(['status', 'stop']);
  expect(
    launcherAvailability(
      {
        ...base,
        evidence: { classification: 'stopped', source: 'cached' },
      },
      definition,
      null,
    ).actions,
  ).toEqual(['status', 'stop']);
  expect(
    launcherAvailability(
      { ...base, evidence: { classification: 'verified', source: 'daemon' } },
      definition,
      null,
    ).actions,
  ).toEqual(['stop', 'restart', 'status']);
  expect(
    launcherAvailability(base, definition, {
      state: 'running',
      operation: 'start',
    }).actions,
  ).toEqual(['status', 'stop']);
});

function missingDocument() {
  /** @param {string} command */
  const operation = (command) => ({
    suggestion: {
      command,
      provenance: {
        kind: 'package-script',
        filename: 'package.json',
        detail: command.endsWith('start') ? 'start' : 'stop',
      },
    },
    candidates: [],
  });
  return {
    fileState: 'missing',
    definition: null,
    suggestions: {
      operations: {
        start: operation('bun run start'),
        stop: operation('bun run stop'),
        restart: { suggestion: null, candidates: [] },
        status: { suggestion: null, candidates: [] },
      },
      environment: [endpointMapping('API_PORT', 'host-port')],
    },
  };
}

/** @param {string} name @param {string} value */
function endpointMapping(name, value) {
  return {
    name,
    endpoint: { component: 'api', endpoint: 'default' },
    value,
    ...(value.endsWith('url') ? { scheme: 'http' } : {}),
  };
}

function desktopStack() {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    components: [
      {
        name: 'api',
        dockerService: 'api',
        endpoints: [
          { name: 'default', publish: true, required: true, containerPort: 3000 },
        ],
      },
    ],
    generation: {
      endpoints: [{ component: 'api', endpoint: 'default', port: 4100 }],
    },
  };
}
