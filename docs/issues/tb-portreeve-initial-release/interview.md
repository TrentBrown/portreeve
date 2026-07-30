# Interview - tb-portreeve-initial-release

**Feature start:** 2026-07-28
**Status:** concluded 2026-07-30; synthesized into `design.md`

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - Feature identity

**Question:** What feature identity should anchor the initial Portreeve
release in the Agentic Development Workflow?

**Answer:** `tb-portreeve-initial-release`.

**Decision:** Use `tb-portreeve-initial-release` as the stable feature ID and
first delivery branch. No external tracker task is associated with it.

**Kind:** Meta/tooling.

## D2 - Problem to solve

**Question:** What problem is this project intended to solve?

**Answer:** Concurrent agentic software development on one machine quickly
causes development-port conflicts. Existing project-local port probing,
remapping, and persistence logic has become complicated and has poorly handled
edge cases.

**Decision:** Portreeve will provide one machine-level coordination authority
that development services can use to obtain persistent port assignments,
reducing project-local allocation logic.

## D3 - Project identity

**Question:** What name should the project use?

**Answer:** Portreeve.

**Decision:** The project, application, and primary CLI will be named
Portreeve, with the working tagline "the local authority for development
ports."

## Design hypotheses still to test

- `lsof` may remain the source of live listener evidence, while Portreeve's
  persisted state supplies historical claim and ownership evidence.
- Automatic process termination may be safe only when the current listener can
  be proven to belong to the prior run for the same claim.
- A portable client library and CLI wrapper may support gradual migration of
  existing services.

## D4 - Initial-release packaging boundary

**Question:** Should the initial release be CLI-first—portable
`portreeve serve`, allocation and ownership persistence, safe reclamation, a
client library, and native launchd/systemd integration—while deferring the
macOS GUI application?

**Answer:** Yes.

**Decision:** The initial release will use a blocking `portreeve serve` command
as its canonical portable runtime and include native launchd and systemd
integration. A macOS GUI application is explicitly deferred beyond v1.

## D5 - Automatic reclamation authorization

**Question:** Should automatic reclamation require both explicit replacement
intent and proof that every current listener belongs to the previously
recorded run?

**Answer:** Yes.

**Decision:** A durable claim alone never authorizes process termination.
Automatic reclamation requires:

1. Explicit caller intent to replace or reclaim the existing run.
2. Verification that every current listener belongs to the recorded run.

An ordinary acquisition returns an already-running result rather than
terminating a verified listener. Portreeve will use live listener inspection
and recorded process-instance evidence, including PID plus process start time,
to prevent PID-reuse mistakes. It will revalidate ownership before signaling
and after graceful termination; forced termination is allowed only while the
listener remains the same proven process instance. Unknown or mixed ownership
aborts automatic reclamation. The separately approved unsafe any-owner eviction
operation may bypass claim ownership, but only for freshly fingerprinted
listeners on an explicitly targeted port.

## D6 - Claim identity

**Question:** Should claim identity consist of an explicit project namespace,
the canonical workspace root, and an explicit service name?

**Answer:** Yes.

**Decision:** Portreeve claim identities will have three components:

```text
project namespace + canonical workspace root + service name
```

Projects declare their namespace and service names. The client derives the
workspace identity from the canonical real path of the Git worktree root,
falling back to a documented canonical project root outside Git.
Different worktrees therefore receive independent claims, while repeated
starts from one worktree reuse its claims.

**Revision (2026-07-29):** The previously proposed `PORTREEVE_INSTANCE`
override was removed from v1. Every v1 workspace identity has an inspectable
filesystem origin. Running two independent instances of one service from the
same directory requires separate worktrees. A future explicit instance
discriminator may be designed if concrete demand justifies its lifecycle and
pruning complexity.

## D7 - Claim lifetime modes

**Question:** Should v1 distinguish sticky claims from ephemeral claims, with
preferred ports affecting initial assignment only?

**Answer:** Yes.

**Decision:** Portreeve v1 will support two claim modes:

- `sticky` is the default for ordinary development services. Its assigned port
  remains reserved for that identity after the service stops and changes only
  through explicit reassignment.
- `ephemeral` is for builds, tests, previews, and other temporary runs. Its port
  becomes reusable only after its time-to-live expires and no listener remains.

A preferred port is an initial-assignment hint. It does not silently move an
established sticky claim.

## D8 - Local transport

**Question:** Should v1 use HTTP/JSON over a per-user Unix-domain socket, with
no network-facing TCP listener by default?

**Answer:** Yes.

**Decision:** Portreeve v1 will expose a language-neutral HTTP/JSON contract
over a per-user Unix-domain socket on macOS and Linux. The socket directory and
socket will be accessible only to the current user. `PORTREEVE_SOCKET` may
override the platform default. Portreeve will not consume a TCP port for its
own control plane and will not expose the API to the network. A future Windows
adapter may preserve the request schema over a named pipe.

## D9 - Runtime-independent distribution

**Question:** Should self-contained macOS and Linux executables be a v1
requirement?

**Answer:** Yes.

**Decision:** Portreeve v1 must ship self-contained executables for macOS and
Linux. Running the daemon or CLI may not depend on a developer's separately
installed Node, Python, or other language runtime. Native supervisors will
invoke a stable Portreeve executable rather than a version-manager-controlled
interpreter path.

## D10 - Implementation language and runtime

**Question:** Should Portreeve v1 use vanilla JavaScript and Commander.js,
with Bun supplying development, testing, and standalone executable builds?

**Answer:** Yes.

**Decision:** Portreeve v1 will use modern ESM JavaScript rather than
TypeScript as its implementation language. Its command-line interface will use
Commander.js. The codebase will recover appropriate static checking without
changing source languages by using JSDoc types and TypeScript `checkJs` in
strict, no-emit mode. Externally supplied HTTP/JSON data and persisted data
will still receive runtime schema validation.

Bun will be a pinned development, test, and build dependency and will compile
self-contained macOS and Linux executables. The release process must exercise
the compiled artifacts on every supported operating-system and architecture
target rather than treating successful cross-compilation as sufficient proof.

The reusable JavaScript client library will remain compatible with supported
Node.js environments and will not expose Bun-specific APIs. Bun-specific
facilities used by the daemon or CLI will be isolated behind infrastructure
boundaries so that the allocation domain model and wire contract are not
unnecessarily coupled to Bun.

## D11 - Two-phase allocation protocol

**Question:** Should v1 use a two-phase, expiring-lease protocol that hides the
port-allocation race and retry behavior behind the client library?

**Answer:** Yes.

**Decision:** A port assignment will not become active merely because
Portreeve selected and returned a number. Allocation will use these phases:

1. `acquire` atomically selects a candidate port and creates a short-lived
   pending lease with an unguessable token.
2. The client attempts to bind the candidate port.
3. After a successful bind, `confirm` converts the pending lease into an
   active allocation and records verified process-instance evidence.
4. If binding fails with an address-in-use error, the client reports the
   collision. Portreeve re-inspects live ownership and either proposes another
   candidate or applies the separately authorized reclamation rules.
5. A client may explicitly abandon a pending lease, and every unconfirmed
   lease expires automatically so that a crash cannot strand it.

The client library will encapsulate the acquire, bind, confirm, abandon, and
retry sequence around service startup. Portreeve guarantees atomic
coordination among cooperating clients, but it does not claim that a returned
port is reserved at the kernel level before the client's successful bind. A
successful operating-system bind is the definitive acquisition event.

## D12 - Live listener authority and process fingerprints

**Question:** Should fresh `lsof` evidence be authoritative for live port
occupancy, while a PID is treated only as an ephemeral handle within a
revalidated process fingerprint?

**Answer:** Yes.

**Decision:** Portreeve will use a fresh, listening-socket-specific `lsof`
inspection as its source of live occupancy evidence. A persisted claim records
allocation history, not present process ownership, and a stored PID alone
never proves ownership or authorizes termination.

During confirmation, Portreeve will correlate the pending lease with every
listener currently observed on the candidate port. It will record composite
process-instance evidence such as PID, process start time, executable, and
user. These fields are historical comparison evidence rather than a substitute
for later inspection.

During reclamation, Portreeve will:

1. Perform a fresh `lsof` inspection rather than assuming the stored PID is
   still relevant.
2. Derive a current fingerprint for every observed listener.
3. Compare those current process instances with the previously confirmed run.
4. Abort when ownership is absent, unknown, changed, or mixed.
5. Reinspect immediately before signaling and again after graceful
   termination.

PID reuse is therefore detected through process-instance comparison. A PID is
used only to interrogate or signal a process that was just observed and
revalidated; it is never durable identity on its own.

Process reclamation applies only to live listening sockets. A process that
fully exits cannot retain a listening socket by itself; apparent leftovers may
instead be surviving child processes, supervisor restarts, unrelated
listeners, or non-listening TCP states such as `TIME_WAIT`.

## D13 - Manual and supervised server lifecycle

**Question:** Should `status` and `stop` support both manually and natively
supervised servers, while `start` and `restart` refuse to replace or adopt an
already-running manual server?

**Answer:** Yes.

**Decision:** `portreeve serve` is always a blocking foreground command. A
developer may background it through their shell, but that remains a manual,
unsupervised server rather than a Portreeve-managed daemon mode.

Lifecycle commands will behave as follows:

- `status` detects any healthy server through the Unix-domain socket and
  reports whether it is manual or owned by the platform supervisor. It also
  reports the separately observed installation and activity state of the
  native supervisor unit.
- `stop` gracefully stops either mode. For a supervised server it first uses
  the native supervisor operation needed to prevent automatic restart; for a
  manual server it requests shutdown through the protected local control
  socket.
- `start` uses the native per-user supervisor. If a manual server already owns
  the socket, it reports the ownership-mode conflict rather than starting a
  competing server or silently adopting the existing one.
- `restart` uses the native supervisor. It refuses to transform an active
  manual server into a supervised server and explains that the manual server
  must first be stopped.

Portreeve will not implement double-forking, a detached daemon mode, or its own
PID-file-based supervisor. Durable background operation belongs to `launchd`
on macOS and `systemd --user` on Linux; `serve` remains usable with containers,
CI, debugging sessions, and other external supervisors.

## D14 - Explicit supervisor installation

**Question:** Should native supervisor setup require explicit `portreeve
install` and `portreeve uninstall` operations rather than occurring as a side
effect of `start`?

**Answer:** Yes.

**Decision:** Installing persistent per-user login behavior is an explicit,
reversible action:

- `portreeve install` creates and enables the appropriate per-user `launchd`
  or `systemd --user` definition.
- `portreeve uninstall` stops the supervised server when necessary, disables
  it, and removes Portreeve's supervisor definition without deleting claims or
  other persisted user data.
- `portreeve start` operates only on an installed native service. When no
  service is installed, it returns a clear diagnostic and the exact install
  command rather than modifying login behavior.

These operations must not require root privileges and must be idempotent.

## D15 - Supervisor-managed executable

**Question:** Should `portreeve install` copy the invoking executable into a
stable, Portreeve-managed per-user location instead of pointing the supervisor
at the invoking path?

**Answer:** Yes.

**Decision:** The native supervisor definition will invoke a managed copy of
the Portreeve executable from the user's platform-appropriate application-data
location. Installation must not depend on the original download directory,
build tree, shell `PATH`, language-version manager, or package-manager
installation remaining unchanged.

`portreeve install` will stage and atomically replace the managed executable
before creating or updating the supervisor definition. Updating the supervised
binary is therefore an explicit install/update operation. Portreeve will not
silently replace the running managed executable merely because a different CLI
version invokes an ordinary lifecycle command. Status output will expose both
CLI and running-server versions when they differ.

## D16 - Durable registry storage

**Question:** Should Portreeve use a per-user SQLite database as its durable
registry, with only the server opening it and clients accessing it exclusively
through the local API?

**Answer:** Yes.

**Decision:** Portreeve will maintain one SQLite database in the user's
platform-appropriate application-data location. It will persist claim
identities, sticky assignments, pending leases and expirations, confirmed-run
fingerprints, and schema version/migration state.

The server is the only database owner during normal operation. Client
libraries and ordinary CLI commands will not open or mutate the database
directly; they will use the HTTP/JSON Unix-socket API. This keeps transaction
and migration behavior centralized and prevents a second application-level
coordination mechanism from forming around the database file.

SQLite is authoritative for Portreeve's durable allocation history. It is not
authoritative for whether a port currently has a listener; fresh `lsof`
inspection retains that role.

## D17 - Client behavior when Portreeve is unavailable

**Question:** Should a migrated client fail loudly when it cannot reach
Portreeve instead of silently falling back to legacy allocation or attempting
to install or launch the daemon?

**Answer:** Yes.

**Decision:** Opting a service into Portreeve establishes one allocation
authority. If the socket is absent, unhealthy, incompatible, or inaccessible,
the client will stop startup with a concise diagnostic that includes observed
health information and exact `portreeve start` or `portreeve serve`
instructions.

The client library will not:

- fall back to project-local probing or persistence;
- create an uncoordinated assignment;
- install a supervisor definition;
- start or background a daemon as an implicit side effect.

This strict behavior begins only after a service is migrated. Unmigrated
services may continue using their existing behavior during the transition, and
Portreeve will observe any ports they actually occupy through `lsof`.

## D18 - Active-run liveness without heartbeats

**Question:** Should v1 determine confirmed-run liveness from fresh `lsof`
inspection rather than requiring service heartbeats or lease renewals?

**Answer:** Yes.

**Decision:** A successfully confirmed run does not need to maintain a
heartbeat, persistent client connection, or renewable lease. When current
liveness matters, Portreeve reconciles the durable run record with fresh
listening-socket evidence.

Clients should send a graceful `release` notification when practical so that
status and history can be updated promptly, but release is advisory
bookkeeping. It cannot prove that a port is free, and its absence does not keep
a dead process alive in Portreeve's model.

This decision does not change pending-lease expiry. A candidate that has not
completed confirmation remains short-lived and is automatically abandoned
after its deadline.

## D19 - Preferred ports and automatic allocation pool

**Question:** Should explicit preferred ports be distinct from automatic
fallback allocation, with fallback choices constrained to a configurable
per-user pool that excludes reserved and operating-system ephemeral ports?

**Answer:** Yes.

**Decision:** A service may supply an unprivileged preferred port independently
of the automatic allocation pool. Subject to claim and live-listener checks,
Portreeve tries that preference when creating the service's first assignment.
If it cannot use the preferred port and the request permits fallback, it
selects a candidate from the automatic pool.

Automatic candidates come only from a configurable per-user range after
applying explicit exclusions and excluding the effective operating-system
ephemeral range. Portreeve will discover platform ephemeral-range settings
where practical and use conservative documented defaults only when discovery
is unavailable. The exact initial fallback range will be chosen and tested
against supported macOS and Linux versions during implementation rather than
being assumed in the interview.

As established for sticky claims, changing a preferred-port setting later does
not silently reassign an existing sticky claim.

## D20 - Exact-port constraint

**Question:** Should v1 support an explicit exact-port constraint in addition
to fallback-permitting preferred ports?

**Answer:** Yes.

**Decision:** A caller may explicitly require one exact port when an external
integration or other fixed endpoint prevents remapping:

- A preferred port is a hint for initial assignment and permits a fallback
  candidate.
- An exact port is a constraint. Portreeve either acquires that number or
  returns a structured conflict explaining its durable claim and live-listener
  findings.

An exact-port request never silently substitutes another number. It also does
not itself authorize process termination; replacing a verified prior run still
requires the separately explicit reclaim intent and safety checks established
for reclamation.

The public API should use the term `exact` rather than `required` so that this
client-selected constraint is not confused with an internal Portreeve
requirement.

## D21 - Run-level listener ownership

**Question:** Should v1 accept a listener that is either the confirmed run
root or a verified descendant of that same still-live process instance, rather
than requiring the allocating process itself to own the socket?

**Answer:** Yes.

**Decision:** Portreeve will model a confirmed service run separately from the
individual processes that listen for it. Confirmation begins with a
fingerprinted root process instance. A listener observed by `lsof` may be
associated with the run when it is:

- the confirmed root process itself; or
- demonstrably descended from that same, still-live root process instance.

Portreeve records the actual listener fingerprints in addition to the root.
This supports framework CLIs, package-script launchers, watchers, and clustered
development servers without treating PID equality as the ownership model.

Ancestry is ownership evidence, not termination scope. Reclamation targets only
processes currently proven to own listening sockets. It does not kill the root
or its wider process tree merely because they are related. A replacement
listener may be recognized through fresh ancestry only while the original root
fingerprint still matches; uncertain, broken, or mixed lineage aborts
automatic reclamation.

## D22 - Local API security boundary

**Question:** Should v1 rely on per-user application-directory and Unix-socket
permissions as its API security boundary instead of distributing a long-lived
API secret to local services?

**Answer:** Yes.

**Decision:** Portreeve's trust boundary is the current operating-system user.
Its application-data directory, database, runtime files, and Unix-domain socket
will be inaccessible to other users using restrictive ownership and
permissions. The server will reject unsafe preexisting directories or socket
paths rather than weakening those protections.

V1 will not introduce a reusable bearer token that every development service
must store. Such a token would add distribution and rotation complexity while
providing little protection from another process already running as the same
user.

Pending leases will still use unguessable, short-lived tokens to correlate
`acquire`, `confirm`, and `abandon` operations and prevent accidental
cross-talk. Reclamation and force operations remain governed by their explicit
intent, identity proof, reinspection, and targeting rules; access to the socket
alone does not relax those rules.

## D23 - Protocol compatibility negotiation

**Question:** Should the socket API be explicitly versioned and expose
protocol-range and capability information before allocation?

**Answer:** Yes.

**Decision:** The HTTP/JSON contract will use an explicit major-version
namespace. Health/handshake information will include the running server
software version, supported protocol range, and relevant optional
capabilities. Client libraries will declare their supported protocol range.

Different client and server software versions may interoperate when their
protocol ranges and required capabilities overlap. When they do not, the
client fails before requesting or mutating an allocation and reports both
versions plus the exact update action. Software-version equality is not
required merely for its own sake.

This compatibility check is especially important because projects may pin
client-library versions independently while the native supervisor runs a
separately installed managed executable.

## D24 - Human and automation CLI contracts

**Question:** Should every operational CLI command provide stable `--json`
output and documented exit codes in addition to its human-readable output,
including the evidence behind conflicts and reclamation decisions?

**Answer:** Yes.

**Decision:** Portreeve's CLI is both a developer interface and a supported
automation interface for scripts and development agents:

- Human-readable output is the default and should emphasize the decision,
  corrective action, and relevant evidence.
- Operational commands support stable, versioned `--json` response shapes.
- Exit codes distinguish success, ordinary state differences, allocation
  conflicts, server unavailability, protocol incompatibility, invalid input,
  and internal failure.
- Conflict and reclamation results include the claim identity, durable
  assignment findings, fresh listener observations, ownership verification
  outcome, and actions taken or refused.

Automation must not need to parse prose, scrape `lsof` output, or open the
SQLite database to understand a Portreeve decision.

## D25 - Two-layer JavaScript client API

**Question:** Should the JavaScript client expose both low-level lease
primitives and a preferred high-level service-start helper?

**Answer:** Yes.

**Decision:** The official JavaScript client will provide:

1. Low-level `acquire`, `confirm`, `abandon`, and `release` operations that map
   cleanly to the versioned protocol for framework adapters and unusual
   lifecycle integrations.
2. A high-level helper that acquires a candidate, invokes an asynchronous
   caller-supplied startup callback with the port, confirms only after the
   callback reports successful listening, handles recognized address-in-use
   failures through the negotiation/retry flow, and abandons the pending lease
   on other startup failure.

The helper hides ordinary two-phase protocol complexity but does not guess
whether an arbitrary process has begun listening. Its callback contract
requires resolution only after the service's listen operation has succeeded.
Clients that cannot expose that boundary use the explicit primitives.

## D26 - One production client transport

**Question:** Should the official JavaScript client always use the public
HTTP/JSON Unix-socket protocol in production, without a direct or embedded
allocation mode?

**Answer:** Yes.

**Decision:** All application clients, including the official JavaScript
package, communicate with the running Portreeve authority through the same
versioned socket protocol. The JavaScript client will not import the server's
allocation service, open SQLite, or instantiate an in-process registry as an
alternate production path.

This makes the official client continuously exercise the portable contract,
keeps transaction serialization inside the one server, and ensures that
different languages receive the same behavior. The server's protocol handlers
call domain services directly inside the Portreeve process, and unit tests may
exercise internal modules or an injected test transport; neither exception is
a published embedded-client mode.

## D27 - Initial client-language scope

**Question:** Should v1 ship only an official JavaScript client, with other
languages using the documented protocol or CLI JSON interface until additional
official packages are justified?

**Answer:** Yes.

**Decision:** The initial release will maintain one official client library for
supported Node.js and Bun environments. Python, shell, and other ecosystems can
integrate through the versioned HTTP/JSON Unix-socket contract or stable CLI
`--json` commands.

The protocol documentation will be sufficient to implement another client
without reverse engineering the JavaScript package. Additional official
language packages are deferred until concrete adoption demand justifies their
maintenance and compatibility burden.

## D28 - Explicit replacement policies

**Question:** Should v1 offer `never`, `graceful`, and
`force-after-grace` replacement policies, allowing force intent to be supplied
up front rather than requiring a second interactive request?

**Answer:** Yes.

**Decision:** Replacement behavior is an explicit request policy:

- `never` is the default. Portreeve reports an existing run or conflict and
  performs no termination.
- `graceful` permits termination only after full ownership proof. Portreeve
  sends `SIGTERM`, waits for its configured grace period, and returns a
  structured timeout if the listener survives.
- `force-after-grace` permits the same verified graceful sequence followed by
  escalation. After the grace period, Portreeve must re-run listener and
  process-instance verification and may send `SIGKILL` only if every target is
  still the same proven process instance.

Supplying `force-after-grace` in the original API or CLI request is sufficient
explicit intent, so disposable development-service workflows can remain fully
automatic. It authorizes escalation but never bypasses claim identity,
listener inspection, process fingerprinting, mixed-ownership refusal, or
pre-signal revalidation.

Operational CLI commands will support a non-mutating planning/dry-run form that
returns the same proposed targets and evidence in human-readable or JSON form.

## D29 - Unsafe any-owner eviction

**Question:** Should v1 provide an explicit escape hatch that can evict
listeners without a Portreeve ownership match, while keeping that capability
out of persistent service replacement configuration?

**Answer:** Yes.

**Decision:** Portreeve will expose an intentionally named, operation-scoped
unsafe eviction command for exceptional recovery. It may ignore the mismatch
between a live listener and Portreeve's recorded claim, but it does not ignore
live target identity:

1. The caller specifies an exact port and explicit unsafe-any-owner intent.
2. Portreeve takes a fresh, complete listening-socket snapshot and returns or
   displays every proposed process target and its fingerprint.
3. A dry-run form performs no mutation.
4. Execution is bound to those exact process instances and revalidates them
   immediately before signaling.
5. A process that replaces an inspected listener is never implicitly included.
6. Graceful termination is attempted first; escalation still requires
   `force-after-grace`.
7. Portreeve records the unsafe request, evidence, signals, and outcome in its
   operational history.

The capability will be available through an explicit CLI/API operation for
humans and agents, including noninteractive JSON usage. It will not be accepted
as a durable `withPort` or service configuration policy, preventing routine
startup from acquiring standing permission to kill unrelated listeners.

## D30 - Global port inventory

**Question:** Should v1 include global list and inspect commands that reconcile
all Portreeve claims with a machine-wide snapshot of TCP listeners?

**Answer:** Yes.

**Decision:** V1 will provide:

- `portreeve ports list`, which returns the union of durable Portreeve claims
  and current TCP listening sockets;
- `portreeve ports inspect <port>`, which provides the complete durable and
  live evidence for one port.

The inventory will classify entries such as verified active, idle sticky,
pending, unclaimed listener, and conflicting/mismatched listener. It will show
all listeners for a port rather than selecting the first PID and will enrich
available evidence with process start time, command, user, working directory,
claim identity, and ownership-verification outcome.

List filters will support common claimed, unclaimed, listening, project,
workspace, service, and port views. Both commands participate in the stable
human/JSON output contract. Dry-run reclamation and unsafe eviction will use
the same snapshot and reconciliation implementation so their evidence cannot
diverge from inventory output.

## D31 - TCP-only initial transport scope

**Question:** Should v1 allocate and reconcile TCP listening ports only, while
recording an explicit transport dimension for future extension?

**Answer:** Yes.

**Decision:** Portreeve v1 manages TCP listening ports. Claims, leases,
database records, API messages, CLI JSON, and uniqueness constraints will
explicitly carry `transport: "tcp"` rather than treating an unqualified number
as permanently protocol-neutral.

UDP allocation, inspection, ownership, and reclamation are outside the initial
release. A future UDP capability may add another transport value without
changing the existing three-part service identity or reinterpreting persisted
TCP claims.

## D32 - Port uniqueness across addresses

**Question:** Should one TCP claim reserve its numeric port across all local
bind addresses and both IP families?

**Answer:** Yes.

**Decision:** Portreeve treats a TCP port number as a machine-wide allocation
resource. It will not assign the same number to separate claims merely because
they intend to bind different loopback addresses, interfaces, hostnames, or
IPv4/IPv6 families.

One confirmed run may legitimately produce multiple listening sockets for its
port, including dual-stack or clustered configurations. Such a port is
verified only when every observed listener belongs to that same run. A
listener from another or unknown run makes the port conflicting or mixed
rather than partially available.

## D33 - Run release versus claim mutation

**Question:** Should ending a run preserve its sticky claim, while separate
administrative commands deliberately reassign or delete the durable mapping?

**Answer:** Yes.

**Decision:** `release` ends or annotates the current confirmed run but does
not free its sticky port assignment. A later acquisition for the same identity
continues to receive that port.

V1 will provide explicit claim-management operations:

- `claims reassign` retains the claim identity while deliberately selecting or
  requiring a new assignment.
- `claims delete` removes the durable claim and returns its assignment to the
  available pool.

Both operations first reconcile the port with fresh listener evidence. They
refuse to mutate around an active or unresolved listener; the caller must stop
the verified run through the established replacement flow or invoke the
separate unsafe eviction escape hatch. This prevents claim administration from
turning an active listener into an unnoticed, unclaimed collision.

## D34 - Missing-workspace claim pruning

**Question:** Should v1 provide an explicit `claims prune` operation for old
claims whose path-derived workspace roots no longer exist, with dry-run and
confirmation controls?

**Answer:** Yes.

**Decision:** A sticky claim is eligible for missing-workspace pruning only
when:

- its canonical workspace root no longer exists;
- it exceeds the configured minimum time since last use;
- it has no pending lease;
- fresh inspection finds no listener requiring resolution.

Because every v1 workspace identity is path-derived, no logical-instance
exception is needed.

Command behavior will be:

- `portreeve claims prune --dry-run` reports candidates and evidence without
  mutation;
- naked `portreeve claims prune` reports candidates and prompts before
  executing when attached to an interactive terminal;
- `portreeve claims prune --yes` executes without a prompt;
- a noninteractive execution without `--yes` refuses;
- `--json` does not imply consent;
- contradictory `--dry-run` and `--yes` options are rejected.

The server will not run missing-workspace pruning periodically in the
background. Invocation remains an explicit human or agent action.

## D35 - Prune age threshold

**Question:** Should missing-workspace pruning default to claims unused for at
least seven days, with a per-invocation `--older-than` override?

**Answer:** Yes.

**Decision:** `claims prune` uses seven days since the claim's last meaningful
use as its default minimum age after the workspace path disappears.
`--older-than <duration>` may override that threshold for one invocation, and
`--older-than 0` explicitly permits immediate cleanup when all other
eligibility and safety checks pass.

The threshold is a command policy rather than permanent global configuration
in v1. Dry-run output will show the effective threshold, each candidate's last
use, and why non-candidates were excluded when requested.

## D36 - No general configuration file

**Question:** Should v1 avoid a general executable or hand-edited config file,
separating server-owned settings, request-specific service intent, and
bootstrap overrides?

**Answer:** Yes.

**Decision:** Portreeve v1 will be usable with built-in defaults and will not
load a `portreeve.config.js`, MJS configuration program, or general
hand-maintained configuration document.

- Durable server settings, including automatic allocation pools and explicit
  exclusions, live in validated SQLite records and are managed through
  `portreeve config get/set` over the server API.
- Project and service intent, including identity, claim mode, preferred or
  exact port, and replacement policy, is supplied by the client request and
  ordinary project code.
- Environment variables and command flags are limited to bootstrap concerns
  that must be known before the server/database is reachable, such as
  overriding the application-data directory or Unix-socket path.

Portreeve will not implicitly execute project configuration code or absorb
ambient project `.env` files as daemon configuration.

## D37 - Initial release distribution

**Question:** Should checksummed GitHub Release binaries be authoritative, with
Homebrew and npm as convenience channels and native application/package
formats deferred?

**Answer:** Yes.

**Decision:** V1 distribution will include:

- self-contained, checksummed GitHub Release executables for each supported
  macOS and Linux operating-system/architecture target;
- a Homebrew formula that installs the CLI executable on supported macOS and
  Linux environments;
- a separately versioned npm package for the official JavaScript client.

GitHub Release artifacts are the source artifacts consumed by convenience
installers and release verification. The macOS GUI/application bundle,
`.deb`, `.rpm`, and other native packaging formats remain deferred. Installing
the CLI binary remains separate from explicitly installing the per-user native
supervisor integration.

## D38 - Managed binary upgrades

**Question:** Should v1 omit a networked self-updater and use `portreeve
install` to promote an already acquired CLI binary into native supervision
with health-checked rollback?

**Answer:** Yes.

**Decision:** Homebrew or a direct GitHub Release download is responsible for
acquiring a new CLI executable. Portreeve itself will not contact a release
service and replace its CLI binary in v1.

Running `portreeve install` from a newer CLI will:

1. validate and stage the invoking executable in the managed per-user
   location;
2. preserve the previously managed executable for rollback;
3. update the native supervisor definition when required;
4. restart the service only if it was active before the operation;
5. verify server health and protocol compatibility;
6. restore the previous managed executable and supervisor state if activation
   fails.

If the native service was installed but inactive, installation updates it
without implicitly starting it. Ordinary lifecycle commands continue to report
CLI/server version differences but never install an update as a side effect.

## D39 - Local observability and audit

**Question:** Should v1 keep observability local through bounded diagnostic
logs and structured operational history, without telemetry or automatic
external reporting?

**Answer:** Yes.

**Decision:** Portreeve will not collect telemetry or transmit diagnostics,
usage, process, path, or claim information externally.

The server will maintain:

- bounded, rotating local diagnostic logs for server lifecycle, health,
  protocol, database, supervisor, and process-inspection troubleshooting;
- structured local audit/history events for claim and lease mutations,
  confirmation and release, reclamation signals and outcomes, unsafe
  evictions, install/update/rollback, configuration changes, and pruning.

`portreeve logs` will expose recent diagnostics, while `portreeve history`
will query structured operational events. Both support human-readable and
stable JSON output. Retention will be bounded by documented defaults so neither
store grows without limit, and sensitive local values will not be included
unless needed to explain a decision.
