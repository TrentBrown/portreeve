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

/**
 * Keep the Playwright inspector profile separate from the installed Desktop app while
 * refusing any development override inside a packaged application.
 *
 * @param {{appDataPath: string, isPackaged: boolean, smokePath?: string, inspectorPath?: string}} options
 */
export function resolveDesktopUserDataPath(options) {
  if (options.smokePath !== undefined) return options.smokePath;
  if (!options.isPackaged && options.inspectorPath !== undefined) {
    return options.inspectorPath;
  }
  return desktopUserDataPath(options.appDataPath);
}

/** @param {string} userDataPath */
export function desktopUpdateStatePath(userDataPath) {
  return join(userDataPath, 'update-state.json');
}
