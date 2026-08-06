# Issues - tb-portreeve-stacks

**Feature:** `tb-portreeve-stacks` **Spec:** [`spec.md`](spec.md) **Plan:**
[`plan.md`](plan.md) **Created:** 2026-08-06

Operational task breakdown derived from the plan.

## I-1 - Establish canonical identities and stack definitions

- **Status:** in-progress
- **Estimate:** 3d
- **Plan steps:** P1, P2
- **Rubric criteria:** R1, R5, R7
- **Depends on:** none
- **PR:** -

Migrate service identities without data loss, add strict version-1 definition
normalization and content-addressed revisions, persist stack registration, and expose
compatible apply and inspection contracts through the server, client, CLI, inventory,
and desktop port model.

**Started 2026-08-06.** The exact feature branch carries the first delivery slice after
design, specification, and plan approval.

## I-2 - Implement generations and process-backed activations

- **Status:** open
- **Estimate:** 3d
- **Plan steps:** P3
- **Rubric criteria:** R2, R7
- **Depends on:** I-1
- **PR:** -

Add complete immutable allocation generations, exclusive activation attempts, atomic
batch leases, process-backed endpoint confirmation, required/optional outcomes, and the
corresponding protocol, client, CLI, and history surfaces.

## I-3 - Deliver dependency resolution and sandbox discovery

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P4
- **Rubric criteria:** R4, R7
- **Depends on:** I-2
- **PR:** -

Resolve scoped dependency aliases and host/Docker/sandbox address views from one
generation, generate redacted activation-scoped discovery documents, and add the
JavaScript snapshot reader and stale-plan safeguards.

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
