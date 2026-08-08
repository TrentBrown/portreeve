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
| `config get`                                       | `{ "version": 1, "settings": { ... } }` or `{ "version": 1, "value": ... }` |
| `config set`                                       | `{ "version": 1, "settings": { ... } }`                                     |
| `history`                                          | `{ "version": 1, "events": [ ... ] }`                                       |
| `logs`                                             | `{ "version": 1, "entries": [ ... ] }`                                      |

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
