# Decision Scratchpad - tb-portreeve-branding

**Feature start:** 2026-08-09

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Allowlist packaged branding assets on the app protocol

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** apps/desktop/main/protocol.js, renderer asset loading, desktop package contents

Serve branding only beneath app://portreeve/branding/ from a separately canonicalized branding root. Permit SVG and PNG there, retain the renderer-only HTML/CSS/JS allowlist at the root, require GET and the portreeve hostname, and apply realpath containment checks independently to both roots. Package the exact branding directory consumed in development so development and packaged builds share one source of truth.

**Triggered by:** The renderer needs the approved logo without weakening the existing local-resource security boundary.

**Alternatives considered:**
Inline the SVG into index.html; copy the mark into the renderer directory; permit image extensions throughout the renderer root. These either duplicate the canonical asset or broaden the renderer protocol unnecessarily.

## [2] Preserve the approved raster as the logo authority

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** branding source assets, renderer mark, generated PNG/iconset/ICNS, tests and documentation

Treat the exact 1254x1254 approved PNG as the checksum-locked archival master. Use a standalone lossless SVG presentation that embeds these exact PNG bytes for the renderer and generation pipeline. Do not claim that the generated artwork had a vector source, and do not substitute another trace or generative approximation without a new explicit review.

**Triggered by:** Packaged-app review showed the hand-authored SVG did not resemble the approved logo; source comparison found the user's screenshot was pixel-identical to an earlier generated PNG and no original SVG existed.

**Alternatives considered:**
Keep refining the failed hand trace; auto-trace the raster into thousands of approximate paths; use a non-portable SVG that loads the PNG through a second protocol request. These risk further visual drift or fail to provide a standalone asset that Chromium can render reliably.

## [3] Separate the archival background from the production mark

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** branding source assets, desktop header, reusable mark and lockup renditions, macOS icon generation, tests and documentation

Keep the checksum-locked cream-background PNG and its SVG presentation unchanged as provenance artifacts. Use a second checksum-locked transparent PNG master for the application-facing SVG, header, lockup, and common mark PNGs. Preserve the original RGB artwork and change only exterior alpha. Continue to render the macOS application icon on its intentional Fogbound Coast tile.

**Triggered by:** The preserved approved artwork includes a cream background that reads as an unintended square when the mark is placed in the desktop interface.

**Alternatives considered:**
Use the cream-background master everywhere - rejected because the square competes with application surfaces; replace cream with a colorway color everywhere - rejected because it reduces reuse and changes the archival source; make the complete macOS icon transparent - rejected because the icon tile is an intentional bounded composition.
