# Branch Tracker - tb-portreeve-mcp

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| R1 | Transport and single authority | PASS | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44), [#49](https://github.com/TrentBrown/portreeve/pull/49) | Dual-era compiled stdio, official-client socket authority, stdout purity, concurrency, and package inspection pass. |
| R2 | Complete typed tool surface | PASS | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44), [#46](https://github.com/TrentBrown/portreeve/pull/46), [#47](https://github.com/TrentBrown/portreeve/pull/47), [#49](https://github.com/TrentBrown/portreeve/pull/49) | Modern and legacy compiled discovery return exactly 51 strict tools; excluded authority remains absent. |
| R3 | Availability and explicit scope | PASS | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44), [#48](https://github.com/TrentBrown/portreeve/pull/48), [#49](https://github.com/TrentBrown/portreeve/pull/49) | Explicit targets, filtered global reads, absence, incompatibility, recovery, setup, and host diagnostics pass. |
| R4 | Credential custody | PASS | [#45](https://github.com/TrentBrown/portreeve/pull/45), [#47](https://github.com/TrentBrown/portreeve/pull/47), [#49](https://github.com/TrentBrown/portreeve/pull/49) | Process-local handles, bounded renewal/extension, settlement, expiry, exit, isolation, and leakage tests pass. |
| R5 | Lifecycle and idempotency | PASS | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#45](https://github.com/TrentBrown/portreeve/pull/45), [#47](https://github.com/TrentBrown/portreeve/pull/47), [#49](https://github.com/TrentBrown/portreeve/pull/49) | Complete lifecycle, retry/replay, concurrent bridges, real hosts, and mixed Docker activation pass. |
| R6 | Consequential mutation safety | PASS | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#46](https://github.com/TrentBrown/portreeve/pull/46), [#49](https://github.com/TrentBrown/portreeve/pull/49) | All seven families pass five-minute expiry, stale evidence, mismatch, single execution, and durable replay. |
| R7 | Safe documents and observability | PASS | [#43](https://github.com/TrentBrown/portreeve/pull/43), [#44](https://github.com/TrentBrown/portreeve/pull/44), [#46](https://github.com/TrentBrown/portreeve/pull/46), [#47](https://github.com/TrentBrown/portreeve/pull/47), [#49](https://github.com/TrentBrown/portreeve/pull/49) | Canonical document safety, bounded cursors/history, structured events, redaction, and secret exclusion pass. |
| R8 | Setup and shipped compatibility | PASS | [#48](https://github.com/TrentBrown/portreeve/pull/48), [#49](https://github.com/TrentBrown/portreeve/pull/49) | Generic/Codex/Claude setup, macOS/Linux binaries, both eras, real hosts, Desktop package, and Docker pass. |

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

### PR #49 - Complete MCP shipped compatibility verification

- **PR:** [#49](https://github.com/TrentBrown/portreeve/pull/49)
- **Status:** in review
- **Scope:** P7 / I-7: compiled macOS/Linux MCP, modern/legacy transcripts,
  concurrent and failed-daemon behavior, real Codex/Claude calls, packaged
  Desktop attestation, and real Docker-backed activation.
- **Evidence packet:** [pr-49](pr-49/)
- **Result:** Feature-final verdict PASS. All eight acceptance criteria and
  rubric rows pass without waiver. All 465 tests, four standalone builds,
  macOS/Linux MCP gates, real Codex and Claude tool calls, packaged Electron,
  and mixed Docker activation pass. Awaiting final human approval.
