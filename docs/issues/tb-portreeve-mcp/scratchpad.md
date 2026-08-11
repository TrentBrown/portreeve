# Decision Scratchpad - tb-portreeve-mcp

## [8] Generate setup previews without third-party writes

[x] **Promote**

**Confidence:** HIGH

**Date:** 2026-08-11

**Scope:** I-6 CLI and Desktop MCP setup

**Triggered by:** public CLI contract and Desktop trust-boundary changes

**Blast Radius:** CLI command tree, shared MCP setup schema, Electron main/IPC/preload/renderer boundary

Generate generic stdio JSON, Codex TOML, and Claude Code JSON from one strict pure module. Trusted callers supply the exact managed executable path; renderers cannot select paths. Default to the stable managed installation and offer bare `portreeve` only behind an explicit portable option. Print or copy previews and registration instructions, but never inspect or edit third-party host settings.

**Alternatives considered:** write host settings automatically; resolve PATH in the renderer; use the bundled release-candidate path; omit a portable mode.

**Feature start:** 2026-08-10

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Pin the official MCP TypeScript SDK v2

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** runtime dependency, packaged executable, MCP bridge implementation

Add @modelcontextprotocol/server at exact version 2.0.0 as a direct runtime dependency. Isolate SDK usage beneath src/mcp and use its stdio server support so PortReeve implements the modern stateless core while retaining the SDK's maintained legacy stdio compatibility. The existing PortReeve HTTP/JSON socket remains the only daemon API used by the bridge.

**Triggered by:** dependency change and public integration boundary

**Alternatives considered:**
Implement MCP framing and compatibility ourselves; use an older SDK generation; defer the dependency until bridge registration.

## [2] Keep consequential action receipts daemon-authoritative

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** SQLite schema, public protocol, mutation replay and safety semantics

Persist generic action receipts and completed outcomes in the PortReeve daemon registry. Preview binds a receipt to a canonical action, explicit target, evidence fingerprint, and short expiry; execute performs fresh validation and records a replayable terminal outcome. The MCP bridge carries receipt identifiers but does not become the authority for evidence freshness or lost-response recovery.

**Triggered by:** schema change and safety-critical public protocol

**Alternatives considered:**
Keep receipts in each stdio bridge process; expose raw preview evidence and let clients resubmit it; rely only on MCP request IDs.

## [3] Use opaque cursor pages and diagnostic operation origins

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** public protocol schemas, JavaScript client, history storage and future MCP collections

Introduce a reusable versioned opaque base64url cursor format whose payload contains only a stable ordering key and identifier; cursors are continuation markers, never authority. Add optional structured operation origin metadata to client compatibility envelopes and persisted history. Origin identifies MCP, CLI, desktop, or library callers for diagnostics only and never grants permission or affects target selection.

**Triggered by:** public protocol and persistence schema change

**Alternatives considered:**
Return unbounded arrays; use numeric offsets; infer caller identity from process details; place origin only inside bridge-local logs.

## [4] Keep credentials and ordinary retry replay bridge-local

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** MCP security boundary, lease lifecycle, retry semantics, bridge shutdown

Keep raw standalone and activation lease credentials only in one bridge process behind cryptographically random opaque handles. A separate safe-result cache derives mutation identity from normalized explicit inputs so lost-response retries can return achieved results after the corresponding credential has been erased. Handles never grant authority outside their originating bridge, and bridge shutdown clears both renewal authority and credentials.

**Triggered by:** security-relevant credential custody and semantically idempotent MCP mutation requirements

**Alternatives considered:**
Return raw tokens to MCP hosts; persist encrypted tokens in the daemon; use MCP request IDs as caller-managed idempotency keys; retain settled credentials solely to support retries.

## [5] Add token-proven standalone pending-lease renewal

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** public socket protocol, official JavaScript client, allocation service, audit history

Add a narrow `POST /v1/leases/{leaseId}/renew` operation and official `renewLease` client method. It accepts only the existing one-time token for a still-pending lease, applies the daemon's configured lease TTL, and records safe renewal history without storing or returning the token. Stack activation leases continue to use their existing atomic batch-renewal operation.

**Triggered by:** public API change required to apply bounded automatic custody consistently to standalone and stack leases

**Alternatives considered:**
Exclude standalone leases from automatic custody; reacquire on every TTL; make the MCP bridge call storage directly; reuse the activation batch endpoint for non-activation leases.

## [6] Route consequential actions through daemon receipts and shared fixed-path document primitives

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Unix HTTP/JSON protocol, official JavaScript client, MCP tool schemas, action services, stack document filesystem safety, Desktop stack editor

Add focused preview and execute endpoints for normal reclaim, claim administration, stack apply and pruning, and public settings. Execute accepts only an explicit target and receipt ID; the daemon recovers the stored proposal, recomputes evidence, and records the terminal result for replay. Extract fixed portreeve.stack.json inspection, validation, fingerprinting, symlink refusal, and atomic compare-and-write into a shared module consumed by both daemon and Desktop. MCP receives structured definitions and document reads, never raw file contents or arbitrary paths.

**Triggered by:** I-4 requires evidence-bound process and durable-state mutations plus one canonical stack-document policy across daemon and Desktop

**Alternatives considered:**
Let the bridge resubmit evidence; keep consequential actions as direct or dry-run requests; duplicate filesystem rules in Desktop and daemon; make the MCP bridge a filesystem authority.

## [7] Keep launcher operation credentials in dedicated bridge-local custody

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** MCP credential security, launcher operation lifecycle, renewal scheduling, bridge shutdown

Store each launcher-operation credential only in a dedicated process-local vault behind a random opaque handle. The vault automatically renews the daemon's thirty-second launcher heartbeat by the earlier of one-third remaining TTL or ten seconds, while enforcing the common ten-minute default and sixty-minute maximum custody bounds. The explicit MCP renew tool refreshes an operation already held by that bridge; completion erases the credential immediately, and bridge exit or custody expiry stops renewal. Safe begin and completion results remain separately replayable without retaining a settled credential.

**Triggered by:** I-5 adds security-sensitive launcher-operation tools whose existing public contract returns a raw renewable credential

**Alternatives considered:**
Return launcher credentials to the MCP host; persist them in PortReeve; reuse lease-shaped records by fabricating lease identifiers; require the model to heartbeat manually without automatic bounded custody; omit the approved renew tool.
