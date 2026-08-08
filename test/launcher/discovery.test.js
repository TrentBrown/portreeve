// @ts-check

import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  discoverLauncherCommands,
  environmentName,
  suggestLauncherEnvironment,
} from '../../src/launcher/discovery.js';

test('inspects exact-directory manifests, shows provenance, and leaves ambiguity blank', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-launcher-discovery-'));
  try {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        packageManager: 'bun@1.3.14',
        scripts: { start: 'vite', stop: 'stop' },
      }),
    );
    await writeFile(join(root, 'Makefile'), 'start:\n\ttrue\nstatus:\n\ttrue\n');
    await mkdir(join(root, 'child'));
    await writeFile(join(root, 'child', 'compose.yaml'), 'services: {}\n');
    const result = await discoverLauncherCommands(root);
    expect(result.operations.start.suggestion).toBeNull();
    expect(result.operations.start.candidates).toHaveLength(2);
    expect(result.operations.stop.suggestion).toEqual({
      command: 'bun run stop',
      provenance: { kind: 'package-script', filename: 'package.json', detail: 'stop' },
    });
    expect(result.operations.status.suggestion?.command).toBe('make status');
    expect(result.inspectedFiles.some((filename) => filename.includes('child'))).toBe(
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('suggests deterministic endpoint names and refuses normalized collisions', () => {
  expect(environmentName('web-api', 'default')).toBe('WEB_API_PORT');
  expect(environmentName('api', 'http-public')).toBe('API_HTTP_PUBLIC_PORT');
  expect(
    suggestLauncherEnvironment({
      version: 1,
      project: 'example',
      components: {
        api: { endpoints: { default: {}, internal: { publish: false } } },
      },
    }),
  ).toEqual([
    {
      name: 'API_PORT',
      endpoint: { component: 'api', endpoint: 'default' },
      value: 'host-port',
    },
  ]);
  expect(() =>
    suggestLauncherEnvironment({
      version: 1,
      project: 'example',
      components: {
        'web-api': { endpoints: { default: {} } },
        web_api: { endpoints: { default: {} } },
      },
    }),
  ).toThrow('collide');
});
