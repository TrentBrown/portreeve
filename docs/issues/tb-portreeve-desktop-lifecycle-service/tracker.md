# Branch Tracker - tb-portreeve-desktop-lifecycle-service

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| #  | Criterion (short)             | Status  | PR  | Notes                         |
| -- | ----------------------------- | ------- | --- | ----------------------------- |
| R1 | Shared lifecycle authority    | PASS | [#37](https://github.com/TrentBrown/portreeve/pull/37), [#39](https://github.com/TrentBrown/portreeve/pull/39), [#41](https://github.com/TrentBrown/portreeve/pull/41), [#42](https://github.com/TrentBrown/portreeve/pull/42) | CLI and Desktop share the lifecycle service; package inspection excludes the retired adapter; native launchd and systemd-user mutations pass with the verified executable. |
| R2 | Canonical result parity       | PASS | [#37](https://github.com/TrentBrown/portreeve/pull/37), [#40](https://github.com/TrentBrown/portreeve/pull/40), [#42](https://github.com/TrentBrown/portreeve/pull/42) | Shared contracts and CLI/Desktop adapters preserve canonical outcomes and before/after evidence; the complete regression suite passes. |
| R3 | Trusted controller            | PASS | [#39](https://github.com/TrentBrown/portreeve/pull/39), [#40](https://github.com/TrentBrown/portreeve/pull/40), [#41](https://github.com/TrentBrown/portreeve/pull/41), [#42](https://github.com/TrentBrown/portreeve/pull/42) | Fixed main-process authority, strict renderer boundary, exact version enforcement, no-downgrade coverage, and packaged/native checks all pass. |
| R4 | Deadlines and recovery        | PASS | [#38](https://github.com/TrentBrown/portreeve/pull/38), [#42](https://github.com/TrentBrown/portreeve/pull/42) | Service-owned bounds and fresh after-evidence pass deterministic tests; SIGKILL recovery proves a subsequent service instance can safely proceed. |
| R5 | Cross-process exclusion       | PASS | [#38](https://github.com/TrentBrown/portreeve/pull/38), [#42](https://github.com/TrentBrown/portreeve/pull/42) | A real second process holds the Unix listener lease; contenders are refused promptly, reads remain live, and abandoned ownership is recovered without PID authority. |
| R6 | Desktop lifecycle behavior    | PASS | [#40](https://github.com/TrentBrown/portreeve/pull/40), [#42](https://github.com/TrentBrown/portreeve/pull/42) | The actual coordinator mutation blocks both window close and application quit until settlement; forced interruption recovery uses fresh service evidence. |
| R7 | Safe diagnostics              | PASS | [#40](https://github.com/TrentBrown/portreeve/pull/40), [#42](https://github.com/TrentBrown/portreeve/pull/42) | Complete allowlisted diagnostic packets and leakage tests pass through main, preload, and renderer boundaries in the full suite. |
| R8 | Compatibility and native parity | PASS | [#37](https://github.com/TrentBrown/portreeve/pull/37), [#39](https://github.com/TrentBrown/portreeve/pull/39), [#41](https://github.com/TrentBrown/portreeve/pull/41), [#42](https://github.com/TrentBrown/portreeve/pull/42) | Bun/Electron contracts, compiled CLI, packaged Desktop, macOS launchd, Linux systemd-user, Docker stack, and Homebrew gates pass on the exact source commit. |

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
- **Status:** Merged; feature-level rubric criteria remain `NOT YET` until
  packaging, complete runtime parity, and native interruption verification finish.
- **Evidence:** [PR 40 boundary packet](pr-40/boundary.json)
- **Decision:** Keep lifecycle activity and close authority in Electron main;
  expose only strict allowlisted diagnostic and activity packets through preload.

### PR #41 - Desktop packaging and runtime parity

- **Scope:** I-5; P6; advances R1, R3, and R8.
- **Status:** Merged; feature-level rubric criteria remain `NOT YET` until
  final native lifecycle and interruption verification completes.
- **Evidence:** [PR 41 boundary packet](pr-41/boundary.json)
- **Decision:** Fail packaging on controller/artifact drift, inspect the final
  ASAR and module graph, and keep the packaged startup smoke read-only and
  isolated.

### PR #42 - Native verification and feature completion

- **Scope:** I-6; P7; completes R1-R8 and the cumulative feature evaluation.
- **Status:** In review; this is the final feature PR and requires explicit
  human approval before merge.
- **Evidence:** [PR 42 boundary packet](pr-42/boundary.json)
- **Result:** The exact source commit passed 422 tests and 2,059 assertions,
  real-process SIGKILL recovery, coordinator close protection, packaged and
  dual-runtime checks, and the four-host native GitHub matrix. Zero `NOT YET`
  or `FAIL` rubric criteria remain.
- **Decision:** Verify interruption recovery at the service boundary, Desktop
  close behavior through the real coordinator, and native supervisor mutation
  through the isolated release matrix rather than shipping a privileged
  packaged-app mutation hook.
