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
| R3 | CLI byte and bundle authority | NOT YET | #74, #75, #76 | Signed transformation and metadata authority are enforced; live protected byte proof remains P8 |
| R4 | Protected production and credential custody | NOT YET | #74, #75, #76 | Main-only producer isolation and cleanup are tested; protected execution remains P8 |
| R5 | Native Apple verification | NOT YET | #75, #76 | Strict ARM64/Intel collectors and aggregation are complete; current hosted documents remain P8 |
| R6 | Finalization and publication separation | PASS | #76 | Final metadata consumes aggregated trust, seals the plan digest, and keeps trust/publication authority disjoint |
| R7 | Failure, recovery, and immutability | PASS | #74, #75, #76 | Strict transformation, evidence, plan-digest, request-continuity, cleanup, and negative-path tests pass |
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
- **Status:** Evaluated source
  `f12b1241b9cb7f0aac609b36bc130821106766b6`; merged as
  `d54fdc0056109a5b0e8442da74332f593f9fe5ed`.

### PR #76 - Verification and sealed distribution

- **Slice:** `slice-03-verification-sealed-distribution`
- **Plan steps:** P5, P6, P7
- **Issues:** I-5, I-6, I-7
- **Rubric in scope:** R1, R2, R3, R4, R5, R6, R7
- **Boundary packet:** [`pr-76/`](pr-76/)
- **Status:** Draft boundary evaluation at pinned source
  `2edacf3a2e627e6e9842532b60ab8535d41aed0f`.

## Active Slice

### Slice 3 - Verification and sealed distribution

- **Branch:** `tb-portreeve-apple-trust-03-verification-sealed-distribution`
- **Plan steps:** P5, P6, P7
- **Issues:** I-5, I-6, I-7
- **Rubric in scope:** R1, R2, R3, R4, R5, R6, R7
- **Status:** GateReeve `PR_BOUNDARY` for draft PR
  [#76](https://github.com/TrentBrown/portreeve/pull/76).
