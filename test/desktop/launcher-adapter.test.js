// @ts-check

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createLauncherAdapter } from '../../apps/desktop/main/launcher-adapter.js';
import { stackStatus, timestamp } from './fixtures.js';

const sessionId = '99999999-9999-4999-8999-999999999999';
const companionSessionId = '88888888-8888-4888-8888-888888888888';
const documentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('edits and trusts launcher files through opaque conflict-protected documents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-desktop-launcher-'));
  try {
    const fixture = stackAt(root);
    const trusted = new Set();
    const adapter = createLauncherAdapter({
      client: clientFor(fixture),
      runtime: runtimeFor(trusted),
      documentId: () => documentId,
      now: () => new Date(timestamp),
    });

    const opened = await adapter.openDocument(fixture.stack.id);
    expect(opened).toMatchObject({
      documentId,
      stackId: fixture.stack.id,
      stackRootName: root.split('/').at(-1),
      fileState: 'missing',
      revision: null,
      trusted: false,
      definition: null,
    });
    expect(JSON.stringify(opened)).not.toContain(root);

    const saved = await adapter.saveDocument({
      documentId,
      definition: launcherDefinition(),
      overwrite: false,
      confirmDowngrade: false,
    });
    expect(saved).toMatchObject({
      outcome: 'saved-and-trusted',
      saved: true,
      trusted: true,
      document: { fileState: 'valid', trusted: true },
    });
    const filename = join(root, 'portreeve.launcher.json');
    expect(JSON.parse(await readFile(filename, 'utf8'))).toMatchObject({
      version: 1,
      operations: { start: { command: 'bun run dev' } },
    });

    await writeFile(
      filename,
      `${JSON.stringify({ ...launcherDefinition(), shell: 'bash' }, null, 2)}\n`,
      'utf8',
    );
    const conflict = await adapter.saveDocument({
      documentId,
      definition: { ...launcherDefinition(), shell: 'zsh' },
      overwrite: false,
      confirmDowngrade: false,
    });
    expect(conflict).toMatchObject({ outcome: 'conflict', saved: false });

    const overwritten = await adapter.saveDocument({
      documentId,
      definition: { ...launcherDefinition(), shell: 'zsh' },
      overwrite: true,
      confirmDowngrade: false,
    });
    expect(overwritten).toMatchObject({
      outcome: 'saved-and-trusted',
      document: { definition: { shell: 'zsh' } },
    });
    await writeFile(
      filename,
      `${JSON.stringify(
        {
          ...launcherDefinition(),
          integration: { mode: 'verified-activation' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    const downgradeRefused = await adapter.saveDocument({
      documentId,
      definition: { ...launcherDefinition(), shell: 'zsh' },
      overwrite: true,
      confirmDowngrade: false,
    });
    expect(downgradeRefused).toMatchObject({
      outcome: 'invalid',
      error: { code: 'launcher_integration_downgrade_confirmation_required' },
    });
    expect(
      await adapter.saveDocument({
        documentId,
        definition: { ...launcherDefinition(), shell: 'zsh' },
        overwrite: true,
        confirmDowngrade: true,
      }),
    ).toMatchObject({ outcome: 'saved-and-trusted' });
    expect(trusted.size).toBeGreaterThan(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runs opaque asynchronous sessions with bounded output, cancellation, saving, and close protection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-desktop-launcher-'));
  try {
    const fixture = stackAt(root);
    await writeFile(
      join(root, 'portreeve.launcher.json'),
      `${JSON.stringify(launcherDefinition({ attached: true }), null, 2)}\n`,
      'utf8',
    );
    let attached = true;
    let savedContent = '';
    /** @type {any[]} */
    const outputEvents = [];
    /** @type {any[]} */
    const sessionEvents = [];
    const runtime = runtimeFor(new Set(), {
      listAttached: () => (attached ? [{ stackRoot: root, startedAt: timestamp }] : []),
      /** @param {any} input */
      async execute(input) {
        input.onOutput({ stream: 'stdout', text: 'server starting\n' });
        await new Promise((resolvePromise) =>
          input.signal.addEventListener('abort', resolvePromise, { once: true }),
        );
        attached = false;
        return launcherResult('cancelled');
      },
    });
    const client = clientFor(fixture);
    let daemonAvailable = true;
    const getStackStatus = client.getStackStatus;
    client.getStackStatus = async (stackId) => {
      if (!daemonAvailable)
        throw Object.assign(new Error('offline'), { code: 'unavailable' });
      return getStackStatus(stackId);
    };
    const adapter = createLauncherAdapter({
      client,
      runtime,
      sessionId: (() => {
        const ids = [sessionId, companionSessionId];
        return () => ids.shift() ?? companionSessionId;
      })(),
      now: () => new Date(timestamp),
      async saveOutput({ content }) {
        savedContent = content;
        return { schemaVersion: 1, outcome: 'saved', filename: 'caregiver-start.log' };
      },
    });
    adapter.subscribeOutput((event) => outputEvents.push(event));
    adapter.subscribeSessions((event) => sessionEvents.push(event));

    const begun = await adapter.begin({
      stackId: fixture.stack.id,
      operation: 'start',
      runStartAnyway: false,
      allowDegraded: false,
    });
    expect(begun).toMatchObject({ sessionId, state: 'running' });
    await Bun.sleep(0);
    expect(outputEvents).toHaveLength(1);
    expect(
      adapter
        .output(sessionId)
        .chunks.map(({ text }) => text)
        .join(''),
    ).toBe('server starting\n');
    expect(adapter.closeState()).toMatchObject({
      allowed: false,
      attached: [{ stackId: fixture.stack.id, project: 'caregiver' }],
    });
    await adapter.begin({
      stackId: fixture.stack.id,
      operation: 'status',
      runStartAnyway: false,
      allowDegraded: false,
    });
    expect(adapter.closeState().attached).toHaveLength(1);
    expect(JSON.stringify(adapter.closeState())).not.toContain(root);
    daemonAvailable = false;
    expect(await adapter.terminateAttached(fixture.stack.id)).toEqual({
      schemaVersion: 1,
      stackId: fixture.stack.id,
      requested: true,
    });

    expect(adapter.cancelSession(sessionId).state).toBe('running');
    expect(adapter.cancelSession(companionSessionId).state).toBe('running');
    await Bun.sleep(0);
    const terminal = adapter.inspectSession(sessionId);
    expect(terminal).toMatchObject({
      state: 'terminal',
      result: { outcome: 'cancelled', failure: null },
    });
    expect(sessionEvents.map(({ state }) => state)).toEqual([
      'running',
      'running',
      'terminal',
      'terminal',
    ]);
    expect(adapter.closeState()).toEqual({
      schemaVersion: 1,
      allowed: true,
      attached: [],
    });
    expect(await adapter.saveOutput(sessionId)).toMatchObject({ outcome: 'saved' });
    expect(savedContent).toBe('server starting\n');
    expect(JSON.stringify(terminal)).not.toMatch(
      /processGroupId|stackRoot|shellPath|credential|"environment":|"command":/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reduces launcher inventory and durable history without exposing root authority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-desktop-launcher-'));
  try {
    const fixture = stackAt(root);
    await writeFile(
      join(root, 'portreeve.launcher.json'),
      `${JSON.stringify(launcherDefinition(), null, 2)}\n`,
      'utf8',
    );
    const client = clientFor(fixture, [historyRecord(fixture)]);
    const adapter = createLauncherAdapter({
      client,
      runtime: runtimeFor(new Set()),
      now: () => new Date(timestamp),
    });
    const snapshot = await adapter.list();
    expect(snapshot).toMatchObject({
      stale: false,
      launchers: [
        {
          stackId: fixture.stack.id,
          fileState: 'valid',
          evidence: { classification: 'stopped' },
          history: [{ operation: 'start', outcome: 'failed' }],
        },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain(root);
    expect(JSON.stringify(snapshot)).not.toMatch(/callerOperationId|processGroupId/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('redacts unexpected main-process failure details from launcher inventory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portreeve-desktop-launcher-'));
  try {
    const fixture = stackAt(root);
    const client = clientFor(fixture);
    client.getStackStatus = async () => {
      throw Object.assign(new Error(`EACCES while reading ${root}/private`), {
        code: 'EACCES',
      });
    };
    const adapter = createLauncherAdapter({
      client,
      runtime: runtimeFor(new Set()),
      now: () => new Date(timestamp),
    });

    const snapshot = await adapter.list();
    expect(snapshot).toMatchObject({
      stale: true,
      launchers: [
        {
          stackId: fixture.stack.id,
          error: {
            code: 'EACCES',
            message: 'The launcher operation failed without additional safe details.',
          },
        },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** @param {string} root */
function stackAt(root) {
  const fixture = structuredClone(stackStatus());
  fixture.stack.stackRoot = root;
  return fixture;
}

/** @param {any} fixture @param {any[]} [history] */
function clientFor(fixture, history = []) {
  return {
    async listStacks() {
      return [fixture.stack];
    },
    /** @param {string} stackId */
    async getStackStatus(stackId) {
      expect(stackId).toBe(fixture.stack.id);
      return fixture;
    },
    async listLauncherOperations() {
      return history;
    },
  };
}

/** @param {Set<string>} trusted @param {Record<string, unknown>} [lifecycle] */
function runtimeFor(trusted, lifecycle = {}) {
  return {
    stateStore: {
      /** @param {string} _root @param {string} revision */
      async trust(_root, revision) {
        trusted.add(revision);
      },
      /** @param {string} _root @param {string} revision */
      async isTrusted(_root, revision) {
        return trusted.has(revision);
      },
    },
    evidenceService: {
      async inspectDaemon() {
        return { summary: evidence(), endpoints: [] };
      },
    },
    lifecycleService: {
      listAttached: () => [],
      terminateAttached: () => true,
      async execute() {
        return launcherResult('succeeded');
      },
      ...lifecycle,
    },
  };
}

/** @param {{attached?: boolean}} [options] */
function launcherDefinition(options = {}) {
  return {
    version: 1,
    integration: { mode: 'command-only' },
    shell: 'system',
    workingDirectory: '.',
    operations: {
      start: {
        command: 'bun run dev',
        mode: options.attached ? 'attached' : 'finite',
        ...(options.attached ? {} : { timeoutSeconds: 300 }),
      },
      stop: { command: 'bun run stop', timeoutSeconds: 120 },
    },
    environment: [],
  };
}

/** @param {'succeeded'|'cancelled'} outcome */
function launcherResult(outcome) {
  return {
    operation: 'start',
    outcome,
    degraded: false,
    environmentSource: 'daemon',
    beforeEvidence: evidence(),
    afterEvidence: evidence(),
    steps: [
      {
        step: 'start',
        command: {
          outcome,
          shellPath: '/bin/zsh',
          startedAt: timestamp,
          completedAt: timestamp,
          durationMilliseconds: 0,
          exitCode: outcome === 'succeeded' ? 0 : null,
          signal: outcome === 'cancelled' ? 'SIGTERM' : null,
          processGroupId: 12345,
          output: {
            chunks: [],
            truncated: false,
            retainedBytes: 0,
            totalBytes: 0,
          },
          failure: null,
        },
      },
    ],
    failure: null,
    integration: {
      mode: 'command-only',
      verified: false,
      upgradeSuggested: false,
      generationId: null,
      activationId: null,
    },
    daemonOperation: null,
  };
}

function evidence() {
  return {
    classification: 'stopped',
    source: 'daemon',
    observedAt: timestamp,
    generationId: null,
    activationId: null,
    listenerCount: 0,
    reasonCodes: ['generation-missing'],
  };
}

/** @param {any} fixture */
function historyRecord(fixture) {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    stackId: fixture.stack.id,
    stackRoot: fixture.stack.stackRoot,
    operation: 'start',
    executionMode: 'finite',
    launcherRevision: 'c'.repeat(64),
    callerOperationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    generationId: null,
    state: 'terminal',
    outcome: 'failed',
    deadlineAt: timestamp,
    startedAt: timestamp,
    renewedAt: timestamp,
    completedAt: timestamp,
    durationMilliseconds: 0,
    exitCode: 1,
    signal: null,
    degraded: false,
    beforeEvidence: evidence(),
    afterEvidence: evidence(),
    failure: { step: 'start', code: 'launcher_command_failed', message: 'Failed.' },
    integration: null,
  };
}
