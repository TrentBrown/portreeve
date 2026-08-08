// @ts-check

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { DesktopUpdateManifestSchema } from '../../apps/desktop/shared/schemas.js';
import {
  createUpdateAdapter,
  DESKTOP_DOWNLOAD_PAGE_URL,
  DESKTOP_UPDATE_MANIFEST_URL,
  UPDATE_CHECK_INTERVAL_MILLISECONDS,
} from '../../apps/desktop/main/update.js';
import { compareSemanticVersions } from '../../src/domain/semantic-version.js';
import { timestamp } from './fixtures.js';

test('ships a strict update manifest matching the public contract', async () => {
  expect(
    DesktopUpdateManifestSchema.parse(
      JSON.parse(await readFile('distribution/desktop-update.json', 'utf8')),
    ),
  ).toEqual({ schemaVersion: 1, desktopVersion: '0.1.0' });
  expect(() =>
    DesktopUpdateManifestSchema.parse({
      schemaVersion: 1,
      desktopVersion: '0.1.0',
      downloadUrl: 'https://example.com/untrusted',
    }),
  ).toThrow();
});

test('checks the fixed identifier-free manifest and persists a private result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-update-'));
  const statePath = join(root, 'state', 'update-state.json');
  /** @type {Array<{url: string, init: RequestInit|undefined}>} */
  const requests = [];
  /** @type {string[]} */
  const opened = [];
  /** @param {string|URL|Request} input @param {RequestInit} [init] */
  const fetchImplementation = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({ schemaVersion: 1, desktopVersion: '0.2.0' }), {
      status: 200,
    });
  };
  try {
    const adapter = createUpdateAdapter({
      desktopVersion: '0.1.0',
      statePath,
      fetch: fetchImplementation,
      now: () => new Date(timestamp),
      async openExternal(url) {
        opened.push(url);
      },
    });

    expect(await adapter.check()).toEqual({
      status: 'available',
      checkedAt: timestamp,
      latestVersion: '0.2.0',
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(DESKTOP_UPDATE_MANIFEST_URL);
    expect(new URL(requests[0]?.url ?? '').search).toBe('');
    expect(requests[0]?.init).toMatchObject({
      method: 'GET',
      body: null,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { accept: 'application/json' },
    });
    expect(await adapter.openDownloadPage()).toEqual({
      schemaVersion: 1,
      opened: true,
    });
    expect(opened).toEqual([DESKTOP_DOWNLOAD_PAGE_URL]);

    expect(JSON.parse(await readFile(statePath, 'utf8'))).toEqual({
      status: 'available',
      checkedAt: timestamp,
      latestVersion: '0.2.0',
    });
    expect((await stat(statePath)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reuses every cached attempt for 24 hours and checks again at the boundary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-update-cache-'));
  const statePath = join(root, 'update-state.json');
  let requests = 0;
  let currentTime = new Date(timestamp);
  const fetchImplementation = async () => {
    requests += 1;
    return new Response(JSON.stringify({ schemaVersion: 1, desktopVersion: '0.1.0' }));
  };
  const options = {
    desktopVersion: '0.1.0',
    statePath,
    fetch: fetchImplementation,
    now: () => currentTime,
    openExternal: async () => {},
  };
  try {
    expect((await createUpdateAdapter(options).check()).status).toBe('current');
    expect(requests).toBe(1);

    currentTime = new Date(
      new Date(timestamp).getTime() + UPDATE_CHECK_INTERVAL_MILLISECONDS - 1,
    );
    expect((await createUpdateAdapter(options).check()).status).toBe('current');
    expect(requests).toBe(1);

    currentTime = new Date(
      new Date(timestamp).getTime() + UPDATE_CHECK_INTERVAL_MILLISECONDS,
    );
    expect((await createUpdateAdapter(options).check()).status).toBe('current');
    expect(requests).toBe(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('throttles malformed and unavailable responses without exposing an error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-update-error-'));
  const statePath = join(root, 'update-state.json');
  let requests = 0;
  const options = {
    desktopVersion: '0.1.0',
    statePath,
    fetch: async () => {
      requests += 1;
      return new Response('{"schemaVersion":1,"desktopVersion":"invalid"}');
    },
    now: () => new Date(timestamp),
    openExternal: async () => {},
  };
  try {
    expect(await createUpdateAdapter(options).check()).toEqual({
      status: 'unavailable',
      checkedAt: timestamp,
      latestVersion: null,
    });
    expect((await createUpdateAdapter(options).check()).status).toBe('unavailable');
    expect(requests).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('bounds a hanging update request and reduces it to unavailable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-update-timeout-'));
  const statePath = join(root, 'update-state.json');
  try {
    const adapter = createUpdateAdapter({
      desktopVersion: '0.1.0',
      statePath,
      fetch: async (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
      now: () => new Date(timestamp),
      openExternal: async () => {},
      requestTimeoutMilliseconds: 5,
    });
    expect((await adapter.check()).status).toBe('unavailable');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects an oversized streamed manifest before buffering the remainder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-update-size-'));
  const statePath = join(root, 'update-state.json');
  let chunks = 0;
  let canceled = false;
  try {
    const adapter = createUpdateAdapter({
      desktopVersion: '0.1.0',
      statePath,
      fetch: async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              chunks += 1;
              controller.enqueue(new Uint8Array(9_000));
              if (chunks === 10) controller.close();
            },
            cancel() {
              canceled = true;
            },
          }),
        ),
      now: () => new Date(timestamp),
      openExternal: async () => {},
    });
    expect((await adapter.check()).status).toBe('unavailable');
    expect(chunks).toBeGreaterThanOrEqual(2);
    expect(canceled).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovers from invalid persisted state and refuses navigation without an update', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-update-invalid-'));
  const statePath = join(root, 'update-state.json');
  await writeFile(statePath, '{"private":"unexpected"}\n');
  let opened = false;
  try {
    const adapter = createUpdateAdapter({
      desktopVersion: '0.2.0',
      statePath,
      fetch: async () =>
        new Response(JSON.stringify({ schemaVersion: 1, desktopVersion: '0.1.0' })),
      now: () => new Date(timestamp),
      async openExternal() {
        opened = true;
      },
    });
    expect((await adapter.check()).status).toBe('current');
    await expect(adapter.openDownloadPage()).rejects.toMatchObject({
      code: 'desktop_update_not_available',
    });
    expect(opened).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('compares semantic versions including prerelease and build metadata', () => {
  expect(compareSemanticVersions('0.2.0', '0.1.9')).toBe(1);
  expect(compareSemanticVersions('1.0.0-rc.10', '1.0.0-rc.2')).toBe(1);
  expect(compareSemanticVersions('1.0.0-rc.2', '1.0.0')).toBe(-1);
  expect(compareSemanticVersions('1.0.0+build.2', '1.0.0+build.1')).toBe(0);
});
