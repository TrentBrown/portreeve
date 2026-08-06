# JavaScript client

Install the separately versioned official client:

```sh
npm install portreeve
```

It supports ESM on Node.js 22 or newer and Bun 1.3.14 or newer. All production
operations use the public Unix-socket protocol. The package has no runtime dependencies
and does not start or install Portreeve.

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

## Stack definitions

`applyStack({ workspaceRoot, definition })` validates through the same public contract
as the CLI and returns `{ changed, stack }`. `listStacks(filters)` and
`getStack(stackId)` inspect the normalized stored definition and its content-addressed
current revision. These methods coordinate definitions and claims only; they do not
start project processes or run Docker Compose. Before applying, the client checks server
health for `stack-definitions-v1`; an older daemon fails explicitly with
`incompatible_protocol` before mutation.

```js
const result = await client.applyStack({
  workspaceRoot: import.meta.dir,
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

Preparation never starts project processes, and the client does not own startup order,
health checks, or Docker Compose. `getStackActivation(id)` reports network-ownership
coordination state, not application readiness.

## Low-level API

The `PortreeveClient` exposes `health`, `acquire`, `confirm`, `abandon`, `release`,
`listPorts`, `inspectPort`, `reclaimPort`, `unsafeEvictPort`, `listClaims`, `getClaim`,
`reassignClaim`, `deleteClaim`, `pruneClaims`, `applyStack`, `listStacks`, `getStack`,
`prepareStack`, `beginStackActivation`, `getStackActivation`, `renewStackActivation`,
`confirmStackEndpoint`, `abandonStackEndpoint`, `skipStackEndpoint`,
`getStackGeneration`, `endStackActivation`, `getConfig`, `setConfig`, `history`, `logs`,
`resolveStackEndpoints`, `createStackEndpointSnapshot`, and `stopServer`.

Construct it with `{ socketPath }` only when overriding the per-user default. Failures
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
  gatewayHost:
    process.platform === 'darwin' ? 'host.docker.internal' : '172.17.0.1',
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

The snapshot contains no Portreeve socket or mutation credential. Mount it read-only in
the sandbox; the host launcher remains responsible for selecting the correct gateway and
replacing the document when activation identity changes.

Migrated services should fail loudly on `code === "unavailable"`. They must not fall
back to legacy probing or silently start/install Portreeve.
