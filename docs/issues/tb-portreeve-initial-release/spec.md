# Spec - tb-portreeve-initial-release

**Feature:** `tb-portreeve-initial-release`
**Created:** 2026-07-28
**Approved:** 2026-07-30
**Status:** validated (gate passed 2026-07-30)
**Design:** [`design.md`](design.md)

## Summary

Portreeve v1 provides one per-user local authority for assigning, inspecting,
persisting, and safely reclaiming development TCP ports across projects and Git
worktrees. It ships as a portable foreground server and self-contained CLI,
supports native per-user supervision on macOS and Linux, and exposes one
versioned Unix-socket protocol used by the official JavaScript client and all
automation interfaces.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** **Local authority and persistence.** On supported macOS and Linux
  systems, `portreeve serve` starts one per-user HTTP/JSON authority on a
  permission-restricted Unix socket, opens no TCP control listener, rejects
  unsafe runtime paths or a competing server, negotiates protocol compatibility
  before mutation, and preserves valid SQLite-backed state across restart.

- **AC2.** **Claim and assignment semantics.** Portreeve derives identity
  from project namespace, canonical workspace root, service name, and TCP
  transport. The same sticky claim reuses its assignment; separate worktrees
  remain independent; ephemeral assignments become reusable only after TTL
  expiry and absence of listeners; preferred ports permit fallback; exact
  ports return structured conflicts; automatic allocation honors exclusions
  and the detected OS ephemeral range; and a number is unique across
  interfaces and IP families.

- **AC3.** **Race-aware client workflow.** Allocation follows acquire, bind,
  and confirm phases with expiring tokenized leases. Concurrent callers cannot
  confirm conflicting assignments. Abandonment and expiration recover unused
  candidates, address-in-use failures reconcile and retry when permitted,
  graceful release preserves sticky claims, and a migrated client fails with
  actionable instructions—without fallback or daemon startup—when Portreeve is
  unavailable or incompatible.

- **AC4.** **Live inventory and ownership.** `ports list` and `ports inspect`
  reconcile every durable claim with every TCP listener reported by fresh
  LISTEN-specific inspection. Results expose all listeners and classify
  verified, idle, pending, unclaimed, conflicting, and mixed states. Ownership
  uses current composite fingerprints and verified run lineage; neither a
  stored PID nor an unverified client assertion is sufficient.

- **AC5.** **Reclamation and unsafe eviction.** The `never`, `graceful`, and
  `force-after-grace` policies produce their documented signal and timeout
  behavior while revalidating every target before escalation. Unknown,
  changed, or mixed ownership blocks normal reclamation. Unsafe any-owner
  eviction requires explicit operation-scoped consent, supports dry-run,
  remains bound to the inspected process instances, never targets a
  replacement process implicitly, and records its evidence and outcome.

- **AC6.** **Supported automation interfaces.** The official JavaScript client
  works from supported Node.js and Bun environments, uses only the public
  socket protocol, and provides both low-level lease operations and the
  high-level startup helper. Operational CLI commands provide human output,
  versioned JSON, and documented exit codes. The protocol is sufficiently
  documented for non-JavaScript clients without database access or prose
  parsing.

- **AC7.** **Lifecycle and supervision.** Foreground `serve` works independently
  of native supervision. Explicit per-user installation, removal, start, stop,
  restart, and status behavior works through LaunchAgent on macOS and
  `systemd --user` on Linux without root. Manual servers are reported
  accurately and never silently adopted. Managed executable updates are
  atomic, preserve inactive state, health-check active upgrades, and restore
  the prior binary and service state after failed activation.

- **AC8.** **Administration, observability, and distribution.** Claim
  reassignment, deletion, and missing-workspace pruning enforce listener and
  confirmation safeguards, including the seven-day default and documented
  dry-run/interactive/noninteractive behavior. Server configuration is
  validated and API-managed without a general config file. Bounded local logs
  and audit history are queryable without telemetry. Checksummed standalone
  artifacts run without Node or Bun on macOS ARM64/x64 and Linux glibc
  ARM64/x64; Homebrew installs the CLI, and npm distributes the JavaScript
  client.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Local authority and persistence | Socket security, singleton behavior, protocol negotiation, restart persistence, and absence of a TCP control listener all work | Any security, singleton, negotiation, or restart case fails | Cross-platform server integration tests, permission inspection, listener scan, migration/restart test |
| R2 | Claim and assignment semantics | Every identity, lifetime, preferred/exact, exclusion, and uniqueness case in AC2 behaves as specified | Any case silently changes identity, violates uniqueness, or returns an invalid candidate | Allocation decision-table tests plus real bind integration tests |
| R3 | Two-phase client workflow | Concurrent acquisition, confirmation, collision retry, abandonment, expiry, release, and unavailable-server behavior pass | A candidate is stranded, conflicting claims confirm, or a client silently falls back | Concurrent client/server integration tests with injected failures and time control |
| R4 | Inventory and ownership | Complete listener sets are classified correctly and only verified process instances/lineage establish ownership | A listener is omitted, stale PID is trusted, or ambiguous ownership is marked verified | `lsof` parser fixtures and macOS/Linux process-tree integration tests |
| R5 | Reclamation and eviction | All policies signal only permitted targets, revalidate correctly, honor dry-run, and audit outcomes | A replacement process is signaled, uncertainty is bypassed normally, or dry-run mutates | Controlled subprocess/signal tests, fingerprint-change tests, and history assertions |
| R6 | Client, protocol, and CLI contracts | Node/Bun clients and documented protocol work; human, JSON, and exit-code contracts are stable | The official client bypasses the protocol or automation must parse prose/database state | Package-consumer tests, protocol conformance tests, CLI snapshots, exit-code matrix |
| R7 | Native lifecycle and upgrade safety | Supported launchd/systemd lifecycle and successful/failed upgrade paths preserve documented state | Root is required, manual mode is adopted, or failed activation lacks rollback | Real macOS/Linux supervisor smoke tests and managed-binary rollback tests |
| R8 | Administration, observability, and release | Claim administration, prune consent, API-managed settings, bounded local observability, no telemetry, and every release channel/target work | Any safeguard fails, data grows unbounded, outbound telemetry occurs, or an advertised artifact cannot run standalone | Command integration tests, retention tests, outbound-network check, artifact smoke tests, checksum/Homebrew/npm verification |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
