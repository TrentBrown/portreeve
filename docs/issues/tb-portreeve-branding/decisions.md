# Decisions - tb-portreeve-branding

**Feature start:** 2026-08-09

Permanent record of decisions promoted from `scratchpad.md`.

---

## Allowlist packaged branding assets on the app protocol

**Confidence:** HIGH

**Blast Radius:** apps/desktop/main/protocol.js, renderer asset loading, desktop package contents

Serve branding only beneath app://portreeve/branding/ from a separately canonicalized branding root. Permit SVG and PNG there, retain the renderer-only HTML/CSS/JS allowlist at the root, require GET and the portreeve hostname, and apply realpath containment checks independently to both roots. Package the exact branding directory consumed in development so development and packaged builds share one source of truth.

**Triggered by:** The renderer needs the approved logo without weakening the existing local-resource security boundary.

**Alternatives considered:**
Inline the SVG into index.html; copy the mark into the renderer directory; permit image extensions throughout the renderer root. These either duplicate the canonical asset or broaden the renderer protocol unnecessarily.

**Promoted:** 2026-08-09. PR: #35 https://github.com/TrentBrown/portreeve/pull/35.

---

## Preserve the approved raster as the logo authority

**Confidence:** HIGH

**Blast Radius:** branding source assets, renderer mark, generated PNG/iconset/ICNS, tests and documentation

Treat the exact 1254x1254 approved PNG as the checksum-locked archival master. Use a standalone lossless SVG presentation that embeds these exact PNG bytes for the renderer and generation pipeline. Do not claim that the generated artwork had a vector source, and do not substitute another trace or generative approximation without a new explicit review.

**Triggered by:** Packaged-app review showed the hand-authored SVG did not resemble the approved logo; source comparison found the user's screenshot was pixel-identical to an earlier generated PNG and no original SVG existed.

**Alternatives considered:**
Keep refining the failed hand trace; auto-trace the raster into thousands of approximate paths; use a non-portable SVG that loads the PNG through a second protocol request. These risk further visual drift or fail to provide a standalone asset that Chromium can render reliably.

**Promoted:** 2026-08-09. PR: #35 https://github.com/TrentBrown/portreeve/pull/35.
