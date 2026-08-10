# Plan - tb-portreeve-branding

**Feature:** `tb-portreeve-branding`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-09

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Deliver the branding as one coherent desktop slice. First centralize Fogbound
Coast semantic tokens and remove renderer color literals. Next author and
validate the SVG master, then derive all raster/macOS assets from that exact
file. Finally expose the branding directory through a narrowly allowlisted
local-protocol route, integrate the header and package icon, and verify both the
runtime UI and packaged bundle.

## Steps

- **P1.** Add the Fogbound Coast theme constants and refactor renderer styles to
  consume semantic roles; add contrast and literal-scan tests. **Advances:** R1,
  R2.
- **P2.** Author the transparent SVG mark and horizontal lockup using the
  approved composition, exact cap sequence, and Fogbound Coast colors; add SVG
  contract tests. **Advances:** R4, R8.
- **P3.** Derive and inspect transparent PNGs, the opaque macOS master, complete
  iconset, ICNS, and contact sheet; document intended use and regeneration.
  **Advances:** R5, R6, R8.
- **P4.** Extend the restricted local protocol with an explicit branding-root
  route, render the logo in the desktop header, and cover containment, MIME,
  accessibility, and responsive structure. **Advances:** R3, R7.
- **P5.** Copy branding assets during desktop staging, configure Electron
  Packager with the ICNS, and verify the packaged bundle icon and resources.
  **Advances:** R5, R7.
- **P6.** Run focused and broad verification, launch the application for visual
  inspection, evaluate the rubric, and prepare the first PR boundary.
  **Advances:** R1-R8.

## Verification

- Theme token and contrast tests.
- SVG contract, asset inventory, dimension, transparency, and iconset tests.
- Restricted-protocol asset-serving and containment tests.
- Renderer header structure and responsive runtime inspection.
- `bun run check`.
- `bun run desktop:package` followed by `.app` resource and icon inspection.
- Contact-sheet inspection from 16 through 1024 pixels.
- **Final step:** Run full rubric evaluation and produce the completion report.
