// @ts-check

import { expect, test } from 'bun:test';
import { DockerCliAdapter } from '../../src/docker/adapter.js';
import {
  expectedDockerLabels,
  verifyDockerEvidence,
} from '../../src/docker/evidence.js';

const containerId = 'a'.repeat(64);

test('Docker CLI adapter normalizes fresh inspect and published-port evidence', async () => {
  /** @type {string[][]} */
  const calls = [];
  const adapter = new DockerCliAdapter({
    runner: async (_executable, args) => {
      calls.push(args);
      if (args[0] === 'version') {
        return { code: 0, stdout: '27.0.0\n', stderr: '' };
      }
      if (args[0] === 'ps') {
        return { code: 0, stdout: `${containerId}\n`, stderr: '' };
      }
      return {
        code: 0,
        stdout: JSON.stringify([
          {
            Id: containerId,
            State: { Running: true },
            Config: { Labels: { owner: 'portreeve' } },
            NetworkSettings: {
              Ports: {
                '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '43210' }],
                '3000/udp': [{ HostIp: '127.0.0.1', HostPort: '43210' }],
              },
            },
          },
        ]),
        stderr: '',
      };
    },
  });

  expect(await adapter.availability()).toEqual({ available: true, reason: null });
  expect(await adapter.inspect(containerId)).toMatchObject({
    status: 'ok',
    container: {
      id: containerId,
      running: true,
      labels: { owner: 'portreeve' },
      ports: [{ containerPort: 3000, hostIp: '127.0.0.1', hostPort: 43210 }],
    },
  });
  expect(await adapter.findPublishedPort(43210)).toMatchObject({
    available: true,
    containers: [{ id: containerId }],
  });
  expect(calls).toContainEqual(['ps', '--quiet', '--no-trunc']);
});

test('Docker evidence requires running state, exact labels, and loopback publication', () => {
  const labels = expectedDockerLabels({
    stackId: 'stack',
    component: 'api',
    definitionRevision: 'b'.repeat(64),
    generationId: 'generation',
    activationId: 'activation',
    endpoints: { metrics: 9090, http: 3000 },
  });
  const matching = {
    id: containerId,
    running: true,
    labels,
    ports: [{ containerPort: 3000, hostIp: '127.0.0.1', hostPort: 43210 }],
  };
  expect(
    verifyDockerEvidence({
      container: matching,
      expectedLabels: labels,
      endpoint: 'http',
      containerPort: 3000,
      hostPort: 43210,
    }),
  ).toMatchObject({ verified: true });
  expect(
    verifyDockerEvidence({
      container: { ...matching, running: false },
      expectedLabels: labels,
      endpoint: 'http',
      containerPort: 3000,
      hostPort: 43210,
    }),
  ).toMatchObject({ verified: false, reason: 'container-not-running' });
  expect(
    verifyDockerEvidence({
      container: {
        ...matching,
        labels: {
          ...labels,
          'com.trentbrown.portreeve.activation-id': 'stale-activation',
        },
      },
      expectedLabels: labels,
      endpoint: 'http',
      containerPort: 3000,
      hostPort: 43210,
    }),
  ).toMatchObject({ verified: false, reason: 'container-label-mismatch' });
  expect(
    verifyDockerEvidence({
      container: {
        ...matching,
        ports: [{ containerPort: 3000, hostIp: '0.0.0.0', hostPort: 43210 }],
      },
      expectedLabels: labels,
      endpoint: 'http',
      containerPort: 3000,
      hostPort: 43210,
    }),
  ).toMatchObject({ verified: false, reason: 'container-publication-mismatch' });
});

test('Docker absence and malformed inspection remain capability evidence', async () => {
  const missing = new DockerCliAdapter({
    runner: async () => ({ code: 127, stdout: '', stderr: 'missing' }),
  });
  expect(await missing.availability()).toEqual({
    available: false,
    reason: 'docker-executable-unavailable',
  });
  expect(await missing.inspect(containerId)).toMatchObject({
    status: 'unavailable',
    container: null,
  });

  const malformed = new DockerCliAdapter({
    runner: async () => ({ code: 0, stdout: '{}', stderr: '' }),
  });
  expect(await malformed.inspect(containerId)).toMatchObject({
    status: 'unavailable',
    reason: 'invalid-inspect-shape',
  });

  const absentContainer = new DockerCliAdapter({
    runner: async () => ({ code: 1, stdout: '', stderr: 'No such container' }),
  });
  expect(await absentContainer.inspect(containerId)).toMatchObject({
    status: 'missing',
    container: null,
  });
});
