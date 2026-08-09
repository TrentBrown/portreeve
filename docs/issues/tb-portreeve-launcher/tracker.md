# Branch Tracker - tb-portreeve-launcher

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-08

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Launcher configuration and trust | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#29](https://github.com/TrentBrown/portreeve/pull/29) | P1 adds strict document/trust primitives; P5 adds exclusive CLI creation, validation, resolved exact-revision review, and noninteractive refusal; Desktop editing remains |
| R2 | Setup and endpoint environment | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#27](https://github.com/TrentBrown/portreeve/pull/27), [#29](https://github.com/TrentBrown/portreeve/pull/29) | P1 adds suggestions; P3 resolves values; P5 presents CLI provenance and endpoint mappings; Desktop setup remains |
| R3 | Command-only lifecycle | NOT YET | [#27](https://github.com/TrentBrown/portreeve/pull/27), [#28](https://github.com/TrentBrown/portreeve/pull/28), [#29](https://github.com/TrentBrown/portreeve/pull/29) | P3-P4 provide evidence and finite execution; P5 exposes all CLI operations and explicit consent; Desktop integration remains |
| R4 | Attached execution | NOT YET | - | Planned for P6-P9 / I-6-I-9 |
| R5 | Verified activation | NOT YET | [#27](https://github.com/TrentBrown/portreeve/pull/27) | P3/I-3 reserves verified for a current matching activation with fresh active required-provider evidence; attached activation and UI transitions remain |
| R6 | Shared engine and coordination | NOT YET | [#26](https://github.com/TrentBrown/portreeve/pull/26), [#27](https://github.com/TrentBrown/portreeve/pull/27), [#28](https://github.com/TrentBrown/portreeve/pull/28), [#29](https://github.com/TrentBrown/portreeve/pull/29) | P2-P4 add sessions, environment, evidence, and finite engine; P5 wires the CLI through one shared runtime; Desktop parity remains |
| R7 | Desktop operation and diagnostics | NOT YET | [#26](https://github.com/TrentBrown/portreeve/pull/26), [#28](https://github.com/TrentBrown/portreeve/pull/28) | P2/I-2 adds bounded safe records; P4/I-4 adds bounded streamed output and structured current-session failures; the Desktop result, history, and existing-lifecycle failure UI remain |
| R8 | Degraded and platform behavior | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#26](https://github.com/TrentBrown/portreeve/pull/26), [#27](https://github.com/TrentBrown/portreeve/pull/27), [#28](https://github.com/TrentBrown/portreeve/pull/28), [#29](https://github.com/TrentBrown/portreeve/pull/29) | P1-P4 establish degraded policy; P5 adds fresh-process cached CLI operation and native compiled coverage; final cross-platform release evidence remains |

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
- **Status:** in review
- **Scope:** P5 / I-5: interactive init, unapplied validation, resolved exact-revision
  trust review, all finite lifecycle commands, explicit admission confirmations,
  stable human/JSON output and exits, fresh-process degraded cache authority, and
  standalone compiled execution.
- **Evidence packet:** [pr-29](pr-29/)
- **Result:** R1, R2, R3, R6, and R8 advance but remain `NOT YET` pending attached and
  verified execution, Desktop boundaries and UI, and final release verification.
  Focused verification passes 57 tests and 235 assertions. Every one of 356 unique
  repository tests passes across the normal host-aware run plus isolated lifecycle
  rerun. Judge: PASS. Code review: no findings.
