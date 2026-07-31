# Spec - tb-portreeve-desktop

**Feature:** `tb-portreeve-desktop`
**Created:** 2026-07-30
**Status:** validated (gate passed 2026-07-30)

## Summary

Finalize Portreeve's first public lifecycle CLI contract, then deliver a
secure, separately versioned macOS desktop management console. The desktop
must preserve the existing per-user service, protocol, database, and native
supervision boundaries while making installation, ordinary lifecycle control,
safe reset, layered status, and global port inventory approachable without
requiring direct CLI use.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** Lifecycle status contract. `portreeve status --json` returns one
  runtime-validated, documented snapshot containing observation time,
  installation state, supervisor state, socket state, execution mode,
  CLI/managed/running versions, and layer-specific errors. Absent, stopped,
  failed, manual, ambiguous, unhealthy, and incompatible states remain
  structured results rather than collapsing into top-level errors.

- **AC2.** Lifecycle mutation contract. Install, upgrade, start, stop, restart,
  manual-server stop, and data-preserving uninstall return stable structured
  outcomes with before/after evidence and truthful partial-failure reporting.
  Operations refuse unsafe or incompatible states, never silently adopt a
  manual server, and never replace a newer managed executable with an older
  one.

- **AC3.** Complete-reset safety. Portreeve creates or safely migrates a
  validated application-home ownership marker. Reset dry-run identifies the
  exact prospective deletion scope without mutation. Execution requires
  matching current evidence, refuses live manual servers and unsafe
  paths/markers/ownership/symlinks, and reports removed, retained, missing,
  and refused paths without claiming false completion.

- **AC4.** Read-only engineering slice. A vanilla-JavaScript Electron
  application under `apps/desktop` launches a normal sandboxed window and
  displays layered service status and global port inventory through the
  official client and exact known CLI. The slice represents absent, manual,
  supervised, unavailable, incompatible, and stale states without exposing
  lifecycle mutations.

- **AC5.** Public MVP behavior. The macOS application provides Overview and
  Ports views; explicit Install and Start onboarding; confirmed upgrade;
  start, stop, restart, manual-server stop, and data-preserving uninstall; and
  a separately previewed, typed-confirmed complete reset. Ports are searchable
  and filterable, with reduced claim/listener evidence and no raw process
  command lines.

- **AC6.** Desktop security and refresh. The renderer is sandboxed,
  context-isolated, local-content-only, and has no Node integration or generic
  IPC. All IPC is allowlisted and runtime validated. Privileged data is
  reduced before crossing IPC. Refreshes run immediately on focus and every
  five seconds while visible, never overlap mutations, pause while hidden, and
  preserve explicitly stale evidence after failure.

- **AC7.** Versions and updates. Desktop and CLI/server versions are
  independent and displayed separately with bundled and managed versions. The
  application checks one fixed update manifest at most once per 24 hours
  without identifiers or telemetry, treats failure as nonfatal, and requires
  explicit external download/install plus separate confirmation before
  upgrading the managed service.

- **AC8.** Release integrity. Portreeve CLI/server `0.1.0`, including the
  finalized lifecycle and reset contracts, passes its complete existing
  release matrix and is published before Portreeve Desktop. Desktop publishes
  separate Developer ID-signed and notarized macOS 13+ ARM64/x64 artifacts.
  Each contains the byte-identical matching published CLI executable, verified
  before and after packaging, and passes native
  install/start/status/ports/upgrade/uninstall/reset/reinstall lifecycle
  testing.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Layered lifecycle status | Every state produces the documented independently layered snapshot | Any ordinary layer failure collapses the result or produces ambiguous evidence | Schema fixtures, compiled CLI matrix, and native supervisor/socket tests |
| R2 | Safe lifecycle mutations | Every ordinary action enforces version, manual-server, confirmation, and partial-outcome rules | A manual server is adopted, a downgrade occurs, or partial success is misreported | Lifecycle service tests plus real LaunchAgent/systemd exercises |
| R3 | Complete reset | Preview and execution are marker-bound, evidence-matched, path-safe, and accurately reported | Unmarked, unsafe, or live state can be deleted, or deletion scope changes silently | Adversarial filesystem, symlink, ownership, process-race, and reinstall tests |
| R4 | Desktop integration | The packaged application obtains status through the CLI and ports through the public client | Renderer/server internals, SQLite, `PATH`, or generic shell execution becomes an integration path | Electron integration tests and running-application inspection |
| R5 | MVP user workflows | Overview, Ports, onboarding, lifecycle, uninstall, and reset flows behave as specified | A required state or action is absent, misleading, or bypasses confirmation | Packaged-application end-to-end tests and native workflow recordings |
| R6 | Electron security and freshness | Privilege isolation, IPC validation, redaction, polling, and stale-state behavior all hold | Privileged or raw data reaches the renderer, or stale evidence appears current | Security configuration audit, IPC tests, CSP/navigation tests, and refresh tests |
| R7 | Version and update policy | Independent versions and identifier-free notification-only updates work without affecting offline management | Updates mutate silently, send identifiers, downgrade service, or block local use | Manifest/version fixtures, network capture, and offline/failure tests |
| R8 | Release identity and native execution | CLI ships first; both signed/notarized desktop architectures preserve exact CLI bytes and pass lifecycle smokes | Any artifact is rebuilt, altered, unsigned, unnotarized, cross-compile-only, or untested end-to-end | Checksums, signatures, notarization tickets, manifests, and native ARM64/x64 release jobs |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
