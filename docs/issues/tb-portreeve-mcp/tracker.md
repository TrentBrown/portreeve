# Branch Tracker - tb-portreeve-mcp

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| R1 | Transport and single authority | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44) | P2 delivers dual-era stdio through the official socket client with stdout framing; packaged proof remains P7. |
| R2 | Complete typed tool surface | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44), [#46](https://github.com/TrentBrown/portreeve/pull/46), [#47](https://github.com/TrentBrown/portreeve/pull/47) | P5 completes all 51 strict tools and proves excluded authority absent in source and live discovery; final packaged P7 audit remains. |
| R3 | Availability and explicit scope | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44), [#48](https://github.com/TrentBrown/portreeve/pull/48) | P6 adds explicit setup scope, diagnostic-only labels, and daemon compatibility guidance; final packaged and real-host proof remains P7. |
| R4 | Credential custody | NOT YET | [#45](https://github.com/TrentBrown/portreeve/pull/45), [#47](https://github.com/TrentBrown/portreeve/pull/47) | Lease and launcher credentials now have process-local opaque handles, bounded renewal/extension, settlement erasure, and bridge isolation; final cross-surface leakage and packaged proof remain P7. |
| R5 | Lifecycle and idempotency | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#45](https://github.com/TrentBrown/portreeve/pull/45), [#47](https://github.com/TrentBrown/portreeve/pull/47) | P5 completes source lifecycle coverage with Docker snapshots and launcher begin/renew/complete/inspection/replay; final concurrent packaged host proof remains P7. |
| R6 | Consequential mutation safety | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#46](https://github.com/TrentBrown/portreeve/pull/46) | P4 routes all seven consequential families through five-minute evidence-bound receipts with stale refusal and replay; final real-host evidence-change proof remains P7. |
| R7 | Safe documents and observability | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44), [#46](https://github.com/TrentBrown/portreeve/pull/46), [#47](https://github.com/TrentBrown/portreeve/pull/47) | Canonical documents, cursored history, redacted snapshots, and bounded launcher history now pass; final packaged host proof remains P7. |
| R8 | Setup and shipped compatibility | NOT YET | [#48](https://github.com/TrentBrown/portreeve/pull/48) | P6 generates strict generic, Codex, and Claude Code setup through CLI and Desktop without third-party writes; shipped compatibility remains P7. |

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

### PR #46 - MCP consequential action receipts

- **PR:** [#46](https://github.com/TrentBrown/portreeve/pull/46)
- **Status:** merged
- **Scope:** P4 / I-4: evidence-bound preview/execute receipts for port, claim,
  stack, settings, and canonical stack-document changes, plus shared document
  safety primitives.
- **Evidence packet:** [pr-46](pr-46/)
- **Result:** Slice verdict PASS. All seven consequential families reject stale
  evidence and replay completed results; documents are structured, bounded,
  fingerprinted, and atomically protected. All 453 repository tests, the
  standalone build, typecheck, lint, and changed-file formatting pass. Judge:
  PASS. Code review: no remaining findings.

### PR #47 - Complete the MCP coordination catalog

- **PR:** [#47](https://github.com/TrentBrown/portreeve/pull/47)
- **Status:** merged
- **Scope:** P5 / I-5: redacted Docker-sandbox snapshots, launcher-operation
  begin/renew/complete/get/list with bridge-local custody, and complete catalog
  and excluded-authority auditing.
- **Evidence packet:** [pr-47](pr-47/)
- **Result:** Slice verdict PASS. Both MCP eras discover exactly 51 strict tools;
  real stdio calls prove snapshot and launcher lifecycles without raw credentials,
  filesystem writes, or project command execution. All 457 repository tests, the
  standalone build, typecheck, lint, and changed-file formatting pass. Judge:
  PASS. Code review: no remaining findings.

### PR #48 - Add MCP host setup guidance

- **PR:** [#48](https://github.com/TrentBrown/portreeve/pull/48)
- **Status:** merged
- **Scope:** P6 / I-6: strict generic, Codex, and Claude Code setup generation,
  exact and portable executable variants, CLI output, and a bounded Desktop MCP
  tab with compatibility evidence and copy actions.
- **Evidence packet:** [pr-48](pr-48/)
- **Result:** Slice verdict PASS. CLI and Desktop generate strict generic,
  Codex, and Claude Code setup with exact and portable variants, diagnostic
  labels, daemon compatibility, copy actions, and no host-setting writes. The
  full repository test suite, standalone build, typecheck, lint, and
  changed-file formatting pass. Judge: PASS. Code review: no remaining
  findings.
