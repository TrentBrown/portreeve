// @ts-check

import { afterEach, expect, test } from 'bun:test';
import {
  access,
  chmod,
  mkdtemp,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { OWNERSHIP_MARKER_FILENAME } from '../../src/platform/ownership.js';
import { executePurge, previewPurge } from '../../src/supervision/purge.js';

const directories = new Set();

afterEach(async () => {
  await Promise.all(
    [...directories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  directories.clear();
});

test('previews and deletes only a marker-bound private application home', async () => {
  const fixture = await createFixture();
  const stateFile = join(fixture.root, 'registry.sqlite');
  await writeFile(stateFile, 'state', { mode: 0o600 });
  const preview = await previewPurge(fixture.manager);

  expect(preview).toMatchObject({
    operation: 'purge',
    dryRun: true,
    allowed: true,
    refused: [],
  });
  expect(preview.paths.map(({ path }) => path)).toContain(
    join(preview.root, 'registry.sqlite'),
  );

  const result = await executePurge(fixture.manager, preview.confirmationToken);
  expect(result).toMatchObject({
    operation: 'purge',
    outcome: 'succeeded',
    confirmationToken: preview.confirmationToken,
    retained: [],
    refused: [],
    error: null,
  });
  expect(result.removed).toContain(preview.root);
  await expect(access(fixture.root)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('refuses execution when filesystem evidence changed after preview', async () => {
  const fixture = await createFixture();
  const preview = await previewPurge(fixture.manager);
  const changedPath = join(fixture.root, 'changed-after-preview');
  await writeFile(changedPath, 'changed', { mode: 0o600 });

  const result = await executePurge(fixture.manager, preview.confirmationToken);
  expect(result).toMatchObject({
    outcome: 'refused',
    removed: [],
    refused: [{ path: preview.root, reason: 'preview-evidence-changed' }],
  });
  await access(fixture.root);
});

test('refuses symlinks and live manual-server evidence', async () => {
  const symlinkFixture = await createFixture();
  const target = join(await temporaryDirectory(), 'target');
  await writeFile(target, 'external');
  await symlink(target, join(symlinkFixture.root, 'unsafe-link'));
  const symlinkPreview = await previewPurge(symlinkFixture.manager);
  expect(symlinkPreview).toMatchObject({
    allowed: false,
    refused: [
      {
        path: join(symlinkPreview.root, 'unsafe-link'),
        reason: 'symlink-in-deletion-tree',
      },
    ],
  });

  const manualFixture = await createFixture('manual');
  expect(await previewPurge(manualFixture.manager)).toMatchObject({
    allowed: false,
    refused: [
      {
        path: join(manualFixture.root, 'portreeve.sock'),
        reason: 'manual-server-running',
      },
    ],
  });
});

test('returns structured refusal when the ownership marker is missing', async () => {
  const fixture = await createFixture();
  await unlink(join(fixture.root, OWNERSHIP_MARKER_FILENAME));

  const preview = await previewPurge(fixture.manager);
  expect(preview).toMatchObject({
    allowed: false,
    marker: null,
    refused: [
      {
        path: join(preview.root, OWNERSHIP_MARKER_FILENAME),
      },
    ],
  });
  expect(preview.refused[0]?.reason).toContain('ownership-marker-invalid');
});

test('reports supervisor cleanup failure as partial without deleting data', async () => {
  const fixture = await createFixture();
  const manager = /** @type {any} */ (fixture.manager);
  const definitionPath = manager.supervisor.definitionPath;
  await writeFile(definitionPath, 'definition', { mode: 0o600 });
  manager.status = () => {
    const value = status(fixture.root, join(fixture.root, 'portreeve.sock'), 'none');
    return Promise.resolve({
      ...value,
      supervisor: {
        kind: 'launchd',
        state: /** @type {'inactive'} */ ('inactive'),
        mainPid: null,
        error: null,
      },
    });
  };
  manager.supervisor.uninstall = () =>
    Promise.reject(new Error('Native uninstall failed.'));
  const preview = await previewPurge(manager);

  const result = await executePurge(manager, preview.confirmationToken);
  expect(result).toMatchObject({
    outcome: 'partial',
    removed: [],
    error: { code: 'internal', message: 'Native uninstall failed.' },
  });
  await access(fixture.root);
});

/**
 * @param {'none' | 'manual'} [mode]
 */
async function createFixture(mode = 'none') {
  const root = await temporaryDirectory();
  await chmod(root, 0o700);
  const socketPath = join(root, 'portreeve.sock');
  await prepareRuntimeDirectories({
    applicationDirectory: root,
    socketPath,
  });
  const definitionPath = join(await temporaryDirectory(), 'portreeve.plist');
  const manager = {
    paths: { applicationDirectory: root },
    supervisor: {
      kind: 'launchd',
      definitionPath,
      renderDefinition() {
        return '';
      },
      state() {
        return Promise.resolve({
          kind: 'launchd',
          installed: false,
          active: false,
          mainPid: null,
        });
      },
      installDefinition() {
        return Promise.resolve();
      },
      start() {
        return Promise.resolve();
      },
      stop() {
        return Promise.resolve();
      },
      uninstall() {
        return Promise.resolve();
      },
    },
    uid: typeof process.getuid === 'function' ? process.getuid() : 501,
    status() {
      return Promise.resolve(status(root, socketPath, mode));
    },
    waitUntilUnavailable() {
      return Promise.resolve();
    },
  };
  return { root, manager };
}

/**
 * @param {string} root
 * @param {string} socketPath
 * @param {'none' | 'manual'} mode
 */
function status(root, socketPath, mode) {
  const manual = mode === 'manual';
  return {
    observedAt: '2026-07-30T23:00:00.000Z',
    installation: {
      state: /** @type {'absent'} */ ('absent'),
      managedExecutablePath: join(root, 'bin', 'portreeve'),
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
      path: socketPath,
      state: /** @type {'unavailable' | 'healthy'} */ (
        manual ? 'healthy' : 'unavailable'
      ),
      server: manual
        ? {
            softwareVersion: '0.1.0',
            protocol: { minimum: 1, maximum: 1 },
            capabilities: [],
            pid: 4242,
            mode: /** @type {'manual'} */ ('manual'),
          }
        : null,
      error: manual ? null : { code: 'unavailable', message: 'Socket is unavailable.' },
    },
    mode,
    versions: {
      cli: '0.1.0',
      managed: null,
      running: manual ? '0.1.0' : null,
    },
    limitations: [],
  };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-purge-'));
  directories.add(directory);
  return directory;
}
