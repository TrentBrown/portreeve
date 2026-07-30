// @ts-check

import { expect, test } from 'bun:test';
import { compareSemanticVersions } from '../../src/supervision/version.js';

test('compares release and prerelease semantic versions for downgrade safety', () => {
  expect(compareSemanticVersions('1.0.0', '1.0.0')).toBe(0);
  expect(compareSemanticVersions('1.0.1', '1.0.0')).toBe(1);
  expect(compareSemanticVersions('1.0.0', '1.0.1')).toBe(-1);
  expect(compareSemanticVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
  expect(compareSemanticVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBe(-1);
  expect(compareSemanticVersions('1.0.0-alpha', '1.0.0-1')).toBe(1);
  expect(compareSemanticVersions('1.0.0+desktop.1', '1.0.0+cli.9')).toBe(0);
});
