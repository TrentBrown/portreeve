# Safety model

PortReeve is a same-user local authority, not a network service or privilege
boundary.

- The HTTP/JSON control plane uses a mode-`0600` Unix socket.
- Runtime directories are private and rejected when ownership, type, symlink,
  or permission checks are unsafe.
- Only the server normally owns SQLite migrations and transactions.
- Lease tokens are random and stored only as one-way hashes.
- Mutating requests negotiate protocol and required capabilities.
- PortReeve does not load project `.env` files, executable configuration, or
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

Docker-backed endpoints use a separate evidence path. Confirmation requires a fresh
container inspection by exact container ID, a running container, exact PortReeve labels
for the stack revision/generation/activation, an exact `127.0.0.1` host-to-container
TCP publication, and exact container-port agreement. A stored container ID is only a
lookup key, not proof. An observable host listener is corroborating evidence, but Linux
Docker Engine may publish through kernel NAT without a userspace `LISTEN` socket.
PortReeve does not infer Docker ownership from process ancestry.

Normal reclamation and `ports unsafe-evict` never signal Docker Desktop, the Docker
daemon, or a Docker port-forwarding process. They return a structured launcher action
containing the freshly observed container IDs; the trusted launcher remains responsible
for stopping or recreating containers.

Activation reconciliation does not trust launcher liveness, stored PIDs, or stored
container IDs. It freshly evaluates current process ownership or exact Docker labels and
publication evidence. Unobservable evidence preserves the live activation; it never
authorizes replacement or ending.

`stacks prune` performs no reclamation. It requires an old missing stack root, reports
resource blockers, revalidates before deletion, and skips any stack whose path or live
evidence reappears. Successful pruning deletes only inactive coordination records and
their endpoint claims while retaining durable history.

`ports unsafe-evict` is a separate escape hatch. It requires literal
`--unsafe-any-owner` consent for that invocation, still binds its plan to the
observed process fingerprint, and supports `--dry-run`. It can terminate an
unrelated same-user process; callers should inspect the evidence first.

## Stack definition editing

Stack definitions remain project-owned files. The desktop renderer cannot choose an
arbitrary path, read or write the filesystem, open the PortReeve socket, or execute the
CLI. A trusted main-process document session resolves the canonical root, exposes only
an opaque ID and display basename, bounds and strictly validates file content, refuses
symlinks and non-regular paths, creates missing files exclusively, and atomically
replaces existing regular files.

Existing writes are conditional on the exact bytes observed when the document opened.
If those bytes change, the user must explicitly choose Overwrite or Cancel; the
one-use overwrite capability is bound to the newly observed bytes and cannot authorize
a later race. Invalid JSON is never partially interpreted. Saving precedes daemon
apply, and Retry Apply is available only for the unchanged saved definition.

## Lifecycle safety

Native lifecycle operations are per-user and reject root. Managed executables
must not be writable by another user. `start` and `restart` refuse manual
servers rather than adopting them. Active upgrades atomically promote a staged
binary, verify the responding PID/version through both socket and supervisor
evidence, and restore the previous binary and active state on failed health.

Complete reset requires a strict private ownership marker matching the
canonical application root and current user. Marker creation claims only a new
empty home or recognized pre-marker PortReeve state with validated entry
types, ownership, permissions, and managed-bin contents. Purge preview inspects
the complete tree with `lstat`, refuses symlinks, foreign ownership, nonprivate
roots or markers, paths writable by another user, and live
manual/ambiguous/incompatible servers, and hashes that evidence into a
confirmation token. Execution accepts only an identical fresh preview,
revalidates after stopping supervised state, refuses any path added during
that shutdown window or any supervisor definition retained by uninstall,
keeps the marker when deletion is partial, and reports retained or refused
paths instead of claiming success.
