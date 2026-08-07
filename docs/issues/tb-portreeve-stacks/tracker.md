# Branch Tracker - tb-portreeve-stacks

**Spec:** [`spec.md`](spec.md) **Plan:** [`plan.md`](plan.md) **Issues:**
[`issues.md`](issues.md) **Created:** 2026-08-06

## Rubric Status

| #   | Criterion (short)           | Status  | PR    | Notes                                                         |
| --- | --------------------------- | ------- | ----- | ------------------------------------------------------------- |
| R1  | Definition and identity     | PASS    | #7    | Strict canonical definitions and revisions                    |
| R2  | Allocation and activation   | PASS    | #8    | P3 complete for process-backed activations                    |
| R3  | Ownership confirmation      | PASS    | #10   | Mixed process/Docker evidence and capability behavior pass    |
| R4  | Discovery isolation         | PASS    | #9    | Scoped, redacted, generation-aware discovery                  |
| R5  | Compatibility and migration | PASS    | #7    | Legacy aliases and relational migration pass                  |
| R6  | Safety and recovery         | PASS    | #10-#11 | Docker refusal, recovery, consent, and revalidation pass      |
| R7  | Client, CLI, and protocol   | PASS    | #7-#11 | Complete capability-gated coordination contract               |
| R8  | Desktop                     | PASS    | #12   | Safe stack inspection/actions and actionable failures pass    |

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
- **Status:** merged
- **Scope:** P3 complete immutable allocation generations, exact/preferred allocation,
  exclusive process-backed activations, atomic renewable endpoint leases,
  required/optional outcomes, evidence-backed confirmation and ending, and matching
  protocol/client/CLI/documentation surfaces.
- **Evidence packet:** [pr-8](pr-8/)
- **Result:** R2 passes for the complete process-backed activation scope. R7 advances
  through the independently capability-gated `stack-activations-v1` surface and remains
  open for dependency discovery, Docker, recovery and pruning, and desktop work.
  Independent judge: PASS WITH CONCERNS; code review: PASS with no remaining findings.
  The one lifecycle-status failure is the unchanged installed-launchd baseline accepted
  with PR #7.

### PR #9 - Scoped dependency and sandbox discovery

- **PR:** [#9](https://github.com/TrentBrown/portreeve/pull/9)
- **Status:** merged
- **Scope:** P4 component-scoped own and dependency resolution, distinct host and
  Docker-network facts, launcher-rendered sandbox gateway views, deterministic redacted
  discovery documents, atomic private file replacement, stale-aware JavaScript reading,
  and matching protocol/client/CLI/documentation surfaces.
- **Evidence packet:** [pr-9](pr-9/)
- **Result:** R4 passes. R7 advances through the independently capability-gated
  `stack-discovery-v1` surface and remains open for Docker, recovery and pruning, and
  desktop work. Independent judge: PASS WITH CONCERNS; code review: PASS with no
  findings. The broad suite's one lifecycle-status failure is the unchanged
  installed-launchd baseline accepted with PRs #7 and #8.

### PR #10 - Docker evidence and mixed activations

- **PR:** [#10](https://github.com/TrentBrown/portreeve/pull/10)
- **Status:** merged
- **Scope:** P5 dynamic `docker-evidence-v1` capability, per-component process/Docker
  placement, exact activation labels, fresh container and host-publication confirmation,
  schema-v5 Docker run evidence, Docker-managed inventory, launcher-only reclamation,
  and matching official client, CLI, diagnostics, and documentation surfaces.
- **Evidence packet:** [pr-10](pr-10/)
- **Result:** R3 passes. R6 advances through unconditional Docker process-signal refusal
  but remains open for P6 recovery and pruning. R7 advances through the independently
  capability-gated Docker surface and remains open for P6-P7. Independent judge: PASS
  WITH CONCERNS; code review: PASS with no remaining findings. The pinned Bun 1.3.14
  gate passes all 206 tests, and a temporary real Docker Desktop container completed the
  full apply/prepare/begin/confirm/inventory path before being removed. Merged to `main`
  as `655f1ac` on 2026-08-06.

### PR #11 - Activation recovery and safe stack pruning

- **PR:** [#11](https://github.com/TrentBrown/portreeve/pull/11)
- **Status:** merged
- **Scope:** P6 fresh process and Docker provider reconciliation, persisted non-live
  lost activations, evidence-gated ending, previewed and consent-gated missing-worktree
  stack pruning, execution-time revalidation, atomic coordination/claim deletion,
  retained history, and matching protocol, client, CLI, compiled-runtime, and
  documentation surfaces.
- **Evidence packet:** [pr-11](pr-11/)
- **Result:** R6 passes across P5-P6 safety and recovery. R7 passes across the complete
  protocol, official JavaScript client, Commander CLI, capability, compiled-runtime, and
  documentation contract. Independent judge: PASS WITH CONCERNS; code review: PASS with
  no remaining findings. The pinned Bun 1.3.14 gate passes all 214 tests with 865
  assertions. Desktop Stacks controls and actionable GUI failure details remain R8 in
  I-6/P7.
- **Merged:** `3ecd8a5` on 2026-08-06.

### PR #12 - Desktop stack coordination

- **PR:** [#12](https://github.com/TrentBrown/portreeve/pull/12)
- **Status:** merged
- **Scope:** P7 desktop Stacks views, definition apply, preparation, reconciliation,
  evidence-gated activation ending, snapshot/address copy, previewed confirmed pruning,
  actionable failures, and the aggregate read-only stack-status surface used by the
  desktop adapter.
- **Evidence packet:** [pr-12](pr-12/)
- **Result:** R8 passes. The pinned Bun 1.3.14 gate passes all 224 tests with 908
  assertions; the standalone release and macOS ARM64 desktop package build; and the
  packaged app applied a temporary definition and prepared its generation before the
  test stack and claims were pruned. Independent judge: PASS WITH CONCERNS; code review:
  PASS with no remaining findings. Native Linux and assembled mixed-stack release
  verification remain I-7/P8.
- **Merged:** `0fc3865` on 2026-08-07.

### PR #13 - Feature-final stack verification

- **PR:** [#13](https://github.com/TrentBrown/portreeve/pull/13)
- **Status:** in review
- **Scope:** P8 public desktop and representative launcher documentation, assembled
  process/Docker apply-through-prune verification, Linux kernel-NAT evidence correction,
  complete native release matrix, packaged desktop smoke, and feature-final gates.
- **Evidence packet:** [pr-13](pr-13/)
- **Result:** AC1-AC8 and R1-R8 pass with zero `NOT YET` or `FAIL`. The pinned Bun
  1.3.14 gate passes 225 tests and 930 assertions. Real mixed-stack verification passes
  on macOS Docker Desktop and hosted Linux x64/ARM64; native lifecycle and release gates
  pass on macOS x64/ARM64 and Linux x64/ARM64. Independent judge: PASS. Code review:
  PASS with no findings. Retention: tracked with no decision required.
