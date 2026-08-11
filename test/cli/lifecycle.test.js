// @ts-check

import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { purgeCommand } from '../../src/cli/commands/lifecycle.js';
import { CliUsageError } from '../../src/cli/exit.js';

test('keeps lifecycle orchestration in the shared service rather than the CLI', async () => {
  const source = await readFile('src/cli/commands/lifecycle.js', 'utf8');
  expect(source).toContain('createLifecycleService');
  expect(source).not.toContain('createLifecycleManager');
  expect(source).not.toContain('executeLifecycleMutation');
  expect(source).not.toContain('lifecycleStateChanged');
});

test('purge requires exactly one preview or evidence-bound execution mode', async () => {
  await expect(purgeCommand({ json: true })).rejects.toBeInstanceOf(CliUsageError);
  await expect(
    purgeCommand({ dryRun: true, confirm: 'token', json: true }),
  ).rejects.toBeInstanceOf(CliUsageError);
  await expect(
    purgeCommand({ confirm: 'not-a-preview-token', json: true }),
  ).rejects.toThrow('64-character lowercase hexadecimal token');
});
