// @ts-check

import { PORTREEVE_VERSION } from '../../version.js';
import { EXIT_CODES } from '../../protocol/constants.js';
import { createLifecycleManager } from '../../supervision/factory.js';
import { setExitCode } from '../exit.js';
import { renderOutput } from '../output/render.js';

/**
 * @param {{home?: string, socket?: string, json?: boolean}} options
 */
export async function installCommand(options) {
  const result = await managerFor(options).install();
  renderOutput(options.json ?? false, 'installation', result, [
    `${result.upgraded ? 'Upgraded' : 'Installed'} Portreeve ${result.version} for ${result.supervisor} supervision.`,
    result.active
      ? 'The supervised server is active and healthy.'
      : 'The supervised server remains inactive; run "portreeve start" to start it.',
  ]);
}

/**
 * @param {{home?: string, socket?: string, json?: boolean}} options
 */
export async function uninstallCommand(options) {
  const result = await managerFor(options).uninstall();
  renderOutput(options.json ?? false, 'installation', result, [
    'Removed Portreeve native supervision and its managed executable.',
    'Claims, settings, history, and diagnostic data were preserved.',
  ]);
}

/**
 * @param {{home?: string, socket?: string, json?: boolean}} options
 */
export async function startCommand(options) {
  const status = await managerFor(options).start();
  renderStatus(options.json ?? false, status, 'started');
}

/**
 * @param {{home?: string, socket?: string, json?: boolean}} options
 */
export async function restartCommand(options) {
  const status = await managerFor(options).restart();
  renderStatus(options.json ?? false, status, 'restarted');
}

/**
 * @param {{home?: string, socket?: string, json?: boolean}} options
 */
export async function stopCommand(options) {
  const result = await managerFor(options).stop();
  renderOutput(options.json ?? false, 'stop', result, [
    result.changed
      ? `Stopped the ${result.mode} Portreeve server.`
      : 'Portreeve is already stopped.',
  ]);
}

/**
 * @param {{home?: string, socket?: string, json?: boolean}} options
 */
export async function lifecycleStatusCommand(options) {
  const status = await managerFor(options).status();
  const versionMatches =
    status.server === null ? null : status.server.softwareVersion === PORTREEVE_VERSION;
  const result = { ...status, cliVersion: PORTREEVE_VERSION, versionMatches };
  const lines = [
    status.running
      ? `Portreeve is running in ${status.mode} mode at ${status.socketPath}.`
      : `Portreeve is not running at ${status.socketPath}.`,
    `Native supervision: ${status.native.installed ? 'installed' : 'not installed'} (${status.native.kind}), ${status.native.active ? 'active' : 'inactive'}.`,
    ...(status.server === null
      ? []
      : [
          `CLI version: ${PORTREEVE_VERSION}; server version: ${status.server.softwareVersion}${versionMatches ? '' : ' (mismatch)'}.`,
        ]),
  ];
  if (!status.running) {
    setExitCode(EXIT_CODES.stateDifference);
  }
  renderOutput(options.json ?? false, 'status', result, lines);
}

/**
 * @param {boolean} json
 * @param {Awaited<ReturnType<import('../../supervision/manager.js').LifecycleManager['status']>>} status
 * @param {string} verb
 */
function renderStatus(json, status, verb) {
  renderOutput(json, 'status', status, [
    `Portreeve ${verb} under ${status.native.kind} supervision.`,
    `Server ${status.server?.softwareVersion ?? 'unknown'} is healthy at ${status.socketPath}.`,
  ]);
}

/**
 * @param {{home?: string, socket?: string}} options
 */
function managerFor(options) {
  return createLifecycleManager({
    ...(options.home ? { home: options.home } : {}),
    ...(options.socket ? { socket: options.socket } : {}),
  });
}
