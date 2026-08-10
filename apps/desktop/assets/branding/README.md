# PortReeve branding assets

## Approved source of truth

`portreeve-approved-original.png` is the exact 1254 by 1254 artwork approved during logo
exploration. It is preserved byte-for-byte rather than replaced by a hand-drawn
approximation. Its SHA-256 is
`cf664538a4bfc275ed77e0ec8c1faa4f658b112abe5ad2aeea37e29772f45c69`.

The approved source was generated as a PNG; no original vector file existed.
`portreeve-approved-original.svg` is a standalone lossless SVG presentation that embeds
the exact original artwork. The cream background remains part of these archival files so
the approved source is never silently altered.

`portreeve-transparent-master.png` is the production cutout. It preserves the original
RGB artwork and adds only an exterior alpha mask. Its SHA-256 is
`987a5fa503f00faa5d5870fd7d57422508ad989cc7eb60857e9c6db8183888f8`. `portreeve-mark.svg`
embeds this transparent master for the desktop header and reusable logo renditions.

The exact cap-band sequence is `80 · 443 · 3000 · 8080`.

`portreeve-app-icon.svg` supplies the Fogbound Coast macOS tile and safe padding.
`portreeve-lockup.svg` combines the canonical mark with the product name and positioning
line.

## Renditions

- `portreeve-approved-original.png`: exact archival artwork approved by the user.
- `portreeve-approved-original.svg`: scalable lossless presentation of the original.
- `portreeve-transparent-master.png`: checksum-locked transparent production cutout.
- `portreeve-mark.svg`: application-facing presentation of the transparent master.
- `portreeve-lockup.svg`: scalable horizontal brand lockup.
- `portreeve-app-icon.svg`: scalable macOS tile source.
- `png/portreeve-mark-*.png`: transparent common-size production renditions.
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
command also rebuilds the two standalone SVG presentations from their respective PNG
masters; edit neither SVG by hand.

Application theme constants live in `apps/desktop/renderer/theme.css`. Changing the
product colorway does not silently recolor the approved original artwork. Any future
logo recoloring should be treated as a new reviewed master, followed by asset
regeneration and the branding tests.
