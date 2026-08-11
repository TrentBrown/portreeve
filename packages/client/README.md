# `portreeve`

The official JavaScript client for the PortReeve local development-port authority. It
supports Node.js 22 or newer and Bun 1.3.14 or newer.

The client always talks to PortReeve through its versioned HTTP/JSON Unix socket
protocol. It never opens PortReeve's SQLite database and never starts or installs the
server implicitly.

```js
import { PortreeveClient } from 'portreeve';

const portreeve = new PortreeveClient();
const service = await portreeve.withPort(
  {
    claim: {
      project: 'caregiver',
      workspaceRoot: process.cwd(),
      service: 'website',
    },
    allocation: { preferredPort: 3000 },
  },
  async (port) => startWebsite({ port }),
);

process.once('SIGTERM', async () => {
  await service.release();
  await service.value.stop();
});
```

Automation adapters may provide diagnostic attribution without granting authority:

```js
const portreeve = new PortreeveClient({
  origin: { kind: 'mcp', runId: crypto.randomUUID(), label: 'codex' },
});
```

Use `historyPage({ limit, afterCursor })` for bounded newest-first pagination. The
legacy-friendly `history` helper follows pages and returns the selected events in
chronological order.

See the repository's `docs/client.md` and `docs/protocol.md` for the complete contract.

For sandbox discovery, a trusted host launcher can call `createStackEndpointSnapshot`,
atomically publish it with `writeEndpointSnapshot`, and mount only that redacted JSON
file. Sandboxed code reads an explicit file or `PORTREEVE_ENDPOINTS_FILE` with
`readEndpointSnapshot`; it never needs the PortReeve control socket.

Independent Desktop and CLI launchers coordinate same-stack lifecycle work with
`beginLauncherOperation`, renew the returned credential every ten seconds, and finish
with `completeLauncherOperation`. The daemon retains only bounded safe metadata; project
commands, environment values, and raw output never enter this protocol.

For a Docker-backed stack component, pass `bindings: { api: 'docker' }` to
`beginStackActivation`. Its leases contain the Compose service, container port, and
exact PortReeve labels for the trusted launcher. After publishing the allocated host
port, call `confirmStackEndpoint` with `bindingKind: 'docker'` and the exact container
ID. The client uses the same HTTP/JSON socket protocol and preflights the optional
`docker-evidence-v1` capability; it never invokes Docker or Compose directly.
