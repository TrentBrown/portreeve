# Decisions - tb-portreeve-launcher

**Feature start:** 2026-08-08

Permanent record of decisions promoted from `scratchpad.md`.

---

## Use structured endpoint references in the launcher file

**Confidence:** HIGH

**Blast Radius:** Launcher schema, editor, CLI initializer, environment resolver, and documentation

Represent every mapping target as `{ component, endpoint }`, with `endpoint` defaulting
to `default`, rather than parsing a dotted string such as `api.http`. Stack names may
legitimately contain punctuation, so structured references preserve identity and allow
strict topology validation without an escaping convention.

**Triggered by:** Planning the version-1 public launcher schema and its relationship to the existing stack schema.

**Alternatives considered:**
- Dotted strings - shorter, but ambiguous when names contain dots and harder to validate safely.
- Database endpoint IDs - rejected because project files must remain portable and must not embed daemon identifiers.

**Promoted:** 2026-08-08. PR: #25 https://github.com/TrentBrown/portreeve/pull/25.

---

## Keep shared trust and degraded cache in one private application-home state file

**Confidence:** HIGH

**Blast Radius:** Platform paths, launcher trust, degraded execution, Desktop and CLI integration, and purge

Store strict versioned launcher trust records and last successfully resolved nonsecret
environment snapshots in one atomically replaced mode-0600 file beneath the existing
marker-owned PortReeve application directory. Key entries by canonical stack root and
exact launcher revision. This lets Desktop and CLI share state without direct SQLite
access and lets degraded Status or confirmed degraded Stop work while the daemon is down.
The existing complete reset naturally removes the file; project launcher files remain
outside the application home and survive.

**Triggered by:** The shared revision-trust, degraded-cache, renderer-isolation, and Delete all data requirements.

**Alternatives considered:**
- Store trust in the daemon database - unavailable during degraded operation and would force Desktop to use the daemon merely to review local trust.
- Store trust in Electron user data - unavailable to the CLI and incorrectly survives service-data reset.
- Separate trust and cache files - adds atomicity and permission surfaces without a first-release benefit.

**Promoted:** 2026-08-08. PR: #25 https://github.com/TrentBrown/portreeve/pull/25.

---

## Use tokenized thirty-second daemon operation sessions

**Confidence:** HIGH

**Blast Radius:** Public protocol, official client, SQLite schema, server concurrency, history, and launcher engine

Add `launcher-operations-v1` with begin, renew, complete, inspect, and recent-history
operations. The daemon issues a random credential, stores only its hash, uses a
thirty-second deadline renewed every ten seconds, and retains bounded terminal safe
metadata for idempotent completion and the latest twenty stack records. Beginning and
completion also emit existing history events. Expiry marks the operation lost but never
runs a command, adopts a process, or sends a signal.

**Triggered by:** The cross-process same-stack coordination requirement and the public API and schema migration planning triggers.

**Alternatives considered:**
- Filesystem locks only - do not provide durable lost-operation history or coordination through the existing authority.
- Store only active rows and delete on completion - makes completion retries non-idempotent and loses the required recent metadata view.
- Long fixed operation deadlines - cannot distinguish a live attached Start from an abandoned client promptly.

**Promoted:** 2026-08-08. PR: #25 https://github.com/TrentBrown/portreeve/pull/25.

---

## Use a dependency-free POSIX process-group command session with a bounded tail

**Confidence:** HIGH

**Blast Radius:** Shared launcher engine, CLI, Electron main, cancellation, attached Start, output handling, and packaging

Implement command sessions with the Node-compatible child-process API, closed stdin,
explicit shell arguments, and a new POSIX process group that is signaled only by its
recorded group identity. Keep an ordered, truncation-marked one-megabyte in-memory tail
per operation while streaming live chunks to the caller. Finite timeout and cancellation
send SIGTERM, wait a short grace period, and then may SIGKILL only that group. Add no PTY
or native dependency, so the same module bundles into Electron and compiles with Bun.

**Triggered by:** The security boundary, attached Start, raw-output retention, macOS/Linux portability, and package-build requirements.

**Alternatives considered:**
- `node-pty` in the first release - introduces native packaging and an interactive surface explicitly deferred by the design.
- Run through the daemon - violates the daemon's no-command-execution boundary.
- Retain complete output - permits unbounded memory growth and conflicts with the bounded session-only contract.

**Promoted:** 2026-08-08. PR: #25 https://github.com/TrentBrown/portreeve/pull/25.

---

## Use resource-oriented launcher-operation routes and bounded summaries

**Confidence:** HIGH

**Blast Radius:** Public protocol, official client, SQLite version 7, daemon admission, history, and later launcher engine integrations

Expose POST /v1/launcher-operations/begin, POST /v1/launcher-operations/{id}/renew, POST /v1/launcher-operations/{id}/complete, GET /v1/launcher-operations/{id}, and GET /v1/stacks/{stackId}/launcher-operations. Begin returns a one-time plaintext credential while SQLite stores only its SHA-256 hash. Records carry fixed lifecycle operation and execution-mode enums, exact launcher revision, optional generation, caller operation ID, deadline and timing, outcome, bounded failure and evidence summaries, but have no schema fields for commands, environment values, or raw output. Completion retries must match the originally stored strict completion payload. Retain the latest twenty terminal records per stack plus active rows and also emit the existing global history events.

**Triggered by:** P2 must turn the approved launcher-operations-v1 capability into exact public routes, payloads, and durable columns.

**Alternatives considered:**
Put mutation verbs under each stack - obscures operation identity and makes inspect/renew/complete less uniform; accept arbitrary metadata objects - would permit accidental command, environment, or output persistence; delete terminal rows after history emission - would prevent the required stack-local recent-operation view and idempotent completion.

**Promoted:** 2026-08-08. PR: #26 https://github.com/TrentBrown/portreeve/pull/26.

---

## Separate observed listeners from verified activation ownership

**Confidence:** HIGH

**Blast Radius:** Shared launcher environment, CLI and Desktop integration, project launcher contract, evidence gates, degraded behavior, and local cache

Inject only PORTREEVE_STACK_ROOT, PORTREEVE_STACK_ID, PORTREEVE_GENERATION_ID, PORTREEVE_SOCKET, and PORTREEVE_ACTIVATION_ID when an activation exists. Launcher mappings remain forbidden from using the reserved PORTREEVE_ prefix. Treat a fresh listener or matching Docker publication on a generation endpoint as observed for command-only classification even when no confirmed run exists. Reserve verified for a current matching activation whose required providers have fresh active evidence. A conflicting result requires mismatched durable claim, run, or provider evidence; the absence of a confirmed run alone is not a conflict. Degraded local lsof inspection may report stopped, partial, fully-observed, or uncertain with source local, but can never claim verified ownership.

**Triggered by:** P3 must define exact reserved context names and turn existing port-level inventory into lifecycle evidence without overstating command-only ownership.

**Alternatives considered:**
Use current inventory classification directly - would label every command-only listener on a claimed port as conflicting; treat every expected listener as verified - would violate the approved ownership boundary; expose arbitrary context names - would destabilize the project-launcher contract and collision rules.

**Promoted:** 2026-08-08. PR: #27 https://github.com/TrentBrown/portreeve/pull/27.

---

## Run Stop with minimal context when no generation exists

**Confidence:** HIGH

**Blast Radius:** Shared launcher lifecycle environment, command-only Stop and Status, CLI and Desktop diagnostics

When the daemon is healthy but the applied stack has no valid allocation generation, finite Stop and configured Status still run with only the applicable reserved context: PORTREEVE_STACK_ROOT, PORTREEVE_STACK_ID, and PORTREEVE_SOCKET. PortReeve omits PORTREEVE_GENERATION_ID, activation identity, and endpoint-derived mappings because those facts do not exist. It reports the environment source as daemon-minimal. It must not prepare a new generation merely to run cleanup or status.

**Triggered by:** The approved requirement that Stop remain available even without observed listeners, combined with the prohibition on preparing replacement allocations around cleanup

**Alternatives considered:**
- Prepare a generation before Stop or Status - invents a new port context for cleanup and can allocate around unrelated running state.
- Block Stop until a generation exists - violates the settled requirement that project cleanup remain available even when listeners are absent.
- Reuse any cached context silently - may inject stale endpoint facts despite a healthy daemon proving there is no current generation.

**Promoted:** 2026-08-08. PR: #28 https://github.com/TrentBrown/portreeve/pull/28.
