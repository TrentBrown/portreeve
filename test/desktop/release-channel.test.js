// @ts-check

import { expect, test } from 'bun:test';
import {
  resolveDesktopReleaseChannel,
  resolveDesktopReleaseVersion,
} from '../../apps/desktop/main/release-channel.js';

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

test('uses packaged coordinated release identity and falls back for development', () => {
  expect(
    resolveDesktopReleaseVersion(
      { portreeveReleaseVersion: '0.1.0-preview.4' },
      '0.1.0',
    ),
  ).toBe('0.1.0-preview.4');
  expect(resolveDesktopReleaseVersion({}, '0.1.0')).toBe('0.1.0');
  expect(
    resolveDesktopReleaseVersion({ portreeveReleaseVersion: 'invalid' }, '0.1.0'),
  ).toBe('0.1.0');
});
