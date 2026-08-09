// @ts-check

import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/index.js';
import { AllocationService } from '../../src/allocation/service.js';
import {
  initLauncherCommand,
  runLauncherCommand,
  trustLauncherCommand,
  validateLauncherCommand,
} from '../../src/cli/commands/launcher.js';
import { readLauncherDocument } from '../../src/launcher/document.js';
import { createLauncherLocalStateStore } from '../../src/launcher/local-state.js';
import { prepareRuntimeDirectories } from '../../src/platform/paths.js';
import { InventoryService } from '../../src/reconciliation/inventory.js';
import { startPortreeveServer } from '../../src/server/server.js';
import { openRegistry } from '../../src/storage/registry.js';

test('interactive init previews, exclusively creates, and trusts exact launcher bytes', async () => {
  const fixture = await launcherFixture();
  try {
    const answers = [
      '',
      'printf "start\\n"',
      'printf "stop\\n"',
      '',
      'printf "status\\n"',
      '',
      '',
      '',
      '',
      'yes',
    ];
    /** @type {string[]} */
    const review = [];
    const output = await captureConsole(() =>
      initLauncherCommand(
        fixture.options,
        interaction(answers, (text) => review.push(text)),
      ),
    );
    const rendered = JSON.parse(output[0] ?? '{}');
    expect(rendered).toMatchObject({
      version: 1,
      result: {
        created: true,
        trusted: true,
        stackRoot: fixture.stackRoot,
        definition: {
          shell: 'system',
          integration: { mode: 'command-only' },
          operations: {
            start: { command: 'printf "start\\n"', mode: 'finite' },
            stop: { command: 'printf "stop\\n"' },
            status: { command: 'printf "status\\n"' },
          },
          environment: [
            {
              name: 'API_PORT',
              endpoint: { component: 'api', endpoint: 'default' },
              value: 'host-port',
            },
          ],
        },
      },
    });
    expect(review.join('')).toContain('Exact portreeve.launcher.json preview');
    expect(review.join('')).toContain('API_PORT <- api.default');
    const launcher = await readLauncherDocument(fixture.stackRoot, {
      stackDefinition: fixture.stack.definition,
    });
    expect(
      await createLauncherLocalStateStore({
        path: join(fixture.home, 'launcher-state.json'),
      }).isTrusted(fixture.stackRoot, launcher.revision),
    ).toBe(true);
    await expect(initLauncherCommand(fixture.options, interaction([]))).rejects.toThrow(
      'already exists',
    );
  } finally {
    await fixture.close();
  }
});

test('validate permits an unapplied launcher while noninteractive trust refuses', async () => {
  const fixture = await launcherFixture();
  try {
    await createLauncherFile(fixture.stackRoot);
    const output = await captureConsole(() => validateLauncherCommand(fixture.options));
    expect(JSON.parse(output[0] ?? '{}')).toMatchObject({
      launcher: { valid: true, applied: true, trusted: false },
    });
    await expect(trustLauncherCommand(fixture.options)).rejects.toThrow(
      'requires an interactive terminal',
    );
    const trusted = await captureConsole(() =>
      trustLauncherCommand(fixture.options, interaction(['yes'])),
    );
    expect(JSON.parse(trusted[0] ?? '{}')).toMatchObject({
      result: { trusted: true, stackRoot: fixture.stackRoot },
    });
    const filename = join(fixture.stackRoot, 'portreeve.launcher.json');
    await writeFile(filename, `${await readFile(filename, 'utf8')}\n`);
    const changed = await captureConsole(() =>
      validateLauncherCommand(fixture.options),
    );
    expect(JSON.parse(changed[0] ?? '{}').launcher.trusted).toBe(false);
  } finally {
    await fixture.close();
  }

  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-unapplied-'));
  const stackRoot = join(directory, 'stack');
  const home = join(directory, 'home');
  await mkdir(stackRoot, { recursive: true });
  await writeStackDefinition(stackRoot);
  await createLauncherFile(stackRoot);
  try {
    const output = await captureConsole(() =>
      validateLauncherCommand({
        stackRoot,
        home,
        socket: join(directory, 'missing.sock'),
        json: true,
      }),
    );
    expect(JSON.parse(output[0] ?? '{}')).toMatchObject({
      launcher: {
        valid: true,
        applied: false,
        daemonAvailable: false,
        trusted: false,
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('interactive partial Start confirmation is passed back through the shared engine', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-confirm-'));
  const stackRoot = await realpath(directory);
  await writeStackDefinition(stackRoot);
  await createLauncherFile(stackRoot);
  const stack = stackRecord(stackRoot);
  /** @type {boolean[]} */
  const calls = [];
  const runtime = {
    client: {
      async listStacks() {
        return [stack];
      },
    },
    stateStore: {
      async read() {
        return { launchers: [] };
      },
    },
    lifecycleService: {
      async execute(/** @type {any} */ input) {
        calls.push(input.runStartAnyway);
        return input.runStartAnyway
          ? successfulResult('start')
          : failedResult('start', 'launcher_start_anyway_required');
      },
    },
  };
  try {
    const output = await captureConsole(() =>
      runLauncherCommand(
        'start',
        { stackRoot, json: true },
        interaction(['yes']),
        runtime,
      ),
    );
    expect(calls).toEqual([false, true]);
    expect(JSON.parse(output[0] ?? '{}').result.outcome).toBe('succeeded');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('compiled-style CLI lifecycle uses exact trust and cached degraded context', async () => {
  const fixture = await launcherFixture();
  try {
    await createLauncherFile(fixture.stackRoot);
    const launcher = await readLauncherDocument(fixture.stackRoot, {
      stackDefinition: fixture.stack.definition,
    });
    const untrusted = await runCli(
      ['launcher', 'start', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(untrusted.exitCode).toBe(20);
    expect(JSON.parse(untrusted.stdout).result.failure).toMatchObject({
      code: 'launcher_untrusted',
    });
    await createLauncherLocalStateStore({
      path: join(fixture.home, 'launcher-state.json'),
    }).trust(fixture.stackRoot, launcher.revision);

    const start = await runCli(
      ['launcher', 'start', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(start.exitCode, start.stderr).toBe(0);
    expect(JSON.parse(start.stdout)).toMatchObject({
      version: 1,
      result: {
        operation: 'start',
        outcome: 'succeeded',
        degraded: false,
        afterEvidence: { classification: 'stopped', source: 'daemon' },
      },
    });

    const status = await runCli(
      ['launcher', 'status', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(status.exitCode, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).result.steps[0]).toMatchObject({
      step: 'status',
      command: { outcome: 'succeeded' },
    });

    const restart = await runCli(
      ['launcher', 'restart', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(restart.exitCode, restart.stderr).toBe(0);
    expect(JSON.parse(restart.stdout).result.steps).toMatchObject([
      { step: 'stop', command: { outcome: 'succeeded' } },
      { step: 'start', command: { outcome: 'succeeded' } },
    ]);

    const nestedDirectory = join(fixture.stackRoot, 'services', 'api');
    await mkdir(nestedDirectory, { recursive: true });
    const implicitStatus = await runCli(
      [
        'launcher',
        'status',
        '--home',
        fixture.home,
        '--socket',
        fixture.socket,
        '--json',
      ],
      nestedDirectory,
    );
    expect(implicitStatus.exitCode, implicitStatus.stderr).toBe(0);
    expect(JSON.parse(implicitStatus.stdout).result.operation).toBe('status');

    await fixture.stopServer();
    const blockedStart = await runCli(
      ['launcher', 'start', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(blockedStart.exitCode).toBe(30);
    expect(JSON.parse(blockedStart.stdout).result.failure).toMatchObject({
      code: 'launcher_daemon_required',
    });

    const cachedStatus = await runCli(
      ['launcher', 'status', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(cachedStatus.exitCode, cachedStatus.stderr).toBe(0);
    expect(JSON.parse(cachedStatus.stdout).result).toMatchObject({
      operation: 'status',
      outcome: 'succeeded',
      degraded: true,
      environmentSource: 'cached',
      beforeEvidence: { source: 'local' },
    });

    const blockedStop = await runCli(
      ['launcher', 'stop', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(blockedStop.exitCode).toBe(20);
    expect(JSON.parse(blockedStop.stdout).result.failure).toMatchObject({
      code: 'launcher_degraded_confirmation_required',
    });

    const confirmedStop = await runCli(
      ['launcher', 'stop', '--allow-degraded', ...fixture.cliOptions],
      fixture.stackRoot,
    );
    expect(confirmedStop.exitCode, confirmedStop.stderr).toBe(0);
    expect(JSON.parse(confirmedStop.stdout).result).toMatchObject({
      operation: 'stop',
      outcome: 'succeeded',
      degraded: true,
    });
  } finally {
    await fixture.close();
  }
});

async function launcherFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-launcher-cli-'));
  const stackRoot = await realpath(
    await mkdir(join(directory, 'stack'), { recursive: true }).then(() =>
      join(directory, 'stack'),
    ),
  );
  const home = join(directory, 'home');
  const socket = join(directory, 'runtime', 'portreeve.sock');
  await writeStackDefinition(stackRoot);
  await prepareRuntimeDirectories({ applicationDirectory: home, socketPath: socket });
  const registry = openRegistry(join(home, 'registry.sqlite'));
  const inventoryService = new InventoryService({
    registry,
    inspectListeners: async () => [],
  });
  let server = await startPortreeveServer({
    socketPath: socket,
    allocationService: new AllocationService({ registry }),
    inventoryService,
  });
  const client = new PortreeveClient({ socketPath: socket });
  const applied = await client.applyStack({
    stackRoot,
    definition: stackDefinition(),
  });
  let stopped = false;
  return {
    directory,
    stackRoot,
    home,
    socket,
    stack: applied.stack,
    options: { stackRoot, home, socket, json: true },
    cliOptions: [
      '--stack-root',
      stackRoot,
      '--home',
      home,
      '--socket',
      socket,
      '--json',
    ],
    async stopServer() {
      if (stopped) return;
      stopped = true;
      await server.stop();
    },
    async close() {
      if (!stopped) await server.stop();
      registry.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

/** @returns {any} */
function stackDefinition() {
  return {
    version: 1,
    project: 'launcher-cli',
    components: { api: { endpoints: { default: {} } } },
  };
}

/** @param {string} stackRoot */
function stackRecord(stackRoot) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    project: 'launcher-cli',
    stackRoot,
    currentRevision: 'a'.repeat(64),
    definition: stackDefinition(),
    createdAt: '2026-08-08T20:00:00.000Z',
    updatedAt: '2026-08-08T20:00:00.000Z',
    lastUsedAt: '2026-08-08T20:00:00.000Z',
  };
}

/** @param {string} operation */
function successfulResult(operation) {
  return {
    operation,
    outcome: 'succeeded',
    degraded: false,
    environmentSource: null,
    beforeEvidence: null,
    afterEvidence: null,
    steps: [],
    failure: null,
    daemonOperation: null,
  };
}

/** @param {string} operation @param {string} code */
function failedResult(operation, code) {
  return {
    ...successfulResult(operation),
    outcome: 'failed',
    failure: { step: 'admission', code, message: 'confirmation required' },
  };
}

/** @param {string} stackRoot */
async function writeStackDefinition(stackRoot) {
  await writeFile(
    join(stackRoot, 'portreeve.stack.json'),
    `${JSON.stringify(stackDefinition(), null, 2)}\n`,
  );
}

/** @param {string} stackRoot */
async function createLauncherFile(stackRoot) {
  await writeFile(
    join(stackRoot, 'portreeve.launcher.json'),
    `${JSON.stringify(
      {
        version: 1,
        operations: {
          start: { command: 'printf "start\\n"' },
          stop: { command: 'printf "stop\\n"' },
          status: { command: 'printf "status\\n"' },
        },
        environment: [
          {
            name: 'API_PORT',
            endpoint: { component: 'api' },
            value: 'host-port',
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

/** @param {string[]} answers @param {(text: string) => void} [write] */
function interaction(answers, write = () => {}) {
  return {
    interactive: true,
    async question() {
      const answer = answers.shift();
      if (answer === undefined) throw new Error('Test interaction ran out of answers.');
      return answer;
    },
    write,
  };
}

/** @param {() => Promise<void>} callback */
async function captureConsole(callback) {
  const original = console.log;
  /** @type {string[]} */
  const lines = [];
  console.log = (value) => lines.push(String(value));
  try {
    await callback();
    return lines;
  } finally {
    console.log = original;
    process.exitCode = undefined;
  }
}

/** @param {string[]} arguments_ @param {string} cwd */
async function runCli(arguments_, cwd) {
  const child = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), ...arguments_],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}
