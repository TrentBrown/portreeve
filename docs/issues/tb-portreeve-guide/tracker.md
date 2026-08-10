# Branch Tracker - tb-portreeve-guide

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Five-tab navigation and naming | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | Exact navigation order, plural collection wording, and singular detail wording verified. |
| R2 | Guide navigation behavior | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | Exclusive Guide activation and existing dirty-editor guards verified. |
| R3 | Responsibility boundary | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | Visible address/lifecycle and ownership/readiness boundaries verified. |
| R4 | Three integration paths | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | Good, Better, and Best paths and runtime tradeoffs verified. |
| R5 | Architecture and deep dives | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | Semantic architecture and all required disclosure groups verified. |
| R6 | Offline trust boundary | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | No privileged, remote, dependency, or live-state surface added. |
| R7 | Responsive accessible presentation | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | Packaged normal/720px runtime and accessibility inspection passed. |
| R8 | Documentation and regression coverage | PASS | [#36](https://github.com/TrentBrown/portreeve/pull/36) | Desktop docs and focused/broad regression evidence recorded. |

## PR Log

### PR #36 - Desktop Guide and Launchers naming

- **PR:** [#36](https://github.com/TrentBrown/portreeve/pull/36)
- **Status:** in review
- **Scope:** P1-P5 / I-1-I-2 and feature-final evaluation: plural collection naming,
  static Guide orientation, Good/Better/Best integration paths, semantic architecture,
  expandable concepts, responsive presentation, public documentation, and regressions.
- **Evidence packet:** [pr-36](pr-36/)
- **Result:** R1-R8 are `PASS`; zero `NOT YET` or `FAIL` criteria remain. Pinned Bun
  typecheck, lint, changed-file formatting, 19 focused tests with 238 assertions,
  release build, desktop package, normal/minimum-width packaged-app acceptance, and
  native disclosure interaction pass. Three broad-suite lifecycle failures are caused
  by the real active launchd service and do not import the changed Guide surface.
  Feature-record retention is tracked. Judge: PASS. Code review: no findings.
