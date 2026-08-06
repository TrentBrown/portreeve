# Branch Tracker - tb-portreeve-stacks

**Spec:** [`spec.md`](spec.md) **Plan:** [`plan.md`](plan.md) **Issues:**
[`issues.md`](issues.md) **Created:** 2026-08-06

## Rubric Status

| #   | Criterion (short)           | Status  | PR  | Notes                                          |
| --- | --------------------------- | ------- | --- | ---------------------------------------------- |
| R1  | Definition and identity     | PASS    | #7  | Strict canonical definitions and revisions     |
| R2  | Allocation and activation   | NOT YET | -   | Planned for P3 / I-2                           |
| R3  | Ownership confirmation      | NOT YET | -   | Planned for P5 / I-4                           |
| R4  | Discovery isolation         | NOT YET | -   | Planned for P4 / I-3                           |
| R5  | Compatibility and migration | PASS    | #7  | Legacy aliases and relational migration pass   |
| R6  | Safety and recovery         | NOT YET | -   | Planned for P5-P6 / I-4-I-5                    |
| R7  | Client, CLI, and protocol   | NOT YET | #7  | Definition sub-surface delivered; P3-P4 remain |
| R8  | Desktop                     | NOT YET | -   | Planned for P7 / I-6                           |

## PR Log

Append PR boundary entries here.

### PR #7 - Canonical endpoint identity and stack definitions

- **PR:** [#7](https://github.com/TrentBrown/portreeve/pull/7)
- **Status:** merged
- **Scope:** P1-P2 claim identity migration, strict stack definitions, content-addressed
  revisions, atomic registration, compatible claims, protocol/client/CLI surfaces, and
  desktop inventory facts.
- **Evidence packet:** [pr-7](pr-7/)
- **Result:** R1 and R5 pass. R7 advances through a complete `stack-definitions-v1`
  surface but remains open for activation and discovery. Independent judge: PASS WITH
  CONCERNS; code review: PASS with no remaining findings. One lifecycle-status test
  failure reproduces on the pinned base under this account's installed launchd state and
  was accepted through human review and merge.

### PR #8 - Immutable generations and process-backed activations

- **PR:** [#8](https://github.com/TrentBrown/portreeve/pull/8)
- **Status:** draft
- **Scope:** P3 complete immutable allocation generations, exact/preferred allocation,
  exclusive process-backed activations, atomic renewable endpoint leases,
  required/optional outcomes, evidence-backed confirmation and ending, and matching
  protocol/client/CLI/documentation surfaces.
- **Result:** Pending PR-boundary verification, specification evaluation, independent
  judge, and code review. R2 is implemented for the process-backed scope. R7 advances
  through `stack-activations-v1` and remains open for dependency discovery, Docker,
  recovery/pruning, and desktop work.
