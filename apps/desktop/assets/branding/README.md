# PortReeve branding assets

## Source of truth

`portreeve-mark.svg` is the canonical logo geometry. It contains the Fogbound Coast logo
constants at the top of the SVG:

- Logo ink: `#12344C`
- Cap band: `#176B70`
- Paper/face: `#FAFCFC`
- Band text: `#FFFFFF`

The exact cap-band sequence is `80 · 443 · 3000 · 8080`.

`portreeve-app-icon.svg` supplies the Fogbound Coast macOS tile and safe padding.
`portreeve-lockup.svg` combines the canonical mark with the product name and positioning
line.

## Renditions

- `portreeve-mark.svg`: scalable transparent standalone mark.
- `portreeve-lockup.svg`: scalable horizontal brand lockup.
- `portreeve-app-icon.svg`: scalable macOS tile source.
- `png/portreeve-mark-*.png`: transparent common-size mark renditions.
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
`PORTREEVE_ICONUTIL` when necessary. Never edit derived PNG or ICNS files directly.

Application theme constants live in `apps/desktop/renderer/theme.css`. When changing the
product colorway, update the named theme values and the four logo constants in the
canonical SVGs together, regenerate the asset family, and run the branding tests.
