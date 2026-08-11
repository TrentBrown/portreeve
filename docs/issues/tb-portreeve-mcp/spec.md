# Spec - tb-portreeve-mcp

**Feature:** `tb-portreeve-mcp`
**Created:** 2026-08-10

## Summary

Add a full-featured, tools-only MCP interface to the existing PortReeve
installation. Each same-user MCP host launches `portreeve mcp serve` as a
stdio bridge. The bridge delegates ordinary coordination through the official
JavaScript client and private Unix socket to the single persistent daemon; it
does not own another database, listener, or durable authority.

The initial release must make global PortReeve discovery and ordinary claim,
lease, stack, activation, Docker-snapshot, launcher-coordination, settings, and
history operations available through focused typed tools. Explicit targets,
process-local credential handles, bounded lease custody, semantically
idempotent mutations, and evidence-bound preview/execute receipts protect the
agent-facing boundary. The CLI and Desktop provide configuration guidance for
generic stdio hosts, Codex, and Claude Code without changing third-party files.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** **Transport and authority.** `portreeve mcp serve` runs a stdio-only
  MCP bridge from the existing PortReeve executable. Each bridge accesses the
  single daemon through the official JavaScript client and private Unix socket,
  owns no durable state, opens no network listener, and reserves stdout
  exclusively for MCP framing. It supports MCP `2026-07-28` and the official
  TypeScript SDK v2 maintained legacy stdio era.

- **AC2.** **Tool catalog and structured results.** Version one exposes focused,
  operation-specific tools covering every approved coordination family in the
  design, with strict input and output schemas, concise summaries, stable
  structured errors, accurate safety and idempotency annotations, and
  tools-only discovery. Collections default to 50 records, permit at most 200,
  and use opaque continuation cursors. Excluded capabilities are not
  advertised.

- **AC3.** **Discovery, availability, and compatibility.** Global inspection
  supports explicit domain filters and never infers mutation scope from the
  bridge working directory. The bridge remains usable when the daemon is absent
  or protocol-incompatible: diagnostics remain available, daemon-backed tools
  fail with typed actionable errors, and later calls retry the socket without
  restarting the MCP host.

- **AC4.** **Credential custody.** Raw lease and launcher credentials never enter
  MCP results, logs, history, configuration, or persistent storage. They remain
  in a process-local vault behind unguessable handles. Custody lasts ten minutes
  by default, may be explicitly extended up to sixty minutes from acquisition,
  and renews no later than one-third of the observed remaining lease TTL or ten
  seconds, whichever is sooner. Settlement removes credentials immediately;
  bridge exit or custody expiry stops renewal.

- **AC5.** **Coordination lifecycle and retries.** MCP supports standalone
  acquire, confirm, abandon, and run release plus the complete stack activation
  lifecycle, including prepare, begin, renew, resolve, confirm, skip, abandon,
  reconcile, end, Docker snapshots, and launcher coordination without shell
  execution. Mutations are semantically idempotent: retries return the existing
  or already-achieved result unless the caller explicitly requests a new
  generation or replacement.

- **AC6.** **Consequential mutation safety.** Normal reclaim, claim reassignment,
  deletion and pruning, stack creation, replacement and pruning, and public
  settings changes require preview and execute tools. A receipt is bound to the
  target, proposed action, caller-visible evidence, and relevant revision or
  fingerprint; it expires after five minutes. Stale or mismatched evidence is
  rejected, while replay after successful execution returns the recorded
  result. Unsafe any-owner eviction remains unavailable.

- **AC7.** **Canonical documents, observability, and sandboxing.** Stack-definition
  tools accept a canonical worktree root and structured definition rather than
  arbitrary paths or raw file contents. They protect external changes with
  fingerprints. MCP exposes bounded structured history and redacted
  Docker-sandbox endpoint snapshots while excluding raw logs, arbitrary output,
  secrets, and general filesystem access.

- **AC8.** **Setup, packaging, and compatibility.** CLI configuration generation
  and a dedicated Desktop MCP tab provide generic stdio, Codex, and Claude Code
  configurations, defaulting to the exact installed executable with an
  explicit portable variant. They never alter third-party settings. The bridge
  ships in the existing standalone executable and Desktop installation and
  passes compiled/runtime verification on macOS and Linux, modern and legacy
  MCP clients, concurrent bridges, unavailable and incompatible daemons, Codex
  and Claude discovery and tool calls, and Docker-backed activation.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
| --- | --- | --- | --- | --- |
| R1 | Transport and single authority | The stdio bridge delegates through the official client and private socket with no additional durable authority or listener. | The bridge owns durable state, shells through the CLI, opens another listener, or permits non-MCP stdout. | Process, module-graph, socket, stdout-framing, and packaging tests. |
| R2 | Complete typed tool surface | Every included coordination family has focused, strictly typed, bounded tools and every excluded capability is absent. | A required family is missing, results are unbounded, an action multiplexer replaces focused tools, or excluded authority is exposed. | Tool-catalog snapshots, input/output schema tests, annotation checks, and real discovery. |
| R3 | Availability and explicit scope | Diagnostics survive daemon absence or incompatibility, later calls retry, global reads support filters, and mutations require explicit durable targets. | The bridge exits, silently guesses a worktree, stops retrying, or permits incompatible daemon operations. | Daemon-absence, recovery, protocol-mismatch, filtering, and explicit-target tests. |
| R4 | Credential custody | Credentials remain process-local, model-invisible, and unpersisted; renewal and extension obey the ten-minute default and sixty-minute maximum custody bounds. | A credential crosses MCP or persistence, remains after settlement, or renews outside the approved custody window. | Seeded leakage tests, fake-clock renewal/expiry tests, bridge-exit tests, and extension-limit tests. |
| R5 | Lifecycle and idempotency | Approved standalone, stack, activation, Docker, and launcher-coordination operations work, and retries return existing or achieved results without duplicate effects. | An approved lifecycle operation is absent, shell execution is exposed, credentials are lost during owned work, or retries create ambiguous duplicate state. | Client/server integration, complete lifecycle fixtures, concurrent-bridge tests, and retry/replay tests. |
| R6 | Consequential mutation safety | Every listed consequential mutation uses a five-minute evidence receipt, rejects stale or mismatched evidence, and returns the recorded result on completed replay. | A consequential mutation is direct, stale evidence executes, successful replay duplicates effects, or unsafe any-owner eviction is exposed. | Receipt expiry/replay tests, revision/fingerprint tests, and process/Docker evidence-change tests. |
| R7 | Safe documents and observability | Canonical stack documents, cursored history, and redacted snapshots are bounded and exclude arbitrary filesystem, log, output, and secret access. | Arbitrary paths or raw files can be accessed, collections are unbounded, external edits are overwritten without rejection, or sensitive data leaks. | Traversal and symlink tests, external-edit fixtures, pagination tests, structured-history tests, and snapshot redaction tests. |
| R8 | Setup and shipped compatibility | CLI and Desktop generate valid generic, Codex, and Claude configurations without external edits, and the existing shipped products pass the required host and platform matrix. | Configuration is invalid or applied automatically, a separate installation is required, or any required MCP era, host, runtime, platform, or Docker flow fails. | CLI/Desktop E2E, packaged-artifact inspection, real Codex/Claude calls, Bun/Electron checks, and macOS/Linux/Docker release gates. |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
