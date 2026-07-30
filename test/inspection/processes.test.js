// @ts-check

import { expect, test } from 'bun:test';
import { realpath } from 'node:fs/promises';
import {
  inspectProcess,
  parsePsProcess,
  sameProcessInstance,
  verifyProcessLineage,
} from '../../src/inspection/processes.js';

/**
 * @param {number} pid
 * @param {number} parentPid
 * @param {string} [startTime]
 */
function fingerprint(pid, parentPid, startTime = '2026-07-30T12:00:00.000Z') {
  return {
    pid,
    parentPid,
    uid: 501,
    startTime,
    executable: '/usr/local/bin/bun',
    command: 'bun',
    workingDirectory: '/worktrees/project',
  };
}

test('parses portable ps process metadata', () => {
  expect(
    parsePsProcess(' 123  501 Thu Jul 30 09:13:41 2026     /usr/local/bin/bun\n'),
  ).toEqual({
    parentPid: 123,
    uid: 501,
    startTime: new Date('Thu Jul 30 09:13:41 2026').toISOString(),
    command: '/usr/local/bin/bun',
  });
});

test('inspects the current process with composite fingerprint evidence', async () => {
  const inspected = await inspectProcess(process.pid);

  expect(inspected).not.toBeNull();
  expect(inspected?.pid).toBe(process.pid);
  expect(inspected?.workingDirectory).toBe(await realpath('.'));
  expect(inspected?.startTime).toMatch(/Z$/);
  expect(inspected?.executable).toMatch(/bun/i);
});

test('uses start time and executable to reject PID reuse', () => {
  const original = fingerprint(100, 1);
  const reused = fingerprint(100, 1, '2026-07-30T13:00:00.000Z');

  expect(sameProcessInstance(original, original)).toBe(true);
  expect(sameProcessInstance(original, reused)).toBe(false);
});

test('verifies descendants only while the original root instance is live', async () => {
  const root = fingerprint(100, 1);
  const child = fingerprint(200, 100);
  const processes = new Map([
    [100, root],
    [200, child],
  ]);
  /** @param {number} pid */
  const inspect = async (pid) => processes.get(pid) ?? null;

  expect(await verifyProcessLineage(child, root, inspect)).toEqual({
    verified: true,
    reason: 'verified',
    lineage: [200, 100],
  });

  processes.set(100, fingerprint(100, 1, '2026-07-30T13:00:00.000Z'));
  expect(await verifyProcessLineage(child, root, inspect)).toEqual({
    verified: false,
    reason: 'root-process-changed',
    lineage: [],
  });
});
