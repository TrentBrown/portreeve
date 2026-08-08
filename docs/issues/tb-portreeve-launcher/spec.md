# Spec - tb-portreeve-launcher

**Feature:** `tb-portreeve-launcher`
**Created:** 2026-08-08
**Approved:** 2026-08-08
**Status:** validated (gate passed 2026-08-08)
**Design:** [`design.md`](design.md)

## Summary

PortReeve must bridge applied stack allocations to project-owned lifecycle commands
without becoming the project orchestrator. Each applied canonical stack root gains one
strict, checked-in, trusted launcher configuration. A shared Desktop and CLI engine
resolves current endpoint values, runs safe command-only or verified-activation
lifecycles, coordinates concurrent callers through the daemon, and presents fresh
listener evidence, bounded output, durable safe metadata, and actionable failures.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** **Launcher configuration and trust.** For an applied stack, the Desktop can
  create and edit, and `portreeve launcher init` can create, one versioned
  `portreeve.launcher.json` in the canonical stack root. It supports the system login
  shell, Bash, or Zsh; one stack-contained working directory; required Start and Stop;
  optional Restart and Status; command-only or verified-activation integration;
  endpoint-derived environment mappings; and finite or attached Start. It stores no
  resolved ports, arbitrary secrets, or database identifiers. Missing, unapplied,
  invalid, untrusted, or externally changed launchers cannot execute. Trust is bound to
  the canonical root and exact file revision. Exact-byte conflicts offer Review,
  explicit Overwrite, or Cancel and never overwrite silently.

- **AC2.** **Assisted setup and environment generation.** Setup inspects supported
  manifest filenames only in the selected working directory, without executing project
  code or recursively searching child directories. It may suggest unambiguous
  `package.json` scripts, exact Makefile targets, and Docker Compose operations while
  displaying provenance; ambiguous cases remain blank. Every stack endpoint receives
  an editable deterministic host-port mapping suggestion: `<COMPONENT>_PORT` for the
  default endpoint and `<COMPONENT>_<ENDPOINT>_PORT` otherwise. Users may additionally
  select host URLs and applicable Docker container-port or Docker-network URLs.
  Invalid names, duplicate names, and reserved `PORTREEVE_*` collisions are refused.
  Current values resolve immediately before every operation and assigned ports are
  never persisted in the launcher file.

- **AC3.** **Command-only lifecycle operations.** In command-only mode, Start prepares or
  reuses a valid generation, injects the resolved environment, and invokes the trusted
  project command without treating command success as ownership confirmation. Fresh
  listener evidence classifies the stack as stopped, partially running, fully observed,
  or conflicting. Fully observed stacks disable Start; partial nonconflicting stacks
  require explicit Run Start Anyway and retain the generation; conflicts block Start.
  Stop invokes only the trusted project Stop command and never kills listeners or
  evicts claims automatically. Status output is advisory and fresh evidence remains
  authoritative. Missing Restart composes Stop, fresh revalidation or preparation, and
  Start. Default finite timeouts are Start five minutes, Stop two minutes, Restart seven
  minutes, and Status thirty seconds.

- **AC4.** **Attached Start execution.** Attached Start has no Start timeout, runs as one
  application-associated process group with closed standard input, and streams bounded
  stdout and stderr while the client session remains open. Status and Stop remain
  available while it runs. Restart always composes Stop and Start. Terminating the
  attached process group requires an explicit action, and normal Desktop exit is
  blocked until the user stops the stack or cancels exit. The first release provides no
  detaching, reattaching, persistent process supervision, or interactive PTY.

- **AC5.** **Verified activation integration.** Verified-activation mode supplies the
  current generation and required PortReeve context so the project launcher can begin,
  renew, confirm, clean up, and end activation. A stack is confirmed only when matching
  activation and fresh listener evidence agree with the current generation; exit zero
  alone is insufficient. When command-only execution produces matching activation
  evidence, Desktop may offer to upgrade the checked-in integration mode. Downgrading
  verified activation requires an explicit warning, confirmation, and newly trusted
  revision.

- **AC6.** **Shared engine, CLI, and concurrency.** Desktop and CLI use the same launcher
  engine, validation, environment resolution, lifecycle policy, and structured results.
  The CLI provides `launcher init`, `validate`, `trust`, `start`, `stop`, `restart`, and
  `status`. Interactive CLI trust displays and approves the exact revision;
  noninteractive execution refuses untrusted revisions. Renewable daemon sessions
  prevent incompatible operations against one stack root while allowing different
  roots concurrently and permitting Status or Stop alongside attached Start. Abandoned
  sessions expire and are recorded as lost. The daemon stores only coordination and
  safe outcome metadata; it never executes project commands or receives raw output.

- **AC7.** **Desktop experience, diagnostics, and history.** Desktop adds Launcher as a
  primary tab after Stacks, with an introductory explanation, stack-linked master-detail
  browser, dedicated Execution, Commands, Endpoint environment, Advanced, and Review
  editor sections, Save and Trust, applicable lifecycle controls, availability reasons,
  current evidence, nonsecret environment preview, bounded live output, explicit Copy
  and Save output actions, and the latest twenty safe operation-metadata records per
  stack. Raw output remains session-only unless explicitly saved. Launcher and existing
  lifecycle failures expose the available underlying code and message, failed step,
  exit or timeout state, relevant evidence, and current-session output instead of a
  generic failure-only presentation.

- **AC8.** **Degraded operation, retention, and platform boundaries.** Desktop management
  works on macOS; the CLI and shared engine work on macOS and Linux; existing non-stack
  and non-launcher clients retain their behavior. With the daemon unavailable, Start
  and Restart refuse; Status may use clearly stale cached nonsecret environment data;
  Stop requires explicit degraded-mode confirmation; and local `lsof` evidence is
  labeled local and uncoordinated. Pruning and ordinary uninstall preserve project
  launcher files. Delete all data removes PortReeve launcher trust, history,
  coordination, and cache state but never project-owned `portreeve.launcher.json` or
  `portreeve.stack.json`. Windows, language generators, PTY terminals, detached
  supervision, arbitrary actions or environment literals, and persisted raw logs remain
  outside this release.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Launcher configuration and trust | Creation, editing, canonical association, validation, exact-revision trust, and conflict behavior satisfy AC1 | An invalid, untrusted, externally changed, or incorrectly associated launcher executes, or a project file is overwritten silently | Schema and trust tests, file-conflict integration tests, and Desktop editor tests |
| R2 | Setup and endpoint environment | Detectors, provenance, suggestions, validation, and operation-time endpoint resolution satisfy AC2 without code execution or recursive discovery | An ambiguous command is silently selected, provenance is absent, mappings collide, discovery executes code, or assigned ports persist | Manifest fixtures, detector tests, mapping and validation tests, and environment-resolution integration tests |
| R3 | Command-only lifecycle | Every evidence state, action guard, project-command-only Stop, advisory Status, composed Restart, and timeout satisfies AC3 | A conflict can start, exit zero confirms ownership, Stop kills or evicts independently, or composed Restart skips revalidation | Lifecycle state-table tests, command-runner tests, listener fixtures, and CLI/Desktop integration tests |
| R4 | Attached execution | Process grouping, closed input, bounded output, concurrent Status/Stop, composed Restart, explicit termination, and quit protection satisfy AC4 | Attached Start times out, detaches, accepts input, survives explicit termination, or permits unsafe Desktop exit | Process-level integration tests and a macOS packaged-Desktop smoke test |
| R5 | Verified activation | Confirmation, generation matching, cleanup context, upgrade, and downgrade behavior satisfy AC5 | Exit code alone confirms, a mismatched generation confirms, or maturity changes occur silently | Activation integration tests and Desktop transition tests |
| R6 | Shared engine and coordination | CLI and Desktop are semantically equivalent and daemon sessions enforce all AC6 concurrency and data-boundary rules | Interfaces diverge, incompatible same-root operations overlap, different roots are unnecessarily serialized, or raw command data reaches the daemon | Cross-interface contract tests, concurrent-client tests, lease-expiration tests, and protocol validation tests |
| R7 | Desktop operation and diagnostics | The Launcher tab exposes every required setup, editing, action, evidence, output, history, and actionable-failure behavior in AC7 | A required view or action is absent, raw output persists implicitly, history violates its limit, or failures remain generic | Renderer-state, coordinator, IPC security, and packaged-Desktop workflow tests |
| R8 | Degraded and platform behavior | Daemon-outage behavior, data retention, platform support, and existing-client compatibility satisfy AC8 | Daemon-free Start or Restart proceeds, degraded evidence appears authoritative, project files are deleted, or an existing client regresses | Daemon-outage and delete/prune tests, macOS/Linux execution coverage, and existing regression suites |

## Changes

None. Initial approved specification derived from the approved design and completed
interview.
