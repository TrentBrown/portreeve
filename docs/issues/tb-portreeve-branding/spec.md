# Spec - tb-portreeve-branding

**Feature:** `tb-portreeve-branding`
**Created:** 2026-08-09

## Summary

PortReeve's desktop application uses the Fogbound Coast colorway through a
single semantic theme definition and displays the approved bearded
harbor-steward logo. A hand-authored SVG is the logo source of truth, with
consistent renderer, documentation, PNG, macOS iconset, ICNS, and packaged-app
renditions.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** Fogbound Coast colors are defined once as named semantic constants
  and used throughout the desktop renderer; component styles contain no
  independent brand-color literals.
- **AC2.** Normal text, muted text, buttons, focus indicators, warnings, errors,
  and status treatments meet WCAG AA contrast for their intended use.
- **AC3.** The desktop header displays the PortReeve mark beside the exact
  `PortReeve` and `Local Port Authority` text without disrupting navigation or
  responsive layout.
- **AC4.** The production SVG depicts the isolated right-facing bearded steward
  using Fogbound Coast colors and contains the exact gently curved sequence
  `80 · 443 · 3000 · 8080`.
- **AC5.** `apps/desktop/assets/branding/` contains the transparent SVG mark,
  horizontal SVG lockup, useful transparent PNG sizes, 1024px macOS master,
  complete standard `.iconset`, compiled `.icns`, and asset documentation.
- **AC6.** Raster and macOS renditions preserve the master logo's proportions,
  safe padding, palette, transparency or background treatment, and required
  pixel dimensions.
- **AC7.** The packaged macOS application uses the PortReeve `.icns`, includes
  the branding assets, and continues loading its renderer through the existing
  restricted local protocol.
- **AC8.** The logo remains recognizable at small icon sizes even when the cap
  numbers are no longer readable; no alternate scenery or replacement symbol
  is introduced.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Centralized Fogbound theme (AC1) | Every renderer color maps to the named theme constants. | Brand colors remain duplicated or hard-coded in component rules. | Theme source inspection and automated literal scan. |
| R2 | Accessible application states (AC2) | Every required foreground/background and UI-state pair meets its applicable WCAG AA threshold. | Any required pair falls below its applicable threshold. | Automated contrast results and runtime screenshots. |
| R3 | Header integration (AC3) | Logo, product name, and descriptor render accessibly at supported widths without clipping or breaking navigation. | Branding is missing, inaccessible, clipped, or layout-breaking. | Renderer structure test and running-app verification. |
| R4 | Canonical SVG contract (AC4) | The SVG matches the approved subject, Fogbound Coast colors, and exact curved cap sequence. | The subject, palette, sequence, or restrained curvature is wrong. | SVG contract inspection and rendered comparison. |
| R5 | Complete asset family (AC5) | Every specified rendition exists and has the required format and dimensions. | Any required rendition is absent, malformed, or incorrectly sized. | Asset inventory and dimension tests. |
| R6 | Rendition consistency (AC6) | Generated files preserve composition, safe padding, palette, and intended background or transparency. | Assets visibly drift, crop incorrectly, or use inconsistent colors. | Generated contact sheet and small-size inspection. |
| R7 | macOS packaging (AC7) | The packaged `.app` uses the committed `.icns`, contains branding assets, and loads the restricted renderer. | The package uses a generic icon, omits assets, or breaks renderer loading. | Packaging command and bundle inspection. |
| R8 | Small-size resilience (AC8) | The portrait and cap band remain identifiable from 16 through 1024 pixels without introducing an alternate symbol. | Small renditions collapse into an indistinct or misleading mark. | Iconset contact sheet covering 16 through 1024 pixels. |

## Changes

- **2026-08-09 source correction:** The artwork the user approved was generated as a
  1254px PNG, not an SVG. Preserve that exact PNG as the archival source and retain a
  checksum-locked SVG presentation rather than substituting approximate hand-authored
  geometry. AC4's visual contract applies to the preserved approved artwork and its SVG
  presentation. AC5 and AC6 permit faithful opaque mark renditions because the approved
  master includes its intentional warm background; the horizontal lockup retains its
  transparent outer canvas.
