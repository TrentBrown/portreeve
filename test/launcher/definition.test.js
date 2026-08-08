// @ts-check

import { expect, test } from 'bun:test';
import {
  LauncherDefinitionSchema,
  normalizeLauncherDefinition,
  validateLauncherTopology,
} from '../../src/launcher/definition.js';

function launcher() {
  return {
    version: 1,
    operations: {
      start: { command: 'npm run start' },
      stop: { command: 'npm run stop' },
    },
    environment: [
      {
        name: 'API_HTTP_PORT',
        endpoint: { component: 'api', endpoint: 'http' },
        value: 'host-port',
      },
    ],
  };
}

function stack() {
  return {
    version: 1,
    project: 'example',
    components: {
      api: {
        docker: { service: 'api' },
        endpoints: {
          http: { docker: { containerPort: 8080 } },
          internal: { publish: false },
        },
      },
    },
  };
}

test('normalizes launcher defaults into deterministic bytes and revisions', () => {
  const first = normalizeLauncherDefinition(launcher());
  const source = launcher();
  const second = normalizeLauncherDefinition({
    environment: source.environment,
    operations: source.operations,
    version: source.version,
  });
  expect(first.revision).toBe(second.revision);
  expect(first.content).toBe(second.content);
  expect(first.definition).toMatchObject({
    integration: { mode: 'command-only' },
    shell: 'system',
    workingDirectory: '.',
    operations: {
      start: { mode: 'finite', timeoutSeconds: 300 },
      stop: { timeoutSeconds: 120 },
    },
  });
  expect(first.content.endsWith('\n')).toBe(true);
});

test('rejects unknown, unsafe, contradictory, and duplicate configuration', () => {
  expect(() =>
    LauncherDefinitionSchema.parse({ ...launcher(), secret: 'value' }),
  ).toThrow();
  expect(() =>
    LauncherDefinitionSchema.parse({ ...launcher(), workingDirectory: '/tmp' }),
  ).toThrow('relative');
  expect(() =>
    LauncherDefinitionSchema.parse({
      ...launcher(),
      operations: {
        start: { command: 'npm start', mode: 'attached', timeoutSeconds: 10 },
        stop: { command: 'npm stop' },
      },
    }),
  ).toThrow('must not declare a timeout');
  expect(() =>
    LauncherDefinitionSchema.parse({
      ...launcher(),
      operations: {
        start: { command: 'npm start', mode: 'attached' },
        stop: { command: 'npm stop' },
        restart: { command: 'npm restart' },
      },
    }),
  ).toThrow('composed Restart');
  expect(() =>
    LauncherDefinitionSchema.parse({
      ...launcher(),
      environment: [...launcher().environment, ...launcher().environment],
    }),
  ).toThrow('duplicate environment');
  expect(() =>
    LauncherDefinitionSchema.parse({
      ...launcher(),
      environment: [
        {
          name: 'PORTREEVE_TOKEN',
          endpoint: { component: 'api' },
          value: 'host-port',
        },
      ],
    }),
  ).toThrow('reserved');
  expect(() =>
    LauncherDefinitionSchema.parse({
      ...launcher(),
      environment: [
        {
          name: 'API_URL',
          endpoint: { component: 'api', endpoint: 'http' },
          value: 'host-url',
        },
      ],
    }),
  ).toThrow('require a scheme');
});

test('validates mappings against stack topology and Docker facts', () => {
  const parsed = LauncherDefinitionSchema.parse(launcher());
  expect(validateLauncherTopology(parsed, stack())).toBe(parsed);
  expect(() =>
    validateLauncherTopology(
      LauncherDefinitionSchema.parse({
        ...launcher(),
        environment: [
          {
            name: 'MISSING_PORT',
            endpoint: { component: 'missing' },
            value: 'host-port',
          },
        ],
      }),
      stack(),
    ),
  ).toThrow('unknown component');
  expect(() =>
    validateLauncherTopology(
      LauncherDefinitionSchema.parse({
        ...launcher(),
        environment: [
          {
            name: 'INTERNAL_PORT',
            endpoint: { component: 'api', endpoint: 'internal' },
            value: 'host-port',
          },
        ],
      }),
      stack(),
    ),
  ).toThrow('published endpoint');
});
