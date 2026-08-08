# Branch Tracker - tb-portreeve-launcher

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-08

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Launcher configuration and trust | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25) | P1/I-1 implements the strict document, contained paths, exact revision, and shared trust primitives; CLI and Desktop workflows remain |
| R2 | Setup and endpoint environment | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#27](https://github.com/TrentBrown/portreeve/pull/27) | P1/I-1 implements suggestions; P3/I-3 resolves every host and Docker mapping at operation time and caches nonsecret exact-revision context; CLI and UI remain |
| R3 | Command-only lifecycle | NOT YET | [#27](https://github.com/TrentBrown/portreeve/pull/27) | P3/I-3 implements stopped, partial, fully observed, conflicting, and uncertain evidence states; lifecycle action policy and execution remain |
| R4 | Attached execution | NOT YET | - | Planned for P6-P9 / I-6-I-9 |
| R5 | Verified activation | NOT YET | [#27](https://github.com/TrentBrown/portreeve/pull/27) | P3/I-3 reserves verified for a current matching activation with fresh active required-provider evidence; attached activation and UI transitions remain |
| R6 | Shared engine and coordination | NOT YET | [#26](https://github.com/TrentBrown/portreeve/pull/26), [#27](https://github.com/TrentBrown/portreeve/pull/27) | P2/I-2 adds daemon sessions; P3/I-3 adds shared environment and evidence services; shared command engine and CLI/Desktop integrations remain |
| R7 | Desktop operation and diagnostics | NOT YET | [#26](https://github.com/TrentBrown/portreeve/pull/26) | P2/I-2 adds bounded safe operation records and global history events; the Desktop result and history UI remains |
| R8 | Degraded and platform behavior | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25), [#26](https://github.com/TrentBrown/portreeve/pull/26), [#27](https://github.com/TrentBrown/portreeve/pull/27) | P1-P2 establish cache/reset and loss behavior; P3 adds explicitly local uncoordinated lsof evidence that cannot claim ownership; degraded command policy remains |

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
- **Status:** in review
- **Scope:** P3 / I-3: operation-time host and Docker endpoint resolution, fixed
  reserved context, exact-revision private cache, fresh daemon evidence state table,
  verified-activation matching, and explicitly local degraded lsof evidence.
- **Evidence packet:** [pr-27](pr-27/)
- **Result:** R2, R3, R5, R6, and R8 advance but remain `NOT YET` pending command
  execution, CLI, attached activation, and Desktop slices. Pinned verification passes
  toolchain, typecheck, lint, build, 100 affected tests, real Unix-socket integration,
  and all 332 repository tests across host-isolated runs.
