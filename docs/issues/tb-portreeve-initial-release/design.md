# Design - tb-portreeve-initial-release

**Status:** approved (gate passed 2026-07-30)

## Problem

Concurrent development services on one machine contend for TCP ports. This is
especially frequent when agents create multiple Git worktrees and run complete
application stacks in parallel.

Existing project-local solutions probe ports during startup, remap conflicts,
persist local overrides, and regenerate runtime configuration. They duplicate
coordination logic across projects, introduce time-of-check/time-of-use races,
and have difficulty distinguishing a legitimately reclaimable listener from an
unrelated process. Each project sees only its own desired ports, while the
operating system owns one machine-wide port space.

Portreeve must replace that fragmented behavior with one per-user local
authority while permitting gradual migration. A migrated service must receive
a stable assignment, negotiate the bind race, and obtain evidence-rich
conflicts without silently falling back to another allocator. Unmigrated
services must remain visible as live, unclaimed listeners rather than being
assumed away.

## Intent

Portreeve is "the local authority for development ports." Its initial release
will:

- coordinate TCP port assignments for development services across projects and
  Git worktrees;
- preserve sticky assignments while supporting short-lived ephemeral claims;
- use the operating system's actual listeners as live evidence;
- support conservative verified reclamation and an unmistakably unsafe,
  operation-scoped escape hatch;
- provide a portable foreground server, native per-user supervision, a
  human-and-agent-friendly CLI, and an official JavaScript client;
- ship as self-contained macOS and Linux executables without requiring an
  installed JavaScript runtime;
- keep its API, database, diagnostics, audit history, and process information
  local to the current operating-system user.

V1 is not a network service, a production service-discovery system, a general
process supervisor, a TCP proxy, or a kernel-level socket reservation broker.
It does not support UDP, Windows, a macOS GUI application, multiple official
language clients, automatic telemetry, or silent fallback to legacy
project-local allocation.

## Chosen shape

### System boundary

```text
development service
    |
    | official JS client or another protocol client
    | HTTP/JSON over a per-user Unix-domain socket
    v
+------------------------- Portreeve server -------------------------+
| versioned API                                                   |
| allocation and claim domain logic                               |
| ownership reconciliation and reclamation                        |
|                                                                 |
| SQLite registry       fresh lsof/process inspection             |
| local audit history   bounded diagnostic logs                   |
+------------------------------------------------------------------+
    ^
    | same versioned socket API
    |
Portreeve operational CLI

Native lifecycle CLI operations also invoke launchd or systemd --user.
```

One long-running server owns all durable allocation mutations. Application
clients and ordinary CLI commands never open SQLite or instantiate an
in-process allocator. The official JavaScript client deliberately uses the
same public protocol available to every other language.

### Claim identity and port model

A v1 claim key contains:

```text
project namespace + canonical workspace root + service name + transport
```

The transport is explicitly `tcp`. Inside Git, the client uses the canonical
real path of the Git worktree root. Outside Git, it uses a documented canonical
project root. There is no `PORTREEVE_INSTANCE` override in v1. Two independent
instances of one service from one checkout require separate worktrees.

A TCP number is treated as machine-wide across all local interfaces and both
IP families. Separate claims may not share a number merely because they intend
to bind different addresses. One run may own multiple IPv4, IPv6, dual-stack,
or clustered listening sockets only when every listener reconciles to that
same run.

Claims have two lifetime modes:

- `sticky` is the default. Its assignment remains reserved after the current
  service run stops and changes only through explicit claim administration.
- `ephemeral` is intended for tests, previews, and temporary runs. Its number
  becomes reusable only after its TTL expires and fresh inspection finds no
  listener.

An initial request may specify:

- a `preferred` port, which permits automatic fallback; or
- an `exact` port, which either succeeds with that number or returns a
  structured conflict.

Changing a preference does not silently move an established sticky claim.
Automatic fallback candidates come from a validated per-user pool after
explicit exclusions and the effective operating-system ephemeral range are
removed. The exact default pool will be set from verified macOS and Linux
behavior during implementation.

### Two-phase allocation

Portreeve coordinates cooperating clients atomically but does not claim to
reserve a candidate in the kernel before the service binds it.

1. `acquire` checks durable claims and fresh listener evidence, selects a
   candidate, and creates a short-lived pending lease with an unguessable
   token.
2. The client attempts to bind the candidate.
3. After the service reports a successful listen operation, `confirm`
   correlates the lease with fresh listener and process evidence and converts
   it into a confirmed run.
4. On an address-in-use error, the client reports the collision. Portreeve
   reinspects the port and either offers another allowed candidate or applies
   the caller's explicit replacement policy.
5. The client may `abandon` a candidate. Any unconfirmed lease also expires
   automatically.

A successful operating-system bind is the definitive acquisition event. The
high-level JavaScript helper wraps this sequence around an asynchronous
service-start callback. The callback must resolve only after listening has
succeeded. Low-level `acquire`, `confirm`, `abandon`, and `release` primitives
remain available for framework adapters.

A confirmed run requires no heartbeat, persistent connection, or lease
renewal. A graceful `release` improves bookkeeping but is not proof that a
port is free. Current liveness is reconciled from fresh listener evidence when
needed.

### Live ownership and run lineage

Fresh, LISTEN-specific `lsof` output is Portreeve's live occupancy authority.
SQLite records allocation and historical process evidence; neither a durable
claim nor a stored PID proves present ownership.

During confirmation Portreeve fingerprints the run root and every observed
listener using evidence such as PID, process start time, executable, user, and
lineage. A PID is only an ephemeral handle for inspecting or signaling a
process that was just observed. Start time and the rest of the fingerprint
guard against PID reuse.

The actual listener may be:

- the confirmed root process; or
- a verified descendant of that same still-live root process instance.

This accommodates package-script launchers, framework CLIs, watchers, and
clustered servers. Ancestry establishes association; it does not expand
termination scope. Reclamation targets only processes currently proven to own
the listening socket, never an entire process tree merely because it is
related.

Every safety-sensitive operation takes a complete listener snapshot, derives
current fingerprints, and refuses absent, unknown, changed, or mixed
ownership. Portreeve reinspects immediately before signaling and after
graceful termination.

### Replacement and eviction

Ordinary acquisition does not terminate a running service. Callers select one
of three explicit replacement policies:

- `never` is the default and reports the existing run or conflict.
- `graceful` requires complete ownership proof, sends `SIGTERM`, waits for the
  configured grace period, and returns a structured timeout if the listener
  survives.
- `force-after-grace` performs the verified graceful sequence, reinspects the
  targets, and sends `SIGKILL` only while every target remains the exact same
  proven process instance.

Force intent may be provided at the start of an automated request. It permits
escalation but never bypasses ownership proof.

V1 also provides a separate unsafe any-owner eviction operation for exceptional
recovery. It:

- requires an exact port and unmistakable operation-scoped unsafe intent;
- snapshots and exposes every current listener fingerprint;
- supports non-mutating dry-run behavior;
- binds execution to the inspected process instances and refuses replacement
  targets;
- attempts graceful termination before separately authorized forced
  escalation;
- records the request, evidence, signals, and outcome.

Unsafe eviction may be invoked explicitly by a human or agent through the
CLI/API. It is not a persistent client or service replacement policy.

### Transport, persistence, and compatibility

The server exposes versioned HTTP/JSON over a per-user Unix-domain socket on
macOS and Linux. It opens no TCP control port. `PORTREEVE_SOCKET` and
equivalent bootstrap flags may override the platform socket path. A future
Windows adapter may preserve the schema over a named pipe.

The user-owned application directory, runtime files, database, and socket use
restrictive permissions. Portreeve rejects unsafe preexisting paths rather
than weakening protection. The operating-system user is the v1 trust boundary;
there is no long-lived bearer token shared among services. Short-lived lease
tokens correlate allocation phases but do not relax reclamation rules.

One SQLite database in the platform application-data location stores:

- sticky and ephemeral claims;
- assignments and server settings;
- pending leases and expirations;
- confirmed runs and historical fingerprints;
- schema and migration state;
- structured audit/history events.

Only the server opens the database during normal operation. Externally supplied
JSON and persisted records receive runtime schema validation.

The API uses an explicit major-version namespace. Health and handshake output
reports the server software version, supported protocol range, and
capabilities. Clients declare their compatible protocol range and required
capabilities. Mismatches fail before allocation or mutation and report exact
upgrade guidance; compatible software versions need not be equal.

### CLI and operational inventory

The CLI uses Commander.js and defaults to concise human-readable output.
Operational commands also expose versioned `--json` shapes and documented exit
codes for success, ordinary state differences, conflicts, unavailable server,
protocol incompatibility, invalid input, and internal failure. Automation
never needs to parse prose, raw `lsof`, or SQLite.

The command families include:

- server execution and lifecycle: `serve`, `install`, `uninstall`, `start`,
  `stop`, `restart`, and `status`;
- global inventory: `ports list` and `ports inspect <port>`;
- claim administration: list/show operations, `claims reassign`,
  `claims delete`, and `claims prune`;
- validated server settings: `config get/set`;
- local observability: `logs` and `history`;
- explicit reclaim, dry-run, and unsafe eviction operations.

Global inventory returns the union of durable claims and one complete
machine-wide TCP LISTEN snapshot. It shows every listener and classifies
verified active, idle sticky, pending, unclaimed, conflicting, and mixed
states. Filters cover claim status, project, workspace, service, and port. The
same reconciliation implementation supplies inventory, conflict, dry-run,
reclamation, and eviction evidence.

`release` ends the current run but preserves a sticky assignment.
`claims reassign` changes an idle claim's assignment, while `claims delete`
returns an idle assignment to the pool. Both refuse to mutate around an active
or unresolved listener.

`claims prune` finds path-derived claims whose canonical workspace roots no
longer exist, have been unused for at least seven days by default, have no
pending lease, and have no unresolved listener. `--older-than` changes the
threshold for one invocation, including explicit immediate cleanup with
`--older-than 0`.

Prune behavior is:

```text
claims prune --dry-run  report without mutation
claims prune            prompt and execute in an interactive terminal
claims prune --yes      execute noninteractively
```

Noninteractive execution without `--yes` refuses. `--json` is not consent, and
`--dry-run` conflicts with `--yes`. The server never prunes sticky claims in
the background.

### Server lifecycle and native supervision

`portreeve serve` is the only command that runs the server and always blocks in
the foreground. Shell-backgrounding it creates a manual, unsupervised server.
Portreeve does not double-fork, detach itself, or maintain a PID-file
supervisor.

Durable per-user supervision uses a LaunchAgent on macOS and a `systemd --user`
unit on Linux:

- `install` explicitly creates/enables the native integration;
- `uninstall` stops and removes it without deleting claims or user data;
- `start` and `restart` operate only through an installed native supervisor;
- `status` reports both socket-observed server health/mode and native service
  state;
- `stop` gracefully handles either manual or supervised mode, stopping the
  supervisor first when required to prevent automatic restart.

`start` and `restart` refuse to replace or silently adopt an active manual
server. `start` does not implicitly install login behavior.

Installation copies the invoking executable atomically into a stable,
Portreeve-managed per-user location. Native definitions never depend on a
download directory, build tree, shell `PATH`, package-manager path, or language
version manager.

A newer CLI is acquired through Homebrew or direct download, not a networked
self-updater. Running `install` stages the new managed executable, preserves a
rollback copy, updates native definitions, and restarts only if the service was
previously active. It health-checks the new server and restores the previous
binary and service state on failure. Status reports CLI/server version
differences.

### Implementation and distribution

The implementation language is modern ESM JavaScript. Commander.js supplies
the CLI. JSDoc types plus TypeScript `checkJs` in strict, no-emit mode provide
static checking without changing source languages. Runtime schema validation
protects all wire and persisted boundaries.

Bun is a pinned development, test, and executable-build dependency. Bun-only
facilities are isolated behind infrastructure boundaries. Allocation domain
logic and the official client remain based on portable Node-compatible and web
interfaces.

The official JavaScript package supports the selected Node.js and Bun release
range and always uses the public socket protocol in production. V1 maintains
no other official language package. Python, shell, and other clients may use
the documented protocol or CLI JSON contract.

Checksummed GitHub Release executables are the authoritative distribution
artifacts for each supported macOS/Linux architecture. A Homebrew formula
provides macOS and Linux convenience installation. The JavaScript client is
published separately through npm. A macOS application bundle, `.deb`, `.rpm`,
and other native packages are deferred.

Release verification must execute compiled artifacts on every advertised
operating-system and architecture target. Successful cross-compilation alone
is insufficient evidence.

### Configuration and observability

Portreeve has built-in defaults and no general hand-edited or executable
configuration file.

- Durable server settings such as allocation pools and exclusions live in
  validated SQLite records managed through `config get/set`.
- Project/service identity, claim mode, preferred/exact port, and replacement
  policy arrive in client requests.
- Environment variables and flags are restricted to bootstrap values that must
  be known before connecting to the server, such as data and socket locations.

The daemon does not execute project configuration code or absorb ambient
project `.env` files.

All observability remains local. Bounded rotating diagnostic logs support
server, database, protocol, supervisor, and process-inspection troubleshooting.
Structured history records claim/lease mutation, confirmation/release,
reclamation, eviction, configuration, install/update/rollback, and pruning.
`logs` and `history` expose human and JSON views. Portreeve sends no telemetry
or automatic external reports.

## Alternatives considered

- **Continue project-local probing and persisted remapping.** Rejected because
  it duplicates coordination, cannot serialize machine-wide decisions, and is
  the complexity Portreeve is intended to remove.
- **Let clients open a shared file or SQLite database directly.** Rejected
  because it distributes migration, transaction, and safety logic and creates
  multiple authorities.
- **Use a TCP control server.** Rejected because the authority should not
  consume another development port or expose itself to the network.
- **Have Portreeve bind candidate sockets and transfer descriptors or proxy
  traffic.** Rejected for v1 because cross-language descriptor handoff and
  proxy ownership would materially complicate portability. The two-phase
  protocol contains the bind race without pretending to eliminate it.
- **Trust persisted PIDs or client ownership assertions.** Rejected because
  PIDs go stale and are reused. Fresh listener evidence and composite process
  fingerprints are required.
- **Require the allocating PID to be the listener.** Rejected because common
  development launchers create child server processes. Verified run lineage
  accommodates that behavior without killing whole process trees.
- **Require active-client heartbeats.** Rejected because `lsof` supplies live
  occupancy and heartbeat expiry could disagree with the kernel. Only pending
  allocation leases expire.
- **Automatically kill whatever occupies an assigned port.** Rejected as a
  normal policy. Verified replacement is conservative; any-owner eviction is
  explicit, operation-scoped, fingerprint-bound, and audited.
- **Give every service a long-lived API secret.** Rejected because the
  per-user socket is already the trust boundary and a shared token adds little
  protection from same-user processes.
- **Embed Portreeve in the JavaScript client.** Rejected because it would
  bypass the portable protocol and create another allocator.
- **Ship multiple official language clients immediately.** Rejected to keep
  compatibility and release scope focused. The language-neutral protocol
  remains documented.
- **Use TypeScript, Python, Go, or Rust for the initial implementation.**
  Considered. Vanilla JavaScript best matches maintainer familiarity and the
  desired Commander.js ergonomics; checked JSDoc supplies useful type safety,
  while Bun supplies standalone builds.
- **Use an executable project configuration file.** Rejected because it would
  reintroduce hidden, project-specific behavior and daemon code execution.
- **Allow `PORTREEVE_INSTANCE` logical identity overrides.** Initially
  considered, then removed. Canonical worktree roots cover the target
  concurrent-development model and make lifecycle/pruning inspectable.
- **Automatically prune missing workspaces.** Rejected because sticky state
  should change only through an explicit, reviewable operation.
- **Implement daemonization or a GUI login application.** Rejected for v1.
  Foreground `serve` plus native per-user supervisors is portable and
  testable.
- **Build a networked self-updater and native OS package matrix.** Deferred in
  favor of authoritative release binaries, Homebrew, npm for the client, and
  explicit health-checked managed installation.

## Constraints

- V1 supports per-user macOS and Linux environments and requires `lsof` plus
  sufficient process metadata access for its advertised safety behavior.
- The server must never require root. Metadata that cannot be observed due to
  permissions is unknown evidence, not permission to proceed.
- V1 manages TCP only and reserves each number across interfaces and address
  families.
- One server owns the database. All normal client and CLI mutations traverse
  the versioned socket API.
- Migrated clients fail loudly when the server is absent, unhealthy, or
  incompatible. They never invoke a fallback allocator or implicitly
  install/start Portreeve.
- Sticky assignments never move because a preferred port changed. Exact-port
  requests never silently fall back.
- Process termination always begins from a fresh, complete listener snapshot.
  Stored PIDs alone never authorize a signal.
- `force-after-grace` does not bypass ownership proof. Only the distinct unsafe
  operation may bypass claim ownership, and it remains bound to freshly
  inspected process instances.
- The public CLI's JSON schemas and exit codes are compatibility contracts.
- The official client must remain Node-compatible and cannot expose Bun-only
  APIs.
- The distributed CLI/server executables must run without an installed Node,
  Bun, Python, or other language runtime.
- Native supervision is explicit, per-user, reversible, and implemented through
  LaunchAgent and `systemd --user` adapters.
- No general configuration file, background pruning, telemetry, network
  listener, embedded allocator, or silent update behavior is permitted.
- V1 source, protocol, database, release, and audit schemas require explicit
  versioning and migrations appropriate to their compatibility promises.

## Open risks

- **Bind race remains.** An unrelated process can bind between candidate
  selection and client `listen()`. The two-phase client flow retries and
  reconciles but cannot provide kernel reservation.
- **Inspection/signal race remains.** Cross-platform process signaling lacks
  one uniform stable process-handle abstraction. Immediate fingerprint
  revalidation narrows but cannot mathematically eliminate the interval between
  inspection and signal delivery.
- **`lsof` is an external system dependency.** Availability, output behavior,
  permissions, and process metadata differ across supported macOS/Linux
  environments. An early platform spike and a strong `doctor` diagnostic are
  required.
- **Run-lineage churn may become ambiguous.** Watchers can replace children,
  descendants may be reparented, and clustered listeners can change. The safe
  response is refusal, but overly conservative matching could reduce automatic
  reclamation usefulness.
- **Bun compatibility must be proven.** Commander.js, Unix sockets,
  child-process execution, SQLite, signals, compiled assets, and standalone
  target behavior require an early compiled-daemon spike on every supported
  family.
- **Default allocation range is unresolved.** macOS and Linux ephemeral ranges
  and local service conventions must be measured before selecting the built-in
  pool and fallback behavior.
- **Release support matrix needs exact bounds.** CPU architectures, minimum OS
  versions, glibc/musl coverage, supported Node.js client versions, code
  signing/notarization, Homebrew tap ownership, and npm package naming must be
  fixed during specification and release planning.
- **Supervisor adapters differ materially.** LaunchAgent and `systemd --user`
  installation, stop/restart semantics, logging, session availability, and
  rollback must be tested as separate platform integrations.
- **Global inventory may be incomplete.** Same-user execution may not reveal
  complete metadata for every machine listener. Output must distinguish
  unclaimed from unobservable rather than presenting absence as proof.
- **Unsafe eviction is inherently dangerous.** Strong naming, dry-run output,
  noninteractive consent, revalidation, and audit reduce accidental misuse but
  cannot make deliberate any-owner termination safe.
- **V1 scope is broad.** The implementation plan should land a vertical
  allocation/confirmation slice before supervisor, distribution, unsafe
  eviction, and release-channel work, while preserving the final protocol and
  safety boundaries.

## Changes

Changes after design-gate approval must be appended here rather than silently
rewriting the approved design.
