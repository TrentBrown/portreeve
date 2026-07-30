# Plan - tb-portreeve-initial-release

**Feature:** `tb-portreeve-initial-release`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-07-28

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Build Portreeve as a small Bun workspace with a root CLI/server application and
a separately publishable JavaScript client package. Keep the allocation model,
state transitions, protocol schemas, and evidence classifications independent
of Bun-specific infrastructure. Isolate SQLite, Unix sockets, `lsof`/process
inspection, signals, native supervisors, and packaging behind platform
adapters.

Start with a compiled technical slice that proves the riskiest runtime
assumptions on macOS before committing to the complete structure. Then deliver
one end-to-end allocation path through the real public socket protocol. Add
live ownership and termination only after durable claims and two-phase
allocation are stable. Finish with administrative operations, native
supervision, and release channels.

Use deterministic unit tests for domain state transitions, injected clocks,
port pools, process snapshots, and signal decisions. Add real subprocess,
socket, SQLite, `lsof`, and supervisor integration tests where operating-system
behavior is the requirement. The final release matrix must execute compiled
artifacts rather than testing source-mode Bun alone.

## Steps

- **P1. Foundation and compiled-runtime spike.** Establish the pinned Bun
  workspace, root CLI/server package, publishable client-package boundary,
  Commander.js entrypoint, strict JSDoc/`checkJs`, formatting/linting, runtime
  schema-validation boundary, and test layout. Build a disposable compiled
  spike proving Commander.js, HTTP over a Unix socket, SQLite, child-process
  execution of LISTEN-specific `lsof`, signals, and embedded source/assets.
  Record the supported runtime/platform bounds and package-name choices before
  expanding the implementation. **Code areas:** root package/tooling files,
  `src/cli/`, `src/platform/`, `packages/client/`, `test/`, release-spike
  scripts. **Verification:** source and compiled smoke tests on macOS, strict
  JS checking, initial client consumption from Node and Bun. **Advances:** R1,
  R4, R6, R8.

- **P2. Versioned protocol, domain model, and SQLite registry.** Define
  versioned request/response/error schemas, capabilities, stable JSON envelopes
  and exit-code categories. Implement the pure claim, assignment, lease, run,
  fingerprint, history, and configuration models plus SQLite schema,
  migrations, transactions, validation, and repository adapters. Include
  token generation, injected time, TTL transitions, uniqueness constraints,
  and migration/restart fixtures. **Code areas:** `src/protocol/`,
  `src/domain/`, `src/storage/`, schema fixtures, migration and domain tests.
  **Verification:** protocol-schema tests, migration round trips, corrupt-data
  rejection, transaction/concurrency tests, and AC2 decision tables.
  **Advances:** R1, R2, R3, R6, R8.

- **P3. Local server and two-phase client vertical slice.** Implement
  platform application/runtime paths, permission validation, singleton Unix
  socket binding, `serve`, health/handshake negotiation, and allocation API
  handlers. Deliver canonical worktree identity, preferred/exact selection,
  sticky/ephemeral behavior, ephemeral-range/exclusion filtering,
  acquire/confirm/abandon/release, lease expiry, collision reconciliation, and
  atomic concurrent acquisition. Implement the official Node-compatible
  socket transport, low-level operations, and high-level startup callback
  helper with strict unavailable/incompatible-server failures. **Code areas:**
  `src/server/`, `src/allocation/`, `src/platform/paths/`,
  `packages/client/`, server/client integration tests. **Verification:** real
  bind and restart tests, concurrent-client tests, time-controlled expiry,
  address-in-use retry, protocol mismatch, no-fallback, and no-TCP-listener
  tests. **Advances:** R1, R2, R3, R6.

- **P4. Listener inspection, run lineage, and global inventory.** Implement
  macOS/Linux `lsof` execution and parsing for complete TCP LISTEN snapshots,
  process metadata and start-time fingerprints, canonical working directories,
  root/descendant lineage verification, and durable/live reconciliation.
  Expose `ports list` and `ports inspect` with verified, idle, pending,
  unclaimed, conflicting, mixed, and unobservable classifications plus
  filters. Never promote missing metadata or stored PIDs into live proof.
  **Code areas:** `src/inspection/`, platform process adapters,
  `src/reconciliation/`, inventory protocol/CLI handlers, fixtures and
  subprocess tests. **Verification:** parser fixtures from both platforms,
  multi-listener/dual-stack processes, PID-reuse simulations, launcher-child
  runs, ambiguous permissions, and real inventory snapshots. **Advances:** R4.

- **P5. Verified reclamation and unsafe eviction.** Implement the `never`,
  `graceful`, and `force-after-grace` state machine, bounded waits,
  pre-signal/post-signal reinspection, same-process-instance enforcement, and
  structured refusal/timeout results. Add dry-run planning and the separate
  operation-scoped unsafe any-owner eviction flow, binding execution to the
  inspected exact-port listener fingerprints. Persist complete audit events
  without widening termination from listeners to their process trees.
  **Code areas:** `src/reclamation/`, signal platform adapters, reclamation
  protocol/CLI handlers, audit repository, controlled-process test helpers.
  **Verification:** real SIGTERM/SIGKILL subprocess tests, changed-target and
  mixed-owner refusal, forced-timeout flows, dry-run nonmutation, unsafe
  consent, and audit evidence assertions. **Advances:** R5, R8.

- **P6. Operational CLI, administration, settings, and observability.**
  Complete the Commander.js command tree and central human/JSON rendering plus
  documented exit-code mapping. Add lifecycle-independent `status`,
  claim list/show/reassign/delete, prune eligibility and consent semantics,
  `config get/set`, bounded rotating diagnostics, and queryable `logs` and
  `history`. Ensure every mutation uses the server API and that ambient project
  config or `.env` files are not loaded. **Code areas:** `src/cli/commands/`,
  `src/cli/output/`, admin/config/history services, logging infrastructure,
  command contract tests. **Verification:** CLI snapshot and JSON-schema
  tests, exit-code matrix, prune age/TTY/non-TTY tests, listener safeguards,
  config validation, retention bounds, and outbound-network/telemetry checks.
  **Advances:** R6, R8.

- **P7. Native per-user supervision and managed installation.** Implement
  stable per-user managed executable paths and adapters for macOS LaunchAgent
  and Linux `systemd --user`. Deliver explicit install/uninstall,
  start/stop/restart/status semantics for manual and supervised servers,
  idempotence, no-root enforcement, mode/version reporting, atomic managed
  binary promotion, inactive-state preservation, active health checks, and
  rollback of failed upgrades. **Code areas:** `src/supervision/`,
  platform service-definition templates, installer/rollback services,
  lifecycle CLI commands, platform integration harnesses. **Verification:**
  real per-user lifecycle tests on macOS and Linux, manual-server conflicts,
  repeated install/uninstall, service restart prevention on stop, successful
  upgrade, failed-health rollback, and permission checks. **Advances:** R7.

- **P8. Protocol documentation and release distribution.** Publish complete
  protocol, CLI JSON/exit-code, client, installation, migration, safety, and
  troubleshooting documentation. Build and smoke-test standalone macOS
  ARM64/x64 and Linux glibc ARM64/x64 executables, emit checksums and release
  metadata, prepare the Homebrew formula, and package the Node/Bun JavaScript
  client for npm. Ensure release artifacts disable implicit project `.env`
  loading and require no Node/Bun runtime. **Code areas:** `docs/`, build and
  release workflows, packaging metadata, Homebrew formula/tap assets,
  `packages/client/`. **Verification:** clean-machine artifact smokes,
  checksum verification, Homebrew install/uninstall, npm consumer tests, and
  protocol-document conformance. **Advances:** R6, R8.

- **P9. Cross-platform final verification and completion evidence.** Run the
  complete Definition of Done and rubric matrix on source and compiled
  artifacts, including allocation concurrency, persistence, listener
  reconciliation, signal safety, administration, native supervision, and
  release-channel smokes. Resolve or explicitly surface all platform support
  limitations, run final spec evaluation and independent judge/review gates,
  and produce the completion report with exact evidence. **Code areas:** test
  matrices, workflow evidence, tracker/issues, release candidate artifacts.
  **Verification:** every R1-R8 evidence expectation and zero remaining
  `NOT YET`/`FAIL` at feature completion. **Advances:** R1, R2, R3, R4, R5,
  R6, R7, R8.

## Verification

- **Per-step:** Run targeted unit and integration tests plus strict JS checking
  for each affected layer. Update tracker status only from preserved evidence.
- **Per-platform:** Exercise real listener/process/supervisor behavior on
  macOS and Linux; fixture-only platform claims are insufficient.
- **Per-release target:** Execute the exact compiled artifact advertised for
  that OS/architecture and verify it has no Node/Bun runtime dependency.
- **Final step:** Run full rubric evaluation and produce the completion report.
