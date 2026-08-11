# PortReeve CLI contract

PortReeve defaults to concise human-readable output. Operational commands accept
`--json` and emit one JSON document with `"version": 1`. Successful documents and
evidence-bearing lifecycle mutation outcomes are written to standard output.
Command-usage failures and top-level failures that cannot construct lifecycle evidence
are written to standard error:

```json
{
  "version": 1,
  "error": {
    "code": "invalid_input",
    "message": "Invalid command input.",
    "details": {}
  }
}
```

Automation should use the JSON document and exit status rather than parsing human
output.

## Exit statuses

| Status | Meaning                                                                                                   |
| -----: | --------------------------------------------------------------------------------------------------------- |
|    `0` | Command completed successfully                                                                            |
|   `10` | Command completed and reported an ordinary state difference, such as a stopped server or cancelled prompt |
|   `20` | Lifecycle, claim, port, listener, or reclamation conflict                                                 |
|   `30` | The PortReeve server is unavailable                                                                       |
|   `40` | Client/server protocol or capability incompatibility                                                      |
|   `50` | Invalid command, option, JSON value, or request input                                                     |
|   `70` | Unexpected internal failure                                                                               |

## Operational JSON keys

| Command                                            | Success document                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `status`                                           | `{ "version": 1, "status": { ... } }`                                       |
| `mcp setup`                                        | `{ "version": 1, "setup": { ... } }`                                        |
| `install` / `uninstall`                            | `{ "version": 1, "result": { ... } }`                                       |
| `start` / `stop` / `stop-manual` / `restart`       | `{ "version": 1, "result": { ... } }`                                       |
| `purge --dry-run`                                  | `{ "version": 1, "preview": { ... } }`                                      |
| `purge --confirm TOKEN`                            | `{ "version": 1, "result": { ... } }`                                       |
| `ports list`                                       | `{ "version": 1, "entries": [ ... ] }`                                      |
| `ports inspect`                                    | `{ "version": 1, "entry": { ... } }`                                        |
| `ports reclaim` / `ports unsafe-evict`             | `{ "version": 1, "result": { ... } }`                                       |
| `claims list`                                      | `{ "version": 1, "claims": [ ... ] }`                                       |
| `claims show` / `claims reassign`                  | `{ "version": 1, "claim": { ... } }`                                        |
| `claims delete`                                    | `{ "version": 1, "result": { ... } }`                                       |
| `claims prune`                                     | `{ "version": 1, "result": { ... } }`                                       |
| `stacks apply`                                     | `{ "version": 1, "result": { "changed": true, "stack": { ... } } }`         |
| `stacks list`                                      | `{ "version": 1, "stacks": [ ... ] }`                                       |
| `stacks show`                                      | `{ "version": 1, "stack": { ... } }`                                        |
| `stacks status`                                    | `{ "version": 1, "status": { "stack": { ... }, "generation": { ... }, "activation": { ... }, "providers": [ ... ] } }` |
| `stacks prepare` / `stacks begin` / `stacks renew` | `{ "version": 1, "result": { ... } }`                                       |
| `stacks activation` / `stacks confirm` / `stacks confirm-docker` | `{ "version": 1, "activation": { ... } }`                       |
| `stacks generation`                                | `{ "version": 1, "generation": { ... } }`                                   |
| `stacks abandon` / `stacks skip`                   | `{ "version": 1, "activation": { ... } }`                                   |
| `stacks end`                                       | `{ "version": 1, "result": { "changed": true, "activation": { ... } } }`    |
| `stacks reconcile`                                 | `{ "version": 1, "result": { "changed": false, "activation": { ... }, "providers": [ ... ] } }` |
| `stacks prune`                                     | `{ "version": 1, "result": { "candidates": [ ... ], "blocked": [ ... ] } }` |
| `stacks resolve`                                   | `{ "version": 1, "resolution": { ... } }`                                   |
| `stacks snapshot`                                  | `{ "version": 1, "result": { "filename": "...", "snapshot": { ... } } }`    |
| `launcher init`                                    | `{ "version": 1, "result": { "created": true, "trusted": true, ... } }`     |
| `launcher validate`                                | `{ "version": 1, "launcher": { "valid": true, ... } }`                        |
| `launcher trust`                                   | `{ "version": 1, "result": { "trusted": true, ... } }`                        |
| `launcher start` / `stop` / `restart` / `status`   | `{ "version": 1, "result": { ... } }`                                            |
| `config get`                                       | `{ "version": 1, "settings": { ... } }` or `{ "version": 1, "value": ... }` |
| `config set`                                       | `{ "version": 1, "settings": { ... } }`                                     |
| `history`                                          | `{ "version": 1, "events": [ ... ] }`                                       |
| `logs`                                             | `{ "version": 1, "entries": [ ... ] }`                                      |

`mcp setup --host generic|codex|claude-code` is a local pure generation command. It
does not require a running daemon and never reads or writes host settings. The returned
setup includes the selected format, exact command and arguments, optional diagnostic
label, configuration text, any equivalent host registration command, and explanatory
notes. It defaults to the managed executable path; `--portable` selects bare
`portreeve` and therefore depends on the host's `PATH`.

## Stack definitions

`stacks apply` walks upward from the current real directory to the nearest
`portreeve.stack.json`, without stopping at child Git repository boundaries.
`--stack-root <path>` selects the standard file at an explicit root. `--file <path>`
selects an explicit file and supplies its parent as the stack root. The selectors are
mutually exclusive, and apply fails as invalid input when it cannot read a selected or
enclosing definition; it never falls back to registered database state. The official
client canonicalizes the exact root before the request. Equivalent normalized content
is an ordinary state difference and exits `10`; changed content exits `0`.

Apply records topology and durable endpoint claims only. It does not prepare a
generation, start an activation, launch a process or container, or inject environment
variables. Launchers invoke `stacks prepare` and the activation commands explicitly.

`stacks list` accepts `--project` and `--stack-root`. `stacks status` accepts those same
disambiguating options. Without an explicit root, status first discovers the nearest
enclosing definition file. When no such file exists, it may select the one registered
stack root enclosing the current real directory. If neither source resolves a stack,
status emits `{ "version": 1, "stack": null }` and exits `10`. A resolved status reports
the latest generation, activation, and fresh provider evidence. `stacks show <stack-id>`
reads only the registered definition. These commands never start or stop project
services or containers.

`stacks prepare <stack-id>` creates or reuses an immutable endpoint allocation.
`stacks begin <generation-id>` atomically leases the activation endpoints and emits
private lease tokens only in JSON mode. `--required-endpoint component.endpoint`
promotes an optional endpoint; `--skip-endpoint component.endpoint` skips one. When
either name itself contains a dot, pass a JSON object such as
`--required-endpoint '{"component":"api.v2","endpoint":"http.internal"}'`.
Use `--docker-component NAME` once per component that the trusted launcher will run in
Docker. The returned leases identify their `bindingKind`; Docker leases also include the
Compose service, container port, and exact PortReeve labels the launcher must apply.

Renewal reads a JSON credential array from `--leases-file`. Confirm, abandon, and skip
read one `{ "leaseId", "leaseToken" }` object from `--lease-file`, keeping tokens out of
the process argument list. Process confirmation also requires `--root-pid`. Launchers should create
credential files with mode `0600`, remove them after use, and use
`stacks activation <activation-id>` or `stacks generation <generation-id>` for
token-free inspection. For Docker-backed leases, use `stacks confirm-docker` with the
same credential file and `--container-id`; PortReeve freshly verifies the running
container, exact labels, loopback publication, and host listener. After the launcher
stops providers, `stacks reconcile <activation-id>` inspects every confirmed process or
Docker provider. Only conclusive absence of every provider marks the activation `lost`;
active or unobservable evidence keeps it live. `stacks end <activation-id>` uses the
same evidence, refuses surviving or unobservable providers and unresolved listeners,
and never signals a process or stops a container.

When port inventory identifies a Docker-published listener, `ports reclaim` and
`ports unsafe-evict` return `launcher-action-required` with exact container IDs. They
never signal Docker Desktop, the Docker daemon, or its port-forwarding processes.

`stacks resolve <activation-id> --component NAME` emits only the component's own
published endpoints and declared dependency aliases. Host-publication and optional
Docker-network address facts are separate; neither represents application health.

`stacks snapshot <activation-id> --component NAME --gateway-host HOST --file PATH`
requests a redacted activation-scoped sandbox document and atomically replaces `PATH`
with mode `0600`. The gateway is supplied by the trusted launcher—for example,
`host.docker.internal` on macOS Docker Desktop or a launcher-discovered bridge address
on Linux. PortReeve does not infer or verify sandbox topology. Mount the resulting
document read-only and never mount the PortReeve control socket into the sandbox.

## Project launchers

`launcher init`, `validate`, `trust`, `start`, `stop`, `restart`, and `status` share
the same definition, exact-revision trust, environment resolution, lifecycle policy,
and structured results used by Desktop. They discover the nearest enclosing applied
stack by default; `--stack-root <path>` selects an explicit canonical root.

`init` is interactive: it refuses an existing file, previews manifest-derived
suggestions and the exact JSON, creates `portreeve.launcher.json` exclusively, and
trusts only after confirmation. `validate` may inspect an unapplied definition and does
not change trust. `trust` is always interactive and reviews the resolved shell, working
directory, commands, and exact revision. There is no noninteractive trust bypass.

Lifecycle execution refuses invalid, unapplied, or untrusted launchers. `start
--run-start-anyway` is the explicit repair path for partial nonconflicting evidence.
`stop --allow-degraded` is the explicit daemon-outage path and uses only an exact-root,
exact-launcher-revision cached nonsecret environment. Start and Restart never proceed
without the daemon. Status output remains advisory beside fresh or clearly local stale
evidence. Attached Start blocks in the invoking CLI process and forwards cancellation
only to the exact process group that invocation created.

See [Project launchers](launchers.md) for the checked-in schema and complete behavioral
contract.

## Prune consent

`claims prune --dry-run` reports eligible missing-workspace claims without mutation.
`stacks prune --dry-run` reports both eligible missing-stack-root stacks and evidence
blockers; stack deletion also removes associated inactive endpoint claims while retaining
history. A
naked interactive invocation displays the plan and prompts before execution.
Noninteractive execution requires `--yes`; `--json` is output selection, not consent.
`--dry-run` and `--yes` cannot be combined.

## Server lifecycle

`portreeve serve` is always a foreground, blocking server. Running it with the shell's
backgrounding features does not turn it into a supervised service. The server reports
its PID and its asserted execution mode over the private Unix socket.

### Layered status

`portreeve status --json` returns one runtime-validated snapshot even when an ordinary
layer is absent, stopped, failed, unhealthy, or incompatible:

```json
{
  "version": 1,
  "status": {
    "observedAt": "2026-07-30T23:00:00.000Z",
    "installation": {
      "state": "installed",
      "managedExecutablePath": "/Users/example/Library/Application Support/Portreeve/bin/portreeve",
      "version": "0.1.0",
      "error": null
    },
    "supervisor": {
      "kind": "launchd",
      "state": "active",
      "mainPid": 4242,
      "error": null
    },
    "socket": {
      "path": "/Users/example/Library/Application Support/Portreeve/portreeve.sock",
      "state": "healthy",
      "server": {
        "softwareVersion": "0.1.0",
        "protocol": { "minimum": 1, "maximum": 1 },
        "capabilities": [],
        "pid": 4242,
        "mode": "supervised"
      },
      "error": null
    },
    "mode": "supervised",
    "versions": {
      "cli": "0.1.0",
      "managed": "0.1.0",
      "running": "0.1.0"
    },
    "limitations": []
  }
}
```

Installation state is `absent`, `installed`, or `invalid`. Supervisor state is
`unavailable`, `inactive`, `starting`, `active`, or `failed`. Socket state is
`unavailable`, `healthy`, `unhealthy`, or `incompatible`. Effective mode is `none`,
`manual`, `supervised`, or `ambiguous`.

A responding server is `supervised` only when its asserted mode and PID agree with the
currently observed native supervisor. A healthy manual server is an ordinary successful
status. An unavailable/unhealthy socket or ambiguous mode exits `10`. Failure to
construct the command or validate its invocation remains a top-level error.

### Mutation results

Every lifecycle mutation returns the same result shape:

```json
{
  "version": 1,
  "result": {
    "operation": "start",
    "outcome": "succeeded",
    "changed": true,
    "startedAt": "2026-07-30T23:00:00.000Z",
    "completedAt": "2026-07-30T23:00:01.000Z",
    "before": {},
    "after": {},
    "error": null
  }
}
```

`before` and `after` are complete layered status snapshots. Outcome is `succeeded`,
`no-change`, `refused`, `partial`, or `failed`. Refused and failed operations still
write this trustworthy result to standard output and use the appropriate nonzero exit
band. A top-level JSON error is reserved for command usage or failures that prevent
lifecycle evidence from being constructed.

`portreeve install` explicitly installs native per-user supervision:

- macOS uses `~/Library/LaunchAgents/com.portreeve.server.plist`;
- Linux uses `~/.config/systemd/user/portreeve.service`, or the corresponding path below
  `XDG_CONFIG_HOME`;
- the managed executable is stored below PortReeve's private application directory at
  `bin/portreeve`;
- installation and upgrade never require or accept root;
- a newly installed or already inactive service remains inactive until
  `portreeve start`;
- an active upgrade is stopped, atomically promoted, restarted, and health-checked;
  activation failure restores the prior executable, definition, and active state; and
- the CLI never replaces a newer managed or running PortReeve version with an older
  source executable.

`start` and `restart` require an installed native service and refuse to adopt or replace
a manual or ambiguous server. `stop` unloads/disables only an active supervisor before
waiting for its server to disappear, preventing automatic restart. `stop-manual` is the
separate explicit operation that requests graceful shutdown of a verified manual server
through the protected socket; it refuses supervised, ambiguous, or absent state.
`uninstall` refuses live manual or ambiguous state, removes the native definition and
managed executables, and preserves the registry, settings, history, and diagnostic data.

### Complete reset

Every initialized application home contains a private `.portreeve-owner.json` marker
binding the PortReeve product, schema, canonical root, and user ID. PortReeve creates it
for a new empty private home or migrates an existing private home only when every entry
is recognized PortReeve state. Missing, malformed, mismatched, nonprivate, or symlinked
markers block reset.

Complete reset is a two-command evidence-bound operation:

```sh
portreeve purge --dry-run --json
portreeve purge --confirm PREVIEW_TOKEN --json
```

The dry run inspects the canonical root, marker, lifecycle state, native definition, and
every deletion path without following symlinks. It returns the exact paths, refusal
reasons, and a SHA-256 confirmation token. Execution immediately repeats that inspection
and refuses when its token differs. The token is not a secret and does not replace user
confirmation; it proves only that the preview evidence is unchanged.

A live manual, ambiguous, or incompatible server blocks purge. A confirmed purge may
stop and uninstall a supervised service. It revalidates the marker, ownership,
permissions, path types, and symlinks after supervision changes and before deleting
data. The result reports `removed`, `retained`, `missing`, and `refused` paths and uses
`succeeded`, `refused`, or `partial` without claiming complete reset after partial
failure.

<!-- PORTREEVE:GENERATED CLI-COMMANDS START -->
## Complete command reference

> Generated from the Commander command tree and required documentation metadata. Do not edit this region directly.

### CLI command: `portreeve serve`

Run the PortReeve server in the foreground

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve serve [options]`

#### Arguments for `portreeve serve`

None.

#### Options for `portreeve serve`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |

#### Environment and configuration for `portreeve serve`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve serve`

Runs the PortReeve server in the foreground until stopped. Startup and runtime failures use the documented CLI exit bands.

### CLI command: `portreeve mcp serve`

Run the local stdio MCP bridge

- **Family:** mcp
- **Safety:** Service administration
- **Synopsis:** `portreeve mcp serve [options]`

#### Arguments for `portreeve mcp serve`

None.

#### Options for `portreeve mcp serve`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the PortReeve Unix socket path |
| `--label <label>` | no | — | — | attach a diagnostic label to this bridge run |

#### Environment and configuration for `portreeve mcp serve`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve mcp serve`

Runs a blocking stdio MCP bridge. Standard output is reserved for MCP framing; startup or protocol failures use the documented CLI exit bands.

### CLI command: `portreeve mcp setup`

Generate MCP host configuration without changing host settings

- **Family:** mcp
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve mcp setup [options]`

#### Arguments for `portreeve mcp setup`

None.

#### Options for `portreeve mcp setup`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--host <host>` | yes | — | — | configuration format: generic, codex, or claude-code |
| `--portable` | no | — | — | use bare portreeve and require it on PATH |
| `--label <label>` | no | — | — | attach a diagnostic label to bridge runs |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve mcp setup`

No command-specific environment input.

#### Output and exit behavior for `portreeve mcp setup`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve status`

Report server and native supervision state

- **Family:** server
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve status [options]`

#### Arguments for `portreeve status`

None.

#### Options for `portreeve status`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve status`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve status`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve purge`

Preview or execute complete PortReeve removal

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve purge [options]`

#### Arguments for `portreeve purge`

None.

#### Options for `portreeve purge`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--dry-run` | no | — | — | inspect the exact deletion evidence without mutation |
| `--confirm <preview-token>` | no | — | — | execute only when current evidence matches this preview token |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve purge`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve purge`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve install`

Install or atomically upgrade native per-user supervision

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve install [options]`

#### Arguments for `portreeve install`

None.

#### Options for `portreeve install`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve install`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve install`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve uninstall`

Remove native supervision while preserving PortReeve data

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve uninstall [options]`

#### Arguments for `portreeve uninstall`

None.

#### Options for `portreeve uninstall`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve uninstall`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve uninstall`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve start`

Start the installed supervised server

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve start [options]`

#### Arguments for `portreeve start`

None.

#### Options for `portreeve start`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve start`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve start`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stop`

Stop the installed supervised server

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve stop [options]`

#### Arguments for `portreeve stop`

None.

#### Options for `portreeve stop`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stop`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stop`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stop-manual`

Explicitly stop a server running outside native supervision

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve stop-manual [options]`

#### Arguments for `portreeve stop-manual`

None.

#### Options for `portreeve stop-manual`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stop-manual`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stop-manual`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve restart`

Restart the installed supervised server

- **Family:** server
- **Safety:** Service administration
- **Synopsis:** `portreeve restart [options]`

#### Arguments for `portreeve restart`

None.

#### Options for `portreeve restart`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve restart`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve restart`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve ports list`

List every claimed or listening TCP port

- **Family:** ports
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve ports list [options]`

#### Arguments for `portreeve ports list`

None.

#### Options for `portreeve ports list`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit the versioned JSON response |
| `--status <classification>` | no | — | — | filter by reconciliation status |
| `--claimed` | no | — | — | show ports with durable claims |
| `--unclaimed` | no | — | — | show ports without durable claims |
| `--listening` | no | — | — | show ports with live listeners |
| `--project <name>` | no | — | — | filter by project namespace |
| `--workspace <path>` | no | — | — | filter by canonical workspace root |
| `--service <name>` | no | — | — | filter by service name |
| `--component <name>` | no | — | — | filter by component name |
| `--endpoint <name>` | no | — | — | filter by endpoint name |
| `--port <number>` | no | — | — | filter by exact TCP port |

#### Environment and configuration for `portreeve ports list`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve ports list`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve ports inspect`

Inspect durable and live evidence for one TCP port

- **Family:** ports
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve ports inspect <port> [options]`

#### Arguments for `portreeve ports inspect`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `port` | yes | no | — | — |

#### Options for `portreeve ports inspect`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit the versioned JSON response |

#### Environment and configuration for `portreeve ports inspect`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve ports inspect`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve ports reclaim`

Reclaim a port from its verified PortReeve run

- **Family:** ports
- **Safety:** Evidence-bound consequential mutation
- **Synopsis:** `portreeve ports reclaim <port> [options]`

#### Arguments for `portreeve ports reclaim`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `port` | yes | no | — | — |

#### Options for `portreeve ports reclaim`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--policy <policy>` | no | `"graceful"` | — | replacement policy: never, graceful, or force-after-grace |
| `--dry-run` | no | — | — | show the evidence-bound target plan without signaling |
| `--json` | no | — | — | emit the versioned JSON response |

#### Environment and configuration for `portreeve ports reclaim`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve ports reclaim`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve ports unsafe-evict`

Dangerously evict any observable listener from an exact port

- **Family:** ports
- **Safety:** Unsafe override
- **Synopsis:** `portreeve ports unsafe-evict <port> [options]`

#### Arguments for `portreeve ports unsafe-evict`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `port` | yes | no | — | — |

#### Options for `portreeve ports unsafe-evict`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--unsafe-any-owner` | yes | — | — | explicitly authorize bypassing PortReeve claim ownership |
| `--force-after-grace` | no | — | — | authorize SIGKILL after the grace period |
| `--dry-run` | no | — | — | show the evidence-bound target plan without signaling |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit the versioned JSON response |

#### Environment and configuration for `portreeve ports unsafe-evict`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve ports unsafe-evict`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve claims list`

List durable claims

- **Family:** claims
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve claims list [options]`

#### Arguments for `portreeve claims list`

None.

#### Options for `portreeve claims list`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve claims list`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve claims list`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve claims show`

Show one durable claim

- **Family:** claims
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve claims show <claim-id> [options]`

#### Arguments for `portreeve claims show`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `claim-id` | yes | no | — | — |

#### Options for `portreeve claims show`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve claims show`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve claims show`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve claims reassign`

Assign a new idle port to a claim

- **Family:** claims
- **Safety:** Evidence-bound consequential mutation
- **Synopsis:** `portreeve claims reassign <claim-id> [options]`

#### Arguments for `portreeve claims reassign`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `claim-id` | yes | no | — | — |

#### Options for `portreeve claims reassign`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--preferred-port <port>` | no | — | — | prefer this port, then permit fallback |
| `--exact-port <port>` | no | — | — | require this exact port without fallback |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve claims reassign`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve claims reassign`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve claims delete`

Delete an idle claim and return its assignment to the pool

- **Family:** claims
- **Safety:** Evidence-bound consequential mutation
- **Synopsis:** `portreeve claims delete <claim-id> [options]`

#### Arguments for `portreeve claims delete`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `claim-id` | yes | no | — | — |

#### Options for `portreeve claims delete`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve claims delete`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve claims delete`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve claims prune`

Delete old claims whose workspace paths no longer exist

- **Family:** claims
- **Safety:** Evidence-bound consequential mutation
- **Synopsis:** `portreeve claims prune [options]`

#### Arguments for `portreeve claims prune`

None.

#### Options for `portreeve claims prune`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--older-than <duration>` | no | `"7d"` | — | minimum age such as 12h or 7d |
| `--dry-run` | no | — | — | report eligible claims without mutation |
| `--yes` | no | — | — | execute without an interactive confirmation |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve claims prune`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve claims prune`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks apply`

Validate and apply a stack-root definition

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks apply [options]`

#### Arguments for `portreeve stacks apply`

None.

#### Options for `portreeve stacks apply`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--file <path>` | no | — | — | select an explicit stack definition file |
| `--stack-root <path>` | no | — | — | select a root containing portreeve.stack.json |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks apply`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks apply`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks list`

List registered stacks

- **Family:** stacks
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve stacks list [options]`

#### Arguments for `portreeve stacks list`

None.

#### Options for `portreeve stacks list`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--project <name>` | no | — | — | filter by project namespace |
| `--stack-root <path>` | no | — | — | filter by canonical stack root |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks list`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks list`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks show`

Show one registered stack and its current definition

- **Family:** stacks
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve stacks show <stack-id> [options]`

#### Arguments for `portreeve stacks show`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `stack-id` | yes | no | — | — |

#### Options for `portreeve stacks show`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks show`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks show`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks status`

Show the enclosing or explicitly selected registered stack

- **Family:** stacks
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve stacks status [options]`

#### Arguments for `portreeve stacks status`

None.

#### Options for `portreeve stacks status`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--project <name>` | no | — | — | select a project namespace |
| `--stack-root <path>` | no | — | — | select an explicit stack root |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks status`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks status`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks prepare`

Create or reuse a complete immutable allocation generation

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks prepare <stack-id> [options]`

#### Arguments for `portreeve stacks prepare`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `stack-id` | yes | no | — | — |

#### Options for `portreeve stacks prepare`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks prepare`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks prepare`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks begin`

Begin one exclusive activation and atomically lease its endpoints

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks begin <generation-id> [options]`

#### Arguments for `portreeve stacks begin`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `generation-id` | yes | no | — | — |

#### Options for `portreeve stacks begin`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--required-endpoint <component.endpoint...>` | no | — | — | promote optional endpoints; JSON objects preserve names containing dots |
| `--skip-endpoint <component.endpoint...>` | no | — | — | skip optional endpoints; JSON objects preserve names containing dots |
| `--docker-component <name...>` | no | — | — | bind named components through Docker for this activation |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output including private lease tokens |

#### Environment and configuration for `portreeve stacks begin`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks begin`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks activation`

Inspect one activation and its endpoint outcomes

- **Family:** stacks
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve stacks activation <activation-id> [options]`

#### Arguments for `portreeve stacks activation`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks activation`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks activation`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks activation`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks generation`

Inspect one immutable allocation generation

- **Family:** stacks
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve stacks generation <generation-id> [options]`

#### Arguments for `portreeve stacks generation`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `generation-id` | yes | no | — | — |

#### Options for `portreeve stacks generation`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks generation`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks generation`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks renew`

Renew pending activation leases from a private JSON file

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks renew <activation-id> [options]`

#### Arguments for `portreeve stacks renew`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks renew`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--leases-file <path>` | yes | — | — | JSON array of lease IDs and tokens |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks renew`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks renew`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks confirm`

Confirm one bound process endpoint with fresh listener evidence

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks confirm <activation-id> [options]`

#### Arguments for `portreeve stacks confirm`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks confirm`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--lease-file <path>` | yes | — | — | private JSON lease credential |
| `--root-pid <pid>` | yes | — | — | root process PID for lineage verification |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks confirm`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks confirm`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks confirm-docker`

Confirm one Docker endpoint with fresh listener and container evidence

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks confirm-docker <activation-id> [options]`

#### Arguments for `portreeve stacks confirm-docker`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks confirm-docker`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--lease-file <path>` | yes | — | — | private JSON lease credential |
| `--container-id <id>` | yes | — | — | Docker container ID lookup key |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks confirm-docker`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks confirm-docker`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks abandon`

Fail one pending activation endpoint

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks abandon <activation-id> [options]`

#### Arguments for `portreeve stacks abandon`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks abandon`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--lease-file <path>` | yes | — | — | private JSON lease credential |
| `--reason <reason>` | no | `"startup-error"` | — | address-in-use, startup-error, or client-cancelled |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks abandon`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks abandon`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks skip`

Skip one optional pending activation endpoint

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks skip <activation-id> [options]`

#### Arguments for `portreeve stacks skip`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks skip`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--lease-file <path>` | yes | — | — | private JSON lease credential |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks skip`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks skip`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks end`

End an activation only after every provider has stopped

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks end <activation-id> [options]`

#### Arguments for `portreeve stacks end`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks end`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks end`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks end`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks reconcile`

Reconcile one activation from fresh process and Docker evidence

- **Family:** stacks
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve stacks reconcile <activation-id> [options]`

#### Arguments for `portreeve stacks reconcile`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks reconcile`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks reconcile`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks reconcile`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks prune`

Delete old missing-stack-root records with no live provider evidence

- **Family:** stacks
- **Safety:** Evidence-bound consequential mutation
- **Synopsis:** `portreeve stacks prune [options]`

#### Arguments for `portreeve stacks prune`

None.

#### Options for `portreeve stacks prune`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--older-than <duration>` | no | `"7d"` | — | minimum age such as 12h or 7d |
| `--dry-run` | no | — | — | report eligible and blocked stacks without mutation |
| `--yes` | no | — | — | execute without an interactive confirmation |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks prune`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks prune`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks resolve`

Resolve one component own endpoints and declared dependencies

- **Family:** stacks
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve stacks resolve <activation-id> [options]`

#### Arguments for `portreeve stacks resolve`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks resolve`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--component <name>` | yes | — | — | consumer component name |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks resolve`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks resolve`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve stacks snapshot`

Write one redacted sandbox endpoint discovery document atomically

- **Family:** stacks
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve stacks snapshot <activation-id> [options]`

#### Arguments for `portreeve stacks snapshot`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `activation-id` | yes | no | — | — |

#### Options for `portreeve stacks snapshot`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--component <name>` | yes | — | — | sandbox consumer component name |
| `--gateway-host <host>` | yes | — | — | launcher-rendered sandbox gateway host |
| `--file <path>` | yes | — | — | destination JSON document |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve stacks snapshot`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve stacks snapshot`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve launcher init`

Interactively create and trust an absent launcher definition

- **Family:** launcher
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve launcher init [options]`

#### Arguments for `portreeve launcher init`

None.

#### Options for `portreeve launcher init`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--stack-root <path>` | no | — | — | select an explicit applied stack root |
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve launcher init`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve launcher init`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve launcher validate`

Validate a launcher against its local stack definition

- **Family:** launcher
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve launcher validate [options]`

#### Arguments for `portreeve launcher validate`

None.

#### Options for `portreeve launcher validate`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--stack-root <path>` | no | — | — | select an explicit stack root |
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve launcher validate`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve launcher validate`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve launcher trust`

Review and trust the exact current launcher revision

- **Family:** launcher
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve launcher trust [options]`

#### Arguments for `portreeve launcher trust`

None.

#### Options for `portreeve launcher trust`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--stack-root <path>` | no | — | — | select an explicit applied stack root |
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve launcher trust`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve launcher trust`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve launcher start`

Start the selected stack through its trusted launcher

- **Family:** launcher
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve launcher start [options]`

#### Arguments for `portreeve launcher start`

None.

#### Options for `portreeve launcher start`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--stack-root <path>` | no | — | — | select an explicit applied stack root |
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--run-start-anyway` | no | — | — | explicitly repair a partially observed non-conflicting stack |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve launcher start`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve launcher start`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve launcher stop`

Stop the selected stack through its trusted project command

- **Family:** launcher
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve launcher stop [options]`

#### Arguments for `portreeve launcher stop`

None.

#### Options for `portreeve launcher stop`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--stack-root <path>` | no | — | — | select an explicit applied stack root |
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--allow-degraded` | no | — | — | explicitly run Stop from cached context without daemon coordination |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve launcher stop`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve launcher stop`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve launcher restart`

Restart the selected stack through its trusted launcher

- **Family:** launcher
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve launcher restart [options]`

#### Arguments for `portreeve launcher restart`

None.

#### Options for `portreeve launcher restart`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--stack-root <path>` | no | — | — | select an explicit applied stack root |
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve launcher restart`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve launcher restart`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve launcher status`

Run advisory project Status and report authoritative evidence

- **Family:** launcher
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve launcher status [options]`

#### Arguments for `portreeve launcher status`

None.

#### Options for `portreeve launcher status`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--stack-root <path>` | no | — | — | select an explicit applied stack root |
| `--home <path>` | no | — | — | override the PortReeve application directory |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve launcher status`

- Uses the platform PortReeve application directory unless --home is set.
- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve launcher status`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve config get`

Read all settings or one setting

- **Family:** config
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve config get [key] [options]`

#### Arguments for `portreeve config get`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `key` | no | no | — | — |

#### Options for `portreeve config get`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve config get`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve config get`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve config set`

Update one setting with a JSON value

- **Family:** config
- **Safety:** Ordinary coordination mutation
- **Synopsis:** `portreeve config set <key> <json-value> [options]`

#### Arguments for `portreeve config set`

| Name | Required | Variadic | Default | Description |
|---|---:|---:|---|---|
| `key` | yes | no | — | — |
| `json-value` | yes | no | — | — |

#### Options for `portreeve config set`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve config set`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve config set`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve history`

Query structured operational history

- **Family:** observability
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve history [options]`

#### Arguments for `portreeve history`

None.

#### Options for `portreeve history`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--limit <count>` | no | `"100"` | — | maximum recent events |
| `--event-type <type>` | no | — | — | filter by exact event type |
| `--entity-type <type>` | no | — | — | filter by exact entity type |
| `--entity-id <id>` | no | — | — | filter by exact entity ID |
| `--since <timestamp>` | no | — | — | filter from an ISO-8601 timestamp |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve history`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve history`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.

### CLI command: `portreeve logs`

Show recent bounded local diagnostic logs

- **Family:** observability
- **Safety:** Read-only or local generation
- **Synopsis:** `portreeve logs [options]`

#### Arguments for `portreeve logs`

None.

#### Options for `portreeve logs`

| Flags | Required | Default | Choices | Description |
|---|---:|---|---|---|
| `--limit <count>` | no | `"100"` | — | maximum recent entries |
| `--socket <path>` | no | — | — | override the Unix socket path |
| `--json` | no | — | — | emit versioned JSON output |

#### Environment and configuration for `portreeve logs`

- Uses the platform PortReeve Unix socket unless --socket is set.

#### Output and exit behavior for `portreeve logs`

Uses concise human output by default when supported and versioned JSON with `--json`. Automation must use structured output and the documented `0`, `10`, `20`, `30`, `40`, `50`, and `70` exit bands rather than parsing prose.
<!-- PORTREEVE:GENERATED CLI-COMMANDS END -->
