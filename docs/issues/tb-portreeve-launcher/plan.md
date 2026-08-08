# Plan - tb-portreeve-launcher

**Feature:** `tb-portreeve-launcher`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-08

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Build outward from the smallest portable authority boundaries. First define and test the
strict project file, contained path resolution, exact-revision trust, conservative
manifest discovery, and private shared local state without executing commands. Next add
one tokenized daemon coordination capability and durable safe operation metadata without
giving the server command authority. Then implement the shared main-process/CLI launcher
engine in layers: endpoint environment and evidence classification, finite command-only
lifecycle, CLI workflows, attached process groups, and verified activation.

Only after those portable contracts pass will Desktop receive narrow launcher adapters
and IPC. The renderer then adds the Launcher browser and editor while remaining unable to
read arbitrary files, access the PortReeve socket, or execute generic shell commands. The
existing lifecycle failure presentation is corrected through the same structured result
model instead of becoming a separate UI-only patch.

The implementation adds no PTY or native dependency. POSIX command sessions use the
Node-compatible child-process API so the same source runs in the compiled Bun CLI and
the Electron main process on macOS and Linux. Raw output is an in-memory, truncation-aware
one-megabyte tail per operation; only explicitly saved output leaves memory. Daemon
operation sessions use a thirty-second renewable deadline with renewal every ten seconds,
and terminal safe metadata is bounded while also feeding the existing history surface.

## Steps

- **P1 - Establish launcher configuration, discovery, and local trust.** Add a strict
  version-1 launcher schema under `src/launcher` with structured component/endpoint
  references, deterministic serialization, shell and timeout validation, attached-Start
  constraints, and topology-reference validation. Add canonical launcher discovery,
  symlink-aware contained working-directory resolution, atomic exact-byte document
  operations, SHA-256 revisions, conservative exact-directory package/Make/Compose
  suggestions with provenance, and a private atomic application-home state file shared
  by CLI and Desktop for trusted revisions and nonsecret resolved-environment cache.
  Integrate that state with reset scope but never project-file deletion. **Advances:** R1,
  R2, R8.

- **P2 - Add daemon launcher-operation coordination and safe history.** Introduce the
  `launcher-operations-v1` capability, strict begin, renew, complete, inspect, and recent
  history schemas, official-client methods and types, server routes, and a version-7
  SQLite migration. Use random operation credentials stored only as hashes, a
  thirty-second renewable deadline, idempotent completion, transactional same-root
  admission rules, different-root concurrency, attached-Start Status/Stop exceptions,
  lazy and startup expiry to `lost`, bounded terminal metadata, and existing history
  events. Never transmit or store project commands, environment values, or raw output.
  **Advances:** R6, R7, R8.

- **P3 - Build endpoint resolution and evidence classification.** Create shared launcher
  environment and evidence services that prepare or reuse generations, resolve every
  selected host or Docker-derived value, add only the approved `PORTREEVE_*` context,
  reject collisions, and atomically cache nonsecret results by root and launcher
  revision. Combine stack status with fresh inventory into explicit stopped, partial,
  fully observed, verified, conflicting, and uncertain states. Keep project Status text
  advisory and implement visibly local degraded `lsof` evidence without claiming daemon
  coordination. **Advances:** R2, R3, R5, R6, R8.

- **P4 - Implement finite command-only lifecycle execution.** Add a shared command
  session abstraction using closed stdin, explicit login-shell invocation, isolated POSIX
  process groups, bounded streamed output, configurable timeouts, graceful then forced
  termination of only the created group, cancellation, and structured failure details.
  Implement evidence-gated Start, explicit Run Start Anyway, project-command-only Stop,
  advisory Status, and composed Restart with fresh revalidation. Acquire, renew, and
  complete daemon operation sessions around execution and preserve immutable trusted
  snapshots throughout each operation. **Advances:** R3, R6, R7, R8.

- **P5 - Deliver the complete CLI launcher workflow.** Register `launcher init`,
  `validate`, `trust`, `start`, `stop`, `restart`, and `status` in Commander with implicit
  enclosing-stack discovery and explicit root selection. Implement interactive init and
  trust review, exact JSON preview and exclusive creation, JSON/human output, stable exit
  behavior, noninteractive trust refusal, explicit partial-Start and degraded-Stop
  confirmation, cached degraded Status, and compiled-runtime coverage on macOS and Linux.
  **Advances:** R1, R2, R3, R6, R8.

- **P6 - Add attached Start and verified activation.** Extend the command session engine
  with one renewable application-tied attached process group per stack, live bounded
  output, concurrent Status/Stop admission, composed Restart, explicit exact-group
  termination, and caller-loss reporting without detach or adoption. Enforce
  verified-activation success by matching the supplied generation to fresh confirmed or
  intentionally degraded activation and listener evidence; implement command-only
  upgrade detection and explicit downgrade validation. Provide Desktop quit-guard hooks
  without placing process authority in the renderer. **Advances:** R4, R5, R6.

- **P7 - Add the trusted Desktop launcher boundary and actionable results.** Add
  main-process launcher document and runtime adapters, coordinator operations, strict
  shared IPC schemas, preload methods, output subscriptions, save-output capability, and
  application-close coordination. Reduce root paths, commands, evidence, environment,
  history, and failures to the minimum renderer contract. Extend lifecycle results so
  install/start and other existing failures expose safe underlying step, code, message,
  timeout or exit, output, and evidence details rather than generic-only summaries.
  **Advances:** R1, R4, R6, R7, R8.

- **P8 - Build and integrate the Launcher tab.** Add the fourth primary tab after Stacks,
  explanatory onboarding, stack-linked list/detail browsing, maturity and evidence
  presentation, action availability and confirmation flows, operation progress and
  cancellation, nonsecret environment preview, bounded current-session output with Copy
  and Save, and twenty-entry safe history. Add the dedicated Execution, Commands,
  Endpoint environment, Advanced, and Review editor with manifest provenance, exact
  preview, Save and Trust, downgrade warning, dirty navigation, and external-change
  Review/Overwrite/Cancel. Cover accessibility, stale/degraded states, attached-quit
  behavior, and cross-links with Stacks. **Advances:** R1, R2, R3, R4, R5, R7, R8.

- **P9 - Complete documentation and assembled verification.** Document the file schema,
  trust scope, environment contract, CLI, command-only limitations, verified integration
  checklist, concurrency, degraded recovery, output retention, platform boundaries, and
  project-launcher ownership. Run targeted protocol, migration, client, engine, CLI,
  Desktop, security, and reset suites; the full pinned check and release builds; compiled
  macOS/Linux CLI smokes; packaged macOS workflows; and manual attached-process and
  external-edit acceptance. Evaluate every rubric criterion and produce the completion
  report at the final real delivery boundary. **Advances:** R1, R2, R3, R4, R5, R6, R7,
  R8.

## Delivery sequence

1. **Configuration and trust slice:** P1. Establishes a safe non-executing project-file
   boundary and local trust contract.
2. **Daemon coordination slice:** P2. Publishes the coordination protocol and migration
   without introducing project command execution.
3. **Command-only engine slice:** P3-P4. Proves environment injection, evidence gating,
   finite execution, and degraded policy through the shared engine.
4. **Portable CLI and advanced execution slice:** P5-P6. Delivers the complete CLI,
   attached Start, and verified activation before Desktop depends on them.
5. **Desktop trusted-boundary slice:** P7. Adds narrow main/preload capabilities and the
   cross-cutting failure-detail correction without an unfinished renderer workflow.
6. **Desktop Launcher slice:** P8. Delivers the complete tab, editor, and runtime UX.
7. **Feature-final slice:** P9. Completes public documentation, native and packaged
   evidence, rubric evaluation, and retention review.

Each later slice begins from updated `main` after the previous PR merges and uses a fresh
sequential delivery branch under the stable feature ID.

## Verification

- Validate strict launcher schemas, deterministic bytes, endpoint references, contained
  real paths, atomic file conflicts, exact revision trust, state-file permissions, and
  project-file retention with adversarial filesystem fixtures.
- Prove manifest discovery never executes code or descends into child directories and
  that every suggestion carries exact-file provenance.
- Exercise migration, token secrecy, idempotency, expiry, same-root admission,
  attached-Start exceptions, different-root concurrency, history bounds, and daemon
  restart behavior against real SQLite transactions and socket routes.
- Run table-driven environment and evidence tests across process, Docker, command-only,
  verified, partial, conflicting, stale, unavailable, and degraded states.
- Exercise real finite and attached POSIX process groups, output truncation, timeout,
  cancellation, SIGTERM/SIGKILL grace, concurrent Status/Stop, exact termination, and
  client loss on macOS and Linux without signaling unrelated processes.
- Exercise CLI init, validate, trust, every lifecycle command, confirmations, JSON/human
  output, exit codes, compiled standalone execution, and unavailable-daemon behavior.
- Verify renderer isolation, strict IPC, no generic shell or filesystem authority,
  reduced data, session-only output, save-output consent, quit guards, external edits,
  stale evidence, history, and detailed existing lifecycle failures.
- Run packaged Desktop setup, edit, trust, Start, partial repair, Status, Stop, Restart,
  verified upgrade, attached quit, output save, conflict, degraded recovery, and reset
  workflows against disposable stacks.
- **Final step:** Run full rubric evaluation and produce the completion report.
