// @ts-check

import { PortreeveClient } from '../../../packages/client/src/index.js';
import { CliUsageError } from '../exit.js';
import { renderOutput } from '../output/render.js';

/**
 * @param {string | undefined} key
 * @param {{socket?: string, json?: boolean}} options
 */
export async function getConfigCommand(key, options) {
  const settings = await clientFor(options.socket).getConfig();
  if (key !== undefined && !(key in settings)) {
    throw new CliUsageError(`Unknown PortReeve setting: ${key}.`, { key });
  }
  const value = key === undefined ? settings : settings[key];
  renderOutput(options.json ?? false, key === undefined ? 'settings' : 'value', value, [
    key === undefined
      ? JSON.stringify(settings, null, 2)
      : `${key}=${JSON.stringify(value)}`,
  ]);
}

/**
 * @param {string} key
 * @param {string} valueArgument
 * @param {{socket?: string, json?: boolean}} options
 */
export async function setConfigCommand(key, valueArgument, options) {
  let value;
  try {
    value = JSON.parse(valueArgument);
  } catch {
    throw new CliUsageError(
      'Configuration values must be valid JSON (for example 5000 or [3000,3001]).',
      { key },
    );
  }
  const settings = await clientFor(options.socket).setConfig({ [key]: value });
  renderOutput(options.json ?? false, 'settings', settings, [
    `Updated ${key}=${JSON.stringify(settings[key])}.`,
  ]);
}

/**
 * @param {string | undefined} socketPath
 */
function clientFor(socketPath) {
  return new PortreeveClient({
    ...(socketPath ? { socketPath } : {}),
  });
}
