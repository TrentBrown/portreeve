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
| R3 | CLI byte and bundle authority | NOT YET | #74 | P2 foundation complete; live signed-byte proof remains P3/P5/P7-P8 |
| R4 | Protected production and credential custody | NOT YET | #74 | P2 primitives complete; protected producer remains P4/P7-P8 |
| R5 | Native Apple verification | NOT YET | - | Planned for P3, P5, P7-P8 / I-3, I-5, I-7, I-8 |
| R6 | Finalization and publication separation | NOT YET | - | Planned for P6-P8 / I-6-I-8 |
| R7 | Failure, recovery, and immutability | NOT YET | #74 | P1-P2 fail-closed contract complete; later boundaries remain |
| R8 | Protected nonpublishing rehearsal | NOT YET | - | Planned for P8 / I-8 |

## PR Log

Append PR boundary entries here.

### PR #74 - Contract foundation

- **Slice:** `slice-01-contract-foundation`
- **Plan steps:** P1, P2
- **Issues:** I-1, I-2
- **Rubric in scope:** R1, R2, R3, R4, R7
- **Boundary packet:** [`pr-74/`](pr-74/)
- **Status:** GateReeve boundary packet valid and human review accepted for
  remediated pinned source
  `cb4ad905a7cd7f141dec4af662aecebbdb74908b`; landing pending.
