# Branch Tracker - tb-portreeve-preview-release

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-16

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| R1 | Deterministic preparation boundary | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | Hosted preview rehearsal produced a complete inspectable workspace with publication disabled; negative transition and mutation tests pass. |
| R2 | Complete native and Desktop artifacts | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | Four native targets, two architecture-specific verified DMGs, client archive, checksums, formula, cask, and metadata are recorded across 13 artifacts. |
| R3 | Release record and exact-byte state machine | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | The downloaded record passed deterministic inspection, digest checks, ordered-stage validation, and changed-plan rejection. |
| R4 | Policy and publication gates | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | Rehearsal is alpha/preview/unsigned and unpublished; publish was skipped, stable finalization fails without Apple evidence, and fake publication guards pass. |
| R5 | One local/hosted engine with npm decoupled | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | Manual dispatch used the script-owned engine across all hosted jobs; npm was neither required nor published. |
| R6 | Direct-download and Homebrew lifecycle semantics | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | Downloaded candidate checksums and Ruby syntax pass; generated material preserves explicit supervision and purge semantics. |
| R7 | Alpha UX and safe installation guidance | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | README, Desktop, installation guide, release notes, and cask consistently expose alpha and unsigned-preview guidance with safe scoped macOS steps. |
| R8 | Operator entry points and drift protection | PASS | [#62](https://github.com/TrentBrown/portreeve/pull/62) | Runbook, project skill, local commands, hosted dispatch, and read-only candidate inspection share the release-record contract and pass drift tests. |

## PR Log

### PR #57 - Deterministic preparation foundation

- **PR:** [#57](https://github.com/TrentBrown/portreeve/pull/57)
- **Status:** merged
- **Scope:** P1 and preparation portions of P2-P3 / I-1-I-3: approved
  feature record, release state/policy schema, exact artifact identity,
  resumable non-publishing preparation, callable build-once stage, and
  coordinated release-tag support.
- **Evidence packet:** [pr-57](pr-57/)
- **Result:** Slice gates pass. R1-R8 remain cumulative `NOT YET`; later slices
  retain all incomplete native, Desktop, hosted, publication, UX, and operator
  documentation work.

### PR #58 - Portable native artifact evidence

- **PR:** [#58](https://github.com/TrentBrown/portreeve/pull/58)
- **Status:** merged
- **Scope:** P3 / I-3: native verification fragments bound to the release,
  source commit, target, and exact promoted executable identity; deterministic
  four-target aggregation; and compatibility support for verifying an explicit
  prepared artifact directory without rebuilding.
- **Evidence packet:** [pr-58](pr-58/)
- **Result:** Pending slice gates. R2, R3, and R5 gain native-evidence
  transport and aggregation, but hosted matrix execution remains for P6/P9.

### PR #59 - Desktop DMGs and Homebrew distribution

- **PR:** [#59](https://github.com/TrentBrown/portreeve/pull/59)
- **Status:** merged
- **Scope:** P4-P5 / I-4-I-5: explicit promoted-CLI Desktop packaging,
  architecture-specific verified apps and DMGs, exact embedded-artifact
  attestation, Desktop evidence joining, unsigned-preview/stable trust policy,
  Homebrew cask rendering, and final distribution checksums.
- **Evidence packet:** [pr-59](pr-59/)
- **Result:** Slice gates passed. R2, R3, R4, and R6 gain the complete Desktop
  and direct-download distribution model; native Intel smoke and hosted
  transport remain P6/P9 evidence.

### PR #60 - Hosted evidence and gated publication

- **PR:** [#60](https://github.com/TrentBrown/portreeve/pull/60)
- **Status:** merged
- **Scope:** P2 and P6 / I-2 and I-6: build-once hosted artifact transport,
  native and Desktop evidence joins, separately environment-gated publication,
  retry-safe remote adapters, npm decoupling, and channel-aware Desktop update
  identity bound into the packaged application.
- **Evidence packet:** [pr-60](pr-60/)
- **Result:** Slice gates passed. R1, R3, R4, R5, R6, and R8 gain the common
  local/hosted publication engine; public mutation remains unexecuted and the
  alpha UX, operator runbook, and final hosted rehearsal remain P7-P9.

### PR #61 - Alpha preview UX and operator entry point

- **PR:** [#61](https://github.com/TrentBrown/portreeve/pull/61)
- **Status:** merged
- **Scope:** P7-P8 / I-7-I-8: persistent README/Desktop alpha identity, safe
  unsigned installation and removal guidance, release-note and cask caveats,
  one script-owned operator runbook, and a project-local release skill that
  preserves the publication gate.
- **Evidence packet:** [pr-61](pr-61/)
- **Result:** Slice gates passed. R7 and R8 gain their user and operator
  surfaces; the complete hosted rehearsal and feature-final evaluation remain
  P9 / I-9.

### PR #62 - Complete preview release rehearsal

- **PR:** [#62](https://github.com/TrentBrown/portreeve/pull/62)
- **Status:** in review
- **Scope:** Feature-final P9 / I-9: read-only downloaded-candidate inspection,
  complete hosted unsigned-preview preparation across four native targets and
  two Desktop architectures, stable-negative coverage, and cumulative
  acceptance/rubric evaluation.
- **Evidence packet:** [pr-62](pr-62/)
- **Hosted rehearsal:** [run 32039385981](https://github.com/TrentBrown/portreeve/actions/runs/32039385981)
- **Result:** PASS. All eight rubric criteria are satisfied. Publication stayed
  disabled, the publish job was skipped, and no tag, GitHub Release, tap, update
  publication, or npm mutation occurred.
