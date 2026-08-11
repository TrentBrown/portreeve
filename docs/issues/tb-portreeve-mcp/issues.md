# Issues - tb-portreeve-mcp

**Feature:** `tb-portreeve-mcp`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-10

Operational task breakdown derived from the plan.

## I-1 - Establish MCP protocol and client foundations

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P1
- **Rubric criteria:** R1, R2, R3, R5, R6, R7
- **Depends on:** none
- **PR:** [#43](https://github.com/TrentBrown/portreeve/pull/43)

Freeze the operation-specific tool catalog and implement the protocol, storage,
receipt, cursor, attribution, idempotency, and official-client foundations that
later bridge slices consume. Add and package the official MCP SDK dependency
without exposing MCP transport policy to the daemon.

## I-2 - Deliver stdio bridge diagnostics and read tools

- **Status:** closed
- **Estimate:** 2.5d
- **Plan steps:** P2
- **Rubric criteria:** R1, R2, R3, R7
- **Depends on:** I-1
- **PR:** [#44](https://github.com/TrentBrown/portreeve/pull/44)

Ship the dual-era stdio bridge, stable error model, stdout discipline,
availability/compatibility diagnostics, explicit attribution, and the complete
bounded global inspection surface.

## I-3 - Deliver credential custody and coordination lifecycle

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P3
- **Rubric criteria:** R4, R5
- **Depends on:** I-1, I-2
- **PR:** [#45](https://github.com/TrentBrown/portreeve/pull/45)

Implement the process-local handle vault, bounded renewal and extension policy,
multi-bridge isolation, standalone leases, stack activations, dependency
resolution, confirmation, reconciliation, and safe recovery after custody loss.

## I-4 - Deliver consequential mutation receipts

- **Status:** closed
- **Estimate:** 4d
- **Plan steps:** P4
- **Rubric criteria:** R5, R6, R7
- **Depends on:** I-1, I-2
- **PR:** [#46](https://github.com/TrentBrown/portreeve/pull/46)

Build the generic preview/execute receipt service and apply it to port, claim,
stack, settings, and canonical stack-document changes. Consolidate document
safety while retaining external-edit protection and excluding unsafe eviction.

## I-5 - Complete and audit the MCP tool catalog

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P5
- **Rubric criteria:** R2, R5, R7
- **Depends on:** I-2, I-3, I-4
- **PR:** [#47](https://github.com/TrentBrown/portreeve/pull/47)

Complete Docker snapshots, launcher coordination, structured history, and
remaining inspections. Prove catalog completeness, excluded-surface absence,
bounded results, and the lack of project shell execution.

## I-6 - Add CLI and Desktop MCP setup

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P6
- **Rubric criteria:** R3, R8
- **Depends on:** I-2, I-5
- **PR:** [#48](https://github.com/TrentBrown/portreeve/pull/48)

Generate generic, Codex, and Claude Code setup from the CLI and add the Desktop
MCP tab with strict trusted boundaries, exact/portable executable variants,
copy actions, safe diagnostics, and no third-party configuration writes.

## I-7 - Complete packaged and real-host verification

- **Status:** in-review
- **Estimate:** 2d
- **Plan steps:** P7
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-3, I-4, I-5, I-6
- **PR:** [#49](https://github.com/TrentBrown/portreeve/pull/49)

Run and retain the complete conformance, security, compiled, packaged,
multi-bridge, unavailable/incompatible daemon, Codex, Claude Code, macOS,
Linux, and Docker verification matrix. Reconcile every rubric criterion and
produce the feature-final report.
