// @ts-check

import { expect, test } from 'bun:test';
import {
  createLifecycleAdapter,
  runExecutable,
} from '../../apps/desktop/main/cli-adapter.js';
import { lifecycleSnapshot } from './fixtures.js';

test('invokes the exact CLI contract and accepts valid status evidence from a nonzero state exit', async () => {
  /** @type {Array<{path: string, arguments_: string[]}>} */
  const calls = [];
  const adapter = createLifecycleAdapter({
    executablePath: '/exact/resources/portreeve',
    run: async (path, arguments_) => {
      calls.push({ path, arguments_ });
      return {
        stdout: JSON.stringify({ version: 1, status: lifecycleSnapshot() }),
        exitCode: 10,
      };
    },
  });

  expect(await adapter.status()).toMatchObject({ mode: 'supervised' });
  expect(calls).toEqual([
    { path: '/exact/resources/portreeve', arguments_: ['status', '--json'] },
  ]);
});

test('rejects malformed lifecycle output without echoing it', async () => {
  const adapter = createLifecycleAdapter({
    executablePath: '/exact/resources/portreeve',
    run: async () => ({
      stdout: '{"token":"never expose this content"}',
      exitCode: 70,
    }),
  });
  await expect(adapter.status()).rejects.toThrow('unsupported lifecycle envelope');
  await expect(adapter.status()).rejects.not.toThrow('never expose');
});

test('terminates a lifecycle command that does not respond in time', async () => {
  await expect(
    runExecutable(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], 50),
  ).rejects.toMatchObject({ code: 'lifecycle_timeout' });
});
