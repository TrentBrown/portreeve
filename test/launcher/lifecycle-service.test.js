// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/client.js';
import { AllocationService } from '../../src/allocation/service.js';
import { LauncherEvidenceService } from '../../src/launcher/evidence-service.js';
import { LauncherEnvironmentService } from '../../src/launcher/environment-service.js';
import { LauncherLifecycleService } from '../../src/launcher/lifecycle-service.js';
import { createLauncherLocalStateStore } from '../../src/launcher/local-state.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { InventoryService } from '../../src/reconciliation/inventory.js';
import { startPortreeveServer } from '../../src/server/server.js';
import { openRegistry } from '../../src/storage/registry.js';

const revision = 'a'.repeat(64);
const generation = {
  id: '22222222-2222-4222-8222-222222222222',
  stackId: '11111111-1111-4111-8111-111111111111',
  revision: 'b'.repeat(64),
  state: /** @type {const} */ ('valid'),
  endpoints: [
    {
      claimId: '33333333-3333-4333-8333-333333333333',
      component: 'api',
      endpoint: 'default',
      transport: /** @type {const} */ ('tcp'),
      host: '127.0.0.1',
      port: 43100,
      required: true,
    },
  ],
  createdAt: '2026-08-08T20:00:00.000Z',
  invalidatedAt: null,
};
const stack = {
  id: generation.stackId,
  project: 'example',
  stackRoot: '/worktrees/example',
  currentRevision: generation.revision,
  definition: {
    version: 1,
    project: 'example',
    components: { api: { endpoints: { default: {} } } },
  },
  createdAt: '2026-08-08T20:00:00.000Z',
  updatedAt: '2026-08-08T20:00:00.000Z',
  lastUsedAt: '2026-08-08T20:00:00.000Z',
};

/** @param {Partial<{restart: boolean, status: boolean}>} [options] */
function launcher(options = {}) {
  return {
    stackRoot: stack.stackRoot,
    workingDirectory: stack.stackRoot,
    revision,
    definition: {
      version: 1,
      integration: { mode: 'command-only' },
      shell: 'system',
      workingDirectory: '.',
      operations: {
        start: { command: 'project start', mode: 'finite', timeoutSeconds: 300 },
        stop: { command: 'project stop', timeoutSeconds: 120 },
        ...(options.restart
          ? { restart: { command: 'project restart', timeoutSeconds: 420 } }
          : {}),
        ...(options.status
          ? { status: { command: 'project status', timeoutSeconds: 30 } }
          : {}),
      },
      environment: [],
    },
  };
}

/** @param {'stopped' | 'partial' | 'fully-observed' | 'verified' | 'conflicting' | 'uncertain'} classification @param {Partial<{trusted: boolean, daemonUnavailable: boolean, hasGeneration: boolean, commandOutcome: 'succeeded' | 'failed' | 'cancelled' | 'timed-out', renewFailure: boolean, slowRenewal: boolean, changeGenerationAtBegin: boolean}>} [options] */
function harness(classification, options = {}) {
  let currentClassification = classification;
  let currentGeneration = options.hasGeneration === false ? null : generation;
  let renewing = false;
  const calls = /** @type {any} */ ({
    environments: [],
    commands: [],
    begins: [],
    completions: [],
    renewals: 0,
    completionRaced: false,
    locals: 0,
  });
  const status = () => ({
    stack,
    generation: currentGeneration,
    activation: null,
    providers: [],
  });
  const summary = (/** @type {'daemon' | 'local'} */ source = 'daemon') => ({
    classification: currentClassification,
    source,
    observedAt: '2026-08-08T20:01:00.000Z',
    generationId: currentGeneration?.id ?? null,
    activationId: null,
    listenerCount: currentClassification === 'stopped' ? 0 : 1,
    reasonCodes: [],
  });
  const client = {
    socketPath: '/private/portreeve.sock',
    async getStackStatus() {
      if (options.daemonUnavailable) throw codedError('unavailable', 'daemon down');
      return status();
    },
    async prepareStack() {
      currentGeneration = generation;
      return { reused: false, generation };
    },
    async beginLauncherOperation(
      /** @type {string} */ _stackId,
      /** @type {any} */ input,
    ) {
      calls.begins.push(input);
      if (options.changeGenerationAtBegin) currentGeneration = null;
      return {
        operation: { id: '44444444-4444-4444-8444-444444444444' },
        credential: 'credential',
        renewAfterMilliseconds:
          options.renewFailure || options.slowRenewal ? 1 : 10_000,
      };
    },
    async renewLauncherOperation() {
      calls.renewals += 1;
      if (options.renewFailure) throw codedError('unavailable', 'renew failed');
      if (options.slowRenewal) {
        renewing = true;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
        renewing = false;
      }
      return { renewAfterMilliseconds: 10_000 };
    },
    async completeLauncherOperation(
      /** @type {string} */ _id,
      /** @type {string} */ _credential,
      /** @type {any} */ completion,
    ) {
      calls.completionRaced = renewing;
      calls.completions.push(completion);
      return {
        operation: { id: '44444444-4444-4444-8444-444444444444', ...completion },
      };
    },
  };
  const cache = {
    revision,
    resolvedAt: '2026-08-08T19:00:00.000Z',
    stackId: stack.id,
    generationId: generation.id,
    activationId: null,
    socketPath: client.socketPath,
    environment: { PORTREEVE_STACK_ROOT: stack.stackRoot, API_PORT: '43100' },
    endpoints: [
      { component: 'api', endpoint: 'default', hostPort: 43100, required: true },
    ],
  };
  const service = new LauncherLifecycleService(
    /** @type {any} */ ({
      client,
      stateStore: {
        async isTrusted() {
          return options.trusted ?? true;
        },
        async cached() {
          return cache;
        },
      },
      environmentService: {
        async resolve(/** @type {any} */ input) {
          calls.environments.push(input);
          if (input.generation === undefined) await client.prepareStack();
          return {
            source: 'daemon',
            environment: {
              PORTREEVE_STACK_ROOT: stack.stackRoot,
              PORTREEVE_GENERATION_ID: generation.id,
              API_PORT: '43100',
            },
            generationId: generation.id,
          };
        },
      },
      evidenceService: {
        async inspectDaemon() {
          return { summary: summary(), endpoints: [] };
        },
        async inspectLocal() {
          calls.locals += 1;
          return { summary: summary('local'), endpoints: [] };
        },
      },
      async runCommand(/** @type {any} */ input) {
        calls.commands.push(input);
        if (options.renewFailure) {
          await new Promise((resolvePromise) => {
            input.signal.addEventListener('abort', resolvePromise, { once: true });
          });
          return commandResult('cancelled');
        }
        if (options.slowRenewal) {
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 3));
        }
        return commandResult(options.commandOutcome ?? 'succeeded');
      },
      resolveShell: () => '/bin/sh',
      operationId: () => '55555555-5555-4555-8555-555555555555',
    }),
  );
  return {
    service,
    calls,
    setClassification(
      /** @type {'stopped' | 'partial' | 'fully-observed' | 'verified' | 'conflicting' | 'uncertain'} */ value,
    ) {
      currentClassification = value;
    },
  };
}

test('refuses every untrusted launcher before collecting evidence', async () => {
  const fixture = harness('stopped', { trusted: false });
  const result = await fixture.service.execute({
    operation: 'start',
    stack,
    launcher: launcher(),
  });
  expect(result).toMatchObject({
    outcome: 'failed',
    failure: { step: 'trust', code: 'launcher_untrusted' },
  });
  expect(fixture.calls.begins).toHaveLength(0);
});

test('applies the Start evidence state table and retains partial generations', async () => {
  for (const classification of [
    'verified',
    'fully-observed',
    'conflicting',
    'uncertain',
    'partial',
  ]) {
    const fixture = harness(/** @type {any} */ (classification));
    const blocked = await fixture.service.execute({
      operation: 'start',
      stack,
      launcher: launcher(),
    });
    expect(blocked.outcome).toBe('failed');
    expect(fixture.calls.commands).toHaveLength(0);
  }

  const repair = harness('partial');
  const repaired = await repair.service.execute({
    operation: 'start',
    stack,
    launcher: launcher(),
    runStartAnyway: true,
  });
  expect(repaired.outcome).toBe('succeeded');
  expect(repair.calls.environments[0]).toMatchObject({ generation });
  expect(repair.calls.commands).toHaveLength(1);

  const stopped = harness('stopped', { hasGeneration: false });
  const started = await stopped.service.execute({
    operation: 'start',
    stack,
    launcher: launcher(),
  });
  expect(started.outcome).toBe('succeeded');
  expect(stopped.calls.environments[0]).not.toHaveProperty('generation');
  expect(stopped.calls.begins[0]).toMatchObject({ generationId: generation.id });
});

test('Stop always runs only the project command even with no generation or listener', async () => {
  const fixture = harness('stopped', { hasGeneration: false });
  const result = await fixture.service.execute({
    operation: 'stop',
    stack,
    launcher: launcher(),
  });
  expect(result).toMatchObject({
    outcome: 'succeeded',
    environmentSource: 'daemon-minimal',
    steps: [{ step: 'stop', command: { outcome: 'succeeded' } }],
  });
  expect(fixture.calls.environments).toHaveLength(0);
  expect(fixture.calls.commands[0]).toMatchObject({
    command: 'project stop',
    environment: {
      PORTREEVE_STACK_ROOT: stack.stackRoot,
      PORTREEVE_STACK_ID: stack.id,
      PORTREEVE_SOCKET: '/private/portreeve.sock',
    },
  });
});

test('refuses a command when its resolved generation changes before execution', async () => {
  const fixture = harness('stopped', { changeGenerationAtBegin: true });
  const result = await fixture.service.execute({
    operation: 'start',
    stack,
    launcher: launcher(),
  });
  expect(result).toMatchObject({
    outcome: 'failed',
    failure: { step: 'admission', code: 'launcher_generation_changed' },
  });
  expect(fixture.calls.commands).toHaveLength(0);
  expect(fixture.calls.completions[0]).toMatchObject({
    outcome: 'failed',
    failure: { code: 'launcher_generation_changed' },
  });
});

test('keeps project Status output advisory beside fresh evidence', async () => {
  const fixture = harness('fully-observed', { commandOutcome: 'failed' });
  const result = await fixture.service.execute({
    operation: 'status',
    stack,
    launcher: launcher({ status: true }),
  });
  expect(result).toMatchObject({
    outcome: 'failed',
    beforeEvidence: { classification: 'fully-observed' },
    afterEvidence: { classification: 'fully-observed' },
    failure: { step: 'status', code: 'launcher_command_failed' },
  });
  expect(fixture.calls.completions[0]).toMatchObject({
    outcome: 'failed',
    afterEvidence: { classification: 'fully-observed' },
  });
});

test('composes missing Restart as Stop, fresh revalidation, then Start', async () => {
  const fixture = harness('fully-observed');
  let commands = 0;
  const original = fixture.service.runCommand;
  fixture.service.runCommand = async (input) => {
    commands += 1;
    if (commands === 1) fixture.setClassification('stopped');
    if (commands === 2) fixture.setClassification('fully-observed');
    return original(input);
  };
  const result = await fixture.service.execute({
    operation: 'restart',
    stack,
    launcher: launcher(),
  });
  expect(result).toMatchObject({
    outcome: 'succeeded',
    steps: [{ step: 'stop' }, { step: 'start' }],
    afterEvidence: { classification: 'fully-observed' },
  });
  expect(
    fixture.calls.commands.map(
      (/** @type {{command: string}} */ command) => command.command,
    ),
  ).toEqual(['project stop', 'project start']);
});

test('composed Restart refuses Start when fresh post-Stop evidence is partial', async () => {
  const fixture = harness('fully-observed');
  const original = fixture.service.runCommand;
  fixture.service.runCommand = async (input) => {
    fixture.setClassification('partial');
    return original(input);
  };
  const result = await fixture.service.execute({
    operation: 'restart',
    stack,
    launcher: launcher(),
  });
  expect(result).toMatchObject({
    outcome: 'failed',
    steps: [{ step: 'stop' }],
    failure: { step: 'restart-revalidation', code: 'launcher_start_anyway_required' },
  });
});

test('allows only confirmed degraded Stop and cached degraded Status', async () => {
  const start = harness('stopped', { daemonUnavailable: true });
  expect(
    await start.service.execute({ operation: 'start', stack, launcher: launcher() }),
  ).toMatchObject({ failure: { code: 'launcher_daemon_required' } });

  const stop = harness('fully-observed', { daemonUnavailable: true });
  expect(
    await stop.service.execute({ operation: 'stop', stack, launcher: launcher() }),
  ).toMatchObject({ failure: { code: 'launcher_degraded_confirmation_required' } });
  const stopped = await stop.service.execute({
    operation: 'stop',
    stack,
    launcher: launcher(),
    allowDegraded: true,
  });
  expect(stopped).toMatchObject({
    outcome: 'succeeded',
    degraded: true,
    environmentSource: 'cached',
    beforeEvidence: { source: 'local' },
    daemonOperation: null,
  });
  expect(stop.calls.begins).toHaveLength(0);
});

test('cancels execution when operation-session renewal is lost', async () => {
  const fixture = harness('stopped', { renewFailure: true });
  const result = await fixture.service.execute({
    operation: 'start',
    stack,
    launcher: launcher(),
  });
  expect(result).toMatchObject({
    outcome: 'failed',
    failure: { step: 'coordination-renew', code: 'unavailable' },
  });
  expect(fixture.calls.renewals).toBe(1);
  expect(fixture.calls.completions[0]).toMatchObject({
    outcome: 'failed',
    failure: { step: 'coordination-renew' },
  });
});

test('settles an in-flight renewal before completing the operation session', async () => {
  const fixture = harness('stopped', { slowRenewal: true });
  const result = await fixture.service.execute({
    operation: 'start',
    stack,
    launcher: launcher(),
  });
  expect(result.outcome).toBe('succeeded');
  expect(fixture.calls.renewals).toBe(1);
  expect(fixture.calls.completionRaced).toBe(false);
});

test('executes through the official Unix-socket client and persists only safe history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-lifecycle-integration-'));
  const applicationDirectory = join(directory, 'data');
  const socketPath = join(directory, 'runtime', 'portreeve.sock');
  await prepareRuntimeDirectories({ applicationDirectory, socketPath });
  const registry = openRegistry(join(applicationDirectory, 'registry.sqlite'));
  const inventoryService = new InventoryService({
    registry,
    inspectListeners: async () => [],
  });
  const server = await startPortreeveServer({
    socketPath,
    allocationService: new AllocationService({ registry }),
    inventoryService,
  });
  try {
    const client = new PortreeveClient({ socketPath });
    const stackRoot = await realpath(directory);
    const applied = await client.applyStack({
      stackRoot,
      definition: {
        version: 1,
        project: 'lifecycle-integration',
        components: { api: { endpoints: { default: {} } } },
      },
    });
    const stateStore = createLauncherLocalStateStore({
      path: join(applicationDirectory, 'launcher-state.json'),
    });
    await stateStore.trust(stackRoot, revision);
    const definition = {
      version: 1,
      integration: { mode: /** @type {const} */ ('command-only') },
      shell: /** @type {const} */ ('system'),
      workingDirectory: '.',
      operations: {
        start: {
          command: 'printf "%s" "$API_PORT" > launcher-observed-port.txt',
          mode: /** @type {const} */ ('finite'),
          timeoutSeconds: 5,
        },
        stop: { command: 'printf stopped', timeoutSeconds: 5 },
      },
      environment: [
        {
          name: 'API_PORT',
          endpoint: { component: 'api', endpoint: 'default' },
          value: /** @type {const} */ ('host-port'),
        },
      ],
    };
    const environmentService = new LauncherEnvironmentService({ client, stateStore });
    const lifecycle = new LauncherLifecycleService({
      client,
      stateStore,
      environmentService,
      evidenceService: new LauncherEvidenceService({ client }),
    });
    const result = await lifecycle.execute({
      operation: 'start',
      stack: applied.stack,
      launcher: { stackRoot, workingDirectory: stackRoot, revision, definition },
    });
    expect(result).toMatchObject({
      outcome: 'succeeded',
      degraded: false,
      beforeEvidence: { classification: 'stopped', source: 'daemon' },
      afterEvidence: { classification: 'stopped', source: 'daemon' },
      daemonOperation: { state: 'terminal', outcome: 'succeeded' },
    });
    const observedPort = await readFile(
      join(stackRoot, 'launcher-observed-port.txt'),
      'utf8',
    );
    expect(Number(observedPort)).toBeGreaterThan(0);
    const history = await client.listLauncherOperations(applied.stack.id);
    expect(history).toHaveLength(1);
    expect(history[0]).not.toHaveProperty('environment');
    expect(history[0]).not.toHaveProperty('rawOutput');
  } finally {
    await server.stop();
    registry.close();
    await rm(directory, { recursive: true, force: true });
  }
});

/** @param {'succeeded' | 'failed' | 'cancelled' | 'timed-out'} outcome */
function commandResult(outcome) {
  return {
    outcome,
    shellPath: '/bin/sh',
    startedAt: '2026-08-08T20:01:00.000Z',
    completedAt: '2026-08-08T20:01:01.000Z',
    durationMilliseconds: 1_000,
    exitCode: outcome === 'succeeded' ? 0 : outcome === 'failed' ? 1 : null,
    signal: outcome === 'cancelled' || outcome === 'timed-out' ? 'SIGTERM' : null,
    processGroupId: 123,
    output: { chunks: [], truncated: false, retainedBytes: 0, totalBytes: 0 },
    failure:
      outcome === 'succeeded'
        ? null
        : { code: `launcher_command_${outcome}`, message: `command ${outcome}` },
  };
}

/** @param {string} code @param {string} message */
function codedError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
