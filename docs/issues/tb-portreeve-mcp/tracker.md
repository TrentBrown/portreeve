# Branch Tracker - tb-portreeve-mcp

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| R1 | Transport and single authority | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44) | P2 delivers dual-era stdio through the official socket client with stdout framing; packaged proof remains P7. |
| R2 | Complete typed tool surface | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44) | P2 registers the complete read-only subset with strict schemas and bounded pages; mutation and final completeness work remain P3-P5/P7. |
| R3 | Availability and explicit scope | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44) | P2 proves absence, incompatibility, live retry, filters, explicit identifiers, and diagnostic-only labels; setup remains P6/P7. |
| R4 | Credential custody | NOT YET | [#45](https://github.com/TrentBrown/portreeve/pull/45) | P3 delivers process-local opaque handles, bounded renewal/extension, settlement erasure, bridge isolation, and lost-custody recovery; final cross-surface leakage and packaged proof remain P7. |
| R5 | Lifecycle and idempotency | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#45](https://github.com/TrentBrown/portreeve/pull/45) | P3 delivers standalone and stack coordination with replay-safe ordinary mutations; documents, snapshots, launcher coordination, and final host proof remain P4-P5/P7. |
| R6 | Consequential mutation safety | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43) | P1 supplies five-minute evidence-bound receipts; action-specific integration remains P4/P7. |
| R7 | Safe documents and observability | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44) | P2 exposes bounded structured history and no raw logs/files; documents and snapshots remain P4/P5/P7. |
| R8 | Setup and shipped compatibility | NOT YET | - | Planned across P6 and P7 / I-6 and I-7. |

## PR Log

Append PR boundary entries here.

### PR #43 - MCP protocol and client foundations

- **PR:** [#43](https://github.com/TrentBrown/portreeve/pull/43)
- **Status:** merged
- **Scope:** P1 / I-1: SDK v2, stable tool catalog, cursor pages, origin
  attribution, and daemon-authoritative action receipts.
- **Evidence packet:** [pr-43](pr-43/)
- **Result:** Slice verdict PASS. All feature-level criteria remain `NOT YET`
  pending I-2 through I-7. All 432 repository tests, the standalone build,
  typecheck, lint, and changed-file formatting pass. Judge: PASS. Code review:
  no remaining findings.

### PR #44 - MCP stdio diagnostics and reads

- **PR:** [#44](https://github.com/TrentBrown/portreeve/pull/44)
- **Status:** merged
- **Scope:** P2 / I-2: dual-era stdio bridge, stable diagnostics and errors,
  global filtered reads, bounded cursor pages, daemon recovery, and explicit
  MCP attribution.
- **Evidence packet:** [pr-44](pr-44/)
- **Result:** Slice verdict PASS. The bridge supports modern and legacy MCP,
  fails closed on incompatible daemons, recovers without restart, and exposes
  fifteen strictly described read tools. All 439 repository tests, standalone
  build, typecheck, lint, and changed-file formatting pass. Judge: PASS. Code
  review: no remaining findings.

### PR #45 - MCP credential custody and coordination

- **PR:** [#45](https://github.com/TrentBrown/portreeve/pull/45)
- **Status:** merged
- **Scope:** P3 / I-3: process-local opaque credential custody, bounded lease
  renewal and activation extension, standalone allocation coordination, and the
  stack prepare/begin/resolve/settle/reconcile/end lifecycle.
- **Evidence packet:** [pr-45](pr-45/)
- **Result:** Slice verdict PASS. Credentials remain model-invisible and
  bridge-local; mutation retries replay achieved safe results; a real stdio
  lifecycle proves cross-bridge isolation and recovery after bridge exit. All
  448 repository tests, the standalone build, typecheck, lint, and changed-file
  formatting pass. Judge: PASS. Code review: no remaining findings.
