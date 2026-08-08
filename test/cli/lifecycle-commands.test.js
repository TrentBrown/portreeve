// @ts-check

import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lifecycleStatusCommand,
  purgeCommand,
  stopManualCommand,
} from '../../src/cli/commands/lifecycle.js';
import { EXIT_CODES } from '../../src/protocol/constants.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { captureOutput, parseRenderedJson } from '../fixtures/cli-runtime.js';

/** @type {string[]} */
const homes = [];

afterEach(async () => {
  while (homes.length > 0) {
    const home = homes.pop();
    if (home !== undefined) {
      await rm(home, { force: true, recursive: true });
    }
  }
});

async function isolatedHome() {
  const home = await realpath(
    await mkdtemp(join(tmpdir(), 'portreeve-lifecycle-command-')),
  );
  homes.push(home);
  return home;
}

test('reports an uninstalled and unsupervised installation as a state difference', async () => {
  const home = await isolatedHome();
  const socket = join(home, 'portreeve.sock');

  const json = await captureOutput(() =>
    lifecycleStatusCommand({ home, socket, json: true }),
  );
  expect(json.exitCode).toBe(EXIT_CODES.stateDifference);
  expect(parseRenderedJson(json.lines)).toMatchObject({
    version: 1,
    status: {
      installation: { state: 'absent' },
      socket: { path: socket, state: 'unavailable' },
      mode: 'none',
    },
  });

  const human = await captureOutput(() => lifecycleStatusCommand({ home, socket }));
  expect(human.lines[0]).toMatch(/^Portreeve mode: none; observed /u);
  expect(human.lines[1]).toBe('Installation: absent; managed version unavailable.');
  expect(human.lines[2]).toMatch(/^Supervisor: unavailable \(/u);
  expect(human.lines[3]).toBe(
    `Socket: unavailable at ${socket}; running version unavailable.`,
  );
});

test('refuses to stop a manual server that is not running', async () => {
  const home = await isolatedHome();
  const stopped = await captureOutput(() =>
    stopManualCommand({ home, socket: join(home, 'portreeve.sock'), json: true }),
  );

  expect(stopped.exitCode).toBe(EXIT_CODES.conflict);
  expect(parseRenderedJson(stopped.lines)).toMatchObject({
    version: 1,
    result: {
      operation: 'stop-manual',
      outcome: 'refused',
      changed: false,
      error: { code: 'conflict', message: 'No manual Portreeve server is running.' },
    },
  });

  const human = await captureOutput(() =>
    stopManualCommand({ home, socket: join(home, 'portreeve.sock') }),
  );
  expect(human.lines[0]).toBe('Portreeve stop-manual: refused.');
  expect(human.lines[1]).toMatch(/^Before: absent installation, /u);
  expect(human.lines.at(-1)).toBe('conflict: No manual Portreeve server is running.');
});

test('requires exactly one purge selector', async () => {
  const home = await isolatedHome();
  const message =
    'Purge requires exactly one of --dry-run or --confirm <preview-token>.';

  await expect(purgeCommand({ home })).rejects.toMatchObject({
    code: 'invalid_input',
    message,
  });
  await expect(
    purgeCommand({ home, dryRun: true, confirm: 'a'.repeat(64) }),
  ).rejects.toMatchObject({ code: 'invalid_input', message });
});

test('rejects a confirmation token that no preview could have produced', async () => {
  const home = await isolatedHome();

  await expect(purgeCommand({ home, confirm: 'not-a-token' })).rejects.toMatchObject({
    code: 'invalid_input',
    message:
      'Purge confirmation token must be the 64-character lowercase hexadecimal token returned by --dry-run.',
  });
});

test('previews and then executes a purge bound to its own evidence token', async () => {
  const home = await isolatedHome();
  const socket = join(home, 'portreeve.sock');
  await prepareRuntimeDirectories({ applicationDirectory: home, socketPath: socket });
  await writeFile(join(home, 'registry.sqlite'), 'placeholder');

  const preview = await captureOutput(() =>
    purgeCommand({ home, socket, dryRun: true, json: true }),
  );
  const rendered = parseRenderedJson(preview.lines);
  expect(rendered).toMatchObject({
    version: 1,
    preview: { allowed: true, root: home },
  });
  expect(rendered.preview.confirmationToken).toMatch(/^[0-9a-f]{64}$/u);

  const stale = await captureOutput(() =>
    purgeCommand({ home, socket, confirm: 'f'.repeat(64), json: true }),
  );
  expect(stale.exitCode).toBe(EXIT_CODES.conflict);
  expect(parseRenderedJson(stale.lines)).toMatchObject({
    result: { outcome: 'refused' },
  });

  const executed = await captureOutput(() =>
    purgeCommand({ home, socket, confirm: rendered.preview.confirmationToken }),
  );
  expect(executed.exitCode).toBe(0);
  expect(executed.lines[0]).toBe('Portreeve purge: succeeded.');
  expect(executed.lines[1]).toMatch(/^Removed: [1-9]/u);
  await expect(stat(join(home, 'registry.sqlite'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});
