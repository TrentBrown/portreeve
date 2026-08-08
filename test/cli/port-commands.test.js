// @ts-check

import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  inspectPortCommand,
  listPortsCommand,
  reclaimPortCommand,
  unsafeEvictPortCommand,
} from '../../src/cli/commands/ports.js';
import { EXIT_CODES } from '../../src/protocol/constants.js';
import {
  captureOutput,
  idlePort,
  parseRenderedJson,
  startCliRuntime,
} from '../fixtures/cli-runtime.js';

/** @type {Awaited<ReturnType<typeof startCliRuntime>>} */
let runtime;
/** @type {number} */
let claimedPort;
/** @type {import('bun').Server<undefined>} */
let listener;

beforeAll(async () => {
  runtime = await startCliRuntime('portreeve-port-command');
  claimedPort = await idlePort();
  const lease = await runtime.client.acquire({
    claim: {
      project: 'port-tests',
      workspaceRoot: runtime.directory,
      service: 'website',
    },
    allocation: { exactPort: claimedPort },
  });
  listener = Bun.serve({
    port: claimedPort,
    fetch: () => new Response('claimed'),
  });
  await runtime.client.confirm(lease, { rootPid: process.pid });
});

afterAll(async () => {
  listener.stop(true);
  await runtime.stop();
});

test('lists claimed inventory in both output modes', async () => {
  const json = await captureOutput(() =>
    listPortsCommand({
      socket: runtime.socketPath,
      json: true,
      claimed: true,
      project: 'port-tests',
    }),
  );
  expect(parseRenderedJson(json.lines)).toMatchObject({
    version: 1,
    entries: expect.arrayContaining([
      expect.objectContaining({ port: claimedPort, classification: 'verified' }),
    ]),
  });

  const human = await captureOutput(() =>
    listPortsCommand({
      socket: runtime.socketPath,
      status: 'verified',
      listening: true,
      project: 'port-tests',
      workspace: runtime.directory,
      service: 'website',
      port: String(claimedPort),
    }),
  );
  expect(human.lines).toHaveLength(1);
  expect(human.lines[0]).toContain(String(claimedPort));
  expect(human.lines[0]).toContain('verified');
  expect(human.lines[0]).toContain(`port-tests/website/${runtime.directory}`);
  expect(human.lines[0]).toMatch(/pid \d+/u);
});

test('reports an empty inventory selection as a plain sentence', async () => {
  const empty = await captureOutput(() =>
    listPortsCommand({
      socket: runtime.socketPath,
      project: 'project-that-does-not-exist',
    }),
  );

  expect(empty.lines).toEqual(['No claimed or listening TCP ports.']);
});

test('rejects contradictory claim filters and malformed ports before any request', async () => {
  await expect(
    listPortsCommand({
      socket: runtime.socketPath,
      claimed: true,
      unclaimed: true,
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: '--claimed and --unclaimed cannot be used together.',
  });

  await expect(
    inspectPortCommand('70000', { socket: runtime.socketPath }),
  ).rejects.toBeInstanceOf(Error);
});

test('inspects one port with its claim and listener evidence', async () => {
  const human = await captureOutput(() =>
    inspectPortCommand(String(claimedPort), { socket: runtime.socketPath }),
  );
  expect(human.lines[0]).toBe(`TCP port ${claimedPort}: verified`);
  expect(human.lines[1]).toBe(`Claim: port-tests/website/${runtime.directory}`);
  expect(human.lines.slice(2).join('\n')).toMatch(/^Listener: pid \d+ \(.+\)/u);

  const json = await captureOutput(() =>
    inspectPortCommand(String(claimedPort), {
      socket: runtime.socketPath,
      json: true,
    }),
  );
  expect(parseRenderedJson(json.lines)).toMatchObject({
    version: 1,
    entry: { port: claimedPort, classification: 'verified' },
  });

  const unclaimedPort = await idlePort();
  const unclaimed = await captureOutput(() =>
    inspectPortCommand(String(unclaimedPort), { socket: runtime.socketPath }),
  );
  expect(unclaimed.lines).toEqual([`TCP port ${unclaimedPort}: available`]);
});

test('refuses reclamation without verified Portreeve ownership evidence', async () => {
  const foreign = Bun.serve({ port: 0, fetch: () => new Response('foreign') });
  try {
    const refused = await captureOutput(() =>
      reclaimPortCommand(String(foreign.port), {
        socket: runtime.socketPath,
        policy: 'graceful',
        dryRun: true,
        json: true,
      }),
    );
    expect(refused.exitCode).toBe(EXIT_CODES.conflict);
    expect(parseRenderedJson(refused.lines)).toMatchObject({
      result: { outcome: 'refused', reason: 'ownership-unverified' },
    });
  } finally {
    foreign.stop(true);
  }
});

test('plans an unsafe eviction only with explicit any-owner authorization', async () => {
  await expect(
    unsafeEvictPortCommand(String(claimedPort), {
      socket: runtime.socketPath,
      unsafeAnyOwner: false,
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: 'Unsafe eviction requires --unsafe-any-owner.',
  });

  const planned = await captureOutput(() =>
    unsafeEvictPortCommand(String(claimedPort), {
      socket: runtime.socketPath,
      unsafeAnyOwner: true,
      forceAfterGrace: true,
      dryRun: true,
    }),
  );
  expect(planned.lines[0]).toContain(`TCP port ${claimedPort}: would-terminate`);
  expect(planned.lines.slice(1).join('\n')).toMatch(/^Target: pid \d+/u);
});
