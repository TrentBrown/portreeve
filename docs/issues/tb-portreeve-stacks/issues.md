# Issues - tb-portreeve-stacks

**Feature:** `tb-portreeve-stacks` **Spec:** [`spec.md`](spec.md) **Plan:**
[`plan.md`](plan.md) **Created:** 2026-08-06

Operational task breakdown derived from the plan.

## I-1 - Establish canonical identities and stack definitions

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P1, P2
- **Rubric criteria:** R1, R5, R7
- **Depends on:** none
- **PR:** [#7](https://github.com/TrentBrown/portreeve/pull/7)

Migrate service identities without data loss, add strict version-1 definition
normalization and content-addressed revisions, persist stack registration, and expose
compatible apply and inspection contracts through the server, client, CLI, inventory,
and desktop port model.

**Started 2026-08-06.** The exact feature branch carries the first delivery slice after
design, specification, and plan approval.

**In review 2026-08-06.** R1 and R5 pass. The definition-registration portion of R7 is
complete and independently capability-gated; the full criterion remains open for I-2 and
I-3. The broad suite's one lifecycle-status failure reproduces at the base SHA and
awaits human acknowledgment in the PR boundary.

**Merged 2026-08-06.** PR #7 merged to `main` as `13db683`; the documented base-only
lifecycle test condition was accepted through human review and merge.

## I-2 - Implement generations and process-backed activations

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P3
- **Rubric criteria:** R2, R7
- **Depends on:** I-1
- **PR:** [#8](https://github.com/TrentBrown/portreeve/pull/8)

Add complete immutable allocation generations, exclusive activation attempts, atomic
batch leases, process-backed endpoint confirmation, required/optional outcomes, and the
corresponding protocol, client, CLI, and history surfaces.

**Started 2026-08-06.** Sequential delivery branch `tb-portreeve-stacks-02-activations`
begins from merged `main` at `13db683`.

**In review 2026-08-06.** Draft PR #8 contains P3's immutable generations,
process-backed activations, atomic batch leases, public coordination surfaces, and
focused verification. R2 is implemented for the process-backed scope; R7 advances
through the complete `stack-activations-v1` surface and remains open for P4-P7.

**Merged 2026-08-06.** PR #8 merged to `main` as `ca7b552`; its process-backed
activation contract and documented installed-launchd baseline were accepted through
human review and merge.

## I-3 - Deliver dependency resolution and sandbox discovery

- **Status:** in-progress
- **Estimate:** 2d
- **Plan steps:** P4
- **Rubric criteria:** R4, R7
- **Depends on:** I-2
- **PR:** -

Resolve scoped dependency aliases and host/Docker/sandbox address views from one
generation, generate redacted activation-scoped discovery documents, and add the
JavaScript snapshot reader and stale-plan safeguards.

**Started 2026-08-06.** Sequential delivery branch
`tb-portreeve-stacks-03-discovery` begins from merged `main` at `ca7b552`.

## I-4 - Add Docker evidence and mixed activations

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P5
- **Rubric criteria:** R3, R6
- **Depends on:** I-2
- **PR:** -

Implement the trusted Docker CLI adapter, activation labels and fresh inspect
verification, mixed process/container confirmation, capability degradation, and
unconditional refusal to signal Docker-managed host listeners.

## I-5 - Complete activation recovery and safe stack pruning

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P6
- **Rubric criteria:** R6
- **Depends on:** I-2, I-4
- **PR:** -

Reconcile launcher loss and surviving providers from fresh evidence, implement
evidence-gated activation ending, and add missing-worktree stack pruning with preview,
consent, revalidation, no-reclamation, and history retention.

## I-6 - Add the desktop Stacks experience and failure details

- **Status:** open
- **Estimate:** 3d
- **Plan steps:** P7
- **Rubric criteria:** R8
- **Depends on:** I-1, I-2, I-3, I-4, I-5
- **PR:** -

Build the approved desktop inspection and safe coordination workflows across the
main/preload/renderer boundary, preserve serialized fresh evidence, and surface
actionable lifecycle and stack errors without granting orchestration authority.

## I-7 - Complete integrated verification and feature evidence

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P8
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-3, I-5, I-6
- **PR:** -

Finish public documentation and representative examples, run mixed-stack and legacy
end-to-end matrices on supported native environments and the packaged desktop, execute
every workflow gate, and preserve the feature-final evidence and completion report.
