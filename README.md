# PortReeve

PortReeve is the per-user local authority for development TCP ports. It gives concurrent
projects and agent worktrees durable port identities without duplicating startup-time
port probing and remapping logic in every service.

PortReeve coordinates through a private HTTP/JSON Unix socket. It persists claims in
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

Coordinate an independently runnable local stack from its project-owned definition:

```sh
# Run at the stack root or anywhere beneath it, including inside a child repository.
portreeve stacks apply --json
portreeve stacks prepare STACK_ID --json
```

`portreeve.stack.json` owns component and endpoint topology. PortReeve owns durable port
assignments, generations, activations, and live evidence; the project launcher still
owns process/container startup, environment mapping, health checks, and shutdown. One
canonical stack root represents one independently runnable stack and may be a non-Git
parent containing multiple child repositories.

The desktop **Stacks** tab can create or edit the same checked-in definition through
structured fields. Saving applies the definition but never prepares ports or launches
project services automatically.

Add a checked-in `portreeve.launcher.json` beside the stack definition when PortReeve
should inject the stack's current endpoint values into project-owned Start, Stop,
Restart, and Status commands. Desktop and CLI share the same exact-revision trust and
lifecycle engine. Begin with command-only integration, then adopt verified activation
when the project launcher is ready to prove ownership and cleanup.

## Documentation

- [Installation and releases](docs/installation.md)
- [JavaScript client](docs/client.md)
- [Socket protocol](docs/protocol.md)
- [MCP bridge](docs/mcp.md)
- [CLI automation contract](docs/cli-contract.md)
- [Stack definitions](docs/stacks.md)
- [Project launchers](docs/launchers.md)
- [Desktop application](docs/desktop.md)
- [Mixed process and Docker example](examples/mixed-stack/README.md)
- [Migration from project-local remapping](docs/migration.md)
- [Safety model](docs/safety.md)
- [Troubleshooting](docs/troubleshooting.md)

PortReeve sends no telemetry and does not load project `.env` or executable
configuration files.

## License

[MIT](LICENSE)
