# Issues - tb-portreeve-pr-publication

**Feature:** `tb-portreeve-pr-publication`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-17

Operational task breakdown derived from the plan.

## I-1 - Build the deterministic repository PR adapter

- **Status:** in-review
- **Estimate:** 1d
- **Plan steps:** P1
- **Rubric criteria:** R2, R3
- **Depends on:** none
- **PR:** [#65](https://github.com/TrentBrown/portreeve/pull/65)

Implement and exhaustively test the reusable GitHub ref/file/PR/merge state machine with
no real public mutation.

## I-2 - Route publication through exact PRs

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P2, P3
- **Rubric criteria:** R1, R2, R3, R4
- **Depends on:** I-1
- **PR:** -

Replace both direct repository mutation paths, preserve release-first ordering, and
prove idempotent partial-publication recovery.

## I-3 - Persist complete and compatible publication evidence

- **Status:** open
- **Estimate:** 0.5d
- **Plan steps:** P4
- **Rubric criteria:** R5
- **Depends on:** I-2
- **PR:** -

Record PR URLs and merge commits for new releases without fabricating them for the
completed first preview.

## I-4 - Align hosted authority and operator surfaces

- **Status:** open
- **Estimate:** 0.5d
- **Plan steps:** P5, P6
- **Rubric criteria:** R6, R7
- **Depends on:** I-2, I-3
- **PR:** -

Update workflow permissions, contracts, plan text, runbook, credential guidance, and
the project-local release skill.

## I-5 - Verify and close the feature

- **Status:** open
- **Estimate:** 0.5d
- **Plan steps:** P7
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7
- **Depends on:** I-1, I-2, I-3, I-4
- **PR:** -

Run focused and broad verification plus every required PR-boundary and final feature
gate.
