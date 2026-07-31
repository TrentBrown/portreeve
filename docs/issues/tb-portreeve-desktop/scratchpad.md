# Decision Scratchpad - tb-portreeve-desktop

**Feature start:** 2026-07-30

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Use snapshots as the canonical lifecycle evidence boundary

[x] **Promote**

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

[x] **Promote**

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

## [3] Use hosted ARM64 and bootstrap npm trust after first publish

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** release workflow, Linux ARM64 native evidence, npm authentication, provenance, release documentation, and P4 completion

Replace the self-hosted Linux ARM64 matrix entry with GitHub's native ubuntu-24.04-arm runner. Keep the first npm publication fail-closed behind an authenticated NPM_TOKEN because npm requires the package to exist before trusted publishing can be configured. After portreeve 0.1.0 exists, configure release.yml as the package's GitHub Actions trusted publisher and remove the long-lived publish token in a follow-up hardening step. The repository is public before publication so GitHub Release/Homebrew URLs and npm provenance are publicly verifiable.

**Triggered by:** P4 prerequisite audit found no self-hosted runner and no npm credentials, while current GitHub and npm capabilities differ from the original release assumptions

**Alternatives considered:**

- Keep a self-hosted ARM64 runner - rejected because GitHub now supplies the
  required native architecture and no local runner is registered.
- Use OIDC for the first npm publish - rejected because npm's trust
  configuration requires an existing package.
- Publish without npm - rejected because P4 and the approved release channels
  require the official client package.
