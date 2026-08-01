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

[x] **Promote**

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

## [4] Defer first publication without blocking non-shipping desktop development

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** P4-P9 sequencing, npm authentication, desktop artifact inputs, issue dependencies, release identity evidence, and public release gates

Keep the npm account's hardware-key protection and defer the first npm/GitHub publication. Continue the non-shipping P5-P8 desktop engineering work against the checksummed locally built 0.1.0 release-candidate executable and the workspace JavaScript client. This provisional input may satisfy engineering tests but cannot satisfy published-artifact identity. I-3 remains open, and P9 plus every public desktop release remain blocked until 0.1.0 is published, inspected, and npm trusted publishing is configured for release.yml. After publication, replace the provisional input with the exact downloaded architecture-specific artifact and verify its checksum and byte identity before native packaging.

**Triggered by:** The first npm publish requires awkward interactive or bootstrap-token authentication, while trusted publishing becomes available only after the package exists

**Alternatives considered:**

- Remove hardware-key or 2FA protection and store username/password in GitHub -
  rejected because npm publishing still requires 2FA or a publishing token,
  primary credentials do not belong in CI, and OIDC removes the recurring
  need.
- Stop all desktop work until publication - rejected because P5-P8
  architecture, security, state, and UI work can be verified against a
  checksummed local release candidate without claiming release identity.
- Publish GitHub artifacts without the npm client - rejected because the
  approved P4 channels include the official client package and partial
  publication would complicate release recovery.

## [5] Pin Electron 43 and Electron Packager 20 for the engineering slice

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** workspace lockfile, desktop runtime, Chromium and Node security surface, packaging scripts, macOS support, CI, and future signing/notarization work

Pin Electron 43.2.0 and @electron/packager 20.0.4 in the private desktop workspace. Electron 43 is the current stable release and supplies a current Chromium/Node security baseline; Electron Packager provides the minimal non-shipping application bundle needed for P5 without committing to the P9 signing/notarization toolchain. Keep renderer sandboxing, context isolation, Node integration, navigation, permissions, IPC, and local content restrictions explicit in code and tests rather than relying only on Electron defaults.

**Triggered by:** P5 introduces the first desktop runtime and packaging dependencies

**Alternatives considered:**
Use an older Electron line - rejected because the approved macOS 13 floor does not require it and Electron recommends current releases for security fixes.
Adopt electron-builder now - rejected because P5 needs a local engineering bundle, while signing, notarization, update manifests, and public installers belong to P9.
Build the UI in a browser-only harness first - rejected because process isolation and IPC are core acceptance boundaries that require Electron from the first slice.

## [6] Keep mutation authority and purge tokens in the main process

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** desktop IPC schemas, preload API, lifecycle adapter, coordinator serialization, reset confirmation, renderer tests, and future multi-window behavior

Expose one named preload method per approved user action rather than a generic command or action-plus-arguments channel. The main process maps each method to fixed CLI arguments, validates the CLI envelope, serializes mutations against refreshes, and immediately refreshes after completion. Purge preview returns only reduced display evidence; its CLI confirmation token remains in main-process memory, is replaced by a newer preview, is consumed before one execution attempt, and never crosses IPC. Purge execution additionally requires the exact typed DELETE value and relies on the CLI to re-preview and refuse drift. Ordinary lifecycle and onboarding results cross IPC only as reduced, runtime-validated outcomes plus the refreshed snapshot.

**Triggered by:** P7 introduces lifecycle mutation and complete-reset capabilities across the untrusted Electron renderer boundary

**Alternatives considered:**
- Expose a generic mutate action with arbitrary arguments - rejected because it expands renderer authority and weakens IPC allowlisting.
- Return the purge confirmation token to the renderer - rejected because the renderer does not need it and the approved privilege boundary excludes reusable destructive authorization.
- Reimplement install, stop, or deletion in Electron - rejected because the CLI is the canonical lifecycle and filesystem safety boundary.

## [7] Separate desktop runtime data from the CLI application home

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Electron startup paths, packaged reset previews, local cache placement, uninstall/reset verification, and cross-platform desktop behavior

Set Electron's `userData` path to an explicit `Portreeve Desktop` directory beneath the platform application-data root before the app becomes ready. The CLI retains exclusive ownership of the marker-bound `Portreeve` application home. Desktop Chromium caches, preferences, and storage must never appear in the CLI deletion tree or prevent an otherwise valid purge preview.

**Triggered by:** packaged P7 verification showed Electron populating the CLI application home and the CLI correctly refusing purge because the ownership marker did not authorize those desktop-created files

**Alternatives considered:**
- Share one application-data directory - rejected because Electron writes files outside the CLI's ownership and schema contracts.
- Teach CLI purge to recognize Chromium cache paths - rejected because that would expand destructive authority and couple the service lifecycle to Electron internals.
- Disable all Electron persistence - rejected because Chromium may still require runtime storage and future desktop preferences/update state need an independently owned location.

## [8] Keep update discovery fixed, nonblocking, and notification-only

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** desktop network behavior, public update-manifest schema,
local desktop persistence, coordinator snapshots, renderer IPC, external
navigation, release publishing, and privacy verification

Check one constant raw-GitHub manifest URL at application launch through a
dedicated main-process adapter. The strict version-1 manifest contains only
the latest desktop semantic version; the approved download page is a separate
compile-time constant and never comes from network data or renderer arguments.
Persist only the check timestamp and reduced result beneath the separate
Portreeve Desktop user-data root. A valid cached result suppresses all network
activity for 24 hours, including after an unavailable or malformed response.

Update discovery runs independently after the initial local lifecycle and port
snapshot, so a slow or failed request cannot delay local management. The
renderer receives only `not-checked`, `current`, `available`, or `unavailable`
state plus the check time and latest version. It may invoke one named,
no-argument operation that opens the fixed GitHub Releases page only while an
update is available. Discovery never downloads, installs, restarts, or upgrades
anything.

**Triggered by:** P8 resolves the approved but previously implementation-level
release-manifest, cadence-persistence, and external-navigation boundaries.

**Alternatives considered:**

- Put a release/download URL in the manifest - rejected because network data
  does not need to control navigation and a fixed page is easier to audit.
- Await update discovery inside ordinary state refresh - rejected because a
  remote dependency could delay or block local Portreeve management.
- Retry every launch after failures - rejected because the explicit policy is
  at most one outbound check per 24 hours, not one successful check.
- Expose a generic open-external URL operation - rejected because it would let
  the renderer select navigation targets across the privilege boundary.
