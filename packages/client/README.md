# `portreeve`

The official JavaScript client for the Portreeve local development-port authority. It
supports Node.js 22 or newer and Bun 1.3.14 or newer.

The client always talks to Portreeve through its versioned HTTP/JSON Unix socket
protocol. It never opens Portreeve's SQLite database and never starts or installs the
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

See the repository's `docs/client.md` and `docs/protocol.md` for the complete contract.

For sandbox discovery, a trusted host launcher can call `createStackEndpointSnapshot`,
atomically publish it with `writeEndpointSnapshot`, and mount only that redacted JSON
file. Sandboxed code reads an explicit file or `PORTREEVE_ENDPOINTS_FILE` with
`readEndpointSnapshot`; it never needs the Portreeve control socket.

For a Docker-backed stack component, pass `bindings: { api: 'docker' }` to
`beginStackActivation`. Its leases contain the Compose service, container port, and
exact Portreeve labels for the trusted launcher. After publishing the allocated host
port, call `confirmStackEndpoint` with `bindingKind: 'docker'` and the exact container
ID. The client uses the same HTTP/JSON socket protocol and preflights the optional
`docker-evidence-v1` capability; it never invokes Docker or Compose directly.
