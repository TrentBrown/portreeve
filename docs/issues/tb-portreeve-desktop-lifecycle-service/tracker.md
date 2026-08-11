# Branch Tracker - tb-portreeve-desktop-lifecycle-service

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| #  | Criterion (short)             | Status  | PR  | Notes                         |
| -- | ----------------------------- | ------- | --- | ----------------------------- |
| R1 | Shared lifecycle authority    | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37), [#39](https://github.com/TrentBrown/portreeve/pull/39) | PR 39 removes the Desktop lifecycle subprocess adapter; final packaged and native evidence remains P6-P7. |
| R2 | Canonical result parity       | NOT YET | [#37](https://github.com/TrentBrown/portreeve/pull/37), [#40](https://github.com/TrentBrown/portreeve/pull/40) | PR 40 reduces canonical Desktop results without redefining outcomes and retains before/after evidence; final packaged/native parity remains P6-P7. |
| R3 | Trusted controller            | NOT YET | [#39](https://github.com/TrentBrown/portreeve/pull/39), [#40](https://github.com/TrentBrown/portreeve/pull/40) | PR 40 keeps activity and close authority in Electron main and makes preload packets strict; packaging evidence remains P6-P7. |
| R4 | Deadlines and recovery        | NOT YET | [#38](https://github.com/TrentBrown/portreeve/pull/38) | PR 38 adds bounded child, wait, operation, read, and recovery deadlines with deterministic partial/failed timeout evidence; final interruption evidence remains P7. |
| R5 | Cross-process exclusion       | NOT YET | [#38](https://github.com/TrentBrown/portreeve/pull/38) | PR 38 adds a purge-safe listener lease, prompt busy results, read concurrency, abandoned-owner recovery, and multi-process contention coverage; final native evidence remains P7. |
| R6 | Desktop lifecycle behavior    | NOT YET | [#40](https://github.com/TrentBrown/portreeve/pull/40) | PR 40 protects window and application close for named mutations while leaving purge preview nonblocking; packaged and interruption recovery remain P6-P7. |
| R7 | Safe diagnostics              | NOT YET | [#40](https://github.com/TrentBrown/portreeve/pull/40) | PR 40 adds complete copyable allowlisted packets and seeded leakage tests; final packaged/native failure evidence remains P7. |
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
- **Status:** Merged; feature-level rubric criteria remain `NOT YET` until
  Desktop close/diagnostic, packaging, and final native verification are complete.
- **Evidence:** [PR 39 boundary packet](pr-39/boundary.json)
- **Decision:** Expose only renderer-safe controller compatibility metadata;
  mismatches visibly suppress native lifecycle mutations while preserving reads.

### PR #40 - Desktop lifecycle safety and diagnostics

- **Scope:** I-4; P5; advances R2, R3, R6, and R7.
- **Status:** In review; feature-level rubric criteria remain `NOT YET` until
  packaging, complete runtime parity, and native interruption verification finish.
- **Evidence:** [PR 40 boundary packet](pr-40/boundary.json)
- **Decision:** Keep lifecycle activity and close authority in Electron main;
  expose only strict allowlisted diagnostic and activity packets through preload.
