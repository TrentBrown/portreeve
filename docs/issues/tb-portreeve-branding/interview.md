# Interview - tb-portreeve-branding

**Feature start:** 2026-08-09
**Status:** concluded

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - Product naming and positioning

**Question:** What product identity must the branding preserve?

**Answer:** The exact product spelling is `PortReeve`, with the positioning line
`Local Port Authority`.

**Decision:** All application and asset renditions use `PortReeve`; lockups that
include a descriptor use `Local Port Authority`.

## D2 - Logo subject

**Question:** Which explored logo direction should become the production mark?

**Answer:** The strongest concept is the simple right-facing bearded male harbor
steward wearing a nautical cap. Harbor scenery crowded the face and weakened the
balance.

**Decision:** The production mark is the isolated head, beard, cap, neck, and
minimal shoulder. It has no lighthouse, ship, dock, frame, or other scenery.

## D3 - Port-number motif

**Question:** How should the software-port concept appear in the otherwise
nautical mark?

**Answer:** The cap band carries the familiar sequence
`80 · 443 · 3000 · 8080`. The numbers should appear to wrap gently around the
cap without becoming distorted or illegible.

**Decision:** Preserve that exact sequence and order. The vector master uses a
shallow curved baseline and restrained perspective. Small raster renditions may
lose numeral legibility naturally, but may not replace the band with a different
symbol.

## D4 - Colorway

**Question:** Which proposed application colorway should ship first?

**Answer:** Use Fogbound Coast for now.

**Decision:** Fogbound Coast becomes the active application and logo palette.
The logo figure remains a visibly maritime dark blue rather than black, the cap
band uses sea teal, and coral remains a restrained signal accent.

Core values:

- Canvas: `#EDF2F3`
- Surface: `#FAFCFC`
- Selected surface: `#E1ECEC`
- Application text: `#26383F`
- Logo ink: `#12344C`
- Muted text: `#5B6B73`
- Border: `#BECBD0`
- Primary / logo band: `#176B70`
- Strong primary: `#115359`
- On-primary: `#FFFFFF`
- Signal accent: `#C75532`
- Soft signal accent: `#F9E5DE`
- Success: `#26745D`
- Warning: `#8B5B18`
- Danger: `#9E3F3B`
- Terminal background: `#15282F`
- Terminal text: `#EAF6F5`

## D5 - Theme mutability

**Question:** How should future color experiments be enabled?

**Answer:** Each color value should have a constant so it can be changed without
hunting through application styles.

**Decision:** Centralize semantic CSS custom properties in one renderer theme
file. Application selectors consume roles rather than literal hex values. This
slice does not add a user-facing theme picker; experimentation is source-level.

## D6 - Asset source of truth

**Question:** What should be the durable source for the approved logo and its
renditions?

**Answer:** Provide a scalable version plus Macintosh and other common formats.
The request for a “CSV” is understood as an SVG.

**Decision:** A hand-authored SVG is the production master. PNGs, the macOS
`.iconset`, and `.icns` are derived from it and are not separately designed.
The exploratory AI bitmap is a visual reference, not a shipped source asset.

## D7 - Asset inventory and application use

**Question:** Which renditions are required and where should they live?

**Answer:** Add useful formats under an application assets folder, including
Macintosh icon-set renditions and other common forms.

**Decision:** Create `apps/desktop/assets/branding/` containing the transparent
SVG mark, horizontal SVG lockup, representative transparent PNGs, a 1024px
macOS app-icon master, the complete `PortReeve.iconset`, `PortReeve.icns`, and
an asset README. The desktop header displays the mark. The packaging script
copies assets and supplies the `.icns` to Electron Packager.

## D8 - macOS treatment

**Question:** How should the unframed portrait become a macOS application icon?

**Answer:** The isolated portrait should remain the brand mark, but a Macintosh
icon needs reliable bounds and contrast.

**Decision:** Keep the reusable mark transparent. Place it with generous safe
padding on an opaque Fogbound Coast app-icon tile for macOS renditions. Do not
add harbor scenery or unrelated decoration.

## Closing summary

The identity, palette, icon subject, number treatment, source-of-truth format,
asset inventory, and packaging integration are settled. The remaining risk is
faithfully translating the selected bitmap concept into a clean maintainable
vector; visual comparison and small-size rendering checks are required before
the mark is considered locked.
