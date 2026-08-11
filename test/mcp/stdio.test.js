// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../../packages/client/src/index.js';
import { MCP_EXCLUDED_CAPABILITIES } from '../../src/mcp/catalog.js';

const MODERN_META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': { name: 'portreeve-test', version: '1' },
};

test('stdio bridge serves legacy MCP, keeps stdout framed, and diagnoses an absent daemon', async () => {
  const messages = await runBridge([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'portreeve-test', version: '1' },
      },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'portreeve_diagnostics', arguments: {} },
    },
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'portreeve_health', arguments: {} },
    },
  ]);

  expect(messages.map(({ id }) => id)).toEqual([1, 2, 3, 4]);
  const tools = messages[1]?.result.tools;
  expect(tools).toHaveLength(45);
  expect(
    tools.filter((/** @type {any} */ tool) => tool.annotations.readOnlyHint === true),
  ).toHaveLength(19);
  expect(
    tools.filter((/** @type {any} */ tool) => tool.annotations.readOnlyHint === false),
  ).toHaveLength(26);
  const names = tools.map((/** @type {any} */ { name }) => name);
  for (const exclusion of MCP_EXCLUDED_CAPABILITIES) {
    expect(names.join(' ')).not.toContain(exclusion);
  }
  expect(messages[2]?.result.structuredContent).toMatchObject({
    ok: true,
    data: { daemon: { available: false, compatible: false } },
  });
  expect(messages[3]?.result.structuredContent).toMatchObject({
    ok: false,
    error: { code: 'portreeve_unavailable' },
  });
});

test('stdio bridge accepts the 2026-07-28 stateless opening', async () => {
  const messages = await runBridge([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'server/discover',
      params: { _meta: MODERN_META },
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: { _meta: MODERN_META },
    },
  ]);
  expect(messages[0]?.result.supportedVersions).toContain('2026-07-28');
  expect(messages[1]?.result.tools).toHaveLength(45);
  expect(messages[1]?.result._meta['io.modelcontextprotocol/serverInfo']).toEqual({
    name: 'portreeve',
    version: '0.1.0',
  });
});

test('diagnostics survive an incompatible daemon while daemon reads fail closed', async () => {
  const socketPath = `/tmp/pr-mcp-${crypto.randomUUID()}.sock`;
  const daemon = Bun.serve({
    unix: socketPath,
    fetch() {
      return Response.json({
        protocolVersion: 1,
        requestId: crypto.randomUUID(),
        data: {
          softwareVersion: '99.0.0',
          protocol: { minimum: 99, maximum: 99 },
          capabilities: [],
          pid: process.pid,
          mode: 'manual',
        },
      });
    },
  });
  try {
    const messages = await runBridge(
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'compatibility-test', version: '1' },
          },
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'portreeve_diagnostics', arguments: {} },
        },
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'portreeve_health', arguments: {} },
        },
      ],
      socketPath,
    );
    expect(messages[1]?.result.structuredContent).toMatchObject({
      ok: true,
      data: { daemon: { available: true, compatible: false } },
    });
    expect(messages[2]?.result.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'portreeve_incompatible', retryable: false },
    });
  } finally {
    daemon.stop(true);
    await rm(socketPath, { force: true });
  }
});

test('stdio bridge exits cleanly when its host sends SIGTERM', async () => {
  const child = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), 'mcp', 'serve'],
    { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
  );
  const lines = lineReader(child.stdout);
  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'signal-test', version: '1' },
      },
    })}\n`,
  );
  expect((await lines.next()).id).toBe(1);
  child.kill('SIGTERM');
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  expect(exitCode, stderr).toBe(0);
});

test('one bridge retries the daemon after it becomes available', async () => {
  const home = await mkdtemp(join(tmpdir(), 'portreeve-mcp-retry-'));
  const socketPath = join(home, 'portreeve.sock');
  const bridge = Bun.spawn(
    [
      process.execPath,
      resolve('src/cli/main.js'),
      'mcp',
      'serve',
      '--socket',
      socketPath,
    ],
    { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
  );
  const lines = lineReader(bridge.stdout);
  /** @type {ReturnType<typeof Bun.spawn> | undefined} */
  let daemon;
  try {
    bridge.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'retry-test', version: '1' },
        },
      })}\n`,
    );
    await lines.next();
    bridge.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'portreeve_health', arguments: {} },
      })}\n`,
    );
    expect((await lines.next()).result.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'portreeve_unavailable', retryable: true },
    });

    daemon = Bun.spawn(
      [process.execPath, resolve('src/cli/main.js'), 'serve', '--home', home],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const client = new PortreeveClient({ socketPath });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        await client.health();
        break;
      } catch {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      }
    }
    bridge.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'portreeve_health', arguments: {} },
      })}\n`,
    );
    expect((await lines.next()).result.structuredContent).toMatchObject({
      ok: true,
      data: { protocol: { minimum: 1, maximum: 1 } },
    });
  } finally {
    bridge.stdin.end();
    await bridge.exited;
    if (daemon !== undefined) {
      daemon.kill('SIGTERM');
      await daemon.exited;
    }
    await rm(home, { force: true, recursive: true });
  }
});

test('previews and executes a daemon-authoritative settings receipt over stdio', async () => {
  const home = await mkdtemp(join(tmpdir(), 'portreeve-mcp-receipt-'));
  const socketPath = join(home, 'portreeve.sock');
  const daemon = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), 'serve', '--home', home],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const client = new PortreeveClient({ socketPath });
  /** @type {Bun.Subprocess<'pipe', 'pipe', 'pipe'> | undefined} */
  let bridge;
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        await client.health();
        break;
      } catch {
        await Bun.sleep(20);
      }
    }
    bridge = Bun.spawn(
      [
        process.execPath,
        resolve('src/cli/main.js'),
        'mcp',
        'serve',
        '--socket',
        socketPath,
      ],
      { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
    );
    const activeBridge = bridge;
    const lines = lineReader(activeBridge.stdout);
    activeBridge.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'receipt-test', version: '1' },
        },
      })}\n`,
    );
    await lines.next();
    activeBridge.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'portreeve_settings_update_preview',
          arguments: { updates: { gracefulShutdownMilliseconds: 850 } },
        },
      })}\n`,
    );
    const preview = (await lines.next()).result.structuredContent;
    expect(preview).toMatchObject({
      ok: true,
      data: { action: 'settings.update', target: { id: 'global' } },
    });
    const receiptId = preview.data.receiptId;
    for (const id of [3, 4]) {
      activeBridge.stdin.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: {
            name: 'portreeve_settings_update_execute',
            arguments: { receiptId },
          },
        })}\n`,
      );
    }
    expect((await lines.next()).result.structuredContent).toMatchObject({
      ok: true,
      data: { changed: true, replayed: false },
    });
    expect((await lines.next()).result.structuredContent).toMatchObject({
      ok: true,
      data: { changed: false, replayed: true },
    });
  } finally {
    if (bridge !== undefined) {
      bridge.stdin.end();
      await bridge.exited;
    }
    daemon.kill('SIGTERM');
    await daemon.exited;
    await rm(home, { force: true, recursive: true });
  }
});

test('coordinates standalone and stack lifecycles without exposing credentials', async () => {
  const home = await mkdtemp(join(tmpdir(), 'portreeve-mcp-coordination-'));
  const socketPath = join(home, 'portreeve.sock');
  const daemon = Bun.spawn(
    [process.execPath, resolve('src/cli/main.js'), 'serve', '--home', home],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const client = new PortreeveClient({ socketPath });
  /** @type {Bun.Subprocess<'pipe', 'pipe', 'pipe'> | undefined} */
  let bridge;
  /** @type {ReturnType<typeof Bun.serve> | undefined} */
  let listener;
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        await client.health();
        break;
      } catch {
        await Bun.sleep(20);
      }
    }
    await client.setConfig({ leaseTtlMilliseconds: 1_000 });
    bridge = Bun.spawn(
      [
        process.execPath,
        resolve('src/cli/main.js'),
        'mcp',
        'serve',
        '--socket',
        socketPath,
      ],
      { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
    );
    const activeBridge = bridge;
    const lines = lineReader(activeBridge.stdout);
    let requestId = 0;
    /** @param {string} name @param {Record<string, unknown>} args */
    const request = async (name, args) => {
      requestId += 1;
      activeBridge.stdin.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: requestId === 1 ? 'initialize' : 'tools/call',
          params:
            requestId === 1
              ? {
                  protocolVersion: '2025-11-25',
                  capabilities: {},
                  clientInfo: { name: 'coordination-test', version: '1' },
                }
              : { name, arguments: args },
        })}\n`,
      );
      return lines.next();
    };
    await request('', {});

    const acquireInput = {
      claim: {
        project: 'mcp-test',
        workspaceRoot: home,
        component: 'standalone',
      },
    };
    const acquired = (await request('portreeve_lease_acquire', acquireInput)).result
      .structuredContent;
    expect(acquired).toMatchObject({ ok: true, data: { changed: true } });
    expect(JSON.stringify(acquired)).not.toContain('leaseToken');
    const standaloneHandle = acquired.data.credentialHandle;
    const acquireReplay = (await request('portreeve_lease_acquire', acquireInput))
      .result.structuredContent;
    expect(acquireReplay).toMatchObject({
      ok: true,
      data: { changed: false, credentialHandle: standaloneHandle },
    });

    const isolated = await runBridge(
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'isolated-test', version: '1' },
          },
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'portreeve_lease_abandon',
            arguments: {
              credentialHandle: standaloneHandle,
              reason: 'client-cancelled',
            },
          },
        },
      ],
      socketPath,
    );
    expect(isolated[1]?.result.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'portreeve_credential_unavailable' },
    });
    const abandoned = (
      await request('portreeve_lease_abandon', {
        credentialHandle: standaloneHandle,
        reason: 'client-cancelled',
      })
    ).result.structuredContent;
    expect(abandoned).toMatchObject({ ok: true, data: { changed: true } });
    expect(
      (
        await request('portreeve_lease_abandon', {
          credentialHandle: standaloneHandle,
          reason: 'client-cancelled',
        })
      ).result.structuredContent,
    ).toMatchObject({ ok: true, data: { changed: false } });

    const applied = await client.applyStack({
      stackRoot: home,
      definition: {
        version: 1,
        project: 'mcp-stack-test',
        components: {
          api: {
            endpoints: {
              http: { required: true },
              metrics: { required: false },
              debug: { required: false },
            },
          },
        },
      },
    });
    const prepared = (
      await request('portreeve_stack_prepare', { stackId: applied.stack.id })
    ).result.structuredContent;
    expect(prepared).toMatchObject({ ok: true, data: { changed: true } });
    const generationId = prepared.data.generation.id;
    const begun = (await request('portreeve_activation_begin', { generationId })).result
      .structuredContent;
    expect(begun).toMatchObject({
      ok: true,
      data: { changed: true, credentialCount: 3 },
    });
    expect(JSON.stringify(begun)).not.toContain('leaseToken');
    const activationId = begun.data.activation.id;
    const beginReplay = (await request('portreeve_activation_begin', { generationId }))
      .result.structuredContent;
    expect(beginReplay).toMatchObject({
      ok: true,
      data: { changed: false, activation: { id: activationId } },
    });
    expect(
      (
        await request('portreeve_activation_custody_extend', {
          activationId,
          custodyMinutes: 20,
        })
      ).result.structuredContent,
    ).toMatchObject({ ok: true, data: { changed: true, credentialCount: 3 } });
    expect(
      (
        await request('portreeve_activation_resolve', {
          activationId,
          component: 'api',
        })
      ).result.structuredContent,
    ).toMatchObject({ ok: true, data: { activationId, component: 'api' } });

    const byEndpoint = new Map(
      begun.data.leases.map((/** @type {any} */ lease) => [lease.endpoint, lease]),
    );
    const httpLease = byEndpoint.get('http');
    listener = Bun.serve({ port: httpLease.port, fetch: () => new Response('ok') });
    const confirmed = (
      await request('portreeve_activation_confirm_endpoint', {
        activationId,
        credentialHandle: httpLease.credentialHandle,
        bindingKind: 'process',
        rootPid: process.pid,
      })
    ).result.structuredContent;
    expect(confirmed).toMatchObject({ ok: true, data: { changed: true } });
    expect(
      (
        await request('portreeve_activation_confirm_endpoint', {
          activationId,
          credentialHandle: httpLease.credentialHandle,
          bindingKind: 'process',
          rootPid: process.pid,
        })
      ).result.structuredContent,
    ).toMatchObject({ ok: true, data: { changed: false } });
    expect(
      (
        await request('portreeve_activation_skip_endpoint', {
          activationId,
          credentialHandle: byEndpoint.get('metrics').credentialHandle,
        })
      ).result.structuredContent,
    ).toMatchObject({ ok: true, data: { changed: true } });
    expect(
      (
        await request('portreeve_activation_abandon_endpoint', {
          activationId,
          credentialHandle: byEndpoint.get('debug').credentialHandle,
          reason: 'startup-error',
        })
      ).result.structuredContent,
    ).toMatchObject({ ok: true, data: { changed: true } });

    listener.stop(true);
    listener = undefined;
    expect(
      (await request('portreeve_activation_reconcile', { activationId })).result
        .structuredContent,
    ).toMatchObject({ ok: true, data: { activation: { id: activationId } } });
    expect(
      (await request('portreeve_activation_end', { activationId })).result
        .structuredContent,
    ).toMatchObject({
      ok: true,
      data: { changed: true, activation: { id: activationId, state: 'ended' } },
    });

    const lostLease = (
      await request('portreeve_lease_acquire', {
        claim: {
          project: 'mcp-test',
          workspaceRoot: home,
          component: 'lost-bridge',
        },
      })
    ).result.structuredContent.data;
    activeBridge.stdin.end();
    await activeBridge.exited;
    bridge = undefined;
    await Bun.sleep(1_200);
    const recovered = await client.acquire({
      claim: {
        project: 'mcp-test',
        workspaceRoot: home,
        component: 'recovered-bridge',
      },
      allocation: { exactPort: lostLease.port },
    });
    expect(recovered.port).toBe(lostLease.port);
    await client.abandon(recovered, 'client-cancelled');
  } finally {
    listener?.stop(true);
    if (bridge !== undefined) {
      bridge.stdin.end();
      await bridge.exited;
    }
    daemon.kill('SIGTERM');
    await daemon.exited;
    await rm(home, { force: true, recursive: true });
  }
});

/** @param {Array<Record<string, unknown>>} requests */
async function runBridge(
  requests,
  socketPath = `/tmp/portreeve-missing-${crypto.randomUUID()}.sock`,
) {
  const child = Bun.spawn(
    [
      process.execPath,
      resolve('src/cli/main.js'),
      'mcp',
      'serve',
      '--socket',
      socketPath,
      '--label',
      'test-bridge',
    ],
    { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
  );
  child.stdin.write(
    `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
  );
  child.stdin.end();
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(exitCode, stderr).toBe(0);
  const lines = stdout.trim().split('\n');
  expect(lines).toHaveLength(requests.filter((request) => 'id' in request).length);
  return lines.map((line) => JSON.parse(line));
}

/** @param {ReadableStream<Uint8Array>} stream */
function lineReader(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return {
    async next() {
      while (!buffer.includes('\n')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('MCP bridge stdout closed before a response.');
        buffer += decoder.decode(chunk.value, { stream: true });
      }
      const index = buffer.indexOf('\n');
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      return JSON.parse(line);
    },
  };
}
