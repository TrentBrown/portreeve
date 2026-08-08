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
