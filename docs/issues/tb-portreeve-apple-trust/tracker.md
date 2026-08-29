# Branch Tracker - tb-portreeve-apple-trust

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-28

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Public-channel trust policy | PASS | #74 | P1 contract and tests complete; P6-P8 must preserve it |
| R2 | Schema lifecycle and compatibility | PASS | #74 | P1 schema-v2 lifecycle and read-only v1 dispatch complete |
| R3 | CLI byte and bundle authority | NOT YET | #74, #75 | P3 canonical helper packaging and mounted-DMG checks complete; protected signed-byte proof remains P5/P7-P8 |
| R4 | Protected production and credential custody | NOT YET | #74, #75 | P4 producer, qualification split, workflow isolation, and cleanup tests complete; protected run remains P7-P8 |
| R5 | Native Apple verification | NOT YET | #75 | P3 producer-side identity and mounted-DMG checks complete; independent native evidence remains P5/P7-P8 |
| R6 | Finalization and publication separation | NOT YET | - | Planned for P6-P8 / I-6-I-8 |
| R7 | Failure, recovery, and immutability | NOT YET | #74, #75 | P1-P4 fail-closed construction and cleanup complete; evidence aggregation and rehearsal remain |
| R8 | Protected nonpublishing rehearsal | NOT YET | - | Planned for P8 / I-8 |

## PR Log

Append PR boundary entries here.

### PR #74 - Contract foundation

- **Slice:** `slice-01-contract-foundation`
- **Plan steps:** P1, P2
- **Issues:** I-1, I-2
- **Rubric in scope:** R1, R2, R3, R4, R7
- **Boundary packet:** [`pr-74/`](pr-74/)
- **Status:** Merged as `0de186b584be0ef4318c34cba5169dc1c5a76dd1`.

### PR #75 - Trusted artifact construction

- **Slice:** `slice-02-trusted-artifact-construction`
- **Plan steps:** P3, P4
- **Issues:** I-3, I-4
- **Rubric in scope:** R3, R4, R5, R7
- **Boundary packet:** [`pr-75/`](pr-75/)
- **Status:** Draft boundary evaluation at pinned source
  `f12b1241b9cb7f0aac609b36bc130821106766b6`.

## Active Slice

### Slice 2 - Trusted artifact construction

- **Branch:** `tb-portreeve-apple-trust-02-trusted-artifact-construction`
- **Plan steps:** P3, P4
- **Issues:** I-3, I-4
- **Rubric in scope:** R3, R4, R5, R7
- **Status:** GateReeve `PR_BOUNDARY` for draft PR
  [#75](https://github.com/TrentBrown/portreeve/pull/75).
