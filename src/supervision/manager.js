// @ts-check

import { lstat, realpath, unlink } from 'node:fs/promises';
import {
  PortreeveClient,
  PortreeveClientError,
} from '../../packages/client/src/index.js';
import { prepareRuntimeDirectories } from '../platform/paths.js';
import { runCommand, assertCommandSucceeded } from './command.js';
import { promoteExecutable, readOptionalFile, restoreExecutable } from './files.js';

export class LifecycleConflictError extends PortreeveClientError {
  /** @param {string} message */
  constructor(message) {
    super(message, { code: 'conflict' });
    this.name = 'LifecycleConflictError';
  }
}

export class LifecycleManager {
  /**
   * @param {{
   *   supervisor: import('./types.js').Supervisor,
   *   paths: {
   *     applicationDirectory: string,
   *     socketPath: string,
   *     managedExecutablePath: string,
   *     rollbackExecutablePath: string,
   *     supervisorStandardOutputPath: string,
   *     supervisorStandardErrorPath: string
   *   },
   *   sourceExecutable: string,
   *   client?: PortreeveClient,
   *   uid?: number,
   *   runner?: typeof runCommand,
   *   healthTimeoutMilliseconds?: number
   * }} options
   */
  constructor(options) {
    this.supervisor = options.supervisor;
    this.paths = options.paths;
    this.sourceExecutable = options.sourceExecutable;
    this.client =
      options.client ?? new PortreeveClient({ socketPath: options.paths.socketPath });
    this.uid =
      options.uid ??
      (typeof process.getuid === 'function' ? process.getuid() : undefined);
    this.runner = options.runner ?? runCommand;
    this.healthTimeoutMilliseconds = options.healthTimeoutMilliseconds ?? 10_000;
  }

  async status() {
    const native = await this.supervisor.state();
    let health = null;
    try {
      health = await this.client.health();
    } catch (error) {
      if (!(error instanceof PortreeveClientError) || error.code !== 'unavailable') {
        throw error;
      }
    }
    const supervised =
      health !== null &&
      health.mode === 'supervised' &&
      native.active &&
      native.mainPid !== null &&
      health.pid === native.mainPid;
    return {
      running: health !== null,
      socketPath: this.paths.socketPath,
      mode: health === null ? null : supervised ? 'supervised' : 'manual',
      server: health,
      native,
    };
  }

  async install() {
    this.assertPerUser();
    const priorStatus = await this.status();
    if (priorStatus.running && priorStatus.mode === 'manual') {
      throw new LifecycleConflictError(
        'A manual Portreeve server is running. Stop it before installing or upgrading the supervised service.',
      );
    }

    await prepareRuntimeDirectories(this.paths);
    const source = await validateSourceExecutable(this.sourceExecutable);
    await validateManagedExecutable(this.paths.managedExecutablePath, this.uid);
    const version = await executableVersion(source, this.runner);
    const priorDefinition = await readOptionalFile(this.supervisor.definitionPath);
    const priorState = priorStatus.native;
    /** @type {{hadPrevious: boolean} | null} */
    let promotion = null;

    try {
      if (priorState.active) {
        await this.supervisor.stop();
        await this.waitUntilUnavailable();
      }
      promotion = await promoteExecutable(
        source,
        this.paths.managedExecutablePath,
        this.paths.rollbackExecutablePath,
      );
      const definition = this.supervisor.renderDefinition(this.definition());
      await this.supervisor.installDefinition(definition);
      if (priorState.active) {
        await this.supervisor.start();
        await this.waitUntilHealthy(version);
      }
      return {
        installed: true,
        upgraded: promotion.hadPrevious,
        active: priorState.active,
        version,
        executable: this.paths.managedExecutablePath,
        supervisor: this.supervisor.kind,
      };
    } catch (error) {
      await this.supervisor.stop().catch(() => {});
      if (promotion !== null) {
        await restoreExecutable(
          this.paths.managedExecutablePath,
          this.paths.rollbackExecutablePath,
          promotion.hadPrevious,
        );
      }
      if (priorDefinition === null) {
        await this.supervisor.uninstall().catch(() => {});
      } else {
        await this.supervisor.installDefinition(priorDefinition);
      }
      if (priorState.active) {
        await this.supervisor.start();
        await this.waitUntilHealthy().catch(() => {});
      }
      throw new Error(
        `Portreeve upgrade activation failed and the prior installation was restored: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }

  async uninstall() {
    this.assertPerUser();
    const status = await this.status();
    if (status.native.active) {
      await this.supervisor.stop();
      if (status.mode === 'supervised') {
        await this.waitUntilUnavailable();
      }
    }
    await this.supervisor.uninstall();
    await unlink(this.paths.managedExecutablePath).catch(ignoreMissing);
    await unlink(this.paths.rollbackExecutablePath).catch(ignoreMissing);
    return {
      installed: false,
      active: false,
      dataPreserved: true,
      supervisor: this.supervisor.kind,
    };
  }

  async start() {
    this.assertPerUser();
    const status = await this.status();
    if (!status.native.installed) {
      throw new LifecycleConflictError(
        'Portreeve is not installed for native supervision. Run "portreeve install" first.',
      );
    }
    if (status.running && status.mode === 'manual') {
      throw new LifecycleConflictError(
        'A manual Portreeve server is already running. Stop it before starting the supervised service.',
      );
    }
    if (!status.native.active) {
      await this.supervisor.start();
    }
    return this.waitUntilHealthy();
  }

  async restart() {
    this.assertPerUser();
    const status = await this.status();
    if (!status.native.installed) {
      throw new LifecycleConflictError(
        'Portreeve is not installed for native supervision. Run "portreeve install" first.',
      );
    }
    if (status.running && status.mode === 'manual') {
      throw new LifecycleConflictError(
        'A manual Portreeve server is running. Portreeve will not adopt or replace it.',
      );
    }
    if (status.native.active) {
      await this.supervisor.stop();
      await this.waitUntilUnavailable();
    }
    await this.supervisor.start();
    return this.waitUntilHealthy();
  }

  async stop() {
    this.assertPerUser();
    const status = await this.status();
    if (!status.running && !status.native.active) {
      return { changed: false, mode: null };
    }
    if (status.native.active) {
      await this.supervisor.stop();
      if (status.running && status.mode === 'manual') {
        await this.client.stopServer();
      }
      await this.waitUntilUnavailable();
      return {
        changed: true,
        mode:
          status.running && status.mode === 'manual'
            ? 'supervised-and-manual'
            : 'supervised',
      };
    }
    if (status.running) {
      await this.client.stopServer();
      await this.waitUntilUnavailable();
      return { changed: true, mode: 'manual' };
    }
    return { changed: false, mode: null };
  }

  definition() {
    return {
      executable: this.paths.managedExecutablePath,
      applicationDirectory: this.paths.applicationDirectory,
      socketPath: this.paths.socketPath,
      standardOutputPath: this.paths.supervisorStandardOutputPath,
      standardErrorPath: this.paths.supervisorStandardErrorPath,
    };
  }

  assertPerUser() {
    if (this.uid === 0) {
      throw new LifecycleConflictError(
        'Portreeve native lifecycle commands must run as the target user, not as root.',
      );
    }
  }

  /** @param {string} [expectedVersion] */
  async waitUntilHealthy(expectedVersion) {
    const deadline = Date.now() + this.healthTimeoutMilliseconds;
    let lastError;
    while (Date.now() <= deadline) {
      try {
        const status = await this.status();
        if (
          status.running &&
          status.mode === 'supervised' &&
          (expectedVersion === undefined ||
            status.server?.softwareVersion === expectedVersion)
        ) {
          return status;
        }
        lastError = new Error(
          status.running
            ? 'the responding server did not match the supervised process and expected version'
            : 'the server socket was not reachable',
        );
      } catch (error) {
        lastError = error;
      }
      await delay(100);
    }
    throw new Error(
      `Portreeve did not become healthy: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  async waitUntilUnavailable() {
    const deadline = Date.now() + this.healthTimeoutMilliseconds;
    while (Date.now() <= deadline) {
      try {
        await this.client.health();
      } catch (error) {
        if (error instanceof PortreeveClientError && error.code === 'unavailable') {
          return;
        }
        throw error;
      }
      await delay(100);
    }
    throw new Error('Portreeve did not stop before the lifecycle timeout.');
  }
}

/** @param {string} path */
async function validateSourceExecutable(path) {
  const canonical = await realpath(path);
  const information = await lstat(canonical);
  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`Unsafe Portreeve executable: ${path}`);
  }
  if ((information.mode & 0o111) === 0) {
    throw new Error(`Portreeve executable is not executable: ${path}`);
  }
  if ((information.mode & 0o022) !== 0) {
    throw new Error(`Portreeve executable is writable by another user: ${path}`);
  }
  return canonical;
}

/**
 * @param {string} path
 * @param {number | undefined} uid
 */
async function validateManagedExecutable(path, uid) {
  let information;
  try {
    information = await lstat(path);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      /** @type {{code?: string}} */ (error).code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }
  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`Unsafe managed Portreeve executable: ${path}`);
  }
  if (uid !== undefined && information.uid !== uid) {
    throw new Error(`Managed Portreeve executable has another owner: ${path}`);
  }
  if ((information.mode & 0o022) !== 0) {
    throw new Error(
      `Managed Portreeve executable is writable by another user: ${path}`,
    );
  }
}

/**
 * @param {string} executable
 * @param {typeof runCommand} runner
 */
async function executableVersion(executable, runner) {
  const result = await runner(executable, ['--version']);
  assertCommandSucceeded(result, 'Portreeve executable validation');
  const version = result.stdout.trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Portreeve executable returned an invalid version: ${version}`);
  }
  return version;
}

/** @param {number} milliseconds */
function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

/** @param {unknown} error */
function ignoreMissing(error) {
  if (!(
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: string}} */ (error).code === 'ENOENT'
  )) {
    throw error;
  }
}
