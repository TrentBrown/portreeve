# MCP bridge

PortReeve exposes a local tools-only MCP bridge through the standalone executable:

```sh
portreeve mcp serve
```

An MCP host normally starts this command and communicates over its standard input and
standard output. The bridge opens no network listener, owns no database, and never
shells out to the PortReeve CLI. Every daemon-backed tool uses the official JavaScript
client over the same private HTTP/JSON Unix socket as other integrations. Diagnostic
messages go to standard error; standard output contains MCP frames only.

The bridge accepts both the 2026-07-28 stateless `server/discover` flow and legacy
2025-era initialization through the official MCP SDK. Each bridge process has its own
run identifier and may be given a diagnostic label with `--label`. These values are
attribution, not authority.

The initial read surface reports bridge diagnostics, daemon compatibility and health,
settings, ports, claims, stacks, generations, activations, and structured history.
Collection tools default to 50 results, permit at most 200, and return opaque
continuation cursors. Diagnostics remain usable while the daemon is absent or
incompatible; daemon-backed calls return stable structured errors and automatically
retry the socket on later calls.

PortReeve does not expose MCP resources, prompts, subscriptions, HTTP transport,
server lifecycle administration, unsafe any-owner eviction, arbitrary shell or
filesystem access, or raw logs and project-command output. Configuration snippets and
Desktop setup guidance are delivered in a later feature slice.
