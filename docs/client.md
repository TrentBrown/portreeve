# JavaScript client

Install the separately versioned official client:

```sh
npm install portreeve
```

It supports ESM on Node.js 22 or newer and Bun 1.3.14 or newer. All production
operations use the public Unix-socket protocol. The package has no runtime
dependencies and does not start or install Portreeve.

## High-level startup helper

`withPort(request, start)` performs acquire, calls `start(port)`, confirms the
bound listener, and returns `{ port, run, value, release }`. Address-in-use
errors are abandoned and retried with a fresh allocation, up to `maxAttempts`
(default 3). Other startup errors are abandoned and rethrown.

```js
const running = await client.withPort(
  {
    claim: {
      project: 'caregiver',
      workspaceRoot: import.meta.dir,
      service: 'website',
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

The client canonicalizes `workspaceRoot` to the real Git worktree root when it
is inside Git, preventing symlink and subdirectory spellings from creating
duplicate identities.

## Low-level API

The `PortreeveClient` exposes `health`, `acquire`, `confirm`, `abandon`,
`release`, `listPorts`, `inspectPort`, `reclaimPort`, `unsafeEvictPort`,
`listClaims`, `getClaim`, `reassignClaim`, `deleteClaim`, `pruneClaims`,
`getConfig`, `setConfig`, `history`, `logs`, and `stopServer`.

Construct it with `{ socketPath }` only when overriding the per-user default.
Failures reject with `PortreeveClientError`, whose stable fields are `code`,
optional HTTP `status`, `requestId`, `retryable`, and `details`.

Migrated services should fail loudly on `code === "unavailable"`. They must
not fall back to legacy probing or silently start/install Portreeve.
