// @ts-check

import { expect, test } from 'bun:test';
import { chmod, mkdtemp, open, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLauncherLocalStateStore } from '../../src/launcher/local-state.js';

const revision = 'a'.repeat(64);
const otherRevision = 'b'.repeat(64);

test('shares exact revision trust and nonsecret cache in a private atomic file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-launcher-state-'));
  const path = join(root, 'launcher-state.json');
  const store = createLauncherLocalStateStore({
    path,
    now: () => new Date('2026-08-08T20:00:00.000Z'),
  });
  try {
    expect(await store.isTrusted('/stack', revision)).toBe(false);
    await store.trust('/stack', revision);
    expect(await store.isTrusted('/stack', revision)).toBe(true);
    expect(await store.isTrusted('/stack', otherRevision)).toBe(false);
    await store.cache('/stack', {
      revision,
      resolvedAt: '2026-08-08T20:01:00.000Z',
      stackId: '11111111-1111-4111-8111-111111111111',
      generationId: '22222222-2222-4222-8222-222222222222',
      activationId: null,
      socketPath: '/private/portreeve.sock',
      stack: {
        id: '11111111-1111-4111-8111-111111111111',
        project: 'example',
        stackRoot: '/stack',
        currentRevision: 'c'.repeat(64),
        definition: {
          version: 1,
          project: 'example',
          components: { api: { endpoints: { default: {} } } },
        },
        createdAt: '2026-08-08T20:00:00.000Z',
        updatedAt: '2026-08-08T20:00:00.000Z',
        lastUsedAt: '2026-08-08T20:00:00.000Z',
      },
      environment: { API_PORT: '3000' },
    });
    expect(await store.cached('/stack', revision)).toMatchObject({
      stack: { project: 'example', stackRoot: '/stack' },
      environment: { API_PORT: '3000' },
    });
    expect(await store.cached('/stack', otherRevision)).toBeNull();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await store.remove('/stack');
    expect((await store.read()).launchers).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('refuses unsafe state and concurrent writers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-launcher-state-'));
  const path = join(root, 'launcher-state.json');
  const store = createLauncherLocalStateStore({ path });
  try {
    await writeFile(path, '{"version":1,"launchers":[]}');
    await chmod(path, 0o644);
    await expect(store.read()).rejects.toMatchObject({ code: 'unsafe_launcher_state' });
    await chmod(path, 0o600);
    const lock = await open(`${path}.lock`, 'wx', 0o600);
    try {
      await expect(store.trust('/stack', revision)).rejects.toMatchObject({
        code: 'launcher_state_busy',
      });
    } finally {
      await lock.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovers a stale lock without relying on a stored PID', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-launcher-state-'));
  const path = join(root, 'launcher-state.json');
  const lockPath = `${path}.lock`;
  const store = createLauncherLocalStateStore({
    path,
    now: () => new Date('2026-08-08T20:00:00.000Z'),
  });
  try {
    await writeFile(lockPath, 'abandoned', { mode: 0o600 });
    await utimes(
      lockPath,
      new Date('2026-08-08T19:00:00.000Z'),
      new Date('2026-08-08T19:00:00.000Z'),
    );
    await store.trust('/stack', revision);
    expect(await store.isTrusted('/stack', revision)).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
