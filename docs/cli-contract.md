# Portreeve CLI contract

Portreeve defaults to concise human-readable output. Operational commands
accept `--json` and emit one JSON document with `"version": 1`. Successful
documents and evidence-bearing lifecycle mutation outcomes are written to
standard output. Command-usage failures and top-level failures that cannot
construct lifecycle evidence are written to standard error:

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

Automation should use the JSON document and exit status rather than parsing
human output.

## Exit statuses

| Status | Meaning |
|---:|---|
| `0` | Command completed successfully |
| `10` | Command completed and reported an ordinary state difference, such as a stopped server or cancelled prompt |
| `20` | Lifecycle, claim, port, listener, or reclamation conflict |
| `30` | The Portreeve server is unavailable |
| `40` | Client/server protocol or capability incompatibility |
| `50` | Invalid command, option, JSON value, or request input |
| `70` | Unexpected internal failure |

## Operational JSON keys

| Command | Success document |
|---|---|
| `status` | `{ "version": 1, "status": { ... } }` |
| `install` / `uninstall` | `{ "version": 1, "result": { ... } }` |
| `start` / `stop` / `stop-manual` / `restart` | `{ "version": 1, "result": { ... } }` |
| `purge --dry-run` | `{ "version": 1, "preview": { ... } }` |
| `purge --confirm TOKEN` | `{ "version": 1, "result": { ... } }` |
| `ports list` | `{ "version": 1, "entries": [ ... ] }` |
| `ports inspect` | `{ "version": 1, "entry": { ... } }` |
| `ports reclaim` / `ports unsafe-evict` | `{ "version": 1, "result": { ... } }` |
| `claims list` | `{ "version": 1, "claims": [ ... ] }` |
| `claims show` / `claims reassign` | `{ "version": 1, "claim": { ... } }` |
| `claims delete` | `{ "version": 1, "result": { ... } }` |
| `claims prune` | `{ "version": 1, "result": { ... } }` |
| `stacks apply` | `{ "version": 1, "result": { "changed": true, "stack": { ... } } }` |
| `stacks list` | `{ "version": 1, "stacks": [ ... ] }` |
| `stacks show` / `stacks status` | `{ "version": 1, "stack": { ... } }` |
| `config get` | `{ "version": 1, "settings": { ... } }` or `{ "version": 1, "value": ... }` |
| `config set` | `{ "version": 1, "settings": { ... } }` |
| `history` | `{ "version": 1, "events": [ ... ] }` |
| `logs` | `{ "version": 1, "entries": [ ... ] }` |

## Stack definitions

`stacks apply` discovers `portreeve.stack.json` at the canonical Git worktree
root. `--file <path>` selects an explicit file. The file's parent is supplied
as the workspace input and the official client canonicalizes it before the
request. Equivalent normalized content is an ordinary state difference and
exits `10`; changed content exits `0`.

`stacks list` accepts `--project` and `--workspace`. `stacks status` selects
the current canonical worktree and accepts the same disambiguating options.
`stacks show <stack-id>` reads a stack directly. These commands never start or
stop project services or containers.

## Prune consent

`claims prune --dry-run` reports eligible missing-workspace claims without
mutation. A naked interactive invocation displays the plan and prompts before
execution. Noninteractive execution requires `--yes`; `--json` is output
selection, not consent. `--dry-run` and `--yes` cannot be combined.

## Server lifecycle

`portreeve serve` is always a foreground, blocking server. Running it with the
shell's backgrounding features does not turn it into a supervised service.
The server reports its PID and its asserted execution mode over the private
Unix socket.

### Layered status

`portreeve status --json` returns one runtime-validated snapshot even when an
ordinary layer is absent, stopped, failed, unhealthy, or incompatible:

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
`unavailable`, `healthy`, `unhealthy`, or `incompatible`. Effective mode is
`none`, `manual`, `supervised`, or `ambiguous`.

A responding server is `supervised` only when its asserted mode and PID agree
with the currently observed native supervisor. A healthy manual server is an
ordinary successful status. An unavailable/unhealthy socket or ambiguous
mode exits `10`. Failure to construct the command or validate its invocation
remains a top-level error.

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

`before` and `after` are complete layered status snapshots. Outcome is
`succeeded`, `no-change`, `refused`, `partial`, or `failed`. Refused and failed
operations still write this trustworthy result to standard output and use the
appropriate nonzero exit band. A top-level JSON error is reserved for command
usage or failures that prevent lifecycle evidence from being constructed.

`portreeve install` explicitly installs native per-user supervision:

- macOS uses `~/Library/LaunchAgents/com.portreeve.server.plist`;
- Linux uses `~/.config/systemd/user/portreeve.service`, or the corresponding
  path below `XDG_CONFIG_HOME`;
- the managed executable is stored below Portreeve's private application
  directory at `bin/portreeve`;
- installation and upgrade never require or accept root;
- a newly installed or already inactive service remains inactive until
  `portreeve start`;
- an active upgrade is stopped, atomically promoted, restarted, and
  health-checked; activation failure restores the prior executable,
  definition, and active state; and
- the CLI never replaces a newer managed or running Portreeve version with an
  older source executable.

`start` and `restart` require an installed native service and refuse to adopt
or replace a manual or ambiguous server. `stop` unloads/disables only an active
supervisor before waiting for its server to disappear, preventing automatic
restart. `stop-manual` is the separate explicit operation that requests
graceful shutdown of a verified manual server through the protected socket;
it refuses supervised, ambiguous, or absent state. `uninstall` refuses live
manual or ambiguous state, removes the native definition and managed
executables, and preserves the registry, settings, history, and diagnostic
data.

### Complete reset

Every initialized application home contains a private
`.portreeve-owner.json` marker binding the Portreeve product, schema, canonical
root, and user ID. Portreeve creates it for a new empty private home or
migrates an existing private home only when every entry is recognized
Portreeve state. Missing, malformed, mismatched, nonprivate, or symlinked
markers block reset.

Complete reset is a two-command evidence-bound operation:

```sh
portreeve purge --dry-run --json
portreeve purge --confirm PREVIEW_TOKEN --json
```

The dry run inspects the canonical root, marker, lifecycle state, native
definition, and every deletion path without following symlinks. It returns the
exact paths, refusal reasons, and a SHA-256 confirmation token. Execution
immediately repeats that inspection and refuses when its token differs. The
token is not a secret and does not replace user confirmation; it proves only
that the preview evidence is unchanged.

A live manual, ambiguous, or incompatible server blocks purge. A confirmed
purge may stop and uninstall a supervised service. It revalidates the marker,
ownership, permissions, path types, and symlinks after supervision changes and
before deleting data. The result reports `removed`, `retained`, `missing`, and
`refused` paths and uses `succeeded`, `refused`, or `partial` without claiming
complete reset after partial failure.
