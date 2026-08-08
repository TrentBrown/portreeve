// @ts-check

import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/index.js';
import { resolveRuntimePaths } from '../platform/paths.js';
import { LaunchdSupervisor } from './launchd.js';
import { LifecycleManager } from './manager.js';
import { SystemdUserSupervisor } from './systemd.js';

/**
 * @param {{
 *   home?: string,
 *   socket?: string,
 *   environment?: NodeJS.ProcessEnv,
 *   platform?: NodeJS.Platform,
 *   sourceExecutable?: string
 * }} [options]
 */
export function createLifecycleManager(options = {}) {
  /** @type {NodeJS.ProcessEnv} */
  const environment = {
    ...process.env,
    ...options.environment,
    ...(options.home ? { PORTREEVE_HOME: options.home } : {}),
    ...(options.socket ? { PORTREEVE_SOCKET: options.socket } : {}),
  };
  const paths = resolveRuntimePaths(environment);
  const platform = options.platform ?? process.platform;
  const uid = typeof process.getuid === 'function' ? process.getuid() : Number.NaN;
  const userHome = environment.HOME ?? homedir();
  /** @type {import('./types.js').Supervisor} */
  let supervisor;

  if (platform === 'darwin') {
    supervisor = new LaunchdSupervisor({
      uid,
      definitionPath:
        environment.PORTREEVE_SUPERVISOR_DEFINITION ??
        join(userHome, 'Library', 'LaunchAgents', 'com.portreeve.server.plist'),
      ...(environment.PORTREEVE_SUPERVISOR_LABEL
        ? { label: environment.PORTREEVE_SUPERVISOR_LABEL }
        : {}),
    });
  } else if (platform === 'linux') {
    supervisor = new SystemdUserSupervisor({
      definitionPath:
        environment.PORTREEVE_SUPERVISOR_DEFINITION ??
        join(
          environment.XDG_CONFIG_HOME ?? join(userHome, '.config'),
          'systemd',
          'user',
          'portreeve.service',
        ),
      ...(environment.PORTREEVE_SUPERVISOR_UNIT
        ? { unit: environment.PORTREEVE_SUPERVISOR_UNIT }
        : {}),
    });
  } else {
    supervisor = new UnsupportedSupervisor(platform);
  }

  return new LifecycleManager({
    supervisor,
    paths,
    sourceExecutable:
      options.sourceExecutable ??
      (process.argv[1]?.endsWith('.js') && !process.argv[1].startsWith('/$bunfs/')
        ? resolve(process.argv[1])
        : process.execPath),
    client: new PortreeveClient({ socketPath: paths.socketPath }),
    ...(Number.isSafeInteger(uid) ? { uid } : {}),
  });
}

class UnsupportedSupervisor {
  /** @param {string} platform */
  constructor(platform) {
    this.kind = `unsupported:${platform}`;
    this.definitionPath = '';
  }

  state() {
    return Promise.resolve({
      kind: this.kind,
      installed: false,
      active: false,
      mainPid: null,
    });
  }

  /** @param {import('./types.js').SupervisorDefinition} _definition */
  renderDefinition(_definition) {
    void _definition;
    return fail(this.error());
  }

  /** @param {string} _content */
  installDefinition(_content) {
    void _content;
    return Promise.reject(this.error());
  }

  start() {
    return Promise.reject(this.error());
  }

  stop() {
    return Promise.reject(this.error());
  }

  uninstall() {
    return Promise.reject(this.error());
  }

  error() {
    return new Error(
      `Native PortReeve supervision is not supported on ${this.kind.slice(
        'unsupported:'.length,
      )}. Use "portreeve serve" in the foreground.`,
    );
  }
}

/**
 * @param {Error} error
 * @returns {never}
 */
function fail(error) {
  throw error;
}
