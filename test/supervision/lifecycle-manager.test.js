// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PortreeveClientError } from '../../packages/client/src/index.js';
import {
  LifecycleConflictError,
  LifecycleManager,
} from '../../src/supervision/manager.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('lifecycle manager', () => {
  test('installs idempotently and preserves inactive state during upgrades', async () => {
    const fixture = await createFixture('1.0.0');
    expect(await fixture.manager.install()).toMatchObject({
      installed: true,
      upgraded: false,
      active: false,
      version: '1.0.0',
    });
    expect(fixture.supervisor.active).toBe(false);

    await writeExecutable(fixture.source, '2.0.0');
    expect(await fixture.manager.install()).toMatchObject({
      upgraded: true,
      active: false,
      version: '2.0.0',
    });
    expect(fixture.supervisor.startCount).toBe(0);
    expect(await readFile(fixture.paths.managedExecutablePath, 'utf8')).toContain(
      '2.0.0',
    );
  });

  test('health-checks an active upgrade and rolls back failed activation', async () => {
    const fixture = await createFixture('1.0.0');
    await fixture.manager.install();
    await fixture.manager.start();
    expect(fixture.supervisor.active).toBe(true);

    await writeExecutable(fixture.source, '2.0.0');
    fixture.client.rejectedVersion = '2.0.0';
    await expect(fixture.manager.install()).rejects.toThrow(
      'prior installation was restored',
    );
    expect(fixture.supervisor.active).toBe(true);
    expect(await readFile(fixture.paths.managedExecutablePath, 'utf8')).toContain(
      '1.0.0',
    );
  });

  test('reports rollback failures instead of claiming a restored installation', async () => {
    const fixture = await createFixture('1.0.0');
    await fixture.manager.install();
    await fixture.manager.start();

    await writeExecutable(fixture.source, '2.0.0');
    fixture.client.rejectedVersion = '2.0.0';
    fixture.supervisor.startFailure = new Error('systemctl start refused');

    await expect(fixture.manager.install()).rejects.toThrow(
      /prior installation was not fully restored \(restarting the previous supervised service failed: systemctl start refused/u,
    );
  });

  test('health-checks a successful active upgrade and keeps supervision active', async () => {
    const fixture = await createFixture('1.0.0');
    await fixture.manager.install();
    await fixture.manager.start();

    await writeExecutable(fixture.source, '2.0.0');
    expect(await fixture.manager.install()).toMatchObject({
      upgraded: true,
      active: true,
      version: '2.0.0',
    });
    expect(fixture.supervisor.active).toBe(true);
    expect(fixture.supervisor.startCount).toBe(2);
  });

  test('refuses to adopt or implicitly stop a manual server', async () => {
    const fixture = await createFixture('1.0.0');
    fixture.client.manual = true;
    await expect(fixture.manager.install()).rejects.toBeInstanceOf(
      LifecycleConflictError,
    );
    await expect(fixture.manager.stop()).rejects.toBeInstanceOf(LifecycleConflictError);

    expect(await fixture.manager.stopManual()).toEqual({
      changed: true,
      mode: 'manual',
    });
    expect(fixture.client.manual).toBe(false);
    expect(fixture.client.stopCount).toBe(1);
  });

  test('uninstall removes integration and binaries but preserves registry data', async () => {
    const fixture = await createFixture('1.0.0');
    await fixture.manager.install();
    await writeFile(fixture.paths.databasePath, 'claims');

    expect(await fixture.manager.uninstall()).toMatchObject({
      installed: false,
      active: false,
      dataPreserved: true,
    });
    expect(await readFile(fixture.paths.databasePath, 'utf8')).toBe('claims');
    expect(fixture.supervisor.installed).toBe(false);
    expect(await fixture.manager.uninstall()).toMatchObject({
      installed: false,
      active: false,
    });
  });

  test('rejects native lifecycle mutation as root', async () => {
    const fixture = await createFixture('1.0.0', 0);
    await expect(fixture.manager.install()).rejects.toThrow('not as root');
  });

  test('rejects executables writable by another user', async () => {
    const unsafeSource = await createFixture('1.0.0');
    await chmod(unsafeSource.source, 0o722);
    await expect(unsafeSource.manager.install()).rejects.toThrow(
      'writable by another user',
    );

    const unsafeManaged = await createFixture('1.0.0');
    await unsafeManaged.manager.install();
    await chmod(unsafeManaged.paths.managedExecutablePath, 0o722);
    await expect(unsafeManaged.manager.install()).rejects.toThrow(
      'installation is unsafe or unreadable',
    );
  });

  test('returns independently layered status for absent, manual, and supervised states', async () => {
    const fixture = await createFixture('1.0.0');
    expect(await fixture.manager.status()).toMatchObject({
      installation: {
        state: 'absent',
        version: null,
      },
      supervisor: {
        kind: 'fake-user',
        state: 'unavailable',
        mainPid: null,
      },
      socket: {
        state: 'unavailable',
        server: null,
      },
      mode: 'none',
      versions: {
        cli: '0.1.0',
        managed: null,
        running: null,
      },
    });

    fixture.client.manual = true;
    expect(await fixture.manager.status()).toMatchObject({
      socket: {
        state: 'healthy',
        server: { mode: 'manual', pid: 9000 },
      },
      mode: 'manual',
      versions: { running: '9.9.9' },
    });
    fixture.client.manual = false;

    await fixture.manager.install();
    await fixture.manager.start();
    expect(await fixture.manager.status()).toMatchObject({
      installation: {
        state: 'installed',
        version: '1.0.0',
      },
      supervisor: {
        state: 'active',
        mainPid: 4242,
      },
      socket: {
        state: 'healthy',
        server: { mode: 'supervised', pid: 4242 },
      },
      mode: 'supervised',
      versions: {
        managed: '1.0.0',
        running: '1.0.0',
      },
      limitations: [],
    });
  });

  test('keeps invalid and incompatible layers inside status snapshots', async () => {
    const fixture = await createFixture('1.0.0');
    await fixture.manager.install();
    await chmod(fixture.paths.managedExecutablePath, 0o722);
    fixture.client.incompatible = true;

    expect(await fixture.manager.status()).toMatchObject({
      installation: {
        state: 'invalid',
        version: null,
        error: { code: 'internal' },
      },
      socket: {
        state: 'incompatible',
        server: null,
        error: { code: 'incompatible_protocol' },
      },
      limitations: ['managed-installation-evidence-incomplete'],
    });
  });

  test('refuses to replace a newer managed executable', async () => {
    const fixture = await createFixture('2.0.0');
    await fixture.manager.install();
    await writeExecutable(fixture.source, '1.9.9');

    await expect(fixture.manager.install()).rejects.toThrow(
      'will not replace newer Portreeve 2.0.0',
    );
    expect(await readFile(fixture.paths.managedExecutablePath, 'utf8')).toContain(
      '2.0.0',
    );
  });

  test('stopping supervision prevents automatic restart', async () => {
    const fixture = await createFixture('1.0.0');
    await fixture.manager.install();
    await fixture.manager.start();

    expect(await fixture.manager.stop()).toEqual({
      changed: true,
      mode: 'supervised',
    });
    expect(fixture.supervisor.active).toBe(false);
    await expect(fixture.client.health()).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  test('stops a known active supervisor even when its socket is unavailable', async () => {
    const fixture = await createFixture('1.0.0');
    await fixture.manager.install();
    await fixture.manager.start();
    fixture.client.unavailable = true;

    expect(await fixture.manager.status()).toMatchObject({
      supervisor: { state: 'active' },
      socket: { state: 'unavailable' },
      mode: 'ambiguous',
    });
    expect(await fixture.manager.stop()).toEqual({
      changed: true,
      mode: 'supervised',
    });
    expect(fixture.supervisor.active).toBe(false);
  });
});

/**
 * @param {string} version
 * @param {number} [uid]
 */
async function createFixture(
  version,
  uid = typeof process.getuid === 'function' ? process.getuid() : 501,
) {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-lifecycle-'));
  directories.push(directory);
  const source = join(directory, 'portreeve-source');
  await writeExecutable(source, version);
  const paths = {
    applicationDirectory: join(directory, 'data'),
    socketPath: join(directory, 'data', 'portreeve.sock'),
    managedExecutablePath: join(directory, 'data', 'bin', 'portreeve'),
    rollbackExecutablePath: join(directory, 'data', 'bin', 'portreeve.previous'),
    supervisorStandardOutputPath: join(directory, 'data', 'stdout.log'),
    supervisorStandardErrorPath: join(directory, 'data', 'stderr.log'),
    databasePath: join(directory, 'data', 'registry.sqlite'),
  };
  const supervisor = new FakeSupervisor(join(directory, 'native.service'));
  const client = new FakeClient(supervisor, paths.managedExecutablePath);
  /** @type {(executable: string, args: string[]) => Promise<{code: number, stdout: string, stderr: string}>} */
  const runner = async (executable, args) => {
    expect(args).toEqual(['--version']);
    return {
      code: 0,
      stdout: versionFromContent(await readFile(executable, 'utf8')),
      stderr: '',
    };
  };
  const manager = new LifecycleManager({
    supervisor,
    paths,
    sourceExecutable: source,
    client: /** @type {any} */ (client),
    uid,
    runner,
    healthTimeoutMilliseconds: 200,
  });
  return { manager, supervisor, client, source, paths };
}

class FakeSupervisor {
  /** @param {string} definitionPath */
  constructor(definitionPath) {
    this.kind = 'fake-user';
    this.definitionPath = definitionPath;
    this.installed = false;
    this.active = false;
    this.startCount = 0;
    /** @type {Error | null} */
    this.startFailure = null;
  }

  state() {
    return Promise.resolve({
      kind: this.kind,
      installed: this.installed,
      active: this.active,
      mainPid: this.active ? 4242 : null,
    });
  }

  /** @param {import('../../src/supervision/types.js').SupervisorDefinition} value */
  renderDefinition(value) {
    return JSON.stringify(value);
  }

  /** @param {string} content */
  async installDefinition(content) {
    await writeFile(this.definitionPath, content);
    this.installed = true;
  }

  start() {
    if (this.startFailure !== null) {
      return Promise.reject(this.startFailure);
    }
    this.active = true;
    this.startCount += 1;
    return Promise.resolve();
  }

  stop() {
    this.active = false;
    return Promise.resolve();
  }

  async uninstall() {
    this.active = false;
    this.installed = false;
    await rm(this.definitionPath, { force: true });
  }
}

class FakeClient {
  /**
   * @param {FakeSupervisor} supervisor
   * @param {string} managedExecutable
   */
  constructor(supervisor, managedExecutable) {
    this.supervisor = supervisor;
    this.managedExecutable = managedExecutable;
    this.manual = false;
    this.incompatible = false;
    this.unavailable = false;
    /** @type {string | null} */
    this.rejectedVersion = null;
    this.stopCount = 0;
  }

  async health() {
    if (this.unavailable) {
      throw unavailable();
    }
    if (this.incompatible) {
      throw new PortreeveClientError('incompatible', {
        code: 'incompatible_protocol',
      });
    }
    if (this.manual) {
      return health('9.9.9', 'manual', 9000);
    }
    if (!this.supervisor.active) {
      throw unavailable();
    }
    const current = versionFromContent(await readFile(this.managedExecutable, 'utf8'));
    return health(
      this.rejectedVersion === current ? '0.1.0-broken' : current,
      'supervised',
      4242,
    );
  }

  stopServer() {
    this.manual = false;
    this.stopCount += 1;
    return Promise.resolve({ changed: true, at: new Date().toISOString() });
  }
}

/** @param {string} path @param {string} version */
async function writeExecutable(path, version) {
  await writeFile(path, `#!/bin/sh\n# VERSION=${version}\n`);
  await chmod(path, 0o700);
}

/** @param {string} content */
function versionFromContent(content) {
  return content.match(/VERSION=([^\n]+)/)?.[1] ?? 'unknown';
}

/** @param {string} version @param {'manual' | 'supervised'} mode @param {number} pid */
function health(version, mode, pid) {
  return {
    softwareVersion: version,
    protocol: { minimum: 1, maximum: 1 },
    capabilities: [],
    mode,
    pid,
  };
}

function unavailable() {
  return new PortreeveClientError('unavailable', { code: 'unavailable' });
}
