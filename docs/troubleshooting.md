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

`status` reports `mode: "manual"` only when the responder asserts manual mode
and no native supervisor is active. Stop it explicitly with `portreeve
stop-manual`, then retry the native operation. `portreeve stop` controls only
the observed native supervisor; it never sends shutdown to a manual or
ambiguous socket responder. PortReeve never adopts a shell-backgrounded
`serve` process.

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

For an entire deleted worktree stack, preview the higher-level coordination cleanup:

```sh
portreeve stacks prune --dry-run
```

The plan reports eligible stacks and blockers. Noninteractive execution requires
`portreeve stacks prune --yes`; no prune command stops processes or containers.

## Launcher exited but providers may still be running

Inspect and reconcile the activation instead of relying on the launcher's PID:

```sh
portreeve stacks reconcile ACTIVATION_ID --json
```

`active` or `unknown` provider evidence keeps the activation live. When every confirmed
provider is conclusively gone, the activation becomes `lost` and a replacement launcher
may begin another activation against the generation if it remains valid. Stop surviving
processes or containers through the project launcher before retrying reconciliation or
ending.

## Launcher is untrusted or changed externally

Trust is bound to the canonical stack root and SHA-256 revision of the exact launcher
file bytes. Inspect the current definition without changing trust:

```sh
portreeve launcher validate --json
```

Then use interactive `portreeve launcher trust` or Desktop **Save and Trust** after
reviewing the resolved shell, working directory, and every command. Desktop offers
Review, explicit Overwrite, or Cancel when bytes change after the editor opens. There is
no force-execute or noninteractive trust bypass.

## Launcher cannot start while PortReeve is unavailable

Start and Restart require a current allocation and daemon coordination, so they refuse
an outage. Restore the service with `portreeve start` or run `portreeve serve` in the
foreground. Status may use a clearly stale exact-revision cache. Stop may use that cache
only after `--allow-degraded` or the corresponding Desktop confirmation; the result is
local, uncoordinated, and has no server-side history.

## Launcher output is missing from history

Raw stdout and stderr are intentionally retained only for the current Desktop or CLI
session and are bounded. Desktop **Save output** is the explicit persistence action.
Durable launcher history keeps safe metadata—operation, outcome, timing, exit or signal,
degraded or lost state, and reduced evidence—but never raw output or environment values.

## Desktop says Saved, but not applied

The project file write succeeded and is not rolled back. The editor shows the apply
outcome, stable error code, message, and validation details returned by the trusted
coordinator. Restore or upgrade the PortReeve service as indicated, then use **Retry
Apply** while the draft still matches the saved definition. If you edit the draft,
Retry is hidden because it would apply older bytes; use **Save and Apply** for the new
draft instead.

Applying still does not allocate ports. After a successful retry, return to stack
details and choose **Prepare allocation** when the project launcher is ready.

## Desktop reports an external definition change

PortReeve compares the current bytes of `portreeve.stack.json` with those observed when
the editor opened. Choose **Cancel** to preserve the external version and reopen it, or
**Overwrite** only when the visible draft should replace those newly observed bytes. A
second external change requires another confirmation. Symlinks, oversized files, and
other non-regular definition paths are refused rather than overwritten.

When a registered stack's file is missing, the editor can seed a replacement from its
currently applied definition. When the file is invalid, replacement is explicit and the
invalid bytes are never partially interpreted.

## Logs and history

`portreeve logs --json` reads bounded diagnostic JSON Lines. `portreeve
history --json` reads structured audit events. On macOS supervised stdout and
stderr are in the PortReeve application directory; Linux uses the configured
systemd unit output paths there as well.

The default application directory is
`~/Library/Application Support/Portreeve` on macOS and
`${XDG_STATE_HOME:-~/.local/state}/portreeve` on Linux.

## CLI and server versions differ

Compatible versions may interoperate. `status` independently reports the CLI,
managed, and running versions. To promote a newly downloaded CLI into an
installed service, run `portreeve install`; it refuses to replace a newer
managed or running version, restarts only when the service was already active,
and rolls back a failed activation.
