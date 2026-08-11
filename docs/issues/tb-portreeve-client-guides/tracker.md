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
| R5 | Safe recipes and troubleshooting | NOT YET | [#51](https://github.com/TrentBrown/portreeve/pull/51) | MCP/CLI recipes and symptom-first safety guidance pass; final README/Guide framing remains P4 |
| R6 | Product README and bounded Guide integration | NOT YET | - | Planned for P4 / I-4 |
| R7 | Accurate platform and Docker boundaries | NOT YET | [#50](https://github.com/TrentBrown/portreeve/pull/50), [#51](https://github.com/TrentBrown/portreeve/pull/51) | Both client guides state the approved support matrix and deny Sandbox integration; README/Guide consistency remains P4 |
| R8 | Secure offline packaged behavior | NOT YET | [#52](https://github.com/TrentBrown/portreeve/pull/52) | P3 package, smoke, security, and real-app interaction checks pass; feature-final offline and minimum-width evidence remains P5 |

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
- **Status:** in review
- **Scope:** P3 / I-3: peer Desktop destinations, static guide rendering,
  searchable complete references, direct installation evidence, and packaged
  offline-safe delivery.
- **Evidence packet:** [pr-52](pr-52/)
- **Result:** Slice verdict PASS. All 475 repository tests, the standalone
  build, typecheck, lint, documentation freshness, Desktop packaging, read-only
  packaged startup, and direct rendered-app interaction checks pass. R3 and R4
  are complete; final R8 proof remains in I-5.
