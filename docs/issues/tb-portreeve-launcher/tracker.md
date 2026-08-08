# Branch Tracker - tb-portreeve-launcher

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-08

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Launcher configuration and trust | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25) | P1/I-1 implements the strict document, contained paths, exact revision, and shared trust primitives; CLI and Desktop workflows remain |
| R2 | Setup and endpoint environment | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25) | P1/I-1 implements conservative manifest and endpoint suggestions with provenance; operation-time resolution and UI remain |
| R3 | Command-only lifecycle | NOT YET | - | Planned for P3-P5, P8-P9 / I-3-I-5, I-8-I-9 |
| R4 | Attached execution | NOT YET | - | Planned for P6-P9 / I-6-I-9 |
| R5 | Verified activation | NOT YET | - | Planned for P3, P6, P8-P9 / I-3, I-6, I-8-I-9 |
| R6 | Shared engine and coordination | NOT YET | - | Planned for P2-P7, P9 / I-2-I-7, I-9 |
| R7 | Desktop operation and diagnostics | NOT YET | - | Planned for P2, P4, P7-P9 / I-2, I-4, I-7-I-9 |
| R8 | Degraded and platform behavior | NOT YET | [#25](https://github.com/TrentBrown/portreeve/pull/25) | P1/I-1 places shared cache state inside reset scope while preserving project files; degraded execution and platform evidence remain |

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
