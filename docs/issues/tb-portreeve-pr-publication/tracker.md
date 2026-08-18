# Branch Tracker - tb-portreeve-pr-publication

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-17

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | PR-only publication sequence | PASS | [#66](https://github.com/TrentBrown/portreeve/pull/66) | GitHub Release remains first; both mutable repositories now use exact PR transport. |
| R2 | Exact generated branches and PRs | PASS | [#65](https://github.com/TrentBrown/portreeve/pull/65), [#66](https://github.com/TrentBrown/portreeve/pull/66) | Shared state machine and exact Homebrew/Desktop configurations pass. |
| R3 | Safe merge and policy fallback | PASS | [#65](https://github.com/TrentBrown/portreeve/pull/65) | Bounded mergeability, merge commits, blocked-review URL, ancestry, and cleanup recovery pass. |
| R4 | Idempotent partial recovery | PASS | [#66](https://github.com/TrentBrown/portreeve/pull/66) | Open, merged, cleanup, and cross-adapter partial retries preserve approved state and exact identity. |
| R5 | Complete honest evidence | PASS | [#66](https://github.com/TrentBrown/portreeve/pull/66) | New records require both PR identities; legacy completed evidence remains exact and readable. |
| R6 | Minimal hosted authority | PASS | [#66](https://github.com/TrentBrown/portreeve/pull/66) | Only the environment-gated publish job has contents/PR write and the release token. |
| R7 | Verified operator documentation | PASS | [#66](https://github.com/TrentBrown/portreeve/pull/66) | Plan, runbook, skill, contracts, and 542-test full suite agree. |

## PR Log

Append PR boundary entries here.

### PR #65 - Deterministic publication PR state machine

- **PR:** [#65](https://github.com/TrentBrown/portreeve/pull/65)
- **Status:** merged
- **Scope:** P1 / I-1: deterministic GitHub ref, exact-file commit, self-verifying
  PR, merge-policy, destination-proof, and cleanup recovery primitive.
- **Evidence packet:** [pr-65](pr-65/)
- **Result:** Slice gates pass. R3 is PASS; R2 remains NOT YET until the next slice
  supplies the exact Homebrew and Desktop-update configurations. Full repository check:
  535 pass / 0 fail.

### PR #66 - PR-backed publication and terminal evidence

- **PR:** [#66](https://github.com/TrentBrown/portreeve/pull/66)
- **Status:** in review
- **Scope:** P2-P7 / I-2-I-5: wire both repositories through the shared state machine,
  preserve partial recovery, require honest terminal evidence, minimize hosted
  authority, align operator surfaces, and close the complete feature rubric.
- **Evidence packet:** [pr-66](pr-66/)
- **Result:** Feature-final gates pass. R1-R7 are PASS. Pinned Bun 1.3.14 full
  repository check: 542 pass / 0 fail / 2,852 assertions.
