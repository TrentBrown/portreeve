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

The inspection surface reports bridge diagnostics, daemon compatibility and health,
settings, ports, claims, stacks, generations, activations, and structured history.
Global collection tools default to 50 results, permit at most 200, and return opaque
continuation cursors; launcher-operation history is independently retained and bounded
to twenty records per stack. Diagnostics remain usable while the daemon is absent or
incompatible; daemon-backed calls return stable structured errors and automatically
retry the socket on later calls.

The coordination surface supports standalone acquire, confirm, abandon, and run
release plus stack status, prepare, activation begin, endpoint resolution, process or
Docker confirmation, optional skip, failure abandonment, reconciliation, and end.
Equivalent retries return the existing or already-achieved result instead of repeating
the effect.

The final coordination family adds one structured stack snapshot tool and five
launcher-operation tools. `portreeve_stack_snapshot` returns an in-memory, redacted
Docker-sandbox address document for an explicit activation, component, and gateway
host; it never writes a file. Launcher begin, renew, complete, get, and bounded list
coordinate lifecycle ownership only. They never execute the project's start, stop,
restart, or status command. Begin requires a caller operation ID for retry identity and
the exact launcher revision that the external launcher is using.

Normal reclaim, claim reassignment/deletion/pruning, stack document apply and pruning,
and public settings changes use focused preview and execute tools. Preview persists the
daemon's current evidence in a five-minute receipt. Execute sends only that receipt and
the explicit target; the daemon recovers the stored proposal, recomputes process,
Docker, registry, settings, or document-fingerprint evidence, and rejects stale state.
A completed receipt replays its recorded result. Canonical stack tools accept an
explicit stack root and typed definition, read or write only `portreeve.stack.json`, and
never expose raw file contents or general filesystem authority.

Raw lease tokens and launcher-operation credentials never cross MCP. The bridge keeps
them only in process-local vaults and returns unguessable credential handles that
cannot be used by another bridge process. Pending leases and active launcher
operations renew automatically no later than one-third of their observed remaining TTL
or ten seconds, whichever comes first. Custody lasts ten minutes by default;
activation custody and launcher custody may be explicitly extended to at most sixty
minutes from acquisition. Confirmation, skip, abandonment, or launcher completion
erases the corresponding credential immediately. Custody expiry or bridge exit erases
all remaining credentials and stops renewal, leaving ordinary daemon expiry and
reconciliation to recover durable state.

PortReeve does not expose MCP resources, prompts, subscriptions, HTTP transport,
server lifecycle administration, unsafe any-owner eviction, arbitrary shell or
filesystem access, or raw logs and project-command output. The registered tool names
exactly match the frozen 51-tool catalog.

## Configure an MCP host

Generate a setup preview for Codex, Claude Code, or a generic stdio host:

```sh
portreeve mcp setup --host codex
portreeve mcp setup --host claude-code
portreeve mcp setup --host generic
```

The default preview uses PortReeve's exact managed executable path. This is the most
reliable choice for GUI applications, which may inherit a restricted `PATH`, and that
managed location remains stable when PortReeve upgrades its executable. Use
`--portable` only when the host environment can find bare `portreeve` on its `PATH`:

```sh
portreeve mcp setup --host codex --portable
```

Add `--label NAME` for a diagnostic bridge label or `--json` for a versioned
machine-readable result. The label identifies a bridge in diagnostics; it grants no
authority and does not choose a stack, worktree, claim, or activation.

For Codex, the generated TOML uses the supported `[mcp_servers.portreeve]` shape and
also includes an equivalent `codex mcp add` command. For Claude Code, the generated
JSON uses a stdio entry under `mcpServers` and includes an equivalent
`claude mcp add --scope user` command. The generic form is the canonical stdio server
descriptor with `type`, `command`, and `args`.

PortReeve only prints these snippets and commands. It never reads or writes Codex,
Claude Code, or another host's settings. The Desktop **MCP** tab provides the same
formats, exact/portable selection, optional labels, daemon compatibility evidence,
copy actions, and visible setup errors through its restricted main-process boundary.
It does not launch an agent host or execute project commands.
