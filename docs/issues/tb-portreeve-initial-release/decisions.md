# Decisions - tb-portreeve-initial-release

**Feature start:** 2026-07-28

Permanent record of decisions promoted from `scratchpad.md`.

---

## Reserve the unscoped `portreeve` name for the client package

**Confidence:** LOW

**Blast Radius:** JavaScript import paths, workspace naming, npm publication,
documentation, and downstream consumers.

Use a private root workspace with a separately publishable package named
`portreeve`. The standalone CLI remains distributed through release artifacts
and Homebrew; npm is the official JavaScript client channel. Keep publication
disabled until release credentials and package ownership are verified.

The npm registry currently reports `portreeve`, `portreeve-client`, and
`@portreeve/client` as absent. The unscoped name gives consumers the simplest
future import without requiring ownership of an npm organization scope.

**Triggered by:** Creating the client workspace required by P1 and AC6.

**Alternatives considered:**
- `@portreeve/client` - rejected for now because it requires external scope
  ownership that has not been established.
- `portreeve-client` - viable fallback, but less concise for the one official
  library.
- Publish the CLI through the same npm package - rejected because the approved
  distribution makes the CLI runtime-independent.

**Promoted:** 2026-07-30.

---

## Disable standalone executable environment autoload

**Confidence:** HIGH

**Blast Radius:** Compiled server startup, bootstrap configuration, developer
environment isolation, and security.

Every standalone build must disable Bun's automatic `.env` and `bunfig.toml`
loading. Portreeve accepts only documented bootstrap environment variables and
must not absorb configuration from whichever project directory happens to
launch the managed executable.

**Triggered by:** Bun standalone executables enable ambient config loading by
default while approved design D36 forbids it.

**Alternatives considered:**
- Leave Bun defaults enabled - rejected because project `.env` files could
  silently alter the machine-level authority.
- Change the process working directory before startup - insufficient because
  it hides rather than removes the ambient configuration channel.

**Promoted:** 2026-07-30.

---

## Type-check against the minimum supported Node runtime

**Confidence:** HIGH

**Blast Radius:** Static Node API compatibility for the official JavaScript
client.

Correct entry 5's type-package target from the local Node 24 runtime to the
client's declared minimum Node 22 runtime. Pin `@types/node` 22.20.1 so strict
checking rejects accidental reliance on APIs absent from supported Node 22.
Set `maxNodeModuleJsDepth` to zero: project JavaScript remains strictly
checked, while JavaScript implementation files imported internally by
third-party declarations are not re-checked as Portreeve source.

**Triggered by:** Testing showed that the `punycode` errors were controlled by
TypeScript's node-module JavaScript traversal depth, independent of the
`@types/node` major version.

**Alternatives considered:**
- Keep Node 24 types because that runtime is installed locally - rejected
  because it would not enforce the published Node 22 compatibility floor.
- Include third-party JavaScript in strict checking - rejected because those
  packages are outside Portreeve's source boundary and are verified by their
  publishers.

**Promoted:** 2026-07-30.

---

## Preserve the invoking Bun runtime in nested project scripts

**Confidence:** HIGH

**Blast Radius:** Local checks, builds, CI, and release artifact
reproducibility.

Package scripts that need Bun re-invoke the package runner through
`npm_execpath` and assert Bun 1.3.14 before executing runtime-sensitive work.
They must not call a bare `bun` executable, because that can select a different
global installation even when the outer command used the pinned project
runtime.

**Triggered by:** The first standalone CLI build entered through Bun 1.3.14
but its nested literal `bun` command selected the global x64 Bun 1.2.18.

**Alternatives considered:**
- Require developers to prepend the isolated Bun directory to `PATH` -
  rejected because the package can preserve the already selected runtime.
- Replace the global Bun installation - rejected because project
  reproducibility must not depend on mutating developer-owned tooling.

**Promoted:** 2026-07-30.

---

## Define the protocol v1 envelope and exit-code bands

**Confidence:** LOW

**Blast Radius:** Every protocol client, CLI automation, compatibility check,
and future backward-compatibility obligation.

Protocol v1 uses `{ protocolVersion, requestId, data }` success envelopes and
the same header with a structured `error` body on failure. Health advertises
the supported protocol range and capability strings. CLI exit-code categories
use spaced numeric bands: success 0, ordinary state difference 10, conflict
20, unavailable server 30, incompatible protocol 40, invalid input 50, and
internal failure 70. The spacing leaves room for compatible subcategories
without changing the top-level meanings.

**Triggered by:** P2 required concrete, machine-readable protocol and exit-code
contracts before handlers and clients are implemented.

**Alternatives considered:**
- Use unversioned response bodies - rejected because independently updated
  clients and servers require explicit compatibility.
- Use consecutive exit codes - viable, but rejected because bands allow future
  refinement while keeping category-level automation stable.

**Promoted:** 2026-07-30.

---

## Make SQLite mutations and their audit events atomic

**Confidence:** HIGH

**Blast Radius:** Durable claims, leases, runs, settings, schema migrations,
recovery after crashes, and operational history.

Schema v1 stores claims, pending leases, confirmed runs, listener
fingerprints, settings, history, and migration state. Machine-wide TCP
assignment and pending-lease uniqueness are database constraints. Lease
secrets are stored only as SHA-256 hashes. Every durable mutation and its
history event execute in one immediate transaction so the audit record cannot
silently diverge from allocation state.

**Triggered by:** P2 introduced the first durable schema and transaction
boundary.

**Alternatives considered:**
- Store raw lease tokens - rejected because the server needs only verification
  and should not expose reusable pending-lease secrets from the database.
- Append history after committing mutations - rejected because a crash or
  write failure could leave an unaudited state change.

**Promoted:** 2026-07-30.

---

## Establish conservative initial server-setting defaults

**Confidence:** LOW

**Blast Radius:** Automatic candidate selection, lease expiry, graceful
replacement latency, and local history retention.

The validated settings model starts with candidate range 10240-49151, a
15-second pending-lease TTL, a 5-second graceful shutdown window, and 10,000
structured history events. Explicit exclusions default empty. P3 must subtract
the freshly detected operating-system ephemeral range from this candidate
range; if discovery fails, it must apply a conservative documented fallback.

These values remain API-managed settings rather than ambient environment or
project configuration.

**Triggered by:** P2 required a validated persisted configuration model with
built-in defaults.

**Alternatives considered:**
- Defer all defaults until server startup - rejected because persisted settings
  and allocation tests need one validated shape now.
- Use the entire unprivileged range - rejected because common development
  ports below 10240 and ephemeral ports above the effective platform boundary
  should not become automatic candidates by default.

**Promoted:** 2026-07-30.

---

## Keep the official client on the public Unix-socket protocol

**Confidence:** HIGH

**Blast Radius:** JavaScript client API, server endpoints, compatibility
negotiation, and non-JavaScript protocol consumers.

The P3 client implements health, acquire, confirm, abandon, release, and the
high-level startup helper through Node's Unix-socket HTTP transport, which also
runs under Bun. It imports no server, allocation, inspection, or SQLite code.
Every mutating request carries the client software version, protocol range,
and required capabilities; incompatible clients fail before claim mutation.

**Triggered by:** P3 introduced the first production client/server vertical
slice and therefore a lasting public API contract.

**Alternatives considered:**
- Give Bun consumers a direct in-process fast path - rejected because it would
  bypass the portable protocol and the single mutation authority.
- Let the CLI or client open SQLite for low-latency reads - rejected because
  only the server owns durable state.

**Promoted:** 2026-07-30.

---

## Treat existing runtime paths as evidence, not cleanup targets

**Confidence:** HIGH

**Blast Radius:** Per-user server safety, singleton behavior, filesystem
permissions, and startup recovery.

Portreeve creates new application/socket directories as mode 0700 and its
socket/database as mode 0600. Unsafe existing directories, symlinks,
non-socket socket paths, foreign ownership, and unsafe database permissions
are rejected rather than repaired. An existing Unix socket is removed only
when an actual connection attempt proves it stale; any accepting server blocks
startup regardless of whether it speaks Portreeve HTTP.

**Triggered by:** P3 introduced local runtime-path creation and stale-socket
handling.

**Alternatives considered:**
- Automatically chmod unsafe existing paths - rejected because the approved
  security boundary requires refusing ambiguous preexisting state.
- Unlink a socket after a failed health response - rejected because another
  legitimate Unix service might accept connections at an overridden path.

**Promoted:** 2026-07-30.

---

## Serialize allocation races at the SQLite lease boundary

**Confidence:** HIGH

**Blast Radius:** Concurrent client allocation, preferred-port fallback, and
same-claim request behavior.

Schema v1 has partial unique indexes for one pending lease per TCP port and one
pending lease per claim. Allocation treats a transaction-level port collision
as a retryable candidate race for fallback-capable requests, while exact-port
requests and a second pending request for the same claim return structured
conflicts.

**Triggered by:** A real concurrent server test showed two requests could
inspect the same preferred port before the first lease transaction committed.

**Alternatives considered:**
- Serialize the entire inspection and selection loop with an application
  mutex - rejected because SQLite remains the durable cross-request authority
  and the bind race still requires retry behavior.
- Return every unique-index race to callers - rejected because fallback
  requests explicitly authorize choosing the next candidate.

**Promoted:** 2026-07-30.

---

## Expire ephemeral assignments separately from pending leases

**Confidence:** HIGH

**Blast Radius:** SQLite schema v1, ephemeral claim reuse, server settings, and
allocation reconciliation.

Pending leases retain the 15-second bind-negotiation TTL. Confirmed ephemeral
claims receive a separate one-hour assignment TTL stored on the claim.
Expiration alone never frees the number: after the run is released, a later
allocation must find no live listener before transactionally clearing the
assignment. The TTL is a validated API-managed server setting.

**Triggered by:** P3 exposed that the original settings model did not
distinguish a short pending lease from an ephemeral claim's useful lifetime.

**Alternatives considered:**
- Reuse the pending lease expiration after confirmation - rejected because a
  bind-negotiation timeout is far too short for previews and test services.
- Clear ephemeral assignments immediately on release - rejected because
  release is advisory and cannot prove the listener has stopped.

**Promoted:** 2026-07-30.

---

## Use composite process instances and fresh lineage for ownership

**Confidence:** HIGH

**Blast Radius:** Confirmation, inventory classification, future reclamation,
PID-reuse safety, and stored run evidence.

A process instance is fingerprinted by PID, parent PID, numeric user, start
time, executable, command, and working directory. PID, start time, executable,
and user are the equality boundary. Confirmation freshly reinspects the root
and each listener, accepts the exact root or a descendant whose parent chain
reaches that still-identical root, and persists both root and listener
fingerprints. A stored PID or client assertion alone never verifies ownership.

**Triggered by:** P4 replaced P3's intentionally conservative direct-PID
confirmation with the approved run-lineage model.

**Alternatives considered:**
- Treat matching PID as ownership - rejected because PIDs are reused.
- Treat any descendant of a stored PID as owned - rejected because the root
  itself may have exited and its PID may identify a different process.

**Promoted:** 2026-07-30.

---

## Derive every inventory view from one reconciliation snapshot

**Confidence:** HIGH

**Blast Radius:** `ports list`, `ports inspect`, filters, conflict evidence,
and the evidence later consumed by dry-run and reclamation.

Inventory takes one complete LISTEN-specific `lsof` snapshot and joins it with
claims, unexpired pending leases, confirmed runs, and stored fingerprints.
Each numeric TCP port is classified as available, verified, idle, pending,
unclaimed, conflicting, or mixed. Pending leases join their claim through
`claimId`, not only an assigned port. Public inventory omits lease-token hashes
and supports classification, claimed/listening, project, workspace, service,
and exact-port filters.

**Triggered by:** P4 introduced the global inventory API and CLI surface.

**Alternatives considered:**
- Implement list, inspect, and reclamation evidence separately - rejected
  because independent snapshots could disagree about live ownership.
- Report only the first listener for a port - rejected because clustered,
  dual-stack, and mixed-owner cases require the complete set.

**Promoted:** 2026-07-30.

---

## Bind reclamation to both live process instances and one confirmed run

**Confidence:** HIGH

**Blast Radius:** Normal replacement policies, process signaling, acquisition
restart behavior, PID-reuse safety, and reclamation audit history.

Normal reclamation starts from the shared inventory evidence, requires every
listener to have verified lineage to one confirmed run, and binds the operation
to that run ID plus the complete initial process-instance set. Portreeve
rechecks the run and target set before every individual signal. Removed
listeners are harmless, but an added, replaced, unobservable, mixed-owner, or
newly confirmed target stops the operation. Only listener PIDs are signaled.
`SIGTERM` always precedes any separately authorized `SIGKILL`; a successful
normal reclaim also marks the confirmed run released.

**Triggered by:** P5 required the approved reclamation state machine and an
adversarial review showed that a matching process fingerprint alone would not
detect a changed durable run context.

**Alternatives considered:**
- Revalidate only once per signal phase - rejected because a multi-listener
  target set can change between individual signals.
- Bind only to the original PIDs - rejected because PID reuse can target an
  unrelated process.
- Bind only to process fingerprints - rejected because the same process could
  be associated with a different confirmed run during the operation.

**Promoted:** 2026-07-30.

---

## Keep unsafe any-owner eviction operation-scoped and fingerprint-bound

**Confidence:** HIGH

**Blast Radius:** Unsafe CLI/API use, automation consent, dry-run behavior,
forced termination, and audit evidence.

Unsafe eviction is a separate exact-port API and CLI command, not a durable
replacement policy. Its request must contain literal `unsafeAnyOwner: true`;
the CLI requires `--unsafe-any-owner`. Dry-run returns every current listener
without signaling. Execution bypasses claim ownership only: each listener must
still expose a full process fingerprint, and every signal remains bound to the
initial process-instance set. Forced escalation requires the separate
`force-after-grace` choice.

Every valid operation records its request and initial evidence, writes a signal
authorization event before each process mutation, records each successfully
sent signal, and finishes with a structured outcome.

**Triggered by:** P5 implemented the approved escape hatch without weakening
the normal ownership boundary.

**Alternatives considered:**
- Model unsafe behavior as another allocation replacement policy - rejected
  because it could persist or become routine service behavior.
- Let unsafe mode target an unobservable PID - rejected because unsafe bypasses
  claim ownership, not current process identity.
- Make force implicit in unsafe mode - rejected because graceful termination
  and forced escalation are distinct authorizations.

**Promoted:** 2026-07-30.

---

## Keep claim administration server-owned and listener-gated

**Confidence:** HIGH

**Blast Radius:** Claim reassignment, deletion, pruning, port uniqueness,
historical run storage, and all administrative clients.

Claim list/show/reassign/delete/prune operations use the versioned socket API;
the CLI and official client never open SQLite. Reassignment and deletion
require no active run, no unexpired pending lease, and no listener on the
claim's current assignment. Reassignment also checks its target twice and the
registry transaction rejects both assigned claims and newly pending leases.
When a claim is deleted, dependent released runs and leases are removed before
the claim because schema v1 intentionally retains restrictive foreign keys;
the bounded structured history event preserves the deletion evidence.

**Triggered by:** P6 introduced administrative mutation paths and exposed a
race between target inspection and a competing pending lease.

**Alternatives considered:**
- Let the CLI edit SQLite directly - rejected because one server must own
  transaction and migration behavior.
- Trust the pre-transaction listener and reservation snapshot alone - rejected
  because live listeners and pending leases can change during reassignment.
- Retain released run rows after deleting their claim - not possible under the
  schema v1 restrictive foreign key without adding tombstone semantics.

**Promoted:** 2026-07-30.

---

## Make prune consent a CLI concern while the server revalidates safety

**Confidence:** HIGH

**Blast Radius:** Missing-workspace cleanup, interactive and agent automation,
JSON behavior, and claim deletion races.

The prune API accepts an explicit dry-run or execution request and independently
revalidates age, path absence, active work, and listeners. The CLI applies the
approved consent matrix: dry-run never mutates, interactive execution prompts,
and noninteractive execution requires `--yes`. JSON output does not grant
consent, and `--dry-run --yes` is invalid. The default age is seven days;
duration parsing accepts explicit zero for immediate eligible cleanup. Creating
a pending lease refreshes the claim's last-used timestamp, even when startup is
later abandoned, so recent attempted use cannot be mistaken for old state.

**Triggered by:** P6 translated the approved prune UX into one API usable by
both human and agent callers.

**Alternatives considered:**
- Send terminal state to the server - rejected because TTY consent belongs to
  the invoking interface, not the local authority.
- Treat `--json` as noninteractive consent - rejected because output format
  must never authorize deletion.

**Promoted:** 2026-07-30.

---

## Separate transactional audit history from best-effort diagnostics

**Confidence:** HIGH

**Blast Radius:** Database mutations, local log retention, disk failures,
protocol reliability, and troubleshooting evidence.

Structured history remains part of mutation transactions and is pruned to the
configured newest-event bound after each append. Diagnostic logs are private
JSON Lines files with size-based rotation and a bounded file count. Existing
unsafe log paths are rejected at server startup. After startup, diagnostic
writes are best effort so a full or failing log disk does not replace a valid
protocol result; failures fall back to standard error. A partial crash-written
line is skipped while older valid entries remain queryable.

**Triggered by:** P6 added both bounded observability stores and required a
clear failure boundary between forensic audit and troubleshooting output.

**Alternatives considered:**
- Make diagnostics transactional with API work - rejected because file logging
  failure must not change an otherwise valid protocol outcome.
- Ignore unsafe preexisting log paths - rejected because logs contain local
  process and operational evidence.
- Let either store grow without limit - rejected by the approved local
  observability contract.

**Promoted:** 2026-07-30.

---

## Centralize stable CLI JSON errors and exit-code bands

**Confidence:** HIGH

**Blast Radius:** Every CLI command, shell automation, agents, human error
messages, and future backward compatibility.

CLI actions share versioned output helpers, and the top-level runner owns
structured error rendering. JSON successes go to standard output; JSON errors
go to standard error without Commander prose mixed into the document. Exit
statuses retain the approved category bands: 0 success, 10 ordinary state
difference, 20 conflict, 30 unavailable, 40 incompatible, 50 invalid input,
and 70 internal failure.

**Triggered by:** P6 completed the operational command tree and made its
automation contract executable.

**Alternatives considered:**
- Let Commander and individual actions print errors independently - rejected
  because JSON automation could receive mixed prose and JSON.
- Use exit status 1 for every failure - rejected because callers need stable
  category-level behavior without parsing messages.

**Promoted:** 2026-07-30.

---

## Separate foreground execution from native per-user supervision

**Confidence:** HIGH

**Blast Radius:** Server lifecycle, login startup, manual development,
managed upgrades, rollback, platform packaging, and automation.

`serve` remains the only server-running command and always blocks in the
foreground. Shell-backgrounded servers remain manual and are never adopted by
native lifecycle commands. Explicit installation places a private managed
executable behind a LaunchAgent on macOS or a `systemd --user` unit on Linux;
initial and inactive upgrades remain inactive. Status combines independent
socket health with native state and calls a process supervised only when the
reported server PID matches the supervisor main PID. Stop unloads the
supervisor before shutdown so keep-alive policy cannot restart the service.
Active upgrades wait for a complete native unload, preserve a rollback
executable, atomically promote, health-check the new process, and restore both
the old executable and prior active state on failure. Native mutations reject
root and executables writable by another user.

**Triggered by:** P7 translated the approved foreground/manual/native
lifecycle and managed-upgrade decisions into platform behavior.

**Alternatives considered:**
- Double-fork or maintain PID files - rejected because launchd/systemd already
  own supervision and live socket plus native process evidence is fresher.
- Let `start` install or adopt a manual server - rejected because it obscures
  login persistence and supervisor ownership.
- Restart every installation - rejected because upgrades must preserve an
  intentionally inactive service.
- Trust an asserted supervised mode alone - rejected because status can match
  the health PID against native supervisor evidence.

**Promoted:** 2026-07-30.

---

## Make checksummed executables the release authority

**Confidence:** HIGH

**Blast Radius:** GitHub Releases, Homebrew, npm, CI runners, release
verification, and operator documentation.

One release build emits four versioned standalone executables, a separately
versioned dependency-free `portreeve` client tarball, a checksum file, a
machine-readable manifest, and a generated Homebrew formula. Homebrew URLs and
checksums point to the same executables uploaded to GitHub Releases; it does
not rebuild or acquire a different server. The npm package contains only the
public protocol client. Release verification checks every digest and
executable header but reports native execution separately. Publication depends
on native macOS ARM64/x64 and Linux ARM64/x64 jobs, with a specifically labeled
self-hosted Linux ARM64 runner where no standard hosted runner is assumed.
Local release builds require explicit homepage and release-base URLs rather
than inventing repository coordinates.

**Triggered by:** P8 implemented the approved authoritative GitHub
Release/Homebrew/npm distribution split and needed a mechanically enforceable
artifact relationship.

**Alternatives considered:**
- Treat successful cross-compilation as platform verification - rejected
  because it cannot prove startup, socket, SQLite, `lsof`, or supervisor
  behavior on the target.
- Let Homebrew build from source - rejected because Homebrew must install the
  same checksummed executable that passed release verification.
- Bundle the server in the npm client - rejected because JavaScript consumers
  need only the portable protocol client and server distribution has a
  separate native lifecycle.
- Hard-code a guessed GitHub repository or npm scope - rejected because this
  checkout has no configured remote or verified publication authority.

**Promoted:** 2026-07-30.

---

## Make process and supervisor inspection explicit across platforms

**Confidence:** HIGH

**Blast Radius:** Linux process ownership, confirmation, reclamation, CLI
status, native-supervisor diagnostics, and cross-platform tests.

P9 Linux ARM64 execution showed that macOS `lsof` emits file-descriptor fields
for `-Fn` even though only name fields were requested, while Linux emits only
the requested names. Process inspection now explicitly requests both
descriptor and name fields with `-Ffn`, which preserves the existing parser
contract on both platforms. Native command execution maps a missing executable
to exit status 127 so read-only systemd status can report inactive/unavailable
supervision without turning an otherwise healthy manual server status into an
internal error; lifecycle mutations still reject the nonzero command result.
The lifecycle test fixture now uses the executing user's UID instead of
assuming macOS UID 501.

**Triggered by:** The first full Linux ARM64 P9 suite exposed process
unobservability, missing-`systemctl` status failures, and UID-dependent test
failures that the macOS ARM64 suite could not reveal.

**Alternatives considered:**
- Parse bare `n` fields by position on Linux - rejected because requesting the
  descriptor field is supported by both `lsof` variants and removes positional
  ambiguity.
- Require `systemctl` merely to report manual-server status - rejected because
  foreground operation is intentionally independent of native supervision.
- Continue using UID 501 in portable tests - rejected because ownership checks
  must reflect the executing user on Linux and macOS.

**Promoted:** 2026-07-30.

---

## Require full source and supervisor gates on every native release target

**Confidence:** HIGH

**Blast Radius:** Release CI duration, self-hosted runner prerequisites,
LaunchAgent/systemd integration, and publication blocking.

Every native release-matrix job now provisions Node 22, runs the complete
source gate, verifies the exact downloaded executable, and exercises a real
native supervisor lifecycle before GitHub or npm publication can begin. The
lifecycle smoke uses a unique service identity and temporary Portreeve data,
then verifies inactive installation, start, supervised PID identity, active
upgrade, restart, stop, uninstall, data preservation, and cleanup. Linux places
its unique unit in the real user's systemd search directory because a running
user manager does not adopt a command-local temporary HOME.

**Triggered by:** P9 Linux execution found portability bugs that the previous
Linux-x64-only build gate and foreground-only native matrix would not detect.

**Alternatives considered:**
- Keep source tests only in the build job - rejected because platform-specific
  process and lifecycle behavior must execute on every supported target.
- Treat foreground health as sufficient lifecycle evidence - rejected because
  it does not exercise LaunchAgent/systemd installation, identity, restart, or
  upgrade behavior.
- Point systemd at a unit outside its user search path - rejected because the
  real user manager correctly refuses to enable a unit it cannot discover.

**Promoted:** 2026-07-30.

---

## Establish the first release identity and visibility gate

**Confidence:** HIGH

**Blast Radius:** GitHub repository administration, executable and client
versions, legal metadata, npm publication, release URLs, and Homebrew access.

The first release is version `0.1.0`, uses the MIT license, lives at
`TrentBrown/portreeve`, and publishes the dependency-free JavaScript client as
the public unscoped npm package `portreeve`. The GitHub repository begins
private for development. Branch builds and manual Actions runs remain valid,
but tag publication requires public repository visibility because public
Homebrew consumers cannot fetch private GitHub release assets without
authentication. Both GitHub Release and npm publication depend on the same
fail-closed public-visibility gate.

**Triggered by:** The user approved the remaining P9 release identity,
licensing, repository, and npm decisions.

**Alternatives considered:**
- Make the repository public immediately - deferred because private development
  does not block CI and the user intends to make it public later.
- Publish a release while the repository is private - rejected because the
  generated Homebrew URLs would not be anonymously downloadable.
- Use a scoped npm package - rejected because the approved public package name
  is the existing unscoped `portreeve` identity.

**Promoted:** 2026-07-30.

---

## Consolidate the current reproducible toolchain contract

**Confidence:** HIGH

**Blast Radius:** Local development, CI, Node compatibility, dependency
resolution, and standalone artifacts for every supported architecture.

Pin Bun 1.3.14 and exact JavaScript dependencies. Use Commander.js for the CLI,
Zod for runtime schema boundaries, TypeScript `checkJs` against the minimum
supported Node 22 types, and ESLint/Prettier for source checks. Nested package
scripts must preserve the invoking Bun runtime, and local verification must use
the host's native architecture while release builds explicitly target all four
supported OS/architecture combinations. Do not replace or upgrade a
developer-owned global Bun installation as part of project setup.

This is the durable replacement for entries 1, 4, and 5: entry 1 contained an
incorrect early Intel-host inference, entry 4 is host-specific diagnostic
history, and entry 5 was superseded by minimum-Node-22 type checking.

**Triggered by:** P9 release preparation requires one accurate permanent
toolchain decision without preserving superseded environment diagnoses as
architecture.

**Alternatives considered:**
- Promote entries 1, 4, and 5 together - rejected because the permanent record
  would retain a known-wrong host inference and an obsolete Node 24 type target.
- Float Bun or dependency versions - rejected because compiler/runtime drift
  would undermine reproducible standalone artifacts.

**Promoted:** 2026-07-30.
