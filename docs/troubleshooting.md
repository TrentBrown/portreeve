# Troubleshooting

## Server unavailable

Run:

```sh
portreeve status --json
```

If native supervision is not installed, start a foreground server with
`portreeve serve`. If it is installed but inactive, use `portreeve start`.
Exit status `10` means status successfully observed a stopped server; `30`
means a command that required the socket could not reach it.

## Manual server conflicts with start or install

`status` reports `mode: "manual"` when a socket responder does not match the
native supervisor PID. Stop it with `portreeve stop`, then retry the native
operation. Portreeve never adopts a shell-backgrounded `serve` process.

## Requested port is unavailable

Inspect the exact port:

```sh
portreeve ports inspect 3000 --json
```

Preferred requests may fall back. Exact requests return a structured conflict.
Normal reclaim refuses unknown or mixed ownership. Use unsafe eviction only
after reviewing the listener/process evidence and understanding that it may
terminate unrelated work.

## Claim remains after deleting a worktree

Preview missing-workspace cleanup:

```sh
portreeve claims prune --dry-run
```

The default minimum age is seven days. Active runs, pending leases, current
listeners, existing paths, and recently used claims remain protected.

## Logs and history

`portreeve logs --json` reads bounded diagnostic JSON Lines. `portreeve
history --json` reads structured audit events. On macOS supervised stdout and
stderr are in the Portreeve application directory; Linux uses the configured
systemd unit output paths there as well.

The default application directory is
`~/Library/Application Support/Portreeve` on macOS and
`${XDG_STATE_HOME:-~/.local/state}/portreeve` on Linux.

## CLI and server versions differ

Compatible versions may interoperate. `status` reports `versionMatches` plus
both versions. To promote a newly downloaded CLI into an installed service,
run `portreeve install`; it restarts only when the service was already active
and rolls back a failed activation.
