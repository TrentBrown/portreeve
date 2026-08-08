// @ts-check

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyStackCommand,
  beginStackActivationCommand,
  confirmStackEndpointCommand,
  endStackActivationCommand,
  listStacksCommand,
  prepareStackCommand,
  pruneStacksCommand,
  reconcileStackActivationCommand,
  renewStackActivationCommand,
  resolveStackEndpointsCommand,
  showStackActivationCommand,
  showStackCommand,
  showStackGenerationCommand,
  snapshotStackEndpointsCommand,
  stackStatusCommand,
} from '../../src/cli/commands/stacks.js';
import { EXIT_CODES } from '../../src/protocol/constants.js';
import {
  captureOutput,
  idlePort,
  parseRenderedJson,
  startCliRuntime,
} from '../fixtures/cli-runtime.js';

/** @type {Awaited<ReturnType<typeof startCliRuntime>>} */
let runtime;
/** @type {string} */
let stackRoot;
/** @type {string} */
let definitionFile;
/** @type {string} */
let stackId;

beforeAll(async () => {
  runtime = await startCliRuntime('portreeve-stack-command');
  await mkdir(join(runtime.directory, 'stack'), { recursive: true });
  stackRoot = await realpath(join(runtime.directory, 'stack'));
  definitionFile = join(stackRoot, 'portreeve.stack.json');
  await writeFile(
    definitionFile,
    JSON.stringify({
      version: 1,
      project: 'stack-command-tests',
      components: {
        api: {
          endpoints: { http: { allocation: { preferredPort: await idlePort() } } },
        },
        website: {
          endpoints: { http: { allocation: { preferredPort: await idlePort() } } },
          dependencies: { backend: { component: 'api', endpoint: 'http' } },
        },
      },
    }),
  );
});

afterAll(async () => {
  await runtime.stop();
});

test('applies a definition once and reports an equivalent re-apply as unchanged', async () => {
  const applied = await captureOutput(() =>
    applyStackCommand({
      file: definitionFile,
      socket: runtime.socketPath,
      json: true,
    }),
  );
  expect(applied.exitCode).toBe(0);
  const rendered = parseRenderedJson(applied.lines);
  expect(rendered).toMatchObject({
    version: 1,
    result: { changed: true, stack: { project: 'stack-command-tests', stackRoot } },
  });
  stackId = rendered.result.stack.id;

  const unchanged = await captureOutput(() =>
    applyStackCommand({ stackRoot, socket: runtime.socketPath }),
  );
  expect(unchanged.exitCode).toBe(EXIT_CODES.stateDifference);
  expect(unchanged.lines).toEqual([
    `Unchanged stack-command-tests/${stackRoot} at revision ${rendered.result.stack.currentRevision}.`,
  ]);
});

test('reports an unreadable definition as a usage failure', async () => {
  const invalidRoot = join(runtime.directory, 'invalid-stack');
  await mkdir(invalidRoot, { recursive: true });
  await writeFile(join(invalidRoot, 'portreeve.stack.json'), 'not json');

  await expect(
    applyStackCommand({ stackRoot: invalidRoot, socket: runtime.socketPath }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: expect.stringContaining('Unable to read a valid stack definition from'),
  });
});

test('lists, shows, and reports status for the registered stack', async () => {
  const listed = await captureOutput(() =>
    listStacksCommand({ stackRoot, socket: runtime.socketPath }),
  );
  expect(listed.lines).toHaveLength(1);
  expect(listed.lines[0]).toContain(`stack-command-tests/${stackRoot}`);

  const empty = await captureOutput(() =>
    listStacksCommand({ project: 'absent-project', socket: runtime.socketPath }),
  );
  expect(empty.lines).toEqual(['No Portreeve stacks.']);

  const shown = await captureOutput(() =>
    showStackCommand(stackId, { socket: runtime.socketPath }),
  );
  expect(shown.lines).toEqual([
    `Stack: ${stackId}`,
    `Identity: stack-command-tests/${stackRoot}`,
    expect.stringMatching(/^Revision: [0-9a-f]{64}$/u),
    'Components: 2',
  ]);

  const status = await captureOutput(() =>
    stackStatusCommand({ stackRoot, socket: runtime.socketPath }),
  );
  expect(status.lines).toEqual([
    `Stack: ${stackId}`,
    `Identity: stack-command-tests/${stackRoot}`,
    expect.stringMatching(/^Revision: /u),
    'Generation: none',
    'Activation: none',
  ]);

  const unregistered = await captureOutput(() =>
    stackStatusCommand({ stackRoot: runtime.directory, socket: runtime.socketPath }),
  );
  expect(unregistered.exitCode).toBe(EXIT_CODES.stateDifference);
  expect(unregistered.lines).toEqual([
    `No Portreeve stack is registered for ${await realpath(runtime.directory)}.`,
  ]);
});

test('coordinates one activation from preparation through confirmation and end', async () => {
  const prepared = await captureOutput(() =>
    prepareStackCommand(stackId, { socket: runtime.socketPath, json: true }),
  );
  expect(prepared.exitCode).toBe(0);
  const generation = parseRenderedJson(prepared.lines).result.generation;
  expect(generation.endpoints).toHaveLength(2);

  const reused = await captureOutput(() =>
    prepareStackCommand(stackId, { socket: runtime.socketPath }),
  );
  expect(reused.exitCode).toBe(EXIT_CODES.stateDifference);
  expect(reused.lines[0]).toBe(`Reused generation ${generation.id}.`);

  const generationShown = await captureOutput(() =>
    showStackGenerationCommand(generation.id, { socket: runtime.socketPath }),
  );
  expect(generationShown.lines.slice(0, 3)).toEqual([
    `Generation: ${generation.id}`,
    `Revision: ${generation.revision}`,
    `State: ${generation.state}`,
  ]);

  const began = await captureOutput(() =>
    beginStackActivationCommand(generation.id, {
      socket: runtime.socketPath,
      json: true,
      skipEndpoint: [],
      requiredEndpoint: ['api.http', '{"component":"website","endpoint":"http"}'],
    }),
  );
  const begun = parseRenderedJson(began.lines).result;
  expect(begun.leases).toHaveLength(2);
  const activationId = begun.activation.id;

  const humanActivation = await captureOutput(() =>
    showStackActivationCommand(activationId, { socket: runtime.socketPath }),
  );
  expect(humanActivation.lines[0]).toBe(`Activation: ${activationId}`);
  expect(humanActivation.lines[2]).toBe('State: starting');

  const leasesFile = join(runtime.directory, 'leases.json');
  await writeFile(
    leasesFile,
    JSON.stringify(
      begun.leases.map(
        (/** @type {{leaseId: string, leaseToken: string}} */ lease) => ({
          leaseId: lease.leaseId,
          leaseToken: lease.leaseToken,
        }),
      ),
    ),
  );
  const renewed = await captureOutput(() =>
    renewStackActivationCommand(activationId, {
      leasesFile,
      socket: runtime.socketPath,
    }),
  );
  expect(renewed.lines).toEqual([`Renewed 2 leases for activation ${activationId}.`]);

  /** @type {Array<import('bun').Server<undefined>>} */
  const listeners = [];
  try {
    for (const lease of begun.leases) {
      listeners.push(
        Bun.serve({ port: lease.port, fetch: () => new Response(lease.component) }),
      );
      const leaseFile = join(runtime.directory, `${lease.component}.lease.json`);
      await writeFile(
        leaseFile,
        JSON.stringify({ leaseId: lease.leaseId, leaseToken: lease.leaseToken }),
      );
      const confirmed = await captureOutput(() =>
        confirmStackEndpointCommand(activationId, {
          leaseFile,
          rootPid: String(process.pid),
          socket: runtime.socketPath,
          json: true,
        }),
      );
      expect(parseRenderedJson(confirmed.lines)).toMatchObject({
        version: 1,
        activation: { id: activationId },
      });
    }

    const resolved = await captureOutput(() =>
      resolveStackEndpointsCommand(activationId, {
        component: 'website',
        socket: runtime.socketPath,
      }),
    );
    expect(resolved.lines).toContain(`Activation: ${activationId}`);
    expect(resolved.lines.join('\n')).toMatch(/dependency\.backend -> api\.http/u);

    const snapshotFile = join(runtime.directory, 'snapshot.json');
    const snapshot = await captureOutput(() =>
      snapshotStackEndpointsCommand(activationId, {
        component: 'website',
        gatewayHost: 'host.docker.internal',
        file: snapshotFile,
        socket: runtime.socketPath,
      }),
    );
    expect(snapshot.lines[0]).toBe(`Wrote endpoint snapshot ${snapshotFile}.`);
    expect(JSON.parse(await readFile(snapshotFile, 'utf8'))).toMatchObject({
      activationId,
      component: 'website',
    });

    const reconciled = await captureOutput(() =>
      reconcileStackActivationCommand(activationId, { socket: runtime.socketPath }),
    );
    expect(reconciled.lines[0]).toContain(`activation ${activationId}: confirmed`);
  } finally {
    for (const listener of listeners) {
      listener.stop(true);
    }
  }

  const ended = await captureOutput(() =>
    endStackActivationCommand(activationId, { socket: runtime.socketPath }),
  );
  expect(ended.exitCode).toBe(0);
  expect(ended.lines).toEqual([`Ended activation ${activationId}.`]);

  const alreadyEnded = await captureOutput(() =>
    endStackActivationCommand(activationId, { socket: runtime.socketPath }),
  );
  expect(alreadyEnded.exitCode).toBe(EXIT_CODES.stateDifference);
  expect(alreadyEnded.lines).toEqual([`Already ended activation ${activationId}.`]);
}, 30_000);

test('rejects malformed endpoint references, lease files, and root PIDs', async () => {
  await expect(
    beginStackActivationCommand('00000000-0000-4000-8000-000000000000', {
      socket: runtime.socketPath,
      requiredEndpoint: ['.'],
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: 'Invalid endpoint reference: ..',
  });

  await expect(
    beginStackActivationCommand('00000000-0000-4000-8000-000000000000', {
      socket: runtime.socketPath,
      skipEndpoint: ['{"component":}'],
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: expect.stringContaining('Invalid JSON endpoint reference'),
  });

  const missingFile = join(runtime.directory, 'absent.json');
  await expect(
    renewStackActivationCommand('00000000-0000-4000-8000-000000000000', {
      leasesFile: missingFile,
      socket: runtime.socketPath,
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: expect.stringContaining('Unable to read valid JSON from'),
  });

  const objectLeases = join(runtime.directory, 'object-leases.json');
  await writeFile(objectLeases, JSON.stringify({ leaseId: 'a' }));
  await expect(
    renewStackActivationCommand('00000000-0000-4000-8000-000000000000', {
      leasesFile: objectLeases,
      socket: runtime.socketPath,
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: 'The leases file must contain a JSON array.',
  });

  const incompleteLease = join(runtime.directory, 'incomplete.lease.json');
  await writeFile(incompleteLease, JSON.stringify({ leaseId: 'a' }));
  await expect(
    confirmStackEndpointCommand('00000000-0000-4000-8000-000000000000', {
      leaseFile: incompleteLease,
      rootPid: '1',
      socket: runtime.socketPath,
    }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: 'The lease file must contain leaseId and leaseToken strings.',
  });

  const completeLease = join(runtime.directory, 'complete.lease.json');
  await writeFile(
    completeLease,
    JSON.stringify({ leaseId: 'lease', leaseToken: 'token' }),
  );
  for (const rootPid of ['0', '-1', '1.5', 'many']) {
    await expect(
      confirmStackEndpointCommand('00000000-0000-4000-8000-000000000000', {
        leaseFile: completeLease,
        rootPid,
        socket: runtime.socketPath,
      }),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      message: '--root-pid must be a positive integer.',
    });
  }
});

test('previews stack pruning without deleting live stack roots', async () => {
  const preview = await captureOutput(() =>
    pruneStacksCommand({
      socket: runtime.socketPath,
      olderThan: '0',
      dryRun: true,
      json: true,
    }),
  );

  expect(parseRenderedJson(preview.lines)).toMatchObject({
    version: 1,
    result: { dryRun: true, candidates: [], deletedStackIds: [] },
  });

  await expect(
    pruneStacksCommand({ socket: runtime.socketPath, olderThan: '0' }),
  ).rejects.toMatchObject({
    code: 'invalid_input',
    message: expect.stringContaining('Noninteractive stack pruning requires --yes'),
  });
});
