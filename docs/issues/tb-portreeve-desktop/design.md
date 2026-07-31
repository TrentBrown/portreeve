# Design - tb-portreeve-desktop

**Status:** approved (gate passed 2026-07-30)

## Problem

Portreeve has a portable JavaScript client and a standalone CLI/server, but its
installation, native supervision, status evidence, version coordination, and
global port inventory are exposed primarily through command-line workflows.
That is appropriate for automation, yet it leaves developers who do not want
to manage the CLI without an approachable way to install, understand, and
control their per-user Portreeve service.

A desktop application could solve that problem, but it also introduces a
privileged UI capable of installing executables, controlling a persistent
service, observing local processes, and deleting state. It must not become a
second supervisor, a second Portreeve installation, an alternate database
owner, or a generic shell bridge. It must also preserve the CLI and server as
independently distributable products.

The current lifecycle JSON output is still an unpublished pre-release shape.
The desktop requires a stable, non-collapsing lifecycle contract and a safe
complete-reset operation before either Portreeve `0.1.0` or the desktop
application can be released publicly.

## Intent

Build an optional, cross-platform-ready Portreeve management console in this
repository under `apps/desktop`. The first public application release targets
macOS 13 or newer and makes the ordinary per-user service lifecycle
approachable while preserving the existing authority boundaries:

- the OS supervisor keeps the service alive independently of the application;
- the server remains the sole owner of SQLite and live socket mutations;
- the official JavaScript client remains the live protocol interface;
- the CLI remains the canonical installation and lifecycle interface; and
- the renderer remains an untrusted presentation layer.

Before the public MVP, deliver a read-only engineering slice that proves
Electron packaging, renderer isolation, IPC, exact-executable discovery,
layered status, and global port inventory without exposing mutations.

The public MVP adds installation, confirmed upgrades, start, stop, restart,
data-preserving uninstall, and separately confirmed complete reset. It does not
add claims administration, activity/history, settings mutation, port
reclamation, unsafe eviction, forced escalation, menu-bar behavior, desktop
login startup, Linux packaging, or Windows support.

## Chosen shape

### Product and repository boundary

Portreeve Desktop is a separately versioned Electron application written in
vanilla JavaScript under `apps/desktop`. It uses a normal application window.
It is a new feature record rather than an amendment to the initial server
feature.

There is one default managed Portreeve service installation per OS user: one
stable managed executable, native supervisor definition, default Unix socket,
and registry/data home. Homebrew, direct-download, and desktop-bundled CLI
executables are installation sources and control copies, not separate service
installations. The desktop always manages the existing default installation
and never creates a desktop-specific authority.

Opening, closing, crashing, or updating the application does not start or stop
the service. The desktop does not register itself as a login item in the first
MVP. LaunchAgent on macOS and `systemd --user` on Linux remain the durable
supervisors.

### Main process, client, and CLI responsibilities

The Electron main process has two narrow adapters:

1. The official `portreeve` JavaScript client supplies socket health and global
   port inventory through the versioned Unix-socket protocol.
2. An exact known Portreeve executable supplies installation, supervisor,
   status, and lifecycle operations through versioned JSON commands.

The application never opens SQLite, imports server or Commander action
implementations, searches the user's shell `PATH`, or exposes a generic command
runner. Lifecycle commands work even when the socket server is unavailable.

The current unpublished lifecycle JSON is replaced in place with one canonical
first-release contract. No legacy parser or version-1/version-2 compatibility
layer is required. This does not alter the separate socket protocol unless the
desktop exposes a real protocol gap.

### Lifecycle evidence and version policy

`portreeve status --json` returns a non-collapsing snapshot with independently
observable layers:

- installation: absent or installed, including managed path and version
  evidence when available;
- supervisor: unavailable, inactive, starting, active, or failed, including
  kind, main PID, and layer error;
- socket: unavailable, healthy, unhealthy, or incompatible, including server
  evidence and layer error;
- mode: none, manual, supervised, or ambiguous;
- CLI, managed-service, and running-server versions; and
- observation time and evidence limitations.

Stopped, failed, incompatible, manual, and ambiguous states remain structured
results rather than collapsing into top-level errors. Supervision is verified
only when fresh native evidence and socket PID identity agree.

The desktop and CLI/server have independent versions. Every desktop release
records the desktop version and its exact bundled Portreeve version.
Compatibility, not equality, controls live protocol use.

When the managed installation differs from the bundle:

- an absent installation may be installed from the bundle;
- the same version is managed normally;
- an older version may be replaced only through an explicit confirmed upgrade;
- a newer version is never downgraded, but may be managed when compatible; and
- an incompatible newer version requires a newer desktop application.

A healthy manual `portreeve serve` process remains observable and may provide
read-only socket data when compatible. It is never adopted or replaced.
Lifecycle installation, upgrade, start, and restart controls remain disabled
until the user explicitly stops the manual server.

### Delivery sequence

The merged CLI/server implementation remains an unpublished baseline. The
first public Portreeve `0.1.0` release must first add:

- the stable layered lifecycle status and mutation-result schemas;
- managed-version evidence and no-downgrade checks;
- the application-home ownership marker;
- safe complete-reset preview and execution; and
- documentation and tests for the exact JSON consumed by the desktop.

After those prerequisites pass, publish and natively verify the standalone
CLI/server release through GitHub and Homebrew. Only then may the desktop
release consume that real artifact.

The first desktop delivery is a non-shipping read-only engineering slice. The
first public macOS MVP follows. Linux packaging is a separate follow-up
milestone built on platform-neutral adapters, view models, IPC, language, and
tests. Windows remains deferred until the server has Windows transport,
inspection, and supervision.

### First-run and ordinary lifecycle UX

When Portreeve is absent, the primary action is explicitly labeled **Install
and Start Portreeve**. Before confirmation it shows the managed location,
bundled version, and login-supervision effect. The main process then:

1. invokes the exact bundled CLI with `install --json`;
2. validates the installed state;
3. invokes `start --json`; and
4. verifies socket health and PID agreement with the native supervisor.

Install and start remain separate CLI operations and evidence boundaries.
Partial success is reported as the actual installed-but-inactive or failed
state rather than falsely described as rollback.

The public MVP also exposes explicit start, stop, restart, confirmed upgrade,
and confirmed data-preserving uninstall. An explicit manual-server stop is
available, but no manual server is silently adopted.

### Complete reset

The Overview danger section contains a separate **Uninstall and Delete All
Data** workflow. The CLI, not Electron, owns deletion.

Before confirmation, the desktop obtains and displays a nonmutating CLI dry run
that identifies the exact paths and state involved. The user must type
`DELETE`. A supervised server may be stopped as part of the confirmed
operation; a live manual server blocks reset and must be stopped separately.
Execution revalidates supervisor, socket, process, ownership, path, permission,
and symlink evidence immediately before mutation.

Every initialized Portreeve application home contains a versioned, nonsecret
ownership marker created only after validation. Existing homes acquire it
through validated migration or upgrade. A missing, malformed, mismatched, or
symlinked marker blocks recursive deletion. The marker is necessary but not
sufficient: roots, the user's home, unsafe ancestors, unrelated paths, unsafe
ownership or modes, symlink traversal, and changed live evidence also block
the operation.

Dry-run and execution evidence must agree on the same resolved root. Results
classify removed, retained, missing, and refused paths. Partial failure never
appears as a complete reset.

### Information architecture and refresh

The first public MVP has two primary views:

- **Overview**: three-layer status, desktop/bundled/managed/running versions,
  update availability, ordinary lifecycle actions, and an expandable danger
  section.
- **Ports**: searchable/filterable global inventory and a selected-port detail
  panel.

The main process refreshes immediately on open and focus, then every five
seconds while the window is visible. Polling pauses while hidden or minimized.
Refreshes and mutations do not overlap, and every mutation triggers an
immediate refresh. A manual refresh control remains available.

If a refresh fails, the renderer retains the last successful snapshot, marks
it stale with its observation time, and shows the current layer-specific error.
It never renders stale evidence as current or replaces a known snapshot with
an empty success.

The port view model includes PID, start time, executable basename, working
directory, numeric user, ownership/lineage relationship, claim identity and
lifecycle, listener addresses, and reconciliation classification. Raw process
command arguments never cross into the renderer because they may contain
credentials or private URLs.

### Electron privilege boundary

The renderer is sandboxed, has context isolation enabled, and has Node
integration disabled. It loads only packaged local content under a strict
Content Security Policy. Navigation and new windows are denied; approved
external links open in the system browser.

The preload bridge exposes only named, allowlisted, runtime-validated desktop
operations and subscriptions. It exposes no generic IPC, shell, executable
path, arbitrary arguments, filesystem primitive, server internals, or database
access. The main process owns all client, CLI, update, refresh, and lifecycle
authority and maps privileged results into reduced renderer view models.

Reusable destructive authorization, lease secrets, raw command execution, and
raw process command lines never enter the renderer. Every mutation revalidates
evidence in the main process and CLI rather than trusting renderer state.

### Updates, distribution, and artifact identity

The first desktop release is distributed directly, not through the Mac App
Store. It is Developer ID-signed, uses hardened runtime, is notarized, and
targets macOS 13 or newer. It publishes separate native ARM64 and x64
application artifacts; no universal application or dual-CLI bundle is created.

The CLI/server release pipeline is the sole authority for executable bytes.
Each desktop build consumes the already-published, architecture-specific,
signed CLI artifact, verifies its release checksum, and does not rebuild,
patch, combine, or re-sign it. The desktop manifest records both product
versions, source release, artifact name, and checksum. Application signing and
notarization must preserve and reverify the nested executable byte-for-byte.
The packaged application and full lifecycle run natively on both supported
architectures before release.

The desktop checks a fixed release-manifest endpoint on launch at most once
every 24 hours. It sends no identifier, analytics, project data, or dynamic
query parameters. Failure is nonfatal. The first MVP only reports availability
and opens the signed download page; it does not automatically download,
install, or restart itself. A newly installed desktop may separately offer a
confirmed managed-service upgrade. This update check is the only first-MVP
outbound runtime request; no telemetry is added.

## Alternatives considered

- **Separate desktop repository:** rejected initially because the application
  and unpublished lifecycle contract must evolve together, and the desktop
  must consume exact release artifacts from the same coordinated project.
- **Tauri:** retained as a future lightweight alternative, but rejected for the
  first proof because Electron's Node main process can use the official client
  directly without adding a Rust relay or sidecar permission model.
- **Desktop as supervisor:** rejected because service lifetime must not depend
  on the GUI process.
- **Direct server or SQLite imports:** rejected because they bypass the public
  protocol and single mutation authority.
- **Shell out for all live data:** rejected because the official client already
  provides health and inventory without repeated parsing and generic process
  spawning.
- **Search `PATH` for a CLI:** rejected because lifecycle operations must use a
  known executable and version.
- **Desktop-specific service installation:** rejected because Portreeve has one
  per-user managed authority independent of distribution channel.
- **Silent upgrade or downgrade:** rejected because an independently installed
  version is legitimate and replacement requires evidence and consent.
- **Read-only slice as public MVP:** rejected because a console for non-CLI
  users must provide useful installation and ordinary lifecycle controls.
- **Mac App Store first:** rejected because App Sandbox and the Electron MAS
  build would force a different helper/storage model before the core product is
  proven.
- **Desktop launch at login:** rejected absent a real continuous-monitoring or
  notification requirement.
- **Linux in the first public milestone:** rejected to keep the first
  packaging/signing/lifecycle proof focused; platform-neutral architecture is
  still required.
- **Automatic desktop or service updates:** rejected because discovery and
  execution are separate consent boundaries.
- **Data-preserving uninstall only:** rejected because a complete,
  fully-testable reset/reinstall workflow is an explicit MVP requirement.
- **Electron-owned recursive deletion:** rejected because destructive state
  cleanup must be reusable, schema-driven, and safety-checked by the CLI.
- **Filesystem permissions as deletion proof:** rejected because an arbitrary
  private directory could satisfy them without being Portreeve-owned.
- **Legacy lifecycle JSON compatibility:** rejected because no previous
  contract has been deployed or published.
- **Joint first CLI and desktop launch:** rejected so the desktop can consume
  and test a real independently published authority.
- **Rebuilding or re-signing the bundled CLI:** rejected because GitHub,
  Homebrew, and desktop must share one authoritative executable.
- **Universal macOS application:** rejected because it would combine or carry
  multiple CLI architectures and weaken exact-artifact simplicity.
- **Remote renderer content or generic IPC:** rejected because the application
  controls service lifecycle and destructive local operations.
- **Raw process commands in the renderer:** rejected because arguments may
  expose secrets without improving the first-MVP diagnosis.

## Constraints

- Preserve all approved initial-release Portreeve authority, socket, process
  evidence, and native-supervision invariants unless this design explicitly
  strengthens them.
- Keep the desktop in vanilla JavaScript and use the public JavaScript client
  for live protocol operations.
- Treat lifecycle JSON as a first public contract before releasing Portreeve
  `0.1.0`; do not invent a legacy compatibility layer.
- Do not release the desktop until the exact bundled CLI version has already
  passed the standalone release matrix and been published.
- Do not publish while the repository visibility, native runner, signing,
  notarization, npm, or artifact prerequisites required by the relevant
  release remain unresolved.
- Keep all lifecycle and destructive mutations explicit, evidence-bound, and
  accurately reported under partial failure.
- Keep normal uninstall data-preserving and complete reset separately
  previewed and typed-confirmed.
- Keep renderer schemas narrower than privileged protocol and CLI results.
- Support macOS 13+ ARM64 and x64 natively in the first public desktop release.
- Keep Linux adapters and renderer contracts viable without claiming Linux
  packaging in the macOS milestone.
- Make update checking optional to successful operation, identifier-free, and
  the only outbound runtime network request.

## Open risks

- The exact lifecycle status and mutation JSON schemas, exit-status semantics,
  and runtime validation package are not yet specified.
- Safe marker migration for the existing pre-marker application home must
  distinguish recognized Portreeve state from unrelated private data without
  normalizing unsafe paths.
- Recursive deletion remains high risk even with a marker; preview/execution
  binding, symlink resistance, changed-evidence handling, and partial failure
  need adversarial tests.
- The packaging pipeline must prove that signing and notarization preserve the
  nested CLI's authoritative bytes and signature.
- Native macOS x64 signing and full lifecycle execution require reliable native
  runner capacity.
- The existing CLI/server release still has external prerequisites, including
  public visibility and the authoritative Linux ARM64 release runner.
- A five-second inventory cadence invokes fresh listener inspection and may
  require performance measurement or adaptive refresh without weakening
  freshness labeling.
- Working directories and process metadata remain locally sensitive even after
  raw command arguments are removed; the renderer schema and screenshots must
  avoid accidental disclosure.
- The fixed update manifest format, hosting path, architecture selection,
  integrity checks, and failure behavior require specification.
- Independent desktop and CLI/server versions make release coordination
  explicit but require clear manifests, UI language, and test matrices.

## Changes

Append approved design amendments here. Do not remove or weaken original
decisions.
