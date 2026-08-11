# Issues - tb-portreeve-client-guides

**Feature:** `tb-portreeve-client-guides`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-11

Operational task breakdown derived from the plan.

## I-1 - Build documentation generation and contract metadata

- **Status:** closed
- **Estimate:** 2.5d
- **Plan steps:** P1
- **Rubric criteria:** R1, R2, R7
- **Depends on:** none
- **PR:** [#50](https://github.com/TrentBrown/portreeve/pull/50)

Add complete CLI/MCP documentation metadata, strict generated regions, a safe
static compiler, committed artifacts, stable anchors, cross-reference checks,
and deterministic freshness and coverage gates.

## I-2 - Author the shared MCP and CLI guides

- **Status:** in-progress
- **Estimate:** 2d
- **Plan steps:** P2
- **Rubric criteria:** R1, R2, R5, R7
- **Depends on:** I-1
- **PR:** -

Write the common four-part guides, approved workflows, safety/approval teaching,
interface comparison, platform boundaries, and symptom-first troubleshooting at
the stable repository paths, then regenerate shared artifacts.

## I-3 - Deliver Desktop client-guide experiences

- **Status:** open
- **Estimate:** 3d
- **Plan steps:** P3
- **Rubric criteria:** R3, R4, R8
- **Depends on:** I-1, I-2
- **PR:** -

Add the CLI peer tab, expand MCP, render the safe static bundle, implement local
reference navigation and accessibility, and show direct-service installation
evidence without invoking the CLI.

## I-4 - Redesign README and integrate Guide

- **Status:** open
- **Estimate:** 1.5d
- **Plan steps:** P4
- **Rubric criteria:** R5, R6, R7
- **Depends on:** I-2, I-3
- **PR:** -

Create the product landing README and durable architecture diagram, add the
bounded Guide bridge, validate links, and make supported platform and Docker
Sandbox boundaries consistent.

## I-5 - Complete packaged and feature-final verification

- **Status:** open
- **Estimate:** 1.5d
- **Plan steps:** P5
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-1, I-2, I-3, I-4
- **PR:** -

Run and retain deterministic, packaged, offline, accessibility, visual,
security, regression, rubric, judge, review, and feature-final evidence. Keep
this final PR open for the user's landing approval.
