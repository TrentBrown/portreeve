# Branch Tracker - tb-portreeve-preview-release

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-16

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| R1 | Deterministic preparation boundary | NOT YET | [#57](https://github.com/TrentBrown/portreeve/pull/57) | PR #57 establishes strict preparation and resume behavior; complete distribution outputs and publication remain. |
| R2 | Complete native and Desktop artifacts | NOT YET | - | P3-P5, P9 / I-3, I-4, I-5, I-9 |
| R3 | Release record and exact-byte state machine | NOT YET | [#57](https://github.com/TrentBrown/portreeve/pull/57) | PR #57 adds schema v1, ordered transitions, atomic persistence, and artifact tamper checks; downstream evidence aggregation remains. |
| R4 | Policy and publication gates | NOT YET | [#57](https://github.com/TrentBrown/portreeve/pull/57) | PR #57 adds preview/stable policy and approval-plan binding; public adapters and complete Apple evidence gates remain. |
| R5 | One local/hosted engine with npm decoupled | NOT YET | - | P3, P6, P9 / I-3, I-6, I-9 |
| R6 | Direct-download and Homebrew lifecycle semantics | NOT YET | - | P4-P6, P9 / I-4, I-5, I-6, I-9 |
| R7 | Alpha UX and safe installation guidance | NOT YET | - | P7, P9 / I-7, I-9 |
| R8 | Operator entry points and drift protection | NOT YET | - | P2, P8-P9 / I-2, I-8, I-9 |

## PR Log

### PR #57 - Deterministic preparation foundation

- **PR:** [#57](https://github.com/TrentBrown/portreeve/pull/57)
- **Status:** in review
- **Scope:** P1 and preparation portions of P2-P3 / I-1-I-3: approved
  feature record, release state/policy schema, exact artifact identity,
  resumable non-publishing preparation, callable build-once stage, and
  coordinated release-tag support.
- **Evidence packet:** [pr-57](pr-57/)
- **Result:** Slice gates pass. R1-R8 remain cumulative `NOT YET`; later slices
  retain all incomplete native, Desktop, hosted, publication, UX, and operator
  documentation work.
