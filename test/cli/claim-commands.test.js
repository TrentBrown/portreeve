// @ts-check

import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  deleteClaimCommand,
  listClaimsCommand,
  reassignClaimCommand,
  showClaimCommand,
} from '../../src/cli/commands/claims.js';
import {
  captureOutput,
  idlePort,
  parseRenderedJson,
  startCliRuntime,
} from '../fixtures/cli-runtime.js';

/** @type {Awaited<ReturnType<typeof startCliRuntime>>} */
let runtime;
/** @type {string} */
let claimId;

beforeAll(async () => {
  runtime = await startCliRuntime('portreeve-claim-command');
  const lease = await runtime.client.acquire({
    claim: {
      project: 'claim-tests',
      workspaceRoot: runtime.directory,
      service: 'api',
    },
    allocation: { exactPort: await idlePort() },
  });
  await runtime.client.abandon(lease, 'client-cancelled');
  claimId = lease.claimId;
});

afterAll(async () => {
  await runtime.stop();
});

test('lists unassigned claims in both output modes', async () => {
  const json = await captureOutput(() =>
    listClaimsCommand({ socket: runtime.socketPath, json: true }),
  );
  expect(parseRenderedJson(json.lines)).toMatchObject({
    version: 1,
    claims: expect.arrayContaining([expect.objectContaining({ id: claimId })]),
  });

  const human = await captureOutput(() =>
    listClaimsCommand({ socket: runtime.socketPath }),
  );
  expect(human.lines).toEqual([
    `${claimId}  claim-tests/api  unassigned  ${runtime.directory}`,
  ]);
});

test('shows one claim with its identity and assignment', async () => {
  const human = await captureOutput(() =>
    showClaimCommand(claimId, { socket: runtime.socketPath }),
  );

  expect(human.lines).toEqual([
    `Claim: ${claimId}`,
    'Identity: claim-tests/api',
    `Workspace: ${runtime.directory}`,
    'Mode: sticky',
    'Assigned port: unassigned',
  ]);
});

test('rejects malformed claim identifiers before contacting the server', async () => {
  await expect(
    showClaimCommand('not a claim id', { socket: runtime.socketPath }),
  ).rejects.toBeInstanceOf(Error);
});

test('reassigns a claim to an exact port and refuses contradictory intents', async () => {
  await expect(
    reassignClaimCommand(claimId, {
      socket: runtime.socketPath,
      preferredPort: '4100',
      exactPort: '4200',
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: '--preferred-port and --exact-port are mutually exclusive.',
  });

  const exactPort = await idlePort();
  const exact = await captureOutput(() =>
    reassignClaimCommand(claimId, {
      socket: runtime.socketPath,
      exactPort: String(exactPort),
    }),
  );
  expect(exact.lines).toEqual([
    `Reassigned claim-tests/api to TCP port ${String(exactPort)}.`,
  ]);

  const preferredPort = await idlePort();
  const preferred = await captureOutput(() =>
    reassignClaimCommand(claimId, {
      socket: runtime.socketPath,
      json: true,
      preferredPort: String(preferredPort),
    }),
  );
  const rendered = parseRenderedJson(preferred.lines);
  const reassignedPort = rendered.claim.assignedPort;
  expect(rendered).toMatchObject({
    version: 1,
    claim: { id: claimId, assignedPort: expect.any(Number) },
  });

  const assigned = await captureOutput(() =>
    showClaimCommand(claimId, { socket: runtime.socketPath }),
  );
  expect(assigned.lines).toContain(`Assigned port: ${String(reassignedPort)}`);

  const listed = await captureOutput(() =>
    listClaimsCommand({ socket: runtime.socketPath }),
  );
  expect(listed.lines).toEqual([
    `${claimId}  claim-tests/api  ${String(reassignedPort)}  ${runtime.directory}`,
  ]);
});

test('deletes an idle claim and then reports it as absent', async () => {
  const deleted = await captureOutput(() =>
    deleteClaimCommand(claimId, { socket: runtime.socketPath }),
  );
  expect(deleted.exitCode).toBe(0);
  expect(deleted.lines).toEqual([`Deleted claim ${claimId}.`]);

  await expect(
    deleteClaimCommand(claimId, { socket: runtime.socketPath, json: true }),
  ).rejects.toMatchObject({ code: 'not_found' });
});

test('reports an empty claim registry as a plain sentence', async () => {
  const empty = await captureOutput(() =>
    listClaimsCommand({ socket: runtime.socketPath }),
  );

  expect(empty.lines).toEqual(['No PortReeve claims.']);
});
