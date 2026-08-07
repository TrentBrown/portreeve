# Portreeve

Portreeve is the per-user local authority for development TCP ports. It gives concurrent
projects and agent worktrees durable port identities without duplicating startup-time
port probing and remapping logic in every service.

Portreeve coordinates through a private HTTP/JSON Unix socket. It persists claims in
SQLite, treats `lsof` listener evidence as live truth, and uses a two-phase
acquire/bind/confirm workflow to close the race between choosing and actually binding a
port.

## Quick start

Run the standalone executable manually:

```sh
portreeve serve
```

Or explicitly install native per-user supervision and start it:

```sh
portreeve install
portreeve start
portreeve status
```

Integrate a JavaScript service:

```js
import { PortreeveClient } from 'portreeve';

const portreeve = new PortreeveClient();
const running = await portreeve.withPort(
  {
    claim: {
      project: 'my-project',
      workspaceRoot: process.cwd(),
      service: 'website',
    },
    allocation: { preferredPort: 3000 },
  },
  async (port) => startWebsite({ port }),
);
```

## Documentation

- [Installation and releases](docs/installation.md)
- [JavaScript client](docs/client.md)
- [Socket protocol](docs/protocol.md)
- [CLI automation contract](docs/cli-contract.md)
- [Stack definitions](docs/stacks.md)
- [Desktop application](docs/desktop.md)
- [Mixed process and Docker example](examples/mixed-stack/README.md)
- [Migration from project-local remapping](docs/migration.md)
- [Safety model](docs/safety.md)
- [Troubleshooting](docs/troubleshooting.md)

Portreeve sends no telemetry and does not load project `.env` or executable
configuration files.

## License

[MIT](LICENSE)
