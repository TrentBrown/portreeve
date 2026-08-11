# Decision Scratchpad - tb-portreeve-mcp

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

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** MCP security boundary, lease lifecycle, retry semantics, bridge shutdown

Keep raw standalone and activation lease credentials only in one bridge process behind cryptographically random opaque handles. A separate safe-result cache derives mutation identity from normalized explicit inputs so lost-response retries can return achieved results after the corresponding credential has been erased. Handles never grant authority outside their originating bridge, and bridge shutdown clears both renewal authority and credentials.

**Triggered by:** security-relevant credential custody and semantically idempotent MCP mutation requirements

**Alternatives considered:**
Return raw tokens to MCP hosts; persist encrypted tokens in the daemon; use MCP request IDs as caller-managed idempotency keys; retain settled credentials solely to support retries.

## [5] Add token-proven standalone pending-lease renewal

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** public socket protocol, official JavaScript client, allocation service, audit history

Add a narrow `POST /v1/leases/{leaseId}/renew` operation and official `renewLease` client method. It accepts only the existing one-time token for a still-pending lease, applies the daemon's configured lease TTL, and records safe renewal history without storing or returning the token. Stack activation leases continue to use their existing atomic batch-renewal operation.

**Triggered by:** public API change required to apply bounded automatic custody consistently to standalone and stack leases

**Alternatives considered:**
Exclude standalone leases from automatic custody; reacquire on every TTL; make the MCP bridge call storage directly; reuse the activation batch endpoint for non-activation leases.
