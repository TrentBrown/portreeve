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
| R4 | Desktop containment | PASS | [#22](https://github.com/TrentBrown/portreeve/pull/22) | P6-P7/I-6 adds both entry points, a guarded dedicated view, opaque document calls only, containment tests, and packaged macOS smoke |
| R5 | Complete editor | PASS | [#22](https://github.com/TrentBrown/portreeve/pull/22) | P5-P7 expose every current schema field, automatic/preferred/exact allocation controls, stable rename propagation, and confirmation-gated cascading deletion |
| R6 | Validation and output | PASS | [#22](https://github.com/TrentBrown/portreeve/pull/22) | Progressive inline and summary validation, first-error focus, latest-valid preview, and exact concise save bytes pass focused tests and packaged UI smoke |
| R7 | File safety and recovery | PASS | [#22](https://github.com/TrentBrown/portreeve/pull/22) | P4 trusted exclusive/atomic/conflict primitives are now wired to visible overwrite/cancel and missing/invalid recovery flows without renderer path authority |
| R8 | Save/apply lifecycle | PASS | [#22](https://github.com/TrentBrown/portreeve/pull/22) | Save-before-apply, visible failure details, saved-not-applied persistence, clean-baseline retry, successful retry, live refusal, and explicit preparation are actionable in the packaged app |

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

### PR #16 - Trusted desktop definition-document boundary

- **PR:** [#16](https://github.com/TrentBrown/portreeve/pull/16)
- **Status:** merged 2026-08-07 (`0654648f3ef348ed02c1cbbbb58ecc528a57d268`)
- **Scope:** P4 / I-4: canonical directory and known-stack resolution, opaque document
  and conflict capabilities, bounded strict validation, exclusive create, atomic
  replacement, safe invalid-file recovery, save-before-apply, and evidence-checked retry.
- **Evidence packet:** [pr-16](pr-16/)
- **Result:** R4, R6, R7, and R8 advance but correctly remain `NOT YET` pending the
  editor model and visible P5-P8 flows. The pinned native Bun gate passes 245 tests and
  1,043 assertions; the focused desktop boundary suite passes 28 tests and 143
  assertions. The final source packages and reaches a loaded renderer. Independent
  judge: PASS. Code review: PASS with no findings.

### PR #21 - Desktop stack editor draft model

- **PR:** [#21](https://github.com/TrentBrown/portreeve/pull/21)
- **Status:** merged 2026-08-08 (`62cad2e05f159b085644c34a3180e2a3a9208099`)
- **Scope:** P5 / I-5: full-schema renderer drafts, stable component, endpoint, and
  dependency identities, allocation modes, dependency-safe rename/delete, progressive
  validation, latest-valid preview, and deterministic concise serialization.
- **Evidence packet:** [pr-21](pr-21/)
- **Result:** R5 and R6 advance but correctly remain `NOT YET` pending the visible and
  accessible P6-P8 editor. The pinned native Bun gate passes 253 tests and 1,084
  assertions; the focused model/security suite passes 13 tests and 64 assertions.

### PR #22 - Desktop stack definition editor

- **PR:** [#22](https://github.com/TrentBrown/portreeve/pull/22)
- **Status:** merged 2026-08-08 (`bd70b34bffdcb5115527278c7ac42fb63f49cf83`)
- **Scope:** P6-P7 / I-6: both Stacks-tab editor entry points, a dedicated guarded
  view, complete accessible field controls, exact preview, trusted save/apply and
  overwrite flows, missing/invalid recovery, visible failure details, and clean-baseline
  retry.
- **Evidence packet:** [pr-22](pr-22/)
- **Result:** R4-R8 pass. The full suite passed 299 tests and 1,277 assertions before
  the final retry-visibility review correction; the exact final retry source passes
  typecheck, lint, and the focused editor/security suite with 16 tests and 91
  assertions. The release and desktop package build, and packaged macOS smoke covers
  creation, validation focus, preview, dirty guards, save/apply failure details,
  successful retry, direct editing, advanced fields, and window-close discard behavior.

### PR #23 - Assembled feature completion

- **PR:** [#23](https://github.com/TrentBrown/portreeve/pull/23)
- **Status:** draft
- **Scope:** P8 / I-7 and the complete feature: final public contract, migration,
  safety, troubleshooting, launcher-boundary, release, mixed-stack, and packaged desktop
  acceptance documentation; active-host test-port robustness; feature-wide evaluation.
- **Evidence packet:** [pr-23](pr-23/)
- **Result:** Pending the formal feature-final evidence packet. Retention is already
  confirmed tracked; every current feature-record file is in Git.
