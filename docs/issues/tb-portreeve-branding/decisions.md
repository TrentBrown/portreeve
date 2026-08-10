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
