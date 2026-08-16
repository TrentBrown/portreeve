// @ts-check

import { join } from 'node:path';
import { expect, test } from 'bun:test';
import {
  desktopUpdateStatePath,
  desktopUserDataPath,
  resolveDesktopUserDataPath,
} from '../../apps/desktop/main/user-data.js';

test('keeps Electron caches outside the CLI application home', () => {
  const appData = join('/Users', 'example', 'Library', 'Application Support');
  expect(desktopUserDataPath(appData)).toBe(join(appData, 'Portreeve Desktop'));
  expect(desktopUserDataPath(appData)).not.toBe(join(appData, 'Portreeve'));
  expect(desktopUpdateStatePath('/desktop/data')).toBe(
    join('/desktop/data', 'update-state.json'),
  );
});

test('isolates development inspection without allowing packaged overrides', () => {
  const appDataPath = '/Users/example/Library/Application Support';
  expect(
    resolveDesktopUserDataPath({
      appDataPath,
      isPackaged: false,
      inspectorPath: '/tmp/portreeve-inspector',
    }),
  ).toBe('/tmp/portreeve-inspector');
  expect(
    resolveDesktopUserDataPath({
      appDataPath,
      isPackaged: true,
      inspectorPath: '/tmp/portreeve-inspector',
    }),
  ).toBe(join(appDataPath, 'Portreeve Desktop'));
  expect(
    resolveDesktopUserDataPath({
      appDataPath,
      isPackaged: true,
      smokePath: '/tmp/portreeve-smoke',
      inspectorPath: '/tmp/portreeve-inspector',
    }),
  ).toBe('/tmp/portreeve-smoke');
});
