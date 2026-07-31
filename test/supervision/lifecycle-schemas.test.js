// @ts-check

import { expect, test } from 'bun:test';
import {
  LifecycleMutationResultSchema,
  LifecycleStatusSchema,
} from '../../src/supervision/schemas.js';

const observedAt = '2026-07-30T23:00:00.000Z';

test('validates the canonical layered lifecycle snapshot strictly', () => {
  const status = snapshot();
  expect(LifecycleStatusSchema.parse(status)).toEqual(status);
  expect(() =>
    LifecycleStatusSchema.parse({ ...status, legacyRunning: true }),
  ).toThrow();
});

test('validates common lifecycle mutation outcomes with before and after evidence', () => {
  const before = snapshot();
  const after = {
    ...snapshot(),
    installation: {
      state: 'installed',
      managedExecutablePath: '/tmp/portreeve/bin/portreeve',
      version: '0.1.0',
      error: null,
    },
    versions: {
      cli: '0.1.0',
      managed: '0.1.0',
      running: null,
    },
  };
  expect(
    LifecycleMutationResultSchema.parse({
      operation: 'install',
      outcome: 'succeeded',
      changed: true,
      startedAt: observedAt,
      completedAt: observedAt,
      before,
      after,
      error: null,
    }),
  ).toMatchObject({
    operation: 'install',
    outcome: 'succeeded',
    changed: true,
  });
});

function snapshot() {
  return {
    observedAt,
    installation: {
      state: /** @type {'absent'} */ ('absent'),
      managedExecutablePath: '/tmp/portreeve/bin/portreeve',
      version: null,
      error: null,
    },
    supervisor: {
      kind: 'launchd',
      state: /** @type {'unavailable'} */ ('unavailable'),
      mainPid: null,
      error: null,
    },
    socket: {
      path: '/tmp/portreeve/portreeve.sock',
      state: /** @type {'unavailable'} */ ('unavailable'),
      server: null,
      error: {
        code: 'unavailable',
        message: 'Portreeve is not running.',
      },
    },
    mode: /** @type {'none'} */ ('none'),
    versions: {
      cli: '0.1.0',
      managed: null,
      running: null,
    },
    limitations: [],
  };
}
