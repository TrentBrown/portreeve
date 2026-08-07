// @ts-check

import { expect, test } from 'bun:test';
import { parseDuration, pruneConsentMode } from '../../src/cli/commands/claims.js';

test('parses prune age overrides including explicit immediate cleanup', () => {
  expect(parseDuration('0')).toBe(0);
  expect(parseDuration('12h')).toBe(43_200_000);
  expect(parseDuration('7d')).toBe(604_800_000);
  expect(() => parseDuration('tomorrow')).toThrow('Invalid duration');
});

test('keeps dry-run, interactive prompting, and noninteractive consent distinct', () => {
  expect(pruneConsentMode({ dryRun: true, yes: false }, false)).toBe('dry-run');
  expect(pruneConsentMode({ dryRun: false, yes: true }, false)).toBe('execute');
  expect(pruneConsentMode({ dryRun: false, yes: false }, true)).toBe('prompt');
  expect(() => pruneConsentMode({ dryRun: false, yes: false }, false)).toThrow(
    'requires --yes',
  );
  expect(() => pruneConsentMode({ dryRun: false, yes: false }, false, 'stack')).toThrow(
    'Noninteractive stack pruning requires --yes',
  );
  expect(() => pruneConsentMode({ dryRun: true, yes: true }, true)).toThrow(
    'cannot be used together',
  );
});
