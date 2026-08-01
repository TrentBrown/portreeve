// @ts-check

import { join } from 'node:path';

/**
 * Keep Chromium/Electron caches outside the CLI's marker-bound application
 * home. The desktop is a management client, not an owner of service data.
 *
 * @param {string} appDataPath
 */
export function desktopUserDataPath(appDataPath) {
  return join(appDataPath, 'Portreeve Desktop');
}

/** @param {string} userDataPath */
export function desktopUpdateStatePath(userDataPath) {
  return join(userDataPath, 'update-state.json');
}
