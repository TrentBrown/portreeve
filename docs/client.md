# JavaScript client

Install the separately versioned official client:

```sh
npm install portreeve
```

It supports ESM on Node.js 22 or newer and Bun 1.3.14 or newer. All production
operations use the public Unix-socket protocol. The package has no runtime dependencies
and does not start or install PortReeve.

## High-level startup helper

`withPort(request, start)` performs acquire, calls `start(port)`, confirms the bound
listener, and returns `{ port, run, value, release }`. Address-in-use errors are
abandoned and retried with a fresh allocation, up to `maxAttempts` (default 3). Other
startup errors are abandoned and rethrown.

```js
const running = await client.withPort(
  {
    claim: {
      project: 'caregiver',
      workspaceRoot: import.meta.dir,
      component: 'website',
      endpoint: 'default',
    },
    allocation: {
      mode: 'sticky',
      preferredPort: 3000,
      replacementPolicy: 'never',
    },
    maxAttempts: 3,
  },
  async (port) => startWebsite(port),
);

await running.release();
```

The client canonicalizes `workspaceRoot` to the real Git worktree root when it is inside
Git, preventing symlink and subdirectory spellings from creating duplicate identities.

For compatibility, `service` remains an alias for `component` with endpoint `default`.
New integrations should use `component` and `endpoint`.

Low-level coordinators may call `renewLease({ leaseId, leaseToken })` while a
standalone lease is still pending. This extends only that pending lease; confirmation
or abandonment permanently settles the credential. Most application code should use
`withPort`, while adapters that retain credentials must keep them out of logs and
persistence.

## Stack definitions

`applyStack({ stackRoot, definition })` validates through the same public contract
as the CLI and returns `{ changed, stack }`. `listStacks(filters)`,
`getStack(stackId)`, and `getStackStatus(stackId)` inspect the normalized stored
definition, its content-addressed current revision, and the latest generation,
activation, and fresh provider evidence. These methods coordinate definitions and claims only; they do not
start project processes or run Docker Compose. Before applying, the client checks server
health for `stack-definitions-v1`; an older daemon fails explicitly with
`incompatible_protocol` before mutation.

```js
const result = await client.applyStack({
  stackRoot: import.meta.dir,
  definition: {
    version: 1,
    project: 'caregiver',
    components: {
      api: {
        endpoints: {
          http: { allocation: { preferredPort: 8080 } },
        },
      },
    },
  },
});
```

The client resolves `stackRoot` to the real path of the exact selected directory. It
does not reinterpret that directory as a Git worktree root, so one runnable stack may
span a non-Git parent containing multiple child repositories. Registered stack roots
may be siblings but cannot be equal, ancestors, or descendants of one another.

The client accepts an already parsed definition and does not discover, read, or write
`portreeve.stack.json`. Project CLIs may use the documented upward file discovery in
the PortReeve CLI, while PortReeve Desktop uses its separate trusted document boundary.
In every case the socket request contains the canonical `stackRoot` and strict
definition; applying never prepares allocations or starts providers.

`prepareStack(stackId)` creates or reuses a complete immutable allocation generation.
`beginStackActivation(generationId, options)` then creates one activation and returns
its activation-scoped lease tokens atomically. The launcher should renew pending leases
with `renewStackActivation`, bind each provider, and call `confirmStackEndpoint` using
that provider's root PID. It may call `skipStackEndpoint` only for an optional endpoint,
or `abandonStackEndpoint` when startup fails.

```js
const { generation } = await client.prepareStack(result.stack.id);
const begun = await client.beginStackActivation(generation.id, {
  skippedEndpoints: [{ component: 'api', endpoint: 'metrics' }],
});

const lease = begun.leases.find(
  ({ component, endpoint }) => component === 'api' && endpoint === 'http',
);
const server = await startApi(lease.port);
await client.confirmStackEndpoint(begun.activation.id, {
  leaseId: lease.leaseId,
  leaseToken: lease.leaseToken,
  rootPid: server.pid,
});
```

Docker leases expose `bindingKind`, `docker.service`, `docker.containerPort`, and
`docker.requiredLabels`. Apply those labels through the trusted launcher, publish the
allocated loopback port, then confirm with `{ leaseId, leaseToken, bindingKind:
"docker", containerId }`. The client preflights `docker-evidence-v1`; Docker absence
does not affect process-only calls.

```js
const begun = await client.beginStackActivation(generation.id, {
  bindings: { api: 'docker' },
});
const lease = begun.leases.find(
  ({ component, endpoint }) => component === 'api' && endpoint === 'http',
);
const containerId = await launcher.startContainer({
  service: lease.docker.service,
  labels: lease.docker.requiredLabels,
  publish: {
    host: '127.0.0.1',
    hostPort: lease.port,
    containerPort: lease.docker.containerPort,
  },
});
await client.confirmStackEndpoint(begun.activation.id, {
  leaseId: lease.leaseId,
  leaseToken: lease.leaseToken,
  bindingKind: 'docker',
  containerId,
});
```

Preparation never starts project processes, and the client does not own startup order,
health checks, or Docker Compose. `getStackActivation(id)` reports network-ownership
coordination state, not application readiness.

After launcher loss, `reconcileStackActivation(id)` returns fresh per-provider
`active`, `gone`, or `unknown` evidence. Only an activation whose providers are all
conclusively gone becomes `lost`, allowing the generation to be reused when it remains
valid. `endStackActivation(id)` uses the same evidence and refuses active or unobservable
providers.

`pruneStacks({ olderThanMilliseconds, dryRun })` returns candidate and blocked
missing-stack-root stacks. Passing `dryRun: false` requests execution-time revalidation and
atomic deletion; CLI-style interactive or `--yes` consent remains a CLI responsibility.

## Launcher-operation coordination

Project commands remain outside PortReeve, but independent launchers coordinate their
lifecycle operations through renewable daemon sessions:

```js
const session = await client.beginLauncherOperation(result.stack.id, {
  operation: 'start',
  launcherRevision,
  generationId: generation.id,
});

const renewal = setInterval(() => {
  void client.renewLauncherOperation(session.operation.id, session.credential);
}, session.renewAfterMilliseconds);

try {
  await projectLauncher.start();
  await client.completeLauncherOperation(
    session.operation.id,
    session.credential,
    { outcome: 'succeeded', exitCode: 0 },
  );
} finally {
  clearInterval(renewal);
}
```

Begin preflights `launcher-operations-v1`. The server stores only a hash of the returned
credential. Renew before the 30-second deadline; abandoned sessions become `lost`
without PortReeve adopting or terminating project processes. Completion accepts only
strict safe metadata and is idempotent when retried identically. Use
`getLauncherOperation` and `listLauncherOperations` for credential-free inspection. Raw
command output and environment values are not accepted by any launcher-operation method.

## Low-level API

The `PortreeveClient` exposes `health`, `acquire`, `confirm`, `abandon`, `release`,
`listPorts`, `inspectPort`, `reclaimPort`, `unsafeEvictPort`, `listClaims`, `getClaim`,
`reassignClaim`, `deleteClaim`, `pruneClaims`, `applyStack`, `listStacks`, `getStack`,
`previewPortReclaim`, `executePortReclaim`, `previewClaimReassign`,
`executeClaimReassign`, `previewClaimDelete`, `executeClaimDelete`,
`previewClaimsPrune`, `executeClaimsPrune`, `getStackDocument`,
`validateStackDefinition`, `previewStackApply`, `executeStackApply`,
`previewStacksPrune`, `executeStacksPrune`, `previewConfigUpdate`, and
`executeConfigUpdate`,
`getStackStatus`,
`prepareStack`, `beginStackActivation`, `getStackActivation`,
`listStackActivations`, `renewLease`, `renewStackActivation`,
`confirmStackEndpoint`, `abandonStackEndpoint`, `skipStackEndpoint`,
`getStackGeneration`, `listStackGenerations`, `reconcileStackActivation`,
`endStackActivation`, `pruneStacks`,
`beginLauncherOperation`, `renewLauncherOperation`, `completeLauncherOperation`,
`getLauncherOperation`, `listLauncherOperations`,
`getConfig`, `setConfig`, `history`, `historyPage`, `logs`,
`resolveStackEndpoints`, `createStackEndpointSnapshot`, and `stopServer`.

Construct it with `{ socketPath }` only when overriding the per-user default. Callers
may also provide diagnostic-only `origin` metadata with `kind`, optional `runId`, and
optional `label`; PortReeve records it in mutation history without treating it as
authority. `historyPage` returns newest-first bounded cursor pages, while `history`
continues to collect and return the requested events in chronological order for CLI
and library callers. Failures
reject with `PortreeveClientError`, whose stable fields are `code`, optional HTTP
`status`, `requestId`, `retryable`, and `details`.

## Dependency and sandbox discovery

`resolveStackEndpoints(activationId, component)` returns only that component's own
published endpoints and declared dependency aliases. Host publication and optional
Docker-network facts remain separate, and all facts come from the activation's one
immutable generation.

The trusted launcher can request a redacted sandbox document, then replace a private
runtime file atomically:

```js
import { PortreeveClient, writeEndpointSnapshot } from 'portreeve';

const snapshot = await client.createStackEndpointSnapshot(activation.id, {
  component: 'website',
  gatewayHost: process.platform === 'darwin' ? 'host.docker.internal' : '172.17.0.1',
});
await writeEndpointSnapshot('/private/runtime/endpoints.json', snapshot);
```

Sandbox consumers import `readEndpointSnapshot`. It reads an explicit path or
`PORTREEVE_ENDPOINTS_FILE`, rejects unknown fields and documents larger than 1 MiB, and
can compare expected revision, generation, activation, or component identity:

```js
import { readEndpointSnapshot } from 'portreeve';

const endpoints = await readEndpointSnapshot(undefined, {
  generationId: expectedGeneration,
  component: 'website',
});
```

The snapshot contains no PortReeve socket or mutation credential. Mount it read-only in
the sandbox; the host launcher remains responsible for selecting the correct gateway and
replacing the document when activation identity changes.

Migrated services should fail loudly on `code === "unavailable"`. They must not fall
back to legacy probing or silently start/install PortReeve.
