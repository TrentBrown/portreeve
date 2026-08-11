# Branch Tracker - tb-portreeve-client-guides

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-11

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Stable guides and complete contract coverage | PASS | [#50](https://github.com/TrentBrown/portreeve/pull/50), [#51](https://github.com/TrentBrown/portreeve/pull/51) | Stable complete guides combine authored workflows with all 49 CLI leaves and 51 MCP tools; safety and links are validated |
| R2 | Deterministic safe generation | PASS | [#50](https://github.com/TrentBrown/portreeve/pull/50), [#51](https://github.com/TrentBrown/portreeve/pull/51) | Completed authored inputs regenerate deterministically into strict marked regions and the current safe static bundle |
| R3 | Accessible Desktop client destinations | PASS | [#52](https://github.com/TrentBrown/portreeve/pull/52) | Peer MCP/CLI destinations render all four sections with accessible search, filters, counts, disclosures, stable anchors, copying, and responsive navigation |
| R4 | Live evidence and bundled version binding | PASS | [#52](https://github.com/TrentBrown/portreeve/pull/52) | Direct Desktop services distinguish bundled, managed, running, stale, incompatible, unavailable, and mismatched evidence without CLI execution |
| R5 | Safe recipes and troubleshooting | PASS | [#51](https://github.com/TrentBrown/portreeve/pull/51), [#53](https://github.com/TrentBrown/portreeve/pull/53) | Complete client recipes retain evidence and approval boundaries; product framing directs readers to the safe client-specific guides |
| R6 | Product README and bounded Guide integration | PASS | [#53](https://github.com/TrentBrown/portreeve/pull/53) | README is the approved product landing page and Guide adds only a compact four-client bridge with accurate in-app destinations |
| R7 | Accurate platform and Docker boundaries | PASS | [#50](https://github.com/TrentBrown/portreeve/pull/50), [#51](https://github.com/TrentBrown/portreeve/pull/51), [#53](https://github.com/TrentBrown/portreeve/pull/53) | User-facing surfaces state the approved support matrix and describe endpoint snapshots generically without claiming Docker Sandbox integration |
| R8 | Secure offline packaged behavior | PASS | [#52](https://github.com/TrentBrown/portreeve/pull/52), [#54](https://github.com/TrentBrown/portreeve/pull/54) | Static version-bound guides are present in the ASAR, prohibited runtime paths are absent, package smoke passes, and the real app is operable at ordinary and minimum widths |

## PR Log

### PR #50 - Client-guide generation foundation

- **PR:** [#50](https://github.com/TrentBrown/portreeve/pull/50)
- **Status:** merged
- **Scope:** P1 / I-1: complete CLI and MCP contract metadata, deterministic
  marked generation, safe static compilation, and freshness enforcement.
- **Evidence packet:** [pr-50](pr-50/)
- **Result:** Slice verdict PASS. The generated catalogs contain 49 CLI leaves
  and 51 MCP tools; all 470 repository tests, the standalone build, typecheck,
  lint, documentation freshness, and changed-file formatting pass. All
  feature-level criteria remain `NOT YET` pending I-2 through I-5.

### PR #51 - Complete authored client guides

- **PR:** [#51](https://github.com/TrentBrown/portreeve/pull/51)
- **Status:** merged
- **Scope:** P2 / I-2: the common four-part MCP and CLI guides, approved
  workflows, client comparison, safety boundaries, platform contract, and
  symptom-first troubleshooting.
- **Evidence packet:** [pr-51](pr-51/)
- **Result:** Slice verdict PASS. Guide generation and all cross-references are
  current; all 471 repository tests, the standalone build, typecheck, lint, and
  changed-file formatting pass. R1 and R2 are complete; later slices retain
  their explicit feature-level work.

### PR #52 - Desktop MCP and CLI client guides

- **PR:** [#52](https://github.com/TrentBrown/portreeve/pull/52)
- **Status:** merged
- **Scope:** P3 / I-3: peer Desktop destinations, static guide rendering,
  searchable complete references, direct installation evidence, and packaged
  offline-safe delivery.
- **Evidence packet:** [pr-52](pr-52/)
- **Result:** Slice verdict PASS. All 475 repository tests, the standalone
  build, typecheck, lint, documentation freshness, Desktop packaging, read-only
  packaged startup, and direct rendered-app interaction checks pass. R3 and R4
  are complete; final R8 proof remains in I-5.

### PR #53 - Product README and Guide client bridge

- **PR:** [#53](https://github.com/TrentBrown/portreeve/pull/53)
- **Status:** merged
- **Scope:** P4 / I-4: product landing README, compact architecture and client
  choice, truthful source setup, bounded Guide bridge, and consistent Docker
  Sandbox non-support language.
- **Evidence packet:** [pr-53](pr-53/)
- **Result:** Slice verdict PASS. All 476 repository tests, build, typecheck,
  lint, documentation freshness, package smoke, link validation, and rendered
  Guide interaction pass. R5, R6, and R7 are complete.

### PR #54 - Feature-final client-guide verification

- **PR:** [#54](https://github.com/TrentBrown/portreeve/pull/54)
- **Status:** in review
- **Scope:** P5 / I-5: complete-feature regression, package-content and offline
  safety attestation, lifecycle evidence edge cases, public-document boundary
  checks, independent evaluation, and retained completion evidence.
- **Evidence packet:** [pr-54](pr-54/)
- **Result:** Feature verdict PASS. All eight rubric criteria pass. The final
  source SHA passes 478 repository tests, standalone and packaged builds,
  documentation freshness, typecheck, lint, release verification, MCP runtime
  verification, Desktop runtime verification, and the real Docker/process stack
  exercise. The feature record is fully tracked. PR #54 remains open for the
  user's final approval.
