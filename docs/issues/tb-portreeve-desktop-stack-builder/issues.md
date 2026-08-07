# Issues - tb-portreeve-desktop-stack-builder

**Feature:** `tb-portreeve-desktop-stack-builder`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-07

Operational task breakdown derived from the plan.

## I-1 - Replace the public stack identity contract

- **Status:** in-review
- **Estimate:** 1d
- **Plan steps:** P1
- **Rubric criteria:** R1, R8
- **Depends on:** none
- **PR:** [#14](https://github.com/TrentBrown/portreeve/pull/14)

Replace stack-specific public vocabulary and canonicalization across schemas, protocol,
client runtime/types, server routes, fixtures, and contract documentation while
preserving standalone claim behavior.

## I-2 - Enforce stack-root and live-activation safety

- **Status:** in-review
- **Estimate:** 1d
- **Plan steps:** P2
- **Rubric criteria:** R1, R3, R8
- **Depends on:** I-1
- **PR:** [#14](https://github.com/TrentBrown/portreeve/pull/14)

Implement persistence mapping, non-overlapping root enforcement, exact-root adoption,
missing-root pruning, and changed-apply refusal under live activation with concurrency
tests.

## I-3 - Deliver stack-root CLI discovery

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P3
- **Rubric criteria:** R1, R2, R8
- **Depends on:** I-1, I-2
- **PR:** -

Update CLI flags, help, discovery, registered-root fallback, output, and integration
coverage for non-Git parent roots with child repositories.

## I-4 - Build the trusted desktop document boundary

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P4
- **Rubric criteria:** R4, R6, R7, R8
- **Depends on:** I-1, I-2
- **PR:** -

Add main-process document and filesystem handling, strict schemas and IPC, conflict and
recovery outcomes, safe atomic writes, apply retry support, and capability-reduction
tests.

## I-5 - Implement the complete editor model

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P5
- **Rubric criteria:** R5, R6
- **Depends on:** I-1
- **PR:** -

Implement full-schema drafts, stable identities, dependency-aware rename/delete,
progressive validation, concise serialization, and exact preview with focused unit tests.

## I-6 - Deliver the dedicated Stacks-tab editor

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P6, P7
- **Rubric criteria:** R3, R4, R5, R6, R7, R8
- **Depends on:** I-3, I-4, I-5
- **PR:** -

Build and integrate the in-tab UI, entry actions, accessible fields and confirmations,
dirty guards, file recovery, save/apply outcomes, retry, live-activation refusal, and
explicit preparation behavior.

## I-7 - Verify and document the assembled feature

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P8
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-3, I-6
- **PR:** -

Update all user and contract documentation, run the complete automated and packaged
runtime matrix, perform focused manual desktop acceptance, evaluate the full rubric, and
produce the completion report at the final real delivery PR.
