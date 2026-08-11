# Branch Tracker - tb-portreeve-desktop-lifecycle-service

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| #  | Criterion (short)             | Status  | PR  | Notes                         |
| -- | ----------------------------- | ------- | --- | ----------------------------- |
| R1 | Shared lifecycle authority    | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37), [#39](https://github.com/TrentBrown/portreeve/pull/39) | PR 39 removes the Desktop lifecycle subprocess adapter; final packaged and native evidence remains P6-P7. |
| R2 | Canonical result parity       | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37) | PR 37 centralizes mutation outcomes and CLI consumption; desktop parity remains P5. |
| R3 | Trusted controller            | NOT YET | [#39](https://github.com/TrentBrown/portreeve/pull/39) | PR 39 fixes privileged inputs and visibly fails mutations closed on controller/artifact mismatch; complete diagnostics and packaging evidence remain P5-P7. |
| R4 | Deadlines and recovery        | NOT YET | [#38](https://github.com/TrentBrown/portreeve/pull/38) | PR 38 adds bounded child, wait, operation, read, and recovery deadlines with deterministic partial/failed timeout evidence; final interruption evidence remains P7. |
| R5 | Cross-process exclusion       | NOT YET | [#38](https://github.com/TrentBrown/portreeve/pull/38) | PR 38 adds a purge-safe listener lease, prompt busy results, read concurrency, abandoned-owner recovery, and multi-process contention coverage; final native evidence remains P7. |
| R6 | Desktop lifecycle behavior    | NOT YET | -   | Planned for P5, P7           |
| R7 | Safe diagnostics              | NOT YET | -   | Planned for P5, P7           |
| R8 | Compatibility and native parity | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37), [#39](https://github.com/TrentBrown/portreeve/pull/39) | PR 39 preserves the verified installation artifact and passes direct-controller compatibility tests; packaged Electron and native completion remain. |

## PR Log

### PR #37 - Shared lifecycle service and CLI migration

- **Scope:** I-1; P1 and P3; advances R1, R2, and R8.
- **Status:** Merged; feature-level rubric criteria remain `NOT YET` until
  the Desktop and safety slices are complete.
- **Evidence:** [PR 37 boundary packet](pr-37/boundary.json)
- **Decision:** CLI exit-code bands remain presentation policy outside the
  canonical lifecycle service.

### PR #38 - Lifecycle deadlines and mutation exclusion

- **Scope:** I-2; P2; advances R4, R5, and R8.
- **Status:** Merged; feature-level rubric criteria remain `NOT YET` until
  Desktop migration and final native/interruption verification are complete.
- **Evidence:** [PR 38 boundary packet](pr-38/boundary.json)
- **Decisions:** Use a per-user Unix listener lease outside the purge root;
  apply one overall deadline with bounded child work and fresh recovery;
  represent an unchanged purge timeout as `failed`.

### PR #39 - Trusted Desktop lifecycle controller

- **Scope:** I-3; P4; advances R1, R3, and R8.
- **Status:** In review; feature-level rubric criteria remain `NOT YET` until
  Desktop close/diagnostic, packaging, and final native verification are complete.
- **Evidence:** [PR 39 boundary packet](pr-39/boundary.json)
- **Decision:** Expose only renderer-safe controller compatibility metadata;
  mismatches visibly suppress native lifecycle mutations while preserving reads.
