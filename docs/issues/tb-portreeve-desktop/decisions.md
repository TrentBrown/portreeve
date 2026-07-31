# Decisions - tb-portreeve-desktop

**Feature start:** 2026-07-30

Permanent record of decisions promoted from `scratchpad.md`.

## [1] Use snapshots as the canonical lifecycle evidence boundary

**PR:** [#2](https://github.com/TrentBrown/portreeve/pull/2)

**Confidence:** HIGH

**Blast Radius:** lifecycle schemas, supervision manager, CLI JSON and exit
semantics, documentation, tests, and the future desktop main-process adapter

Define one runtime-validated lifecycle snapshot containing independent
installation, supervisor, and socket layers plus effective mode and
CLI/managed/running versions. Every lifecycle mutation returns a common
structured result with operation, outcome, changed flag, timestamps,
before/after snapshots, and a structured error when refused or failed.
Ordinary unavailable, stopped, incompatible, and layer-failure states remain
inside snapshots. `stop` controls supervised state; a separate `stop-manual`
operation makes manual-server termination explicit. The top-level CLI JSON
envelope remains version 1 because no earlier lifecycle contract was
published.

**Triggered by:** I-1 changes the lifecycle API contract that the desktop will
runtime-validate and consume.

**Alternatives considered:**

- Preserve command-specific legacy payloads - rejected because they force the
  desktop to infer state and partial success across unrelated shapes.
- Return every refused or failed mutation as a top-level CLI error - rejected
  because it loses trustworthy before/after evidence and cannot represent
  partial mutation truthfully.
- Let `stop` terminate either mode implicitly - rejected because manual-server
  termination is a separate user consent boundary in the approved design.

## [2] Bind purge execution to a deterministic preview token

**PR:** [#2](https://github.com/TrentBrown/portreeve/pull/2)

**Confidence:** HIGH

**Blast Radius:** application-home initialization, filesystem safety, lifecycle
CLI, native supervision cleanup, desktop reset orchestration, documentation,
and release tests

Create `.portreeve-owner.json` only for an empty private application home or a
private home containing recognized Portreeve entries. The strict marker records
its schema, product, canonical root, user ID, and creation time. Purge preview
walks that marker-bound root without following symlinks and returns a SHA-256
confirmation token over canonical marker, lifecycle, supervisor-definition,
and filesystem evidence. `portreeve purge --confirm <token>` immediately
rebuilds the preview and refuses changed evidence before mutation. The token
is evidence binding, not a secret or substitute for the desktop's typed
`DELETE` confirmation.

**Triggered by:** I-2 introduces recursive deletion and a new destructive CLI
contract.

**Alternatives considered:**

- Accept `--yes` without a preview identity - rejected because the deletion
  target or live process state could change between inspection and execution.
- Persist a purge plan in the application home - rejected because it adds
  mutable authorization state inside the directory being evaluated.
- Let Electron delete the directory - rejected because it duplicates the
  safety boundary and makes headless uninstall/reinstall testing inconsistent.
