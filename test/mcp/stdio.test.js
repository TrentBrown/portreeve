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
  expect(tools).toHaveLength(15);
  expect(
    tools.every((/** @type {any} */ tool) => tool.annotations.readOnlyHint === true),
  ).toBe(true);
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
  expect(messages[1]?.result.tools).toHaveLength(15);
  expect(messages[1]?.result._meta['io.modelcontextprotocol/serverInfo']).toEqual({
    name: 'portreeve',
    version: '0.1.0',
  });
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

/** @param {Array<Record<string, unknown>>} requests */
async function runBridge(requests) {
  const child = Bun.spawn(
    [
      process.execPath,
      resolve('src/cli/main.js'),
      'mcp',
      'serve',
      '--socket',
      `/tmp/portreeve-missing-${crypto.randomUUID()}.sock`,
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
