# Safety model

Portreeve is a same-user local authority, not a network service or privilege
boundary.

- The HTTP/JSON control plane uses a mode-`0600` Unix socket.
- Runtime directories are private and rejected when ownership, type, symlink,
  or permission checks are unsafe.
- Only the server normally owns SQLite migrations and transactions.
- Lease tokens are random and stored only as one-way hashes.
- Mutating requests negotiate protocol and required capabilities.
- Portreeve does not load project `.env` files, executable configuration, or
  plugins and sends no telemetry.

## Listener ownership and signals

`lsof` is the live listener source of truth. Stored PIDs are context, never
sufficient ownership proof. Normal reclamation requires fresh listener,
process-start, executable, confirmed-run, and lineage evidence and revalidates
the exact process instance before every signal. Mixed, unknown, or changed
evidence refuses normal reclamation.

`graceful` sends SIGTERM and waits. `force-after-grace` may send SIGKILL only
after the grace period and another successful revalidation. Replacement
processes are never inherited as targets.

`ports unsafe-evict` is a separate escape hatch. It requires literal
`--unsafe-any-owner` consent for that invocation, still binds its plan to the
observed process fingerprint, and supports `--dry-run`. It can terminate an
unrelated same-user process; callers should inspect the evidence first.

## Lifecycle safety

Native lifecycle operations are per-user and reject root. Managed executables
must not be writable by another user. `start` and `restart` refuse manual
servers rather than adopting them. Active upgrades atomically promote a staged
binary, verify the responding PID/version through both socket and supervisor
evidence, and restore the previous binary and active state on failed health.

Complete reset requires a strict private ownership marker matching the
canonical application root and current user. Marker creation claims only a new
empty home or recognized pre-marker Portreeve state with validated entry
types, ownership, permissions, and managed-bin contents. Purge preview inspects
the complete tree with `lstat`, refuses symlinks, foreign ownership, nonprivate
roots or markers, paths writable by another user, and live
manual/ambiguous/incompatible servers, and hashes that evidence into a
confirmation token. Execution accepts only an identical fresh preview,
revalidates after stopping supervised state, refuses any path added during
that shutdown window or any supervisor definition retained by uninstall,
keeps the marker when deletion is partial, and reports retained or refused
paths instead of claiming success.
