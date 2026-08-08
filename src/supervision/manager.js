// @ts-check

import { lstat, realpath, unlink } from 'node:fs/promises';
import {
  PortreeveClient,
  PortreeveClientError,
} from '../../packages/client/src/index.js';
import { PORTREEVE_VERSION } from '../version.js';
import { prepareRuntimeDirectories } from '../platform/paths.js';
import { HealthResponseSchema } from '../protocol/schemas.js';
import { runCommand, assertCommandSucceeded } from './command.js';
import { promoteExecutable, readOptionalFile, restoreExecutable } from './files.js';
import {
  executePurge as executePurgeOperation,
  previewPurge as previewPurgeOperation,
} from './purge.js';
import {
  LifecycleStatusSchema,
  SemanticVersionSchema,
  lifecycleError,
} from './schemas.js';
import { compareSemanticVersions } from './version.js';

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
    const [installation, supervisor, socket] = await Promise.all([
      this.observeInstallation(),
      this.observeSupervisor(),
      this.observeSocket(),
    ]);
    const mode = effectiveMode(supervisor, socket);
    const limitations = [];
    if (installation.error !== null) {
      limitations.push('managed-installation-evidence-incomplete');
    }
    if (supervisor.error !== null) {
      limitations.push('supervisor-evidence-incomplete');
    }
    if (
      socket.error !== null &&
      socket.state !== 'unavailable' &&
      socket.state !== 'incompatible'
    ) {
      limitations.push('socket-evidence-incomplete');
    }
    if (mode === 'ambiguous') {
      limitations.push('execution-mode-ambiguous');
    }
    return LifecycleStatusSchema.parse({
      observedAt: new Date().toISOString(),
      installation,
      supervisor,
      socket,
      mode,
      versions: {
        cli: PORTREEVE_VERSION,
        managed: installation.version,
        running: socket.server?.softwareVersion ?? null,
      },
      limitations,
    });
  }

  async observeInstallation() {
    let information;
    try {
      information = await lstat(this.paths.managedExecutablePath);
    } catch (error) {
      if (isMissingFile(error)) {
        return {
          state: /** @type {'absent'} */ ('absent'),
          managedExecutablePath: this.paths.managedExecutablePath,
          version: null,
          error: null,
        };
      }
      return {
        state: /** @type {'invalid'} */ ('invalid'),
        managedExecutablePath: this.paths.managedExecutablePath,
        version: null,
        error: lifecycleError(error),
      };
    }

    const invalidReason = invalidExecutableReason(
      information,
      this.paths.managedExecutablePath,
      this.uid,
    );
    if (invalidReason !== null) {
      return {
        state: /** @type {'invalid'} */ ('invalid'),
        managedExecutablePath: this.paths.managedExecutablePath,
        version: null,
        error: lifecycleError(invalidReason),
      };
    }

    try {
      return {
        state: /** @type {'installed'} */ ('installed'),
        managedExecutablePath: this.paths.managedExecutablePath,
        version: await executableVersion(this.paths.managedExecutablePath, this.runner),
        error: null,
      };
    } catch (error) {
      return {
        state: /** @type {'invalid'} */ ('invalid'),
        managedExecutablePath: this.paths.managedExecutablePath,
        version: null,
        error: lifecycleError(error),
      };
    }
  }

  async observeSupervisor() {
    try {
      const native = await this.supervisor.state();
      if (native.kind.startsWith('unsupported:')) {
        return {
          kind: native.kind,
          state: /** @type {'unavailable'} */ ('unavailable'),
          mainPid: null,
          error: {
            code: 'unsupported_platform',
            message: `Native supervision is unavailable on ${native.kind.slice(
              'unsupported:'.length,
            )}.`,
          },
        };
      }
      return {
        kind: native.kind,
        state: /** @type {'unavailable' | 'inactive' | 'starting' | 'active'} */ (
          !native.installed
            ? 'unavailable'
            : !native.active
              ? 'inactive'
              : native.mainPid === null
                ? 'starting'
                : 'active'
        ),
        mainPid: native.mainPid,
        error: null,
      };
    } catch (error) {
      return {
        kind: this.supervisor.kind,
        state: /** @type {'failed'} */ ('failed'),
        mainPid: null,
        error: lifecycleError(error),
      };
    }
  }

  async observeSocket() {
    try {
      return {
        path: this.paths.socketPath,
        state: /** @type {'healthy'} */ ('healthy'),
        server: HealthResponseSchema.parse(await this.client.health()),
        error: null,
      };
    } catch (error) {
      const evidence = lifecycleError(error);
      if (error instanceof PortreeveClientError) {
        if (error.code === 'unavailable') {
          return {
            path: this.paths.socketPath,
            state: /** @type {'unavailable'} */ ('unavailable'),
            server: null,
            error: evidence,
          };
        }
        if (error.code === 'incompatible_protocol') {
          return {
            path: this.paths.socketPath,
            state: /** @type {'incompatible'} */ ('incompatible'),
            server: null,
            error: evidence,
          };
        }
      }
      return {
        path: this.paths.socketPath,
        state: /** @type {'unhealthy'} */ ('unhealthy'),
        server: null,
        error: evidence,
      };
    }
  }

  async install() {
    this.assertPerUser();
    const priorStatus = await this.status();
    this.assertMutationCompatible(priorStatus);
    if (priorStatus.mode === 'manual' || priorStatus.mode === 'ambiguous') {
      throw new LifecycleConflictError(
        'A manual PortReeve server is running. Stop it before installing or upgrading the supervised service.',
      );
    }

    await prepareRuntimeDirectories(this.paths);
    const source = await validateSourceExecutable(this.sourceExecutable);
    await validateManagedExecutable(this.paths.managedExecutablePath, this.uid);
    const version = await executableVersion(source, this.runner);
    const comparisonVersions = [
      priorStatus.versions.managed,
      priorStatus.versions.running,
    ].filter((value) => value !== null);
    for (const installedVersion of comparisonVersions) {
      if (compareSemanticVersions(version, installedVersion) < 0) {
        throw new LifecycleConflictError(
          `PortReeve ${version} will not replace newer PortReeve ${installedVersion}.`,
        );
      }
    }
    const priorDefinition = await readOptionalFile(this.supervisor.definitionPath);
    const priorActive =
      priorStatus.supervisor.state === 'active' ||
      priorStatus.supervisor.state === 'starting';
    /** @type {{hadPrevious: boolean} | null} */
    let promotion = null;

    try {
      if (priorActive) {
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
      if (priorActive) {
        await this.supervisor.start();
        await this.waitUntilHealthy(version);
      }
      return {
        installed: true,
        upgraded: promotion.hadPrevious,
        active: priorActive,
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
      if (priorActive) {
        await this.supervisor.start();
        await this.waitUntilHealthy().catch(() => {});
      }
      throw new Error(
        `PortReeve upgrade activation failed and the prior installation was restored: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }

  async uninstall() {
    this.assertPerUser();
    const status = await this.status();
    this.assertMutationCompatible(status);
    if (status.mode === 'manual' || status.mode === 'ambiguous') {
      throw new LifecycleConflictError(
        'A manual or ambiguous PortReeve server is running. Stop it explicitly before uninstalling native supervision.',
      );
    }
    if (
      status.supervisor.state === 'active' ||
      status.supervisor.state === 'starting'
    ) {
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
    this.assertMutationCompatible(status);
    if (status.installation.state !== 'installed') {
      throw new LifecycleConflictError(
        'PortReeve is not installed for native supervision. Run "portreeve install" first.',
      );
    }
    if (status.mode === 'manual' || status.mode === 'ambiguous') {
      throw new LifecycleConflictError(
        'A manual PortReeve server is already running. Stop it before starting the supervised service.',
      );
    }
    if (status.supervisor.state !== 'active') {
      await this.supervisor.start();
    }
    return this.waitUntilHealthy();
  }

  async restart() {
    this.assertPerUser();
    const status = await this.status();
    this.assertMutationCompatible(status);
    if (status.installation.state !== 'installed') {
      throw new LifecycleConflictError(
        'PortReeve is not installed for native supervision. Run "portreeve install" first.',
      );
    }
    if (status.mode === 'manual' || status.mode === 'ambiguous') {
      throw new LifecycleConflictError(
        'A manual PortReeve server is running. PortReeve will not adopt or replace it.',
      );
    }
    if (
      status.supervisor.state === 'active' ||
      status.supervisor.state === 'starting'
    ) {
      await this.supervisor.stop();
      await this.waitUntilUnavailable();
    }
    await this.supervisor.start();
    return this.waitUntilHealthy();
  }

  async stop() {
    this.assertPerUser();
    const status = await this.status();
    this.assertMutationCompatible(status);
    const supervisorActive =
      status.supervisor.state === 'active' || status.supervisor.state === 'starting';
    if (
      status.mode === 'manual' ||
      (status.mode === 'ambiguous' && !supervisorActive)
    ) {
      throw new LifecycleConflictError(
        'A manual or ambiguous PortReeve server is running. Use "portreeve stop-manual" for explicit manual-server shutdown.',
      );
    }
    if (status.socket.state === 'unavailable' && !supervisorActive) {
      return { changed: false, mode: null };
    }
    if (supervisorActive) {
      await this.supervisor.stop();
      if (status.mode === 'supervised') {
        await this.waitUntilUnavailable();
      }
      return { changed: true, mode: 'supervised' };
    }
    return { changed: false, mode: null };
  }

  async stopManual() {
    this.assertPerUser();
    const status = await this.status();
    this.assertMutationCompatible(status);
    if (status.mode !== 'manual') {
      throw new LifecycleConflictError(
        status.mode === 'none'
          ? 'No manual PortReeve server is running.'
          : 'PortReeve will not stop an ambiguous or supervised server through the manual-server operation.',
      );
    }
    await this.client.stopServer();
    await this.waitUntilUnavailable();
    return { changed: true, mode: 'manual' };
  }

  async previewPurge() {
    this.assertPerUser();
    return previewPurgeOperation(this);
  }

  /** @param {string} confirmationToken */
  async purge(confirmationToken) {
    this.assertPerUser();
    return executePurgeOperation(this, confirmationToken);
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
        'PortReeve native lifecycle commands must run as the target user, not as root.',
      );
    }
  }

  /**
   * @param {import('zod').infer<typeof LifecycleStatusSchema>} status
   */
  assertMutationCompatible(status) {
    if (status.socket.state === 'incompatible') {
      throw new PortreeveClientError(
        'The running PortReeve server is protocol-incompatible with this CLI.',
        { code: 'incompatible_protocol' },
      );
    }
    if (status.installation.state === 'invalid') {
      throw new LifecycleConflictError(
        'The managed PortReeve installation is unsafe or unreadable.',
      );
    }
    if (status.supervisor.state === 'failed') {
      throw new LifecycleConflictError(
        'Native supervisor state could not be observed safely.',
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
          status.socket.state === 'healthy' &&
          status.mode === 'supervised' &&
          (expectedVersion === undefined || status.versions.running === expectedVersion)
        ) {
          return status;
        }
        lastError = new Error(
          status.socket.state === 'healthy'
            ? 'the responding server did not match the supervised process and expected version'
            : 'the server socket was not reachable',
        );
      } catch (error) {
        lastError = error;
      }
      await delay(100);
    }
    throw new Error(
      `PortReeve did not become healthy: ${
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
    throw new Error('PortReeve did not stop before the lifecycle timeout.');
  }
}

/**
 * @param {import('zod').infer<typeof import('./schemas.js').LifecycleSupervisorSchema>} supervisor
 * @param {import('zod').infer<typeof import('./schemas.js').LifecycleSocketSchema>} socket
 * @returns {'none' | 'manual' | 'supervised' | 'ambiguous'}
 */
function effectiveMode(supervisor, socket) {
  const supervisorActive =
    supervisor.state === 'active' || supervisor.state === 'starting';
  if (socket.state !== 'healthy' || socket.server === null) {
    return supervisorActive ? 'ambiguous' : 'none';
  }
  if (
    supervisor.state === 'active' &&
    supervisor.mainPid !== null &&
    socket.server.mode === 'supervised' &&
    socket.server.pid === supervisor.mainPid
  ) {
    return 'supervised';
  }
  if (!supervisorActive && socket.server.mode === 'manual') {
    return 'manual';
  }
  return 'ambiguous';
}

/**
 * @param {import('node:fs').Stats} information
 * @param {string} path
 * @param {number | undefined} uid
 */
function invalidExecutableReason(information, path, uid) {
  if (!information.isFile() || information.isSymbolicLink()) {
    return new Error(`Unsafe managed PortReeve executable: ${path}`);
  }
  if (uid !== undefined && information.uid !== uid) {
    return new Error(`Managed PortReeve executable has another owner: ${path}`);
  }
  if ((information.mode & 0o022) !== 0) {
    return new Error(
      `Managed PortReeve executable is writable by another user: ${path}`,
    );
  }
  return null;
}

/** @param {string} path */
async function validateSourceExecutable(path) {
  const canonical = await realpath(path);
  const information = await lstat(canonical);
  if (!information.isFile() || information.isSymbolicLink()) {
    throw new Error(`Unsafe PortReeve executable: ${path}`);
  }
  if ((information.mode & 0o111) === 0) {
    throw new Error(`PortReeve executable is not executable: ${path}`);
  }
  if ((information.mode & 0o022) !== 0) {
    throw new Error(`PortReeve executable is writable by another user: ${path}`);
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
  const reason = invalidExecutableReason(information, path, uid);
  if (reason !== null) {
    throw reason;
  }
}

/**
 * @param {string} executable
 * @param {typeof runCommand} runner
 */
async function executableVersion(executable, runner) {
  const result = await runner(executable, ['--version']);
  assertCommandSucceeded(result, 'PortReeve executable validation');
  try {
    return SemanticVersionSchema.parse(result.stdout.trim());
  } catch {
    throw new Error(
      `PortReeve executable returned an invalid version: ${result.stdout.trim()}`,
    );
  }
}

/**
 * @param {unknown} error
 */
function isMissingFile(error) {
  return (
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: string}} */ (error).code === 'ENOENT'
  );
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
