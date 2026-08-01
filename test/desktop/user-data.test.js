// @ts-check

import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { desktopUserDataPath } from '../../apps/desktop/main/user-data.js';

test('keeps Electron caches outside the CLI application home', () => {
  const appData = join('/Users', 'example', 'Library', 'Application Support');
  expect(desktopUserDataPath(appData)).toBe(join(appData, 'Portreeve Desktop'));
  expect(desktopUserDataPath(appData)).not.toBe(join(appData, 'Portreeve'));
});
