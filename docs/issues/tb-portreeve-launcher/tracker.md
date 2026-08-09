# Branch Tracker - tb-portreeve-launcher

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-08

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Launcher configuration and trust | PASS | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#29](https://github.com/TrentBrown/portreeve/pull/29), [#31](https://github.com/TrentBrown/portreeve/pull/31), [#32](https://github.com/TrentBrown/portreeve/pull/32), [#33](https://github.com/TrentBrown/portreeve/pull/33) | Exact-revision creation, editing, validation, trust, external-change Review/Overwrite/Cancel, and project-file retention pass automated and packaged acceptance |
| R2 | Setup and endpoint environment | PASS | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#27](https://github.com/TrentBrown/portreeve/pull/27), [#29](https://github.com/TrentBrown/portreeve/pull/29), [#32](https://github.com/TrentBrown/portreeve/pull/32), [#33](https://github.com/TrentBrown/portreeve/pull/33) | Safe suggestions, provenance, strict mappings, operation-time resolution, Docker values, and no assigned-port persistence pass the assembled matrix |
| R3 | Command-only lifecycle | PASS | [#27](https://github.com/TrentBrown/portreeve/pull/27), [#28](https://github.com/TrentBrown/portreeve/pull/28), [#29](https://github.com/TrentBrown/portreeve/pull/29), [#32](https://github.com/TrentBrown/portreeve/pull/32), [#33](https://github.com/TrentBrown/portreeve/pull/33) | Every evidence guard, project-command-only Stop, advisory Status, composed Restart, timeout, output, and failure result passes cumulative tests |
| R4 | Attached execution | PASS | [#30](https://github.com/TrentBrown/portreeve/pull/30), [#31](https://github.com/TrentBrown/portreeve/pull/31), [#33](https://github.com/TrentBrown/portreeve/pull/33) | Real process-group tests and packaged Desktop prove no-timeout execution, allocated environment, output streaming, close blocking, keep-open, explicit exact-group termination, and clean exit |
| R5 | Verified activation | PASS | [#27](https://github.com/TrentBrown/portreeve/pull/27), [#30](https://github.com/TrentBrown/portreeve/pull/30), [#32](https://github.com/TrentBrown/portreeve/pull/32), [#33](https://github.com/TrentBrown/portreeve/pull/33) | Generation-matched confirmation, cleanup, upgrade suggestion, downgrade consent, and durable reduced assessment pass cumulative tests and documentation review |
| R6 | Shared engine and coordination | PASS | [#26](https://github.com/TrentBrown/portreeve/pull/26), [#27](https://github.com/TrentBrown/portreeve/pull/27), [#28](https://github.com/TrentBrown/portreeve/pull/28), [#29](https://github.com/TrentBrown/portreeve/pull/29), [#30](https://github.com/TrentBrown/portreeve/pull/30), [#31](https://github.com/TrentBrown/portreeve/pull/31), [#33](https://github.com/TrentBrown/portreeve/pull/33) | Desktop and CLI share one runtime; renewable daemon admission, loss, cross-root concurrency, attached companions, strict schemas, and no-command daemon boundary pass |
| R7 | Desktop operation and diagnostics | PASS | [#26](https://github.com/TrentBrown/portreeve/pull/26), [#28](https://github.com/TrentBrown/portreeve/pull/28), [#31](https://github.com/TrentBrown/portreeve/pull/31), [#32](https://github.com/TrentBrown/portreeve/pull/32), [#33](https://github.com/TrentBrown/portreeve/pull/33) | The packaged app completes trust, conflict, attached-close, output, history, evidence, and actionable-result workflows through the strict main/preload boundary |
| R8 | Degraded and platform behavior | PASS | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#26](https://github.com/TrentBrown/portreeve/pull/26), [#27](https://github.com/TrentBrown/portreeve/pull/27), [#28](https://github.com/TrentBrown/portreeve/pull/28), [#29](https://github.com/TrentBrown/portreeve/pull/29), [#31](https://github.com/TrentBrown/portreeve/pull/31), [#33](https://github.com/TrentBrown/portreeve/pull/33) | Daemon-outage and purge suites pass; native macOS arm64/x64 and Linux x64/arm64 lifecycle jobs pass, including Docker stack smoke on both Linux architectures |

## PR Log

Append PR boundary entries here.

### PR #25 - Launcher configuration and trust foundations

- **PR:** [#25](https://github.com/TrentBrown/portreeve/pull/25)
- **Status:** merged 2026-08-08
- **Scope:** P1 / I-1: strict launcher schema, structured endpoint mappings,
  deterministic exact-byte revisions, canonical contained documents, conservative
  manifest suggestions, private shared trust/cache state, and reset placement.
- **Evidence packet:** [pr-25](pr-25/)
- **Result:** R1, R2, and R8 advance but correctly remain `NOT YET`; later CLI,
  engine, daemon, and Desktop slices complete them. Focused verification passes 23 tests
  and 69 assertions. Pinned Bun 1.3.14 passes toolchain, typecheck, lint, and all unique
  tests across a full run plus isolated lifecycle rerun. Judge: PASS WITH CONCERNS only
  for host LaunchAgent interference in the monolithic test invocation and an unrelated
  pre-existing handoff formatting failure.
  Code review: PASS with no findings after token-bound stale-lock and manifest-error
  corrections. Pattern review is not applicable because no rule scope is configured.

### PR #26 - Daemon launcher-operation coordination

- **PR:** [#26](https://github.com/TrentBrown/portreeve/pull/26)
- **Status:** merged
- **Scope:** P2 / I-2: strict `launcher-operations-v1` schemas and routes,
  version-7 durable sessions, one-way credential storage, transactional per-root
  admission, renewal, idempotent completion, lazy and startup expiry, bounded safe
  records, global history, and official JavaScript client methods and types.
- **Evidence packet:** [pr-26](pr-26/)
- **Result:** R6, R7, and R8 advance but remain `NOT YET` pending the shared engine,
  CLI, Desktop boundary, renderer, and degraded operation slices. Pinned verification
  passes toolchain, typecheck, lint, compiled build, 114 focused tests, npm packaging,
  and every unique repository test across the normal run plus isolated lifecycle rerun.

### PR #27 - Launcher environment and evidence services

- **PR:** [#27](https://github.com/TrentBrown/portreeve/pull/27)
- **Status:** merged
- **Scope:** P3 / I-3: operation-time host and Docker endpoint resolution, fixed
  reserved context, exact-revision private cache, fresh daemon evidence state table,
  verified-activation matching, and explicitly local degraded lsof evidence.
- **Evidence packet:** [pr-27](pr-27/)
- **Result:** R2, R3, R5, R6, and R8 advance but remain `NOT YET` pending command
  execution, CLI, attached activation, and Desktop slices. Pinned verification passes
  toolchain, typecheck, lint, build, 100 affected tests, real Unix-socket integration,
  and all 332 repository tests across host-isolated runs.

### PR #28 - Finite command-only launcher execution

- **PR:** [#28](https://github.com/TrentBrown/portreeve/pull/28)
- **Status:** merged 2026-08-08
- **Scope:** P4 / I-4: closed-input login-shell command sessions, isolated POSIX
  process groups, operation-wide bounded output, timeout and cancellation cleanup,
  trusted command-only lifecycle policy, degraded Stop/Status, and renewable daemon
  coordination around immutable execution snapshots.
- **Evidence packet:** [pr-28](pr-28/)
- **Result:** R3, R6, R7, and R8 advance but remain `NOT YET` pending CLI,
  attached/verified execution, Desktop boundaries and UI, and final cross-platform
  release verification. Pinned verification passes build, typecheck, lint, 36 focused
  launcher tests, real Unix-socket integration, and every repository test across the
  normal host-aware run plus isolated lifecycle rerun.

### PR #29 - Complete launcher CLI workflow

- **PR:** [#29](https://github.com/TrentBrown/portreeve/pull/29)
- **Status:** merged 2026-08-08
- **Scope:** P5 / I-5: interactive init, unapplied validation, resolved exact-revision
  trust review, all finite lifecycle commands, explicit admission confirmations,
  stable human/JSON output and exits, fresh-process degraded cache authority, and
  standalone compiled execution.
- **Evidence packet:** [pr-29](pr-29/)
- **Result:** R1, R2, R3, R6, and R8 advance but remain `NOT YET` pending attached and
  verified execution, Desktop boundaries and UI, and final release verification.
  Focused verification passes 57 tests and 237 assertions. Every one of 356 unique
  repository tests passes across the normal host-aware run plus isolated lifecycle
  rerun. Judge: PASS. Code review: no findings.

### PR #30 - Attached and verified launcher execution

- **PR:** [#30](https://github.com/TrentBrown/portreeve/pull/30)
- **Status:** merged 2026-08-08
- **Scope:** P6 / I-6: application-local attached process groups, explicit exact-group
  termination, concurrent Status/Stop, composed attached Restart, verified-activation
  enforcement, command-only upgrade detection, downgrade validation, and reduced safe
  maturity history.
- **Evidence packet:** [pr-30](pr-30/)
- **Result:** R4, R5, and R6 advance but remain `NOT YET` pending Desktop quit
  protection, Desktop maturity transitions and parity, packaged application evidence,
  and final release verification. Pinned build, typecheck, lint, changed-file format,
  65 focused tests, real process/socket activation integration, and all 369 repository
  tests pass across the normal host-aware run plus isolated lifecycle rerun.

### PR #31 - Desktop launcher trusted boundary

- **PR:** [#31](https://github.com/TrentBrown/portreeve/pull/31)
- **Status:** merged 2026-08-08
- **Scope:** P7 / I-7: main-process launcher documents and runtime sessions, strict
  renderer capabilities, bounded session-only output, user-selected output saving,
  attached-operation close protection, safe history/evidence reduction, and actionable
  lifecycle failure detail.
- **Evidence packet:** [pr-31](pr-31/)
- **Result:** R6 reaches `PASS`. R1, R4, R7, and R8 advance but remain `NOT YET`
  pending the Launcher tab and final packaged/cross-platform workflow verification.
  Pinned build, typecheck, lint, changed-file format, 71 Desktop tests, and all 375
  repository tests pass across the normal host-aware run plus isolated lifecycle rerun.

### PR #32 - Desktop Launcher tab

- **PR:** [#32](https://github.com/TrentBrown/portreeve/pull/32)
- **Status:** merged 2026-08-08
- **Scope:** P8 / I-8: fourth primary Launcher tab, stack-linked master-detail browser,
  guided editor and provenance, exact JSON review, Save and Trust, evidence and maturity
  presentation, lifecycle controls, confirmations, progress, cancellation, bounded
  session output, safe history, external-change handling, and Stacks cross-links.
- **Evidence packet:** [pr-32](pr-32/)
- **Result:** R1, R2, R3, R5, and R7 reach `PASS`. R4 and R8 remain `NOT YET`
  only for the final packaged attached-close, external-edit, Linux, release, and
  retention matrix in P9. Pinned build, typecheck, lint, changed-file format, 77
  Desktop tests, packaged application construction and an isolated packaged Launcher
  workflow pass. All 381 unique repository tests pass across the host-aware run plus
  the isolated lifecycle rerun. Judge: PASS. Code review: no findings.

### PR #33 - Launcher documentation and feature-final verification

- **PR:** [#33](https://github.com/TrentBrown/portreeve/pull/33)
- **Status:** merged 2026-08-08
- **Scope:** P9 / I-9 and feature-final evaluation: public launcher guide, CLI/Desktop
  cross-links, canonical mixed-stack launcher example, assembled source/release/native
  matrix, packaged external-edit and attached-close acceptance, and final retention and
  rubric evaluation.
- **Evidence packet:** [pr-33](pr-33/)
- **Result:** R1-R8 are `PASS`; zero `NOT YET` or `FAIL` criteria remain. All 382
  repository tests pass across clean hosted runners and the locally reconciled suite.
  Six release artifacts, native macOS arm64/x64 and Linux x64/arm64 lifecycles, both
  Linux Docker smokes, both macOS Homebrew smokes, and packaged Desktop acceptance pass.
  Feature-record retention is tracked. Judge: PASS. Code review: no findings.
