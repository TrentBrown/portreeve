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

## Low-level API

The `PortreeveClient` exposes `health`, `acquire`, `confirm`, `abandon`, `release`,
`listPorts`, `inspectPort`, `reclaimPort`, `unsafeEvictPort`, `listClaims`, `getClaim`,
`reassignClaim`, `deleteClaim`, `pruneClaims`, `applyStack`, `listStacks`, `getStack`,
`getConfig`, `setConfig`, `history`, `logs`, and `stopServer`.

Construct it with `{ socketPath }` only when overriding the per-user default. Failures
reject with `PortreeveClientError`, whose stable fields are `code`, optional HTTP
`status`, `requestId`, `retryable`, and `details`.

Migrated services should fail loudly on `code === "unavailable"`. They must not fall
back to legacy probing or silently start/install Portreeve.
