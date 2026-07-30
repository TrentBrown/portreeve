// @ts-check

import { expect, test } from 'bun:test';
import { detectEphemeralPortRange } from '../../src/platform/ephemeral-ports.js';

test('detects a valid platform ephemeral TCP range', async () => {
  const range = await detectEphemeralPortRange();

  expect(range.start).toBeGreaterThanOrEqual(1);
  expect(range.end).toBeLessThanOrEqual(65_535);
  expect(range.start).toBeLessThanOrEqual(range.end);
  if (process.platform === 'darwin') {
    expect(range.source).toBe('sysctl');
  } else if (process.platform === 'linux') {
    expect(range.source).toBe('procfs');
  }
});
