// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PortreeveClientError,
  readEndpointSnapshot,
  writeEndpointSnapshot,
} from '../../packages/client/src/index.js';

const originalSnapshotPath = process.env.PORTREEVE_ENDPOINTS_FILE;

afterEach(() => {
  if (originalSnapshotPath === undefined) {
    delete process.env.PORTREEVE_ENDPOINTS_FILE;
  } else {
    process.env.PORTREEVE_ENDPOINTS_FILE = originalSnapshotPath;
  }
});

/** @returns {import('../../packages/client/src/index.js').StackEndpointSnapshot} */
function snapshot(generationId = '11111111-1111-4111-8111-111111111111') {
  return {
    schemaVersion: 1,
    definitionRevision: 'a'.repeat(64),
    generationId,
    activationId: '22222222-2222-4222-8222-222222222222',
    component: 'website',
    own: {
      http: {
        component: 'website',
        endpoint: 'http',
        address: { transport: 'tcp', host: 'host.docker.internal', port: 43102 },
      },
    },
    dependencies: {
      backend: {
        component: 'api',
        endpoint: 'http',
        address: { transport: 'tcp', host: 'host.docker.internal', port: 43100 },
      },
    },
  };
}

test('atomically writes private snapshots and reads explicit or conventional paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-discovery-reader-'));
  try {
    const filename = join(directory, 'nested', 'endpoints.json');
    expect(await writeEndpointSnapshot(filename, snapshot())).toBe(filename);
    expect((await stat(filename)).mode & 0o777).toBe(0o600);
    expect(await readdir(join(directory, 'nested'))).toEqual(['endpoints.json']);
    expect(await readEndpointSnapshot(filename)).toEqual(snapshot());

    process.env.PORTREEVE_ENDPOINTS_FILE = filename;
    expect(await readEndpointSnapshot(undefined, { component: 'website' })).toEqual(
      snapshot(),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('replaces snapshots and rejects stale expected identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-discovery-stale-'));
  try {
    const filename = join(directory, 'endpoints.json');
    const first = snapshot();
    const second = snapshot('33333333-3333-4333-8333-333333333333');
    await writeEndpointSnapshot(filename, first);
    await writeEndpointSnapshot(filename, second);
    await expect(
      readEndpointSnapshot(filename, { generationId: first.generationId }),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      details: { reason: 'stale_snapshot', field: 'generationId' },
    });
    expect(await readEndpointSnapshot(filename)).toEqual(second);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('strictly rejects unknown fields and oversized or missing documents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-discovery-invalid-'));
  try {
    const filename = join(directory, 'endpoints.json');
    await writeFile(filename, JSON.stringify({ ...snapshot(), leaseToken: 'secret' }));
    await expect(readEndpointSnapshot(filename)).rejects.toBeInstanceOf(
      PortreeveClientError,
    );
    await writeFile(filename, Buffer.alloc(1024 * 1024 + 1));
    await expect(readEndpointSnapshot(filename)).rejects.toThrow('exceeds the 1 MiB');
    delete process.env.PORTREEVE_ENDPOINTS_FILE;
    await expect(readEndpointSnapshot()).rejects.toThrow(
      'PORTREEVE_ENDPOINTS_FILE is unset',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
