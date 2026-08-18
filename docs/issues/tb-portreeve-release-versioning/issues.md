# Issues - tb-portreeve-release-versioning

**Feature:** `tb-portreeve-release-versioning`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-18

Operational task breakdown derived from the plan.

## I-1 - Establish coordinated version mechanics

- **Status:** in-review
- **Estimate:** 2h
- **Plan steps:** P1, P2
- **Rubric criteria:** R1, R2, R4
- **Depends on:** none
- **PR:** [#72](https://github.com/TrentBrown/portreeve/pull/72)

Validate release/source compatibility, inject the release identity into compiled
CLI artifacts, and stage the client archive with the same identity.

## I-2 - Coordinate Desktop and installer identity

- **Status:** in-review
- **Estimate:** 2h
- **Plan steps:** P3
- **Rubric criteria:** R2, R3
- **Depends on:** I-1
- **PR:** [#72](https://github.com/TrentBrown/portreeve/pull/72)

Use coordinated release identity for Desktop runtime/update surfaces, DMGs, and
the Homebrew cask while preserving numeric Apple bundle metadata.

## I-3 - Verify and document release versioning

- **Status:** in-review
- **Estimate:** 2h
- **Plan steps:** P4
- **Rubric criteria:** R1-R5
- **Depends on:** I-1, I-2
- **PR:** [#72](https://github.com/TrentBrown/portreeve/pull/72)

Update the runbook and exercise focused, runtime, Homebrew, and full checks.
