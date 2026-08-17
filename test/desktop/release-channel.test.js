// @ts-check

import { expect, test } from 'bun:test';
import { resolveDesktopReleaseChannel } from '../../apps/desktop/main/release-channel.js';

test('binds packaged stable builds to stable updates and defaults development to preview', () => {
  expect(resolveDesktopReleaseChannel({ portreeveReleaseChannel: 'stable' })).toBe(
    'stable',
  );
  expect(resolveDesktopReleaseChannel({ portreeveReleaseChannel: 'preview' })).toBe(
    'preview',
  );
  expect(resolveDesktopReleaseChannel({})).toBe('preview');
  expect(resolveDesktopReleaseChannel(null)).toBe('preview');
});
