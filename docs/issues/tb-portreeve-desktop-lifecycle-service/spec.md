# Spec - tb-portreeve-desktop-lifecycle-service

**Feature:** `tb-portreeve-desktop-lifecycle-service`
**Created:** 2026-08-10

## Summary

Replace the PortReeve desktop application's lifecycle CLI subprocess adapter
with the same internal, runtime-neutral lifecycle application service used by
the CLI. Preserve the checksum-verified standalone executable as the installed
server, public command-line product, and future MCP entry point.

The refactor must retain existing public lifecycle behavior while adding
cross-process mutation exclusion, service-owned deadlines and uncertain-outcome
recovery, trusted controller/artifact version enforcement, normal desktop-close
protection during mutation, and complete renderer-safe diagnostics. The shared
behavior must be verified under the Bun-built CLI, Electron's Node main process,
macOS launchd, and Linux systemd-user supervision.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** Shared lifecycle authority. Lifecycle status, install or upgrade,
  start, stop, manual stop, restart, uninstall, purge preview, and purge
  execution use one internal lifecycle service from both the CLI and Electron
  main. Desktop lifecycle operations never spawn the PortReeve CLI.
  Installation continues to promote the checksum-verified standalone
  executable.

- **AC2.** Canonical results and adapter parity. Every lifecycle mutation
  produces a validated result containing its operation, outcome, changed state,
  timing, before and after evidence, and optional structured error. CLI and
  desktop render or reduce that same result without independently redefining
  success, refusal, partial completion, or failure. Purge preview and execution
  retain their evidence-bound confirmation contract.

- **AC3.** Trusted desktop controller. Electron main constructs a fixed
  controller from trusted application inputs. Renderer callers cannot select
  executable paths, PortReeve home, socket, supervisor, environment, or native
  arguments. A controller/artifact version mismatch disables lifecycle
  mutations and visibly reports the mismatch, while compatible read-only
  daemon features remain usable. Existing no-downgrade behavior remains
  effective.

- **AC4.** Bounded execution and recovery. Native commands, lifecycle wait
  loops, and complete lifecycle operations have finite service-owned deadlines.
  A timeout after mutation may have begun produces fresh after-evidence and a
  canonical `partial` or `failed` result marked as timed out; neither adapter
  reports the operation as cancelled merely because its caller stopped waiting.

- **AC5.** Cross-process mutation safety. A per-user atomic lock covers
  before-evidence, mutation, rollback, and after-evidence. While one CLI or
  desktop mutation holds it, another mutation fails without waiting for the
  holder to finish and returns `lifecycle_busy`. Status and purge preview remain
  available. Abandoned locks are recovered using fresh evidence rather than PID
  identity alone, and complete purge cannot remove its own active lock.

- **AC6.** Desktop operation and shutdown behavior. Existing desktop lifecycle
  actions, confirmation flows, availability rules, and final-state refreshes
  remain functional. During install or upgrade, start, stop, manual stop,
  restart, uninstall, or purge execution, normal window and application close
  are blocked and the active operation is identified. Status and purge preview
  do not block closing. After forced interruption, the next launch derives
  state from fresh evidence.

- **AC7.** Actionable safe failures. Desktop lifecycle failures provide a
  concise summary plus a copyable diagnostic packet containing operation,
  lifecycle layer, outcome, stable code, safe message, timeout state, nullable
  native exit code, before and after evidence, and recovery guidance. Raw
  exceptions, stack traces, unrestricted stdout or stderr, command arguments,
  credentials, and unvalidated paths never cross preload IPC.

- **AC8.** Compatibility and runtime behavior. Existing CLI command names,
  flags, JSON envelopes, human-output semantics, and exit-code bands remain
  compatible, as do supervisor definitions,
  ownership/no-downgrade/rollback/purge policies, daemon protocol, registry
  schema, and public JavaScript client behavior. The same lifecycle contract
  executes under the Bun-built CLI and Electron Node main, with real lifecycle
  behavior verified on macOS launchd and Linux systemd-user environments.

## Rubric

| #  | Criterion                       | Pass                                                                                                                                                                                            | Fail                                                                                                                                                      | Evidence                                                               |
| -- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| R1 | Shared lifecycle authority      | CLI and Electron use one service for every operation in AC1; desktop performs no lifecycle CLI spawn; the verified executable remains the installation source.                                  | Any desktop lifecycle subprocess or fallback remains, lifecycle implementations diverge, or different bytes are installed.                               | Structural tests, adapter tests, and packaged-artifact inspection.     |
| R2 | Canonical result parity         | Both adapters consume the same validated status, mutation, and purge contracts with equivalent outcomes and evidence.                                                                           | Either adapter defines different result semantics or loses required evidence.                                                                             | Shared contract tests and CLI/direct-call parity fixtures.             |
| R3 | Trusted controller              | Renderer cannot alter privileged targets; an exact controller/artifact mismatch visibly blocks mutations; no-downgrade remains effective.                                                       | Renderer controls native inputs, a mismatch permits mutation, or a newer installation is downgraded.                                                      | IPC/security tests, packaging mismatch tests, and upgrade tests.       |
| R4 | Deadlines and recovery          | Injected expiry bounds work, gathers fresh after-evidence, and returns timed-out `partial` or `failed` results consistently.                                                                      | Work is unbounded, a caller-only timeout hides continuing mutation, or timeout is represented as cancellation.                                            | Deterministic clock/runner tests and interruption tests.               |
| R5 | Cross-process exclusion         | Only one mutation enters its complete transaction; a contender receives `lifecycle_busy`; reads continue; stale recovery and purge safety work.                                                  | Mutations overlap, a contender waits for the holder to finish, PID alone grants authority, or purge removes the active lock.                              | Unit tests and real multi-process contention tests.                    |
| R6 | Desktop lifecycle behavior      | Existing actions work; active mutations block normal close and identify themselves; reads do not block; an interrupted launch recovers from fresh evidence.                                      | Action or confirmation behavior regresses, close proceeds during mutation, nonmutating work blocks close, or recovery trusts stale state.                 | Coordinator, window, renderer, packaged desktop, and interruption tests. |
| R7 | Safe diagnostics                | Every failure exposes all approved diagnostic fields and excludes every forbidden category across preload IPC.                                                                                  | Required information is absent or privileged or raw data reaches the renderer.                                                                            | Schema and view-model tests seeded with secrets, paths, output, and stacks. |
| R8 | Compatibility and native parity | Compatibility fixtures pass in both runtimes, the exact installed artifact is preserved, and native macOS launchd and Linux systemd-user lifecycle gates pass.                                   | A preserved contract changes, runtimes diverge, installed-artifact provenance changes, or either required native gate lacks passing evidence.             | Existing suites, dual-runtime contract tests, compiled CLI and packaged desktop smokes, and macOS/Linux lifecycle records. |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
