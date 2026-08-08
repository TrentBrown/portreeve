# Issues - tb-portreeve-launcher

**Feature:** `tb-portreeve-launcher`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-08

Operational task breakdown derived from the plan.

## I-1 - Define launcher configuration and trust

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P1
- **Rubric criteria:** R1, R2, R8
- **Depends on:** none
- **PR:** [#25](https://github.com/TrentBrown/portreeve/pull/25)

Implement the strict launcher document, endpoint-reference validation, safe discovery,
contained paths, atomic editing, exact-revision trust, private shared state, and reset
retention behavior without executing project commands.

## I-2 - Add daemon operation coordination

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P2
- **Rubric criteria:** R6, R7, R8
- **Depends on:** none
- **PR:** [#26](https://github.com/TrentBrown/portreeve/pull/26)

Add the database migration, public protocol capability, official-client surface,
transactional operation sessions, renewable credentials, lost-session expiry, bounded
safe metadata, and recent history.

## I-3 - Implement environment and evidence services

- **Status:** in-progress
- **Estimate:** 1d
- **Plan steps:** P3
- **Rubric criteria:** R2, R3, R5, R6, R8
- **Depends on:** I-1, I-2
- **PR:** -

Resolve current endpoint-derived values and approved context, cache only nonsecret facts,
and classify fresh daemon or explicitly local listener and activation evidence.

## I-4 - Implement finite command-only execution

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P4
- **Rubric criteria:** R3, R6, R7, R8
- **Depends on:** I-2, I-3
- **PR:** -

Build safe POSIX command sessions, timeouts and cancellation, bounded output, structured
results, lifecycle admission, evidence-gated Start, project-command-only Stop, advisory
Status, and composed Restart.

## I-5 - Deliver launcher CLI commands

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P5
- **Rubric criteria:** R1, R2, R3, R6, R8
- **Depends on:** I-1, I-3, I-4
- **PR:** -

Add init, validate, trust, start, stop, restart, and status with discovery, interactive
review, confirmations, stable automation output, and compiled macOS/Linux coverage.

## I-6 - Add attached and verified execution

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P6
- **Rubric criteria:** R4, R5, R6
- **Depends on:** I-3, I-4
- **PR:** -

Implement attached process-group lifecycle, concurrent Status/Stop, explicit termination,
client-loss behavior, immutable execution snapshots, verified activation assessment, and
integration-mode upgrade and downgrade rules.

## I-7 - Build the Desktop trusted boundary

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P7
- **Rubric criteria:** R1, R4, R6, R7, R8
- **Depends on:** I-1, I-2, I-4, I-6
- **PR:** -

Add main-process adapters, coordinator state, narrow IPC and preload contracts, output
subscriptions and saving, quit guards, renderer-safe reductions, and actionable Launcher
and existing lifecycle failure details.

## I-8 - Deliver the Desktop Launcher tab

- **Status:** open
- **Estimate:** 3d
- **Plan steps:** P8
- **Rubric criteria:** R1, R2, R3, R4, R5, R7, R8
- **Depends on:** I-5, I-6, I-7
- **PR:** -

Build the stack-linked browser, dedicated editor, suggestions and provenance, evidence
and maturity UI, lifecycle controls, confirmations, output and history, external-change
flow, degraded states, Stacks cross-links, and packaged accessibility coverage.

## I-9 - Document and verify the assembled feature

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P9
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-5, I-8
- **PR:** -

Complete all public and integration documentation, run source, compiled, native, release,
security, reset, and packaged application gates, perform focused manual acceptance, and
produce the final rubric evaluation and completion report.
