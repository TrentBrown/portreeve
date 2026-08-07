// @ts-check

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PortreeveClient,
  readEndpointSnapshot,
  writeEndpointSnapshot,
} from '../packages/client/src/index.js';
import { AllocationService } from '../src/allocation/service.js';
import { DockerCliAdapter } from '../src/docker/adapter.js';
import { prepareRuntimeDirectories } from '../src/platform/paths.js';
import { startPortreeveServer } from '../src/server/server.js';
import { openRegistry } from '../src/storage/registry.js';

const dockerExecutable = process.env.PORTREEVE_DOCKER_EXECUTABLE ?? 'docker';
const dockerImage = process.env.PORTREEVE_DOCKER_SMOKE_IMAGE ?? 'node:22.17.0-bookworm';
const gatewayHost =
  process.env.PORTREEVE_SANDBOX_GATEWAY ??
  (process.platform === 'darwin' ? 'host.docker.internal' : '172.17.0.1');
const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-feature-'));
const applicationDirectory = join(directory, 'authority');
const socketPath = join(applicationDirectory, 'portreeve.sock');
const databasePath = join(applicationDirectory, 'registry.sqlite');
const stackRoot = join(directory, 'stack-root');
const snapshotPath = join(directory, 'sandbox', 'endpoints.json');
const containerName = `portreeve-feature-final-${randomUUID().slice(0, 8)}`;
const dockerAdapter = new DockerCliAdapter({ executable: dockerExecutable });
/** @type {Bun.Server<undefined>|undefined} */
let processListener;
/** @type {Awaited<ReturnType<typeof startPortreeveServer>>|undefined} */
let server;
/** @type {ReturnType<typeof openRegistry>|undefined} */
let registry;
let containerId = '';
let summary;

try {
  const availability = await dockerAdapter.availability();
  assert.equal(
    availability.available,
    true,
    `Docker is required for the mixed-stack smoke: ${availability.reason}`,
  );
  await ensureDockerImage(dockerImage);
  await mkdir(stackRoot, { recursive: true, mode: 0o700 });
  await prepareRuntimeDirectories({ applicationDirectory, socketPath });
  registry = openRegistry(databasePath);
  const allocationService = new AllocationService({ registry });
  server = await startPortreeveServer({
    socketPath,
    allocationService,
    dockerAdapter,
  });
  const client = new PortreeveClient({ socketPath });
  const health = await client.health();
  assert(health.capabilities.includes('docker-evidence-v1'));

  const applied = await client.applyStack({
    stackRoot,
    definition: {
      version: 1,
      project: 'feature-final-mixed',
      components: {
        api: {
          docker: { service: 'api' },
          endpoints: {
            http: { docker: { containerPort: 3000 } },
          },
        },
        website: {
          endpoints: { http: {} },
          dependencies: {
            backend: { component: 'api', endpoint: 'http' },
          },
        },
      },
    },
  });
  const prepared = await client.prepareStack(applied.stack.id);
  const begun = await client.beginStackActivation(prepared.generation.id, {
    bindings: { api: 'docker' },
  });
  const apiLease = begun.leases.find(
    ({ component, endpoint }) => component === 'api' && endpoint === 'http',
  );
  const websiteLease = begun.leases.find(
    ({ component, endpoint }) => component === 'website' && endpoint === 'http',
  );
  assert(apiLease?.docker, 'Expected one Docker API lease.');
  assert(websiteLease, 'Expected one process-backed website lease.');
  assert.equal(websiteLease.bindingKind, 'process');

  processListener = Bun.serve({
    hostname: '127.0.0.1',
    port: websiteLease.port,
    fetch: () => new Response('website'),
  });
  const dockerArguments = [
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--publish',
    `127.0.0.1:${apiLease.port}:3000/tcp`,
  ];
  for (const [key, value] of Object.entries(apiLease.docker.requiredLabels)) {
    dockerArguments.push('--label', `${key}=${value}`);
  }
  dockerArguments.push(
    dockerImage,
    'node',
    '--input-type=module',
    '--eval',
    "import http from 'node:http'; http.createServer((_request, response) => response.end('api')).listen(3000, '0.0.0.0');",
  );
  containerId = (await runDocker(dockerArguments, 'start smoke container')).trim();
  assert.match(containerId, /^[a-f0-9]{64}$/u);
  await waitForHttp(apiLease.port);

  await client.confirmStackEndpoint(begun.activation.id, {
    leaseId: websiteLease.leaseId,
    leaseToken: websiteLease.leaseToken,
    rootPid: process.pid,
  });
  const confirmed = await client.confirmStackEndpoint(begun.activation.id, {
    leaseId: apiLease.leaseId,
    leaseToken: apiLease.leaseToken,
    bindingKind: 'docker',
    containerId,
  });
  assert.equal(confirmed.state, 'confirmed');

  const resolution = await client.resolveStackEndpoints(begun.activation.id, 'website');
  assert.equal(resolution.own.http?.host.port, websiteLease.port);
  assert.equal(resolution.dependencies.backend?.host.port, apiLease.port);
  assert.deepEqual(resolution.dependencies.backend?.dockerNetwork, {
    transport: 'tcp',
    host: 'api',
    port: 3000,
  });

  const snapshot = await client.createStackEndpointSnapshot(begun.activation.id, {
    component: 'website',
    gatewayHost,
  });
  await writeEndpointSnapshot(snapshotPath, snapshot);
  const consumed = await readEndpointSnapshot(snapshotPath, {
    definitionRevision: applied.stack.currentRevision,
    generationId: prepared.generation.id,
    activationId: begun.activation.id,
    component: 'website',
  });
  assert.equal(consumed.own.http?.address.host, gatewayHost);
  assert.equal(consumed.dependencies.backend?.address.host, gatewayHost);
  const serializedSnapshot = JSON.stringify(consumed);
  for (const secret of [socketPath, stackRoot, containerId, apiLease.leaseToken]) {
    assert(!serializedSnapshot.includes(secret));
  }

  const status = await client.getStackStatus(applied.stack.id);
  assert.equal(status.activation?.state, 'confirmed');
  assert.deepEqual(
    status.providers.map(({ bindingKind, status: providerStatus }) => ({
      bindingKind,
      status: providerStatus,
    })),
    [
      { bindingKind: 'docker', status: 'active' },
      { bindingKind: 'process', status: 'active' },
    ],
  );
  await assert.rejects(client.endStackActivation(begun.activation.id), (error) => {
    assert.equal(/** @type {{code?: unknown}} */ (error).code, 'conflict');
    return true;
  });
  const active = await client.reconcileStackActivation(begun.activation.id);
  assert.equal(active.changed, false);
  assert.equal(active.activation.state, 'confirmed');

  processListener.stop(true);
  processListener = undefined;
  await removeSmokeContainer();
  const lost = await waitForLostActivation(client, begun.activation.id);
  assert.equal(lost.activation.state, 'lost');
  const ended = await client.endStackActivation(begun.activation.id);
  assert.equal(ended.activation.state, 'ended');

  await rm(stackRoot, { recursive: true, force: true });
  const preview = await client.pruneStacks({
    olderThanMilliseconds: 0,
    dryRun: true,
  });
  assert(preview.candidates.some(({ stack }) => stack.id === applied.stack.id));
  const pruned = await client.pruneStacks({
    olderThanMilliseconds: 0,
    dryRun: false,
  });
  assert(pruned.deletedStackIds.includes(applied.stack.id));
  const history = await client.history({ eventType: 'stack.pruned' });
  assert(history.some(({ entityId }) => entityId === applied.stack.id));

  summary = {
    schemaVersion: 1,
    platform: `${process.platform}-${process.arch}`,
    dockerImage,
    stackId: applied.stack.id,
    generationId: prepared.generation.id,
    activationId: begun.activation.id,
    processPort: websiteLease.port,
    dockerPort: apiLease.port,
    finalActivationState: ended.activation.state,
    pruned: true,
    retainedHistory: true,
  };
} finally {
  processListener?.stop(true);
  await removeSmokeContainer();
  await server?.stop();
  registry?.close();
  await rm(directory, { recursive: true, force: true });
}

console.log(JSON.stringify(summary, null, 2));

/** @param {string} image */
async function ensureDockerImage(image) {
  const inspection = await runDockerResult(['image', 'inspect', image]);
  if (inspection.code === 0) return;
  await runDocker(['pull', image], `pull ${image}`);
}

async function removeSmokeContainer() {
  if (containerId === '') return;
  await runDockerResult(['rm', '--force', containerName]);
  containerId = '';
}

/** @param {PortreeveClient} client @param {string} activationId */
async function waitForLostActivation(client, activationId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await client.reconcileStackActivation(activationId);
    if (result.activation.state === 'lost') return result;
    await Bun.sleep(50);
  }
  throw new Error('Provider evidence did not converge to a lost activation.');
}

/** @param {number} port */
async function waitForHttp(port) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // The container publication is not ready yet.
    }
    await Bun.sleep(50);
  }
  throw new Error(`Docker publication ${port} did not become reachable.`);
}

/** @param {string[]} arguments_ @param {string} operation */
async function runDocker(arguments_, operation) {
  const result = await runDockerResult(arguments_);
  if (result.code !== 0) {
    throw new Error(
      `${operation} failed (${result.code}): ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

/** @param {string[]} arguments_ */
async function runDockerResult(arguments_) {
  const subprocess = Bun.spawn([dockerExecutable, ...arguments_], {
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ]);
  return { code, stdout: stdout.trim(), stderr: stderr.trim() };
}
