# Issues - tb-portreeve-initial-release

**Feature:** `tb-portreeve-initial-release`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-07-28

Operational task breakdown derived from the plan.

## I-1 - Establish toolchain and prove compiled runtime

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P1
- **Rubric criteria:** R1, R4, R6, R8
- **Depends on:** none
- **PR:** -

Create the Bun/Commander.js/checkJs project foundation and execute the
compiled-runtime spike before committing the rest of the architecture.

Completed on macOS ARM64 with pinned Bun 1.3.14. `bun run check` passes strict
checking, lint, formatting, and five tests. The compiled probes exercise the
Commander CLI, Unix-socket HTTP, SQLite, LISTEN-specific `lsof`, SIGTERM,
embedded assets, disabled ambient dotenv loading, and Node/Bun client-source
consumption. `bun run build` produces a runnable native ARM64 executable.

## I-2 - Implement protocol, domain model, and SQLite registry

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P2
- **Rubric criteria:** R1, R2, R3, R6, R8
- **Depends on:** I-1
- **PR:** -

Define the versioned contracts and durable transactional model used by every
later slice.

Completed with versioned Zod request/response/error schemas, compatibility
negotiation, stable error/exit categories, validated settings, hashed lease
tokens, and SQLite schema v1. Focused tests cover migration/restart,
cross-connection pending-port serialization, acquire/confirm/release/expiry,
corrupt records, settings persistence, and atomic mutation/audit rollback.

## I-3 - Deliver local server and JavaScript allocation client

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P3
- **Rubric criteria:** R1, R2, R3, R6
- **Depends on:** I-2
- **PR:** -

Complete the first end-to-end acquire, bind, confirm, release, retry, and
restart-persistence workflow over the real Unix-socket protocol.

Completed on macOS ARM64 with a permission-validated singleton Unix socket,
foreground `serve`, compatibility-before-mutation, canonical Git worktree
identity, preferred/exact and sticky/ephemeral semantics, detected
ephemeral-range filtering, atomic concurrent leases, bind-collision retry, and
the protocol-only Node/Bun client. Real integration tests bind TCP listeners,
confirm them through fresh `lsof`, restart the SQLite-backed server, exercise
compiled `serve`, prove no TCP control listener, and verify unavailable and
incompatible failures.

## I-4 - Reconcile live listeners and expose global inventory

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P4
- **Rubric criteria:** R4
- **Depends on:** I-3
- **PR:** -

Build platform inspection, process fingerprints, run lineage, and the global
list/inspect evidence model.

Implemented with a complete LISTEN-specific `lsof` snapshot, composite process
fingerprints, fresh root/descendant lineage verification, persisted listener
evidence, reconciliation classifications, filters, public inventory endpoints,
official-client methods, and `ports list`/`ports inspect`. Real macOS tests
cover direct and child-process listeners, PID-reuse rejection, mixed and
conflicting ownership, unclaimed listeners, and JSON CLI inspection. Real
Linux execution remains part of the P9 cross-platform matrix.

## I-5 - Implement safe reclamation and unsafe eviction

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P5
- **Rubric criteria:** R5, R8
- **Depends on:** I-4
- **PR:** -

Implement and verify every replacement policy, target revalidation, dry-run,
unsafe consent boundary, and audit outcome.

Completed with evidence-bound `never`, `graceful`, and `force-after-grace`
behavior; confirmed-run and per-process revalidation before every signal;
bounded timeout and escalation results; run release after verified reclaim;
and a separate exact-port unsafe operation requiring literal operation-scoped
consent. The versioned API, Node/Bun client, acquisition flow, and Commander
CLI expose the behavior. Audit history captures initial evidence, write-ahead
signal authorization, sent signals, and final outcomes. Focused tests cover
mixed and changed ownership, changed run context, dry-run nonmutation,
graceful timeout, explicit unsafe consent, and real child-process SIGTERM and
SIGKILL behavior.

## I-6 - Complete operational CLI and administration

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P6
- **Rubric criteria:** R6, R8
- **Depends on:** I-3, I-4, I-5
- **PR:** -

Finish stable human/JSON output, exit codes, claims/config commands, pruning,
and bounded local logs/history.

Completed with lifecycle-independent `status`; claims list/show/reassign/delete
and consent-gated missing-workspace pruning; validated API-managed settings;
bounded structured history and private rotating diagnostic logs; centralized
human/JSON rendering and error handling; and documented exit-code bands.
Administrative mutations traverse the versioned server API and revalidate
active runs, pending leases, listeners, path absence, age, and transaction-time
port reservations. Tests cover dry-run and TTY/non-TTY consent modes, age zero,
configuration validation, retention bounds, log-path permissions, compiled
CLI operation, stable JSON/error documents, every exit-code category, and the
absence of outbound telemetry integrations.

## I-7 - Add native supervision and managed upgrades

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P7
- **Rubric criteria:** R7
- **Depends on:** I-6
- **PR:** -

Deliver and test LaunchAgent and `systemd --user` lifecycle behavior,
installation, upgrades, health checks, and rollback.

Completed with explicit per-user `install`, `uninstall`, `start`, `stop`,
`restart`, and enriched `status`; a foreground-only `serve`; protected
socket-requested manual shutdown; PID-matched manual/supervised
classification; private stable managed-binary paths; and root rejection.
LaunchAgent and `systemd --user` adapters install deterministic definitions
and preserve inactive state. Active upgrades wait for full supervisor unload,
atomically retain and promote executables, verify version and health after
activation, and restore the prior executable, definition, and active state on
failure. Unit/integration tests cover adapter commands, launchd retry,
manual-server refusal, idempotent installation/removal, permission rejection,
restart prevention, successful and failed active upgrades, and retained user
data. A real macOS LaunchAgent smoke covered install, start, active in-place
upgrade, restart, stop, stopped status, and uninstall. Real Linux supervisor
execution remains part of the P9 cross-platform matrix.

## I-8 - Package and document the release

- **Status:** closed
- **Estimate:** unknown
- **Plan steps:** P8
- **Rubric criteria:** R6, R8
- **Depends on:** I-6, I-7
- **PR:** -

Produce protocol and operator documentation, compiled artifacts, checksums,
Homebrew packaging, and the npm client package.

Completed with an operator README and dedicated installation, protocol,
client, migration, safety, troubleshooting, and CLI-contract documentation.
The release builder produces macOS ARM64/x64 and Linux glibc ARM64/x64
self-contained executables, a dependency-free `portreeve` npm tarball, a
versioned manifest, deterministic `SHA256SUMS`, and a generated Homebrew
formula pinned to the same executable checksums. Verification rejects version,
checksum, executable-format, permission, formula-syntax, and package-content
drift. On macOS ARM64 the standalone artifact served through its real Unix
socket, the npm tarball installed into a clean Node consumer, and a temporary
Homebrew tap installed, ran, and removed the formula without disturbing an
existing installation.

The release workflow derives repository URLs at runtime, runs the full gate,
and makes publication depend on native smokes for macOS ARM64/x64, Linux x64,
and a labeled self-hosted Linux ARM64 runner. This intentionally prevents
cross-compilation from being accepted as native execution. The P8 candidate
remained version `0.0.0` and was not published; P9 later approved version
`0.1.0`, the MIT license, `TrentBrown/portreeve`, and the public unscoped npm
package.

## I-9 - Run final cross-platform verification

- **Status:** in-progress
- **Estimate:** unknown
- **Plan steps:** P9
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-1, I-2, I-3, I-4, I-5, I-6, I-7, I-8
- **PR:** -

Execute the complete rubric and Definition-of-Done matrix, resolve blocking
findings, and produce feature-completion evidence.

P9 found and corrected three Linux portability defects: process inspection now
requests `lsof` descriptor fields explicitly, missing native commands produce
a stable executable-not-found result rather than an internal spawn exception,
and lifecycle tests use the executing user's UID. The complete source gate
passes on macOS ARM64 and native Linux ARM64 with real listener/process
inspection, allocation, SQLite, Node 22 consumption, and signal tests.

The exact release artifacts pass foreground and native-supervisor smokes on
macOS ARM64, macOS x64 under Rosetta, and Linux ARM64 with a real systemd user
manager. Both Linux artifacts also pass standalone foreground, status,
inventory, configuration, history, and shutdown smokes in clean glibc
containers; Linux x64 is supplemental emulated evidence. The release workflow
now runs Node 22 plus the complete source gate, exact-artifact smoke, and real
native lifecycle smoke on every native target before publication.

Version `0.1.0`, the MIT license, repository `TrentBrown/portreeve`, and the
public unscoped npm package are approved. The repository was created privately
for development; tag publication now fails closed until it is public so
Homebrew can fetch unauthenticated GitHub release assets. Feature completion
remains pending the authoritative native workflow results and verified npm
publication credentials. The new private repository currently has neither an
`NPM_TOKEN` secret nor a registered self-hosted Linux ARM64 runner. No release
has been published.
