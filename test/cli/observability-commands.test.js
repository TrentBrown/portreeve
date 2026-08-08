// @ts-check

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  historyCommand,
  logsCommand,
  statusCommand,
} from '../../src/cli/commands/observability.js';
import { EXIT_CODES } from '../../src/protocol/constants.js';
import {
  captureOutput,
  idlePort,
  parseRenderedJson,
  startCliRuntime,
} from '../fixtures/cli-runtime.js';

/** @type {Awaited<ReturnType<typeof startCliRuntime>>} */
let runtime;

beforeAll(async () => {
  runtime = await startCliRuntime('portreeve-observability-command');
  const workspace = runtime.directory;
  const lease = await runtime.client.acquire({
    claim: {
      project: 'observability-tests',
      workspaceRoot: workspace,
      service: 'history-source',
    },
    allocation: { exactPort: await idlePort() },
  });
  await runtime.client.abandon(lease, 'client-cancelled');
});

afterAll(async () => {
  await runtime.stop();
});

test('reports a healthy server in both output modes', async () => {
  const json = await captureOutput(() =>
    statusCommand({ socket: runtime.socketPath, json: true }),
  );
  expect(json.exitCode).toBe(0);
  expect(parseRenderedJson(json.lines)).toMatchObject({
    version: 1,
    status: {
      running: true,
      socketPath: runtime.socketPath,
      server: { softwareVersion: expect.any(String) },
    },
  });

  const human = await captureOutput(() =>
    statusCommand({ socket: runtime.socketPath }),
  );
  expect(human.lines[0]).toBe(`Portreeve is running at ${runtime.socketPath}.`);
  expect(human.lines[1]).toMatch(/^Server version: /u);
});

test('reports an unavailable server as a state difference without failing', async () => {
  const socketPath = join(runtime.directory, 'absent.sock');
  const unavailable = await captureOutput(() => statusCommand({ socket: socketPath }));

  expect(unavailable.exitCode).toBe(EXIT_CODES.stateDifference);
  expect(unavailable.lines).toEqual([`Portreeve is not running at ${socketPath}.`]);
});

test('renders recorded history events and empty filtered results', async () => {
  const json = await captureOutput(() =>
    historyCommand({ socket: runtime.socketPath, json: true, limit: '5' }),
  );
  const rendered = parseRenderedJson(json.lines);
  expect(rendered.version).toBe(1);
  expect(Array.isArray(rendered.events)).toBe(true);
  expect(rendered.events.length).toBeGreaterThan(0);

  const human = await captureOutput(() =>
    historyCommand({ socket: runtime.socketPath, limit: '5' }),
  );
  expect(human.lines.length).toBeGreaterThan(0);
  for (const line of human.lines) {
    expect(line).toMatch(/^\S+ {2}\S+ {2}\S+:\S+$/u);
  }

  const empty = await captureOutput(() =>
    historyCommand({
      socket: runtime.socketPath,
      eventType: 'event.type.that.never.happens',
      entityType: 'claim',
      entityId: 'absent',
      since: '2020-01-01T00:00:00.000Z',
    }),
  );
  expect(empty.lines).toEqual(['No matching Portreeve history events.']);
});

test('renders diagnostic log entries with aligned levels', async () => {
  const human = await captureOutput(() =>
    logsCommand({ socket: runtime.socketPath, limit: '10' }),
  );
  expect(human.lines.length).toBeGreaterThan(0);
  expect(human.lines.some((line) => line.includes('Portreeve server started.'))).toBe(
    true,
  );

  const json = await captureOutput(() =>
    logsCommand({ socket: runtime.socketPath, json: true }),
  );
  expect(parseRenderedJson(json.lines)).toMatchObject({
    version: 1,
    entries: expect.arrayContaining([
      expect.objectContaining({ component: 'server', level: 'info' }),
    ]),
  });
});

test('rejects limits outside the supported range for every query command', async () => {
  for (const limit of ['0', '10001', 'many', '1.5']) {
    await expect(
      historyCommand({ socket: runtime.socketPath, limit }),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      message: '--limit must be an integer from 1 through 10000.',
    });
    await expect(
      logsCommand({ socket: runtime.socketPath, limit }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  }
});
