# Issues - tb-portreeve-branding

**Feature:** `tb-portreeve-branding`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-09

Operational task breakdown derived from the plan.

## I-1 - Centralize Fogbound Coast renderer theme

- **Status:** in-progress
- **Estimate:** 3h
- **Plan steps:** P1
- **Rubric criteria:** R1, R2
- **Depends on:** none
- **PR:** -

Create semantic CSS constants, replace renderer literals, and verify required
contrast pairs.

## I-2 - Author canonical vector logo

- **Status:** open
- **Estimate:** 4h
- **Plan steps:** P2
- **Rubric criteria:** R4, R8
- **Depends on:** none
- **PR:** -

Translate the approved bearded steward and curved port-number band into a clean
Fogbound Coast SVG master and horizontal lockup.

## I-3 - Generate production asset family

- **Status:** open
- **Estimate:** 3h
- **Plan steps:** P3
- **Rubric criteria:** R5, R6, R8
- **Depends on:** I-2
- **PR:** -

Generate transparent PNGs, macOS master, iconset, ICNS, contact sheet, and
asset documentation from the SVG.

## I-4 - Integrate desktop header and restricted asset route

- **Status:** open
- **Estimate:** 3h
- **Plan steps:** P4
- **Rubric criteria:** R3, R7
- **Depends on:** I-2
- **PR:** -

Serve only the committed branding root through the local protocol and display
the mark in the responsive desktop header.

## I-5 - Integrate and verify macOS packaging

- **Status:** open
- **Estimate:** 3h
- **Plan steps:** P5, P6
- **Rubric criteria:** R5, R7
- **Depends on:** I-3, I-4
- **PR:** -

Stage branding assets, configure the ICNS, run packaging, inspect the bundle,
and complete the PR-boundary verification.
