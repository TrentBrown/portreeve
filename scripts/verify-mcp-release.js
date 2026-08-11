// @ts-check

import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PortreeveClient } from '../packages/client/src/index.js';
import { MCP_TOOL_NAMES } from '../src/mcp/catalog.js';
import { McpSetupResultSchema } from '../src/mcp/setup.js';
import { PORTREEVE_VERSION } from '../src/version.js';

const releaseDirectory = resolve('dist', 'release');
const manifest = JSON.parse(
  await readFile(resolve(releaseDirectory, 'manifest.json'), 'utf8'),
);
const native = executableArtifact(
  process.platform === 'darwin' ? 'macos' : process.platform,
  process.arch === 'x64' ? 'x64' : process.arch,
);
const nativeExecutable = resolve(releaseDirectory, native.filename);
const modernMetadata = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': {
    name: 'portreeve-release-verifier',
    version: '1',
  },
};
/** @type {{schemaVersion: 1, softwareVersion: string, native: string, setupHosts: string[], mcpEras: string[], concurrentBridges: number, unavailableDaemon: boolean, incompatibleDaemon: boolean, linuxArtifacts: string[], hosts: string[]}} */
const result = {
  schemaVersion: 1,
  softwareVersion: PORTREEVE_VERSION,
  native: `${native.operatingSystem}-${native.architecture}`,
  setupHosts: [],
  mcpEras: [],
  concurrentBridges: 0,
  unavailableDaemon: false,
  incompatibleDaemon: false,
  linuxArtifacts: [],
  hosts: [],
};

assert.equal(manifest.softwareVersion, PORTREEVE_VERSION);
await chmod(nativeExecutable, 0o755);
progress('native setup generation');
await verifySetup(nativeExecutable, result.setupHosts);
progress('absent daemon behavior');
await verifyAbsentDaemon(nativeExecutable);
result.unavailableDaemon = true;
progress('incompatible daemon behavior');
await verifyIncompatibleDaemon(nativeExecutable);
result.incompatibleDaemon = true;
progress('compiled daemon with concurrent bridges');
await verifyCompiledDaemonAndConcurrentBridges(nativeExecutable);
result.concurrentBridges = 2;
result.mcpEras.push('2025-11-25', '2026-07-28');

if (process.argv.includes('--docker')) {
  progress('Linux artifacts under Docker');
  await verifyLinuxArtifacts();
}
if (process.argv.includes('--hosts')) {
  progress('real Codex and Claude Code hosts');
  await verifyRealHosts(nativeExecutable);
}

console.log(JSON.stringify(result, null, 2));

/** @param {string} step */
function progress(step) {
  console.error(`MCP release verification: ${step}`);
}

/** @param {string} operatingSystem @param {string} architecture */
function executableArtifact(operatingSystem, architecture) {
  const artifact = manifest.artifacts.find(
    (/** @type {Record<string, any>} */ candidate) =>
      candidate.type === 'executable' &&
      candidate.operatingSystem === operatingSystem &&
      candidate.architecture === architecture,
  );
  if (artifact === undefined) {
    throw new Error(`Missing ${operatingSystem}/${architecture} release artifact.`);
  }
  return artifact;
}

/** @param {string} executable @param {string[]} recordedHosts */
async function verifySetup(executable, recordedHosts) {
  for (const host of ['generic', 'codex', 'claude-code']) {
    for (const portable of [false, true]) {
      const command = [executable, 'mcp', 'setup', '--host', host, '--json'];
      if (portable) command.push('--portable');
      const execution = await run(command);
      assert.equal(execution.code, 0, execution.stderr);
      const setup = McpSetupResultSchema.parse(JSON.parse(execution.stdout).setup);
      assert.equal(setup.host, host);
      assert.equal(setup.executableMode, portable ? 'portable' : 'exact');
      if (portable) {
        assert.equal(setup.command, 'portreeve');
      } else {
        assert.notEqual(setup.command, 'portreeve');
        assert(setup.command.startsWith('/'));
      }
      assert.deepEqual(setup.args.slice(0, 2), ['mcp', 'serve']);
      recordedHosts.push(`${host}:${setup.executableMode}`);
    }
  }
}

/** @param {string} executable */
async function verifyAbsentDaemon(executable) {
  const socket = join(tmpdir(), `portreeve-missing-${crypto.randomUUID()}.sock`);
  const legacy = await runBridge(executable, socket, legacyRequests('absent-legacy'));
  assertToolCatalog(legacy[1]);
  assert.equal(legacy[2]?.result?.structuredContent?.data?.daemon?.available, false);
  assert.equal(
    legacy[3]?.result?.structuredContent?.error?.code,
    'portreeve_unavailable',
  );
  const modern = await runBridge(executable, socket, modernRequests());
  assert(modern[0]?.result?.supportedVersions?.includes('2026-07-28'));
  assertToolCatalog(modern[1]);
}

/** @param {string} executable */
async function verifyIncompatibleDaemon(executable) {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-mcp-incompatible-'));
  const socket = join(directory, 'portreeve.sock');
  const daemon = Bun.serve({
    unix: socket,
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
      executable,
      socket,
      legacyRequests('incompatible'),
    );
    assert.equal(
      messages[2]?.result?.structuredContent?.data?.daemon?.compatible,
      false,
    );
    assert.equal(
      messages[3]?.result?.structuredContent?.error?.code,
      'portreeve_incompatible',
    );
  } finally {
    daemon.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}

/** @param {string} executable */
async function verifyCompiledDaemonAndConcurrentBridges(executable) {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-mcp-release-'));
  const socket = join(directory, 'portreeve.sock');
  const daemon = Bun.spawn([executable, 'serve', '--home', directory], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  try {
    const client = new PortreeveClient({ socketPath: socket });
    const health = await waitForHealth(client);
    assert.equal(health.softwareVersion, PORTREEVE_VERSION);
    const [first, second] = await Promise.all([
      runBridge(executable, socket, diagnosticRequests('compiled-first')),
      runBridge(executable, socket, diagnosticRequests('compiled-second')),
    ]);
    const firstDiagnostic = first[1]?.result?.structuredContent?.data;
    const secondDiagnostic = second[1]?.result?.structuredContent?.data;
    assert.equal(firstDiagnostic?.daemon?.available, true);
    assert.equal(firstDiagnostic?.daemon?.compatible, true);
    assert.equal(secondDiagnostic?.daemon?.available, true);
    assert.equal(secondDiagnostic?.daemon?.compatible, true);
    assert.notEqual(firstDiagnostic?.bridge?.runId, secondDiagnostic?.bridge?.runId);
    assert.equal(firstDiagnostic?.daemon?.health?.pid, health.pid);
    assert.equal(secondDiagnostic?.daemon?.health?.pid, health.pid);
    await client.stopServer();
    assert.equal(await daemon.exited, 0);
  } finally {
    daemon.kill('SIGKILL');
    await daemon.exited;
    await rm(directory, { recursive: true, force: true });
  }
}

async function verifyLinuxArtifacts() {
  const image = process.env.PORTREEVE_MCP_DOCKER_IMAGE ?? 'node:22.17.0-bookworm';
  for (const architecture of ['arm64', 'x64']) {
    progress(`Linux ${architecture}`);
    const artifact = executableArtifact('linux', architecture);
    const executable = resolve(releaseDirectory, artifact.filename);
    const platform = architecture === 'arm64' ? 'linux/arm64' : 'linux/amd64';
    const version = await run([
      'docker',
      'run',
      '--rm',
      '--pull',
      'never',
      '--platform',
      platform,
      '--volume',
      `${executable}:/portreeve:ro`,
      image,
      '/portreeve',
      '--version',
    ]);
    assert.equal(version.code, 0, version.stderr);
    assert.equal(version.stdout.trim(), PORTREEVE_VERSION);
    const setup = await run([
      'docker',
      'run',
      '--rm',
      '--pull',
      'never',
      '--platform',
      platform,
      '--volume',
      `${executable}:/portreeve:ro`,
      image,
      '/portreeve',
      'mcp',
      'setup',
      '--host',
      'generic',
      '--portable',
      '--json',
    ]);
    assert.equal(setup.code, 0, setup.stderr);
    McpSetupResultSchema.parse(JSON.parse(setup.stdout).setup);
    const modern = await runDockerBridge(
      image,
      platform,
      executable,
      architecture,
      modernRequests(),
    );
    assert(modern[0]?.result?.supportedVersions?.includes('2026-07-28'));
    assertToolCatalog(modern[1]);
    const legacy = await runDockerBridge(
      image,
      platform,
      executable,
      architecture,
      legacyRequests(`linux-${architecture}`),
    );
    assertToolCatalog(legacy[1]);
    assert.equal(legacy[2]?.result?.structuredContent?.data?.daemon?.available, false);
    result.linuxArtifacts.push(`${architecture}:modern-and-legacy-stdio`);
  }
}

/** @param {string} image @param {string} platform @param {string} executable @param {string} architecture @param {Array<Record<string, unknown>>} requests */
async function runDockerBridge(image, platform, executable, architecture, requests) {
  const transcript = await run(
    [
      'docker',
      'run',
      '--rm',
      '--pull',
      'never',
      '--interactive',
      '--platform',
      platform,
      '--volume',
      `${executable}:/portreeve:ro`,
      image,
      '/portreeve',
      'mcp',
      'serve',
      '--socket',
      '/tmp/absent.sock',
      '--label',
      `linux-${architecture}`,
    ],
    `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
    60_000,
  );
  assert.equal(transcript.code, 0, transcript.stderr);
  return transcript.stdout
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
}

/** @param {string} executable */
async function verifyRealHosts(executable) {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-mcp-hosts-'));
  const socket = join(directory, 'portreeve.sock');
  const daemon = Bun.spawn([executable, 'serve', '--home', directory], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  try {
    await waitForHealth(new PortreeveClient({ socketPath: socket }));
    const prompt =
      'Call the portreeve_diagnostics MCP tool exactly once. Respond only PORTREEVE_MCP_OK if daemon.available and daemon.compatible are both true.';
    const codex = await run(
      [
        'codex',
        'exec',
        '--ignore-user-config',
        '--ephemeral',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
        '--json',
        '-c',
        `mcp_servers.portreeve.command=${JSON.stringify(executable)}`,
        '-c',
        `mcp_servers.portreeve.args=${JSON.stringify([
          'mcp',
          'serve',
          '--socket',
          socket,
          '--label',
          'codex-release',
        ])}`,
        prompt,
      ],
      undefined,
      180_000,
    );
    assert.equal(codex.code, 0, codex.stderr);
    assert(codex.stdout.includes('PORTREEVE_MCP_OK'));
    assert(codex.stdout.includes('portreeve_diagnostics'));
    result.hosts.push('codex:tool-call');

    const claudeConfiguration = JSON.stringify({
      mcpServers: {
        portreeve: {
          type: 'stdio',
          command: executable,
          args: ['mcp', 'serve', '--socket', socket, '--label', 'claude-release'],
        },
      },
    });
    const claude = await run(
      [
        'claude',
        '--mcp-config',
        claudeConfiguration,
        '--strict-mcp-config',
        '--allowedTools',
        'mcp__portreeve__portreeve_diagnostics',
        '--no-session-persistence',
        '--permission-mode',
        'dontAsk',
        '--output-format',
        'stream-json',
        '--verbose',
        '--max-turns',
        '3',
        '--max-budget-usd',
        '1',
        '--print',
        prompt,
      ],
      undefined,
      180_000,
    );
    assert.equal(claude.code, 0, claude.stderr);
    assert(claude.stdout.includes('PORTREEVE_MCP_OK'));
    assert(claude.stdout.includes('portreeve_diagnostics'));
    result.hosts.push('claude-code:tool-call');
  } finally {
    daemon.kill('SIGTERM');
    await daemon.exited;
    await rm(directory, { recursive: true, force: true });
  }
}

/** @param {string} label */
function legacyRequests(label) {
  return [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: label, version: '1' },
      },
    },
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
  ];
}

function modernRequests() {
  return [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'server/discover',
      params: { _meta: modernMetadata },
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: { _meta: modernMetadata },
    },
  ];
}

/** @param {string} label */
function diagnosticRequests(label) {
  return [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: label, version: '1' },
      },
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'portreeve_diagnostics', arguments: {} },
    },
  ];
}

/** @param {string} executable @param {string} socket @param {Array<Record<string, unknown>>} requests */
async function runBridge(executable, socket, requests) {
  const execution = await run(
    [executable, 'mcp', 'serve', '--socket', socket, '--label', 'release-verifier'],
    `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
  );
  assert.equal(execution.code, 0, execution.stderr);
  const lines = execution.stdout.trim().split(/\r?\n/u);
  assert.equal(
    lines.length,
    requests.filter((request) => 'id' in request).length,
    `Unexpected MCP stdout: ${execution.stdout}`,
  );
  return lines.map((line) => JSON.parse(line));
}

/** @param {Record<string, any>} message */
function assertToolCatalog(message) {
  const names = message?.result?.tools?.map(
    (/** @type {{name: string}} */ tool) => tool.name,
  );
  assert.deepEqual(names?.sort(), [...MCP_TOOL_NAMES].sort());
}

/** @param {PortreeveClient} client */
async function waitForHealth(client) {
  let lastError;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      return await client.health();
    } catch (error) {
      lastError = error;
      await Bun.sleep(20);
    }
  }
  throw lastError ?? new Error('PortReeve daemon did not become healthy.');
}

/** @param {string[]} command @param {string|undefined} [input] @param {number} [timeoutMilliseconds] */
async function run(command, input, timeoutMilliseconds = 30_000) {
  const child = Bun.spawn(command, {
    stdin: input === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (input !== undefined) {
    const stdin = child.stdin;
    if (stdin === undefined || typeof stdin === 'number') {
      throw new Error('Verification subprocess did not open stdin.');
    }
    stdin.write(input);
    stdin.end();
  }
  const timeout = setTimeout(() => child.kill('SIGKILL'), timeoutMilliseconds);
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  clearTimeout(timeout);
  return { code, stdout, stderr };
}
