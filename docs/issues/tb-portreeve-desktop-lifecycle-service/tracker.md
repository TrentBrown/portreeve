# Branch Tracker - tb-portreeve-desktop-lifecycle-service

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| #  | Criterion (short)             | Status  | PR  | Notes                         |
| -- | ----------------------------- | ------- | --- | ----------------------------- |
| R1 | Shared lifecycle authority    | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37) | PR 37 establishes the shared service and CLI adapter; desktop migration remains P4. |
| R2 | Canonical result parity       | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37) | PR 37 centralizes mutation outcomes and CLI consumption; desktop parity remains P5. |
| R3 | Trusted controller            | NOT YET | -   | Planned for P4, P5, P6, P7   |
| R4 | Deadlines and recovery        | NOT YET | -   | I-2 implementation and deterministic recovery tests are in progress; interruption evidence remains P7. |
| R5 | Cross-process exclusion       | NOT YET | -   | I-2 listener-lock implementation and multi-process contention tests are in progress; final native evidence remains P7. |
| R6 | Desktop lifecycle behavior    | NOT YET | -   | Planned for P5, P7           |
| R7 | Safe diagnostics              | NOT YET | -   | Planned for P5, P7           |
| R8 | Compatibility and native parity | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37) | PR 37 passes CLI and compiled-runtime compatibility; Electron and native completion remain. |

## PR Log

### PR #37 - Shared lifecycle service and CLI migration

- **Scope:** I-1; P1 and P3; advances R1, R2, and R8.
- **Status:** Merged; feature-level rubric criteria remain `NOT YET` until
  the Desktop and safety slices are complete.
- **Evidence:** [PR 37 boundary packet](pr-37/boundary.json)
- **Decision:** CLI exit-code bands remain presentation policy outside the
  canonical lifecycle service.
