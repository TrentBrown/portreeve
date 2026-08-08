// @ts-check

import { expect, test } from 'bun:test';
import {
  availableActions,
  availableStackActions,
  canUninstall,
  compareVersions,
  stackPresentationState,
  stackRenderSignature,
  updatePresentation,
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
  expect(canUninstall(absent)).toBe(false);
  expect(availableActions(stopped)).toEqual(['start', 'upgrade']);
  expect(availableActions(snapshotWith({}))).toEqual(['stop', 'restart']);
  expect(canUninstall(snapshotWith({}))).toBe(true);
  expect(availableActions(manual)).toEqual(['stopManual']);
  expect(canUninstall(manual)).toBe(false);
  expect(availableActions(ambiguous)).toEqual([]);
  const staleLifecycle = {
    ...stopped,
    errors: [
      {
        source: 'lifecycle',
        code: 'offline',
        message: 'Unavailable.',
        observedAt: timestamp,
      },
    ],
  };
  expect(availableActions(staleLifecycle)).toEqual([]);
  expect(canUninstall(staleLifecycle)).toBe(false);
  expect(compareVersions('0.2.0', '0.1.9')).toBeGreaterThan(0);
  expect(compareVersions('0.1.0-rc.1', '0.1.0')).toBeLessThan(0);
  expect(compareVersions('0.1.0-rc.10', '0.1.0-rc.2')).toBeGreaterThan(0);
  expect(compareVersions('0.1.0-alpha', '0.1.0-1')).toBeGreaterThan(0);
  expect(compareVersions('0.1.0+desktop.1', '0.1.0+cli.9')).toBe(0);
});

test('withholds stack mutations on stale evidence and never invents launcher actions', () => {
  const active = { activation: { state: 'confirmed' } };
  expect(availableStackActions({ errors: [] }, active)).toEqual([
    'prepare',
    'reconcile',
    'end',
  ]);
  expect(
    availableStackActions(
      { errors: [{ source: 'stacks', code: 'unavailable' }] },
      active,
    ),
  ).toEqual([]);
  expect(availableStackActions({ errors: [] }, { activation: null })).toEqual([
    'prepare',
  ]);
  expect(stackPresentationState({ generation: null, activation: null })).toBe(
    'defined',
  );
  expect(stackPresentationState({ generation: {}, activation: null })).toBe('prepared');
  expect(
    stackPresentationState({ generation: {}, activation: { state: 'degraded' } }),
  ).toBe('degraded');
});

test('keeps stack rendering stable across evidence timestamps while noticing material changes', () => {
  const stack = { id: 'stack-1', project: 'demo' };
  const initial = {
    stacks: [stack],
    errors: [],
    refreshedAt: '2026-08-06T10:00:00.000Z',
  };
  const later = {
    ...initial,
    refreshedAt: '2026-08-06T10:00:05.000Z',
  };
  expect(stackRenderSignature(later)).toBe(stackRenderSignature(initial));
  expect(
    stackRenderSignature({ ...later, stacks: [{ ...stack, project: 'next' }] }),
  ).not.toBe(stackRenderSignature(initial));
  expect(
    stackRenderSignature({
      ...later,
      errors: [{ source: 'stacks', code: 'unavailable' }],
    }),
  ).not.toBe(stackRenderSignature(initial));
});

test('presents update discovery without implying automatic installation', () => {
  expect(updatePresentation({ status: 'available', latestVersion: '0.2.0' })).toEqual({
    message:
      'PortReeve Desktop 0.2.0 is available. Downloading the desktop remains a separate, manual action.',
    canOpenDownloadPage: true,
  });
  expect(updatePresentation({ status: 'unavailable', latestVersion: null })).toEqual({
    message:
      'Update information is unavailable. Local PortReeve management is unaffected.',
    canOpenDownloadPage: false,
  });
});
