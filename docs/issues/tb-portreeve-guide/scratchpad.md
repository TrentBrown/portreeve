# Decision Scratchpad - tb-portreeve-guide

**Feature start:** 2026-08-10

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Keep the Guide semantic, local, and unprivileged

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** Desktop renderer content, styling, packaging, accessibility, and trust
boundary

Implement the Guide as static semantic HTML and CSS in the existing renderer. Do not
add Mermaid, a packaged text diagram, remote content, external navigation, new IPC, or
live server state. This keeps the explanation readable at the minimum window width,
accessible without an image-only representation, version-matched to the installed
desktop, and inside the existing restrictive CSP. The global runtime evidence strip is
hidden while Guide is active so the surface remains explanatory rather than another
status view.

**Triggered by:** Choosing how to render the approved architecture and whether to link
or fetch external documentation

**Alternatives considered:**
- Runtime Mermaid - rejected because one static diagram does not justify a dependency
  or renderer execution surface.
- Packaged SVG with embedded text - rejected because responsive semantic markup is more
  readable and accessible at narrow widths.
- Remote or fixed-link documentation - deferred because it adds navigation and
  release-drift concerns without being required for offline orientation.
