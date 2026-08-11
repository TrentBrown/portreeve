# Issues - tb-portreeve-desktop-lifecycle-service

**Feature:** `tb-portreeve-desktop-lifecycle-service`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-10

Operational task breakdown derived from the plan.

## I-1 - Extract shared lifecycle service and migrate CLI

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P1, P3
- **Rubric criteria:** R1, R2, R8
- **Depends on:** none
- **PR:** [#37](https://github.com/TrentBrown/portreeve/pull/37)

Create the canonical lifecycle application service and move the CLI onto it
without changing observable CLI behavior. Establish contract and golden parity
fixtures before another caller adopts the service.

## I-2 - Add deadlines, uncertain recovery, and mutation locking

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P2
- **Rubric criteria:** R4, R5, R8
- **Depends on:** I-1
- **PR:** [#38](https://github.com/TrentBrown/portreeve/pull/38)

Centralize bounded execution, timeout recovery, and the purge-safe per-user
cross-process lock. Record the selected lock mechanism and any dependency
decision before implementation.

## I-3 - Replace the desktop CLI lifecycle adapter

- **Status:** closed
- **Estimate:** 1.5d
- **Plan steps:** P4
- **Rubric criteria:** R1, R3, R8
- **Depends on:** I-1, I-2
- **PR:** [#39](https://github.com/TrentBrown/portreeve/pull/39)

Construct the fixed trusted controller in Electron main, enforce controller/
artifact version identity, and remove every desktop lifecycle subprocess path
while retaining the verified artifact as the installation payload.

## I-4 - Add desktop close protection and safe diagnostics

- **Status:** in-review
- **Estimate:** 1.5d
- **Plan steps:** P5
- **Rubric criteria:** R2, R3, R6, R7
- **Depends on:** I-3
- **PR:** [#40](https://github.com/TrentBrown/portreeve/pull/40)

Complete the coordinator, window, schema, preload, renderer, and security-test
changes for active-operation visibility, close blocking, final refresh, and
copyable renderer-safe failures.

## I-5 - Verify packaging and both JavaScript runtimes

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P6
- **Rubric criteria:** R1, R3, R8
- **Depends on:** I-3, I-4
- **PR:** -

Validate packaged controller/artifact identity, absence of lifecycle CLI
spawning, common contract behavior under Bun and Electron Node, and compiled/
packaged smoke behavior.

## I-6 - Complete native lifecycle and interruption verification

- **Status:** open
- **Estimate:** 1.5d
- **Plan steps:** P7
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-2, I-4, I-5
- **PR:** -

Run and retain the macOS launchd, Linux systemd-user, real contention,
desktop-close, and force-interruption/recovery evidence required for the final
rubric evaluation.
