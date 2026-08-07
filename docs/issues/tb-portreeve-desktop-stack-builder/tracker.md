# Branch Tracker - tb-portreeve-desktop-stack-builder

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-07

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Stack-root contract | PASS | [#14](https://github.com/TrentBrown/portreeve/pull/14) | P1/I-1: strict public `stackRoot`, exact real-path canonicalization, standalone `workspaceRoot` preservation, and current-surface documentation pass |
| R2 | CLI discovery | PASS | [#15](https://github.com/TrentBrown/portreeve/pull/15) | P3/I-3: explicit selectors, upward real-path discovery across child repositories, missing-file status fallback, and apply refusal pass |
| R3 | Server safety | PASS | [#14](https://github.com/TrentBrown/portreeve/pull/14) | P2/I-2: overlap refusal, sibling acceptance, exact-root adoption, missing-root pruning, and live-activation definition protection pass |
| R4 | Desktop containment | NOT YET | - | Planned for P4, P6-P8 / I-4, I-6-I-7 |
| R5 | Complete editor | NOT YET | - | Planned for P5-P8 / I-5-I-7 |
| R6 | Validation and output | NOT YET | - | Planned for P4-P8 / I-4-I-7 |
| R7 | File safety and recovery | NOT YET | - | Planned for P4, P6-P8 / I-4, I-6-I-7 |
| R8 | Save/apply lifecycle | NOT YET | [#14](https://github.com/TrentBrown/portreeve/pull/14) | PR #14 establishes the strict apply and live-activation server boundary; desktop save/retry behavior remains P4/P7 |

## PR Log

Append PR boundary entries here.

### PR #14 - Stack-root contract and server authority

- **PR:** [#14](https://github.com/TrentBrown/portreeve/pull/14)
- **Status:** merged 2026-08-07 (`757bb1a3b554fd3aa630ef5294761baeaefb4389`)
- **Scope:** P1-P2 / I-1-I-2: strict public `stackRoot`, exact-directory
  canonicalization, transactional root overlap and live-activation safety, exact-root
  claim adoption, pruning/history terminology, and current desktop contract reduction.
- **Evidence packet:** [pr-14](pr-14/)
- **Result:** R1 and R3 pass; R8 advances but remains `NOT YET`. The native pinned Bun
  1.3.14 gate passes 232 tests and 958 assertions. Independent judge: PASS. Code review:
  PASS with no findings. CLI discovery and desktop editor/save workflows remain in later
  planned slices.

### PR #15 - Deterministic CLI stack discovery

- **PR:** [#15](https://github.com/TrentBrown/portreeve/pull/15)
- **Status:** merged 2026-08-07 (`4740cf4a6012eac339595a289727c9ec3236557b`)
- **Scope:** P3 / I-3: explicit apply root/file selection, upward definition discovery
  across child Git repositories, registered-root status fallback, compiled CLI coverage,
  and public CLI/example documentation.
- **Evidence packet:** [pr-15](pr-15/)
- **Result:** R2 passes. R1 and R3 remain passing from PR #14; R8 and the desktop editor
  criteria remain `NOT YET` for later slices. The pinned native Bun gate passes 235
  tests and 976 assertions. Independent judge: PASS. Code review: PASS with no findings.
