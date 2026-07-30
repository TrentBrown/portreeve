# Portreeve CLI contract

Portreeve defaults to concise human-readable output. Operational commands
accept `--json` and emit one JSON document with `"version": 1`. Successful
documents are written to standard output. Structured failures are written to
standard error:

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
| `20` | Claim, port, listener, or reclamation conflict |
| `30` | The Portreeve server is unavailable |
| `40` | Client/server protocol or capability incompatibility |
| `50` | Invalid command, option, JSON value, or request input |
| `70` | Unexpected internal failure |

## Operational JSON keys

| Command | Success document |
|---|---|
| `status` | `{ "version": 1, "status": { ... } }` |
| `install` / `uninstall` | `{ "version": 1, "installation": { ... } }` |
| `start` / `restart` | `{ "version": 1, "status": { ... } }` |
| `stop` | `{ "version": 1, "stop": { ... } }` |
| `ports list` | `{ "version": 1, "entries": [ ... ] }` |
| `ports inspect` | `{ "version": 1, "entry": { ... } }` |
| `ports reclaim` / `ports unsafe-evict` | `{ "version": 1, "result": { ... } }` |
| `claims list` | `{ "version": 1, "claims": [ ... ] }` |
| `claims show` / `claims reassign` | `{ "version": 1, "claim": { ... } }` |
| `claims delete` | `{ "version": 1, "result": { ... } }` |
| `claims prune` | `{ "version": 1, "result": { ... } }` |
| `config get` | `{ "version": 1, "settings": { ... } }` or `{ "version": 1, "value": ... }` |
| `config set` | `{ "version": 1, "settings": { ... } }` |
| `history` | `{ "version": 1, "events": [ ... ] }` |
| `logs` | `{ "version": 1, "entries": [ ... ] }` |

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
  definition, and active state.

`start` and `restart` require an installed native service and refuse to adopt
or replace a manual server. `stop` unloads/disables an active supervisor before
stopping its server, preventing automatic restart; it can also request
graceful shutdown of a manual server through the protected socket.
`uninstall` removes the native definition and managed executables while
preserving the registry, settings, history, and diagnostic data.

`status` independently reports socket-observed server health and native
supervisor state. It identifies a server as supervised only when the health
PID matches the native supervisor's current main PID; otherwise a responding
server is reported as manual. It also reports CLI/server version equality.
A stopped server is an ordinary state difference and exits with status `10`.
