// @ts-check

import { expect, test } from 'bun:test';
import {
  foregroundServeCommand,
  quickStartAuthorityPresentation,
} from '../../apps/desktop/renderer/quick-start.js';
import { lifecycleSnapshot, provisionalArtifact } from './fixtures.js';
import { createDesktopSnapshot } from '../../apps/desktop/main/view-model.js';

/** @param {ReturnType<typeof lifecycleSnapshot>} lifecycle */
function snapshotWith(lifecycle) {
  return createDesktopSnapshot({
    artifact: provisionalArtifact(),
    lifecycle,
    ports: [],
    stacks: [],
    errors: [],
    refreshedAt: '2026-08-11T12:00:00.000Z',
  });
}

test('builds a copyable foreground serve command for paths with shell characters', () => {
  expect(foregroundServeCommand('/Applications/Port Reeve/bin/portreeve')).toBe(
    "'/Applications/Port Reeve/bin/portreeve' serve",
  );
  expect(foregroundServeCommand("/tmp/user's/portreeve")).toBe(
    "'/tmp/user'\\''s/portreeve' serve",
  );
});

test('presents foreground and supervised authorities as ready', () => {
  expect(quickStartAuthorityPresentation(snapshotWith(lifecycleSnapshot()))).toEqual({
    label: 'Ready — supervised',
    detail: 'Skip step 1; the local authority is already reachable.',
  });
  expect(
    quickStartAuthorityPresentation(
      snapshotWith(
        lifecycleSnapshot({
          mode: 'manual',
          supervisor: {
            kind: 'launchd',
            state: 'inactive',
            mainPid: null,
            error: null,
          },
        }),
      ),
    ),
  ).toEqual({
    label: 'Ready — foreground',
    detail: 'Skip step 1; the local authority is already reachable.',
  });
});

test('directs a user to choose an authority when no socket is healthy', () => {
  expect(
    quickStartAuthorityPresentation(
      snapshotWith(
        lifecycleSnapshot({
          mode: 'none',
          socket: {
            path: '/tmp/portreeve.sock',
            state: 'unavailable',
            server: null,
            error: null,
          },
        }),
      ),
    ),
  ).toEqual({
    label: 'Not running',
    detail: 'Choose the foreground command or open Service setup.',
  });
});
