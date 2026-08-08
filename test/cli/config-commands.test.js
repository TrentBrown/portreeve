// @ts-check

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { getConfigCommand, setConfigCommand } from '../../src/cli/commands/config.js';
import {
  captureOutput,
  parseRenderedJson,
  startCliRuntime,
} from '../fixtures/cli-runtime.js';

/** @type {Awaited<ReturnType<typeof startCliRuntime>>} */
let runtime;

beforeAll(async () => {
  runtime = await startCliRuntime('portreeve-config-command');
});

afterAll(async () => {
  await runtime.stop();
});

test('reads every setting and one setting in both output modes', async () => {
  const all = await captureOutput(() =>
    getConfigCommand(undefined, { socket: runtime.socketPath, json: true }),
  );
  expect(parseRenderedJson(all.lines)).toMatchObject({
    version: 1,
    settings: { gracefulShutdownMilliseconds: expect.any(Number) },
  });

  const humanAll = await captureOutput(() =>
    getConfigCommand(undefined, { socket: runtime.socketPath }),
  );
  expect(JSON.parse(humanAll.lines.join('\n'))).toMatchObject({
    gracefulShutdownMilliseconds: expect.any(Number),
  });

  const single = await captureOutput(() =>
    getConfigCommand('historyMaximumEvents', { socket: runtime.socketPath }),
  );
  expect(single.lines).toEqual(['historyMaximumEvents=10000']);

  const singleJson = await captureOutput(() =>
    getConfigCommand('historyMaximumEvents', {
      socket: runtime.socketPath,
      json: true,
    }),
  );
  expect(parseRenderedJson(singleJson.lines)).toEqual({
    version: 1,
    value: 10_000,
  });
});

test('rejects unknown setting keys before rendering output', async () => {
  await expect(
    getConfigCommand('notASetting', { socket: runtime.socketPath }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: 'Unknown PortReeve setting: notASetting.',
    details: { key: 'notASetting' },
  });
});

test('updates one validated setting from its JSON value', async () => {
  const updated = await captureOutput(() =>
    setConfigCommand('gracefulShutdownMilliseconds', '900', {
      socket: runtime.socketPath,
      json: true,
    }),
  );
  expect(parseRenderedJson(updated.lines)).toMatchObject({
    version: 1,
    settings: { gracefulShutdownMilliseconds: 900 },
  });

  const human = await captureOutput(() =>
    setConfigCommand('excludedPorts', '[3000,3001]', { socket: runtime.socketPath }),
  );
  expect(human.lines).toEqual(['Updated excludedPorts=[3000,3001].']);
});

test('separates malformed JSON values from server-side validation failures', async () => {
  await expect(
    setConfigCommand('gracefulShutdownMilliseconds', 'nine hundred', {
      socket: runtime.socketPath,
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message:
      'Configuration values must be valid JSON (for example 5000 or [3000,3001]).',
    details: { key: 'gracefulShutdownMilliseconds' },
  });

  await expect(
    setConfigCommand('gracefulShutdownMilliseconds', '1', {
      socket: runtime.socketPath,
    }),
  ).rejects.toMatchObject({ code: 'invalid_input' });
});
