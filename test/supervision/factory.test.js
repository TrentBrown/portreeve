// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLifecycleManager } from '../../src/supervision/factory.js';

/**
 * @param {Parameters<typeof createLifecycleManager>[0]} options
 */
async function withHome(options) {
  const home = await mkdtemp(join(tmpdir(), 'portreeve-factory-'));
  const manager = createLifecycleManager({
    ...options,
    environment: {
      HOME: home,
      XDG_CONFIG_HOME: join(home, '.config'),
      ...options?.environment,
    },
  });
  return {
    home,
    manager,
    async cleanup() {
      await rm(home, { force: true, recursive: true });
    },
  };
}

test('selects launchd with the per-user agent definition on macOS', async () => {
  const { home, manager, cleanup } = await withHome({ platform: 'darwin' });
  try {
    expect(manager.supervisor.kind).toBe('launchd');
    expect(manager.supervisor.definitionPath).toBe(
      join(home, 'Library', 'LaunchAgents', 'com.portreeve.server.plist'),
    );
  } finally {
    await cleanup();
  }
});

test('selects systemd with the XDG user unit definition on Linux', async () => {
  const { home, manager, cleanup } = await withHome({ platform: 'linux' });
  try {
    expect(manager.supervisor.kind).toBe('systemd-user');
    expect(manager.supervisor.definitionPath).toBe(
      join(home, '.config', 'systemd', 'user', 'portreeve.service'),
    );
  } finally {
    await cleanup();
  }
});

test('honors explicit supervisor definition and label overrides', async () => {
  const launchd = await withHome({
    platform: 'darwin',
    environment: {
      PORTREEVE_SUPERVISOR_DEFINITION: '/tmp/portreeve-agent.plist',
      PORTREEVE_SUPERVISOR_LABEL: 'com.example.portreeve',
    },
  });
  const systemd = await withHome({
    platform: 'linux',
    environment: {
      PORTREEVE_SUPERVISOR_DEFINITION: '/tmp/portreeve-unit.service',
      PORTREEVE_SUPERVISOR_UNIT: 'example-portreeve.service',
    },
  });
  try {
    expect(launchd.manager.supervisor.definitionPath).toBe(
      '/tmp/portreeve-agent.plist',
    );
    expect(launchd.manager.supervisor.renderDefinition).toBeInstanceOf(Function);
    expect(systemd.manager.supervisor.definitionPath).toBe(
      '/tmp/portreeve-unit.service',
    );
  } finally {
    await launchd.cleanup();
    await systemd.cleanup();
  }
});

test('routes home and socket overrides into the resolved runtime paths', async () => {
  const home = await mkdtemp(join(tmpdir(), 'portreeve-factory-home-'));
  const socket = join(home, 'custom.sock');
  try {
    const manager = createLifecycleManager({
      home,
      socket,
      platform: 'linux',
      environment: { HOME: home },
      sourceExecutable: '/usr/local/bin/portreeve',
    });

    expect(manager.paths.applicationDirectory).toBe(home);
    expect(manager.paths.socketPath).toBe(socket);
    expect(manager.sourceExecutable).toBe('/usr/local/bin/portreeve');
    expect(manager.client.socketPath).toBe(socket);
  } finally {
    await rm(home, { force: true, recursive: true });
  }
});

test('reports an uninstalled unsupported supervisor and refuses every mutation', async () => {
  const { manager, cleanup } = await withHome({ platform: 'win32' });
  const supervisor = manager.supervisor;
  try {
    expect(supervisor.kind).toBe('unsupported:win32');
    expect(supervisor.definitionPath).toBe('');
    expect(await supervisor.state()).toEqual({
      kind: 'unsupported:win32',
      installed: false,
      active: false,
      mainPid: null,
    });

    const message =
      'Native Portreeve supervision is not supported on win32. Use "portreeve serve" in the foreground.';
    expect(() =>
      supervisor.renderDefinition({
        executable: '/tmp/portreeve',
        applicationDirectory: '/tmp',
        socketPath: '/tmp/portreeve.sock',
        standardOutputPath: '/tmp/out.log',
        standardErrorPath: '/tmp/error.log',
      }),
    ).toThrow(message);
    await expect(supervisor.installDefinition('content')).rejects.toThrow(message);
    await expect(supervisor.start()).rejects.toThrow(message);
    await expect(supervisor.stop()).rejects.toThrow(message);
    await expect(supervisor.uninstall()).rejects.toThrow(message);
  } finally {
    await cleanup();
  }
});
