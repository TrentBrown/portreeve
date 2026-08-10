# Issues - tb-portreeve-branding

**Feature:** `tb-portreeve-branding`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-08-09

Operational task breakdown derived from the plan.

## I-1 - Centralize Fogbound Coast renderer theme

- **Status:** in-review
- **Estimate:** 3h
- **Plan steps:** P1
- **Rubric criteria:** R1, R2
- **Depends on:** none
- **PR:** [#35](https://github.com/TrentBrown/portreeve/pull/35)

Create semantic CSS constants, replace renderer literals, and verify required
contrast pairs.

## I-2 - Preserve the approved logo master

- **Status:** in-review
- **Estimate:** 4h
- **Plan steps:** P2
- **Rubric criteria:** R4, R8
- **Depends on:** none
- **PR:** [#35](https://github.com/TrentBrown/portreeve/pull/35)

Preserve the exact approved bearded steward artwork as the checksum-locked archival
master, provide a standalone SVG presentation that embeds it without visual drift, and
retain the horizontal lockup.

## I-3 - Generate production asset family

- **Status:** in-review
- **Estimate:** 3h
- **Plan steps:** P3
- **Rubric criteria:** R5, R6, R8
- **Depends on:** I-2
- **PR:** [#35](https://github.com/TrentBrown/portreeve/pull/35)

Generate faithful PNGs, macOS master, iconset, ICNS, contact sheet, and asset
documentation from the approved master and its standalone SVG presentation.

## I-4 - Integrate desktop header and restricted asset route

- **Status:** in-review
- **Estimate:** 3h
- **Plan steps:** P4
- **Rubric criteria:** R3, R7
- **Depends on:** I-2
- **PR:** [#35](https://github.com/TrentBrown/portreeve/pull/35)

Serve only the committed branding root through the local protocol and display
the mark in the responsive desktop header.

## I-5 - Integrate and verify macOS packaging

- **Status:** in-review
- **Estimate:** 3h
- **Plan steps:** P5, P6
- **Rubric criteria:** R5, R7
- **Depends on:** I-3, I-4
- **PR:** [#35](https://github.com/TrentBrown/portreeve/pull/35)

Stage branding assets, configure the ICNS, run packaging, inspect the bundle,
and complete the PR-boundary verification.
