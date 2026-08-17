# Branch Tracker - tb-portreeve-pr-publication

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-17

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | PR-only publication sequence | NOT YET | - | Planned for P2 / I-2 |
| R2 | Exact generated branches and PRs | NOT YET | [#65](https://github.com/TrentBrown/portreeve/pull/65) | Shared exact-path state machine passes; repository wiring remains P2. |
| R3 | Safe merge and policy fallback | PASS | [#65](https://github.com/TrentBrown/portreeve/pull/65) | Bounded mergeability, merge commits, blocked-review URL, ancestry, and cleanup recovery pass. |
| R4 | Idempotent partial recovery | NOT YET | - | Planned for P3 / I-2 |
| R5 | Complete honest evidence | NOT YET | - | Planned for P4 / I-3 |
| R6 | Minimal hosted authority | NOT YET | - | Planned for P5 / I-4 |
| R7 | Verified operator documentation | NOT YET | - | Planned for P6-P7 / I-4-I-5 |

## PR Log

Append PR boundary entries here.

### PR #65 - Deterministic publication PR state machine

- **PR:** [#65](https://github.com/TrentBrown/portreeve/pull/65)
- **Status:** in review
- **Scope:** P1 / I-1: deterministic GitHub ref, exact-file commit, self-verifying
  PR, merge-policy, destination-proof, and cleanup recovery primitive.
- **Evidence packet:** [pr-65](pr-65/)
- **Result:** Slice gates pass. R3 is PASS; R2 remains NOT YET until the next slice
  supplies the exact Homebrew and Desktop-update configurations. Full repository check:
  535 pass / 0 fail.
