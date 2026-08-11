# Branch Tracker - tb-portreeve-client-guides

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-11

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Stable guides and complete contract coverage | NOT YET | [#50](https://github.com/TrentBrown/portreeve/pull/50) | P1 provides complete generated inventories and safety metadata; authored-guide completion remains P2 |
| R2 | Deterministic safe generation | NOT YET | [#50](https://github.com/TrentBrown/portreeve/pull/50) | P1 generation, validation, freshness, and negative coverage pass; P2 must prove the completed authored inputs |
| R3 | Accessible Desktop client destinations | NOT YET | - | Planned for P3 / I-3 |
| R4 | Live evidence and bundled version binding | NOT YET | - | Planned for P3 / I-3 |
| R5 | Safe recipes and troubleshooting | NOT YET | - | Planned for P2 and P4 / I-2 and I-4 |
| R6 | Product README and bounded Guide integration | NOT YET | - | Planned for P4 / I-4 |
| R7 | Accurate platform and Docker boundaries | NOT YET | [#50](https://github.com/TrentBrown/portreeve/pull/50) | P1 metadata is neutral and generated from runtime contracts; authored cross-surface consistency remains P2/P4 |
| R8 | Secure offline packaged behavior | NOT YET | - | Planned for P3 and P5 / I-3 and I-5 |

## PR Log

### PR #50 - Client-guide generation foundation

- **PR:** [#50](https://github.com/TrentBrown/portreeve/pull/50)
- **Status:** in review
- **Scope:** P1 / I-1: complete CLI and MCP contract metadata, deterministic
  marked generation, safe static compilation, and freshness enforcement.
- **Evidence packet:** [pr-50](pr-50/)
- **Result:** Slice verdict PASS. The generated catalogs contain 49 CLI leaves
  and 51 MCP tools; all 470 repository tests, the standalone build, typecheck,
  lint, documentation freshness, and changed-file formatting pass. All
  feature-level criteria remain `NOT YET` pending I-2 through I-5.
