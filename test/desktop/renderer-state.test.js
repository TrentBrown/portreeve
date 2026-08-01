// @ts-check

import { expect, test } from 'bun:test';
import {
  availableActions,
  compareVersions,
} from '../../apps/desktop/renderer/state.js';
import { createDesktopSnapshot } from '../../apps/desktop/main/view-model.js';
import { lifecycleSnapshot, provisionalArtifact, timestamp } from './fixtures.js';

/** @param {Record<string, unknown>} overrides */
function snapshotWith(overrides) {
  return createDesktopSnapshot({
    artifact: provisionalArtifact(),
    lifecycle: lifecycleSnapshot(overrides),
    ports: [],
    refreshedAt: timestamp,
  });
}

test('derives only state-appropriate service actions', () => {
  const base = lifecycleSnapshot();
  const absent = snapshotWith({
    mode: 'none',
    installation: { ...base.installation, state: 'absent', version: null },
    supervisor: { ...base.supervisor, state: 'unavailable', mainPid: null },
    socket: { ...base.socket, state: 'unavailable', server: null },
    versions: { cli: '0.1.0', managed: null, running: null },
  });
  const stopped = snapshotWith({
    mode: 'none',
    supervisor: { ...base.supervisor, state: 'inactive', mainPid: null },
    socket: { ...base.socket, state: 'unavailable', server: null },
    versions: { cli: '0.1.0', managed: '0.0.9', running: null },
  });
  const manual = snapshotWith({
    mode: 'manual',
    supervisor: { ...base.supervisor, state: 'inactive', mainPid: null },
    socket: {
      ...base.socket,
      server: { ...base.socket.server, mode: 'manual' },
    },
  });
  const ambiguous = snapshotWith({ mode: 'ambiguous' });

  expect(availableActions(absent)).toEqual(['installAndStart']);
  expect(availableActions(stopped)).toEqual(['start', 'upgrade']);
  expect(availableActions(snapshotWith({}))).toEqual(['stop', 'restart']);
  expect(availableActions(manual)).toEqual(['stopManual']);
  expect(availableActions(ambiguous)).toEqual([]);
  expect(
    availableActions({
      ...stopped,
      errors: [
        {
          source: 'lifecycle',
          code: 'offline',
          message: 'Unavailable.',
          observedAt: timestamp,
        },
      ],
    }),
  ).toEqual([]);
  expect(compareVersions('0.2.0', '0.1.9')).toBeGreaterThan(0);
  expect(compareVersions('0.1.0-rc.1', '0.1.0')).toBeLessThan(0);
});
