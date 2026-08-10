# Branch Tracker - tb-portreeve-branding

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-09

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Centralized Fogbound theme | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | Semantic constants and literal-scan test pass. |
| R2 | Accessible application states | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | Required WCAG AA contrast pairs and runtime states pass. |
| R3 | Header integration | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | The transparent mark renders at 96px with a balanced header at 1224px and 720px widths. |
| R4 | Approved artwork contract | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | The archival and transparent masters and their respective SVG embeddings are checksum-locked. |
| R5 | Complete asset family | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | Archival, transparent, SVG, PNG, iconset, ICNS, contact sheet, and documentation assets exist. |
| R6 | Rendition consistency | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | Reusable marks are transparent; the approved geometry and intentional app-icon tile remain intact. |
| R7 | macOS packaging | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | Packaged icon hash, ASAR assets, protocol, and runtime load verified. |
| R8 | Small-size resilience | PASS | [#35](https://github.com/TrentBrown/portreeve/pull/35) | Iconset identity remains intact and the 96px header rendition makes the cap numbers just legible. |

## PR Log

### PR #35 - Fogbound Coast branding and production logo

- **PR:** [#35](https://github.com/TrentBrown/portreeve/pull/35)
- **Status:** in review
- **Scope:** P1-P6 / I-1-I-7 and feature-final evaluation: semantic Fogbound Coast
  theme, accessible state colors, exact approved logo master and standalone SVG
  presentation, transparent production master, generated raster and macOS assets,
  restricted branding protocol route, header integration, and packaged application icon.
- **Evidence packet:** [pr-35](pr-35/)
- **Result:** R1-R8 are `PASS`; zero `NOT YET` or `FAIL` criteria remain. Pinned
  source-image pixel comparison, archival/transparent checksum and embedded-byte tests,
  typecheck, lint, changed-file formatting, 7 focused branding/protocol tests with 116
  assertions, package construction, byte-identical bundle icon, ASAR inspection,
  packaged-executable smoke, and real-renderer Playwright acceptance pass. The host-aware
  full suite passes 385 tests; its three lifecycle
  failures are caused by the real installed launch agent and all five tests in that
  file pass with an isolated supervisor label. Feature-record retention is tracked.
  Judge: PASS. Code review: no findings.
