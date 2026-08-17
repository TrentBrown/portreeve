# Issues - tb-portreeve-preview-release

**Feature:** `tb-portreeve-preview-release`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-16

Operational task breakdown derived from the plan.

## I-1 - Release record and transition engine

- **Status:** closed
- **Estimate:** 1d
- **Plan steps:** P1
- **Rubric criteria:** R1, R3, R4
- **Depends on:** none
- **PR:** [#57](https://github.com/TrentBrown/portreeve/pull/57)

Create the versioned schema, atomic record store, policy matrix, transition
validation, tamper detection, and unit fixtures.

## I-2 - Prepare and publish commands

- **Status:** closed
- **Estimate:** 1d
- **Plan steps:** P2
- **Rubric criteria:** R1, R3, R4, R8
- **Depends on:** I-1
- **PR:** [#60](https://github.com/TrentBrown/portreeve/pull/60)

Create script entry points, versioned workspaces, publication plans, explicit
confirmation/immutability checks, and fake remote adapters.

## I-3 - Promoted native artifacts

- **Status:** closed
- **Estimate:** 1d
- **Plan steps:** P3
- **Rubric criteria:** R2, R3, R5
- **Depends on:** I-1, I-2
- **PR:** [#58](https://github.com/TrentBrown/portreeve/pull/58)

Refactor the current build/verify scripts into build-once record stages and
merge native verification evidence without rebuilding.

## I-4 - Dual-architecture Desktop DMGs

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P4
- **Rubric criteria:** R2, R3, R4, R6
- **Depends on:** I-3
- **PR:** [#59](https://github.com/TrentBrown/portreeve/pull/59)

Package ARM64/x64 Desktop applications from exact CLI bytes, generate and
verify DMGs, and add signing/notarization policy hooks plus native smokes.

## I-5 - Homebrew distribution material

- **Status:** closed
- **Estimate:** 1d
- **Plan steps:** P5
- **Rubric criteria:** R2, R6
- **Depends on:** I-3, I-4
- **PR:** [#59](https://github.com/TrentBrown/portreeve/pull/59)

Generate and verify the formula/cask/publication-plan material while preserving
explicit supervision and purge semantics.

## I-6 - Hosted release orchestration

- **Status:** closed
- **Estimate:** 1.5d
- **Plan steps:** P6
- **Rubric criteria:** R3, R4, R5, R6
- **Depends on:** I-3, I-4, I-5
- **PR:** [#60](https://github.com/TrentBrown/portreeve/pull/60)

Convert GitHub Actions to the common staged engine, native matrix, record
aggregation, explicit publication gate, npm decoupling, and channel-aware update
metadata.

## I-7 - Alpha preview user experience

- **Status:** in-review
- **Estimate:** 1d
- **Plan steps:** P7
- **Rubric criteria:** R7
- **Depends on:** I-2, I-4, I-5
- **PR:** [#61](https://github.com/TrentBrown/portreeve/pull/61)

Add README/Desktop alpha status and safe unsigned installation, service,
uninstall, purge, release-note, and Homebrew caveat guidance with regression
coverage.

## I-8 - Operator runbook and release skill

- **Status:** in-review
- **Estimate:** 1d
- **Plan steps:** P8
- **Rubric criteria:** R8
- **Depends on:** I-2, I-6
- **PR:** [#61](https://github.com/TrentBrown/portreeve/pull/61)

Add the release runbook, project-local Codex skill, help and workflow examples,
and drift tests that keep every invocation surface aligned.

## I-9 - Full release rehearsal and final verification

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P9
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-6, I-7, I-8
- **PR:** -

Exercise the complete unsigned preview preparation and stable-negative paths,
collect native CI evidence, run final rubric/judge/review gates, and stop before
real public publication pending explicit approval.
