# Design - tb-portreeve-branding

**Status:** approved (gate passed 2026-08-09)

## Problem

PortReeve has a working desktop application but its visual identity is spread
across repeated literal CSS colors, the packaged application has no intentional
product icon, and the selected logo exists only as exploratory generated
artwork. Color experiments therefore risk inconsistent UI states, and there is
no durable source from which application, documentation, and macOS assets can
be reproduced.

## Intent

Ship the Fogbound Coast colorway as PortReeve's initial coherent application
theme and establish the approved bearded harbor-steward portrait as a real
production logo. Make both maintainable: application colors have semantic
constants, the logo has a hand-authored vector source, and all raster and macOS
formats agree with that source.

## Chosen shape

### Application theme

- Create one renderer theme file containing the Fogbound Coast values as
  semantic CSS custom properties.
- Separate `logo ink` from normal application text so the portrait remains a
  clearly maritime navy (`#12344C`) rather than near-black.
- Use sea teal (`#176B70`) for the cap band, selected navigation, focus, and
  primary actions; use coral (`#C75532`) only as a restrained signal accent.
- Replace renderer color literals with semantic tokens covering canvas,
  surfaces, text, muted text, borders, primary states, status states, terminal
  output, focus, shadows, and overlays.
- Keep colorway selection source-level in this slice. No settings migration,
  persistent preference, or user-facing theme selector is introduced.

### Production logo

- Reconstruct the selected concept as a clean SVG: a right-facing bearded male
  harbor steward, nautical cap, neck, and minimal shoulder with no surrounding
  harbor scenery.
- Curve `80 · 443 · 3000 · 8080` gently along the sea-teal cap band. The text
  remains fully legible at normal logo sizes and is not materially distorted.
- Use Fogbound Coast logo colors: navy figure, sea-teal band, light face and
  negative space, with coral limited to an optional small signal detail if the
  final vector needs it.
- Treat the SVG as the source of truth. The exploratory generated bitmap is
  retained only outside the repository as visual provenance.

### Asset family

Create `apps/desktop/assets/branding/` with:

- A transparent standalone mark in SVG.
- A horizontal SVG lockup containing the mark, `PortReeve`, and
  `Local Port Authority`.
- Transparent PNG renditions at useful documentation/UI sizes.
- A 1024px opaque macOS app-icon master using Fogbound Coast canvas and safe
  padding around the mark.
- A standard macOS `PortReeve.iconset` containing 16, 32, 128, 256, and 512
  point sizes plus required `@2x` files.
- A compiled `PortReeve.icns`.
- A README documenting the source of truth, palette tokens, regeneration
  commands, and intended use of each rendition.

### Application and packaging integration

- Display the standalone mark in the desktop header beside the existing
  product name and positioning line.
- Copy the desktop assets into the staged Electron application.
- Pass the committed `.icns` to Electron Packager so Finder, Dock, and the
  application bundle use the product icon.
- Add focused tests for theme-token completeness, absence of unintended color
  literals in renderer styles, required asset inventory/dimensions, SVG text
  contract, and packaging icon configuration.

## Alternatives considered

- **Continue using the generated bitmap as the master:** rejected because it is
  difficult to recolor, scale, inspect, or reproduce consistently.
- **Trace a very detailed scenic logo:** rejected because the isolated portrait
  had better visual balance and survived application-icon scale more reliably.
- **Use one dark color for both logo and application text:** rejected because it
  made the human figure appear black and weakened the navy/green maritime
  relationship.
- **Add a runtime theme picker immediately:** rejected as unnecessary scope.
  Semantic constants provide the requested experimentation path without adding
  preferences, migration, or UI complexity.
- **Maintain each raster rendition independently:** rejected because formats
  would drift. Derived assets must follow the SVG source.

## Constraints

- Exact product spelling is `PortReeve`.
- Exact descriptor is `Local Port Authority`.
- Exact cap-band sequence is `80 · 443 · 3000 · 8080`.
- The cap text may curve gently but must remain legible at normal logo sizes.
- The reusable mark contains no harbor scenery.
- The current application remains a light theme; Fogbound Coast is not a dark
  mode.
- Status and interaction colors must retain sufficient contrast in the actual
  renderer states.
- The macOS iconset must meet Apple's conventional filename and pixel-size
  expectations and compile successfully with `iconutil`.
- Packaging remains macOS ARM64/x64 as currently supported.
- No new runtime dependency is required solely to display the theme or logo.

## Open risks

- The vector reconstruction may need one visual refinement pass to match the
  selected portrait's proportions while simplifying it for small sizes.
- The cap numbers cannot remain readable at the smallest macOS icon sizes;
  the silhouette and green band must still remain recognizable without them.
- Platform icon masking and downsampling can expose overly thin strokes or
  insufficient safe padding; generated iconset renditions require visual and
  dimension checks.

## Changes

No changes after the design gate yet.
