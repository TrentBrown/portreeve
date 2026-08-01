// @ts-check

import { expect, test } from 'bun:test';
import {
  createLifecycleAdapter,
  runExecutable,
} from '../../apps/desktop/main/cli-adapter.js';
import { lifecycleSnapshot } from './fixtures.js';

/** @param {string} operation @param {Record<string, unknown>} [overrides] */
function mutationResult(operation, overrides = {}) {
  const status = lifecycleSnapshot();
  return {
    operation,
    outcome: 'succeeded',
    changed: true,
    startedAt: status.observedAt,
    completedAt: status.observedAt,
    before: status,
    after: status,
    error: null,
    ...overrides,
  };
}

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

test('maps every lifecycle capability to a fixed CLI argv contract', async () => {
  /** @type {string[][]} */
  const calls = [];
  const adapter = createLifecycleAdapter({
    executablePath: '/exact/resources/portreeve',
    run: async (_path, arguments_) => {
      calls.push(arguments_);
      const operation = arguments_[0] ?? '';
      return {
        stdout: JSON.stringify({ version: 1, result: mutationResult(operation) }),
        exitCode: 0,
      };
    },
  });
  await adapter.install();
  await adapter.start();
  await adapter.stop();
  await adapter.stopManual();
  await adapter.restart();
  await adapter.uninstall();
  expect(calls).toEqual([
    ['install', '--json'],
    ['start', '--json'],
    ['stop', '--json'],
    ['stop-manual', '--json'],
    ['restart', '--json'],
    ['uninstall', '--json'],
  ]);
});

test('confines purge tokens to one main-process preview and consumes them once', async () => {
  const token = 'b'.repeat(64);
  /** @type {string[][]} */
  const calls = [];
  const status = lifecycleSnapshot({
    mode: 'none',
    supervisor: {
      ...lifecycleSnapshot().supervisor,
      state: 'inactive',
      mainPid: null,
    },
    socket: { ...lifecycleSnapshot().socket, state: 'unavailable', server: null },
  });
  const adapter = createLifecycleAdapter({
    executablePath: '/exact/resources/portreeve',
    run: async (_path, arguments_) => {
      calls.push(arguments_);
      if (arguments_.includes('--dry-run')) {
        return {
          stdout: JSON.stringify({
            version: 1,
            preview: {
              operation: 'purge',
              dryRun: true,
              allowed: true,
              confirmationToken: token,
              root: '/Users/example/Library/Application Support/Portreeve',
              marker: null,
              status,
              paths: [
                {
                  path: '/Users/example/Library/Application Support/Portreeve',
                  type: 'directory',
                  uid: 501,
                  mode: 448,
                  size: 96,
                  modifiedAt: status.observedAt,
                },
              ],
              refused: [],
            },
          }),
          exitCode: 0,
        };
      }
      return {
        stdout: JSON.stringify({
          version: 1,
          result: {
            operation: 'purge',
            outcome: 'succeeded',
            confirmationToken: token,
            startedAt: status.observedAt,
            completedAt: status.observedAt,
            before: status,
            after: status,
            removed: ['/Users/example/Library/Application Support/Portreeve'],
            retained: [],
            missing: [],
            refused: [],
            error: null,
          },
        }),
        exitCode: 0,
      };
    },
  });
  const preview = await adapter.previewPurge();
  expect(JSON.stringify(preview)).not.toContain(token);
  const result = await adapter.executePurge();
  expect(JSON.stringify(result)).not.toContain(token);
  expect(calls[1]).toEqual(['purge', '--confirm', token, '--json']);
  await expect(adapter.executePurge()).rejects.toMatchObject({
    code: 'purge_preview_required',
  });
});
