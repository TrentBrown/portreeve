# PortReeve branding assets

## Approved source of truth

`portreeve-approved-original.png` is the exact 1254 by 1254 artwork approved during logo
exploration. It is preserved byte-for-byte rather than replaced by a hand-drawn
approximation. Its SHA-256 is
`cf664538a4bfc275ed77e0ec8c1faa4f658b112abe5ad2aeea37e29772f45c69`.

The approved source was generated as a PNG; no original vector file existed.
`portreeve-approved-original.svg` is a standalone lossless scalable SVG presentation
that embeds the exact original artwork. `portreeve-mark.svg` is the identical
application-facing presentation. Keeping the PNG beside the self-contained SVG makes the
original provenance and checksum directly inspectable.

The exact cap-band sequence is `80 · 443 · 3000 · 8080`.

`portreeve-app-icon.svg` supplies the Fogbound Coast macOS tile and safe padding.
`portreeve-lockup.svg` combines the canonical mark with the product name and positioning
line.

## Renditions

- `portreeve-approved-original.png`: exact archival artwork approved by the user.
- `portreeve-approved-original.svg`: scalable lossless presentation of the original.
- `portreeve-mark.svg`: application-facing presentation of the approved original.
- `portreeve-lockup.svg`: scalable horizontal brand lockup.
- `portreeve-app-icon.svg`: scalable macOS tile source.
- `png/portreeve-mark-*.png`: faithful opaque common-size renditions of the approved
  artwork.
- `png/portreeve-lockup-1520x480.png`: large raster lockup.
- `portreeve-app-icon-1024.png`: full-size macOS raster master.
- `PortReeve.iconset/`: standard 16 through 1024 pixel macOS iconset.
- `PortReeve.icns`: packaged macOS application icon.
- `portreeve-iconset-contact-sheet.png`: small-size inspection sheet.

## Regeneration

On macOS with `rsvg-convert`, ImageMagick, and `iconutil` installed:

```sh
bun run branding:generate
```

Override tool paths with `PORTREEVE_RSVG_CONVERT`, `PORTREEVE_MAGICK`, or
`PORTREEVE_ICONUTIL` when necessary. Never edit derived PNG or ICNS files directly. The
command also rebuilds both standalone SVG presentations by embedding the archival PNG;
edit neither SVG by hand.

Application theme constants live in `apps/desktop/renderer/theme.css`. Changing the
product colorway does not silently recolor the approved original artwork. Any future
logo recoloring should be treated as a new reviewed master, followed by asset
regeneration and the branding tests.
