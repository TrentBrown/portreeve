# Interview - tb-portreeve-desktop

**Feature start:** 2026-07-30
**Status:** concluded

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - Establish the product and first-slice boundary

**Question:** Should Portreeve Desktop begin as a separate feature in the
existing repository under `apps/desktop`, using Electron and vanilla
JavaScript, with a normal macOS window and a read-only status/inventory first
slice?

**Answer:** Approved.

**Decision:** Portreeve Desktop is the separate
`tb-portreeve-desktop` feature. Its leading implementation shape is an Electron
application under `apps/desktop`, with a sandboxed renderer, a narrow IPC
boundary, and a Node main process. The first delivery is macOS-first and
read-only: it reports installation, native-supervisor, socket-health, version,
and global port-inventory state. Menu-bar behavior, Linux packaging, and
mutating service controls are outside that first slice.

**Rationale:** Keeping the first slice read-only proves application packaging,
the Electron security boundary, official-client integration, exact-executable
status inspection, and the three-layer status model without making a new UI
capable of changing supervision or signaling processes.

## D2 - Separate live protocol operations from lifecycle commands

**Question:** Should the desktop main process use the official JavaScript
client for live server operations and invoke an exact bundled Portreeve
executable for lifecycle commands, while refusing SQLite access, server
imports, shell `PATH` lookup, and generic command execution?

**Answer:** Approved as part of the initial boundary.

**Decision:** The Electron main process uses the public Unix-socket client for
health and inventory. Lifecycle information and later lifecycle mutations use
an exact known Portreeve executable through versioned JSON commands. The
renderer receives desktop-specific view models through allowlisted IPC and
never receives a shell bridge, Node integration, database access, or server
internals.

The lifecycle command envelope is already versioned, but its inner status and
mutation payloads are currently raw internal objects. Mutating desktop
controls must not depend on those accidental shapes; their schemas and
compatibility contract must be designed and tested first.

## D3 - Distinguish the engineering slice from the first public MVP

**Question:** Should the read-only status/inventory slice explicitly be an
internal engineering milestone rather than the first shippable desktop
release?

**Answer:** Yes.

**Decision:** The first read-only slice is a technical proof, not the public
MVP. It proves application packaging, renderer isolation, IPC, official-client
access, bundled-executable discovery, status classification, and inventory
rendering. It may display an absent or stopped installation without providing
an action.

The first public MVP must provide enough lifecycle capability to be useful to
a developer who does not want to manage Portreeve through the CLI. Its exact
mutation surface remains to be resolved in the interview.

## D4 - Preserve one installation across independent distribution channels

**Question:** How should the desktop application behave when the single
managed Portreeve installation differs from the executable bundled with the
application?

**Answer:** Use the proposed evidence-first policy: install when absent;
manage the same version normally; offer an explicit upgrade for an older
installation; never downgrade a newer installation; and never adopt or
replace a manually running server.

**Decision:** The desktop application manages the existing per-user Portreeve
installation rather than creating a desktop-specific installation. An absent
installation may be created from the exact bundled executable. Replacing an
older managed executable requires explicit confirmation. A newer managed
version is never replaced by an older desktop bundle; the desktop may manage
it when protocol-compatible and otherwise reports that the application must be
upgraded. A manual server remains observable but is not adopted or replaced.

## D5 - Distinguish service installation from executable copies

**Question:** Is there always only one Portreeve installation, rather than one
CLI installation and a separate desktop-managed installation?

**Answer:** Yes, with a terminology distinction between the managed service
and the executable copies capable of controlling or installing it.

**Decision:** Portreeve has one default managed service installation per user:
one stable managed executable, one native supervisor definition, one default
Unix socket, and one registry/data home. The desktop application does not
create a second service, socket authority, or registry.

Several executable copies may coexist on disk, such as a Homebrew-installed
CLI, a direct-download CLI, and the executable bundled inside the desktop
application. Those are distribution or control copies, not separate service
installations. Invoking `portreeve install` from one of them copies that exact
executable into the same stable managed-service location.

The desktop UI should therefore use terms such as "managed service version"
and "desktop-bundled version," not imply that its bundled executable is a
second installed Portreeve instance.

## D6 - Bound the first public desktop MVP

**Question:** Should the first public desktop MVP include install, confirmed
upgrade, start, stop, restart, and confirmed uninstall, plus read-only status
and ports, while deferring claims, activity, settings, reclamation, and unsafe
eviction?

**Answer:** Yes.

**Decision:** The first public MVP manages the ordinary per-user service
lifecycle and provides read-only operational visibility. It includes:

- installation from the exact desktop-bundled executable;
- explicit, confirmed upgrades that obey the no-downgrade policy;
- start, stop, and restart;
- explicit, confirmed uninstall while preserving Portreeve data;
- the three-layer installation/supervisor/socket status model;
- application, bundled, managed-service, and running-server version evidence;
- read-only global port inventory; and
- an explicit way to stop, but never adopt, a manual Portreeve server.

Claims administration, history and diagnostic activity, settings mutation,
verified reclamation, unsafe any-owner eviction, and forced escalation are
deferred beyond the first public MVP.

## D7 - Use direct signed and notarized macOS distribution

**Question:** Should the first desktop release explicitly exclude Mac App
Store compatibility and target direct Developer ID-signed and notarized macOS
distribution?

**Answer:** Yes.

**Decision:** The first Portreeve Desktop release is distributed directly as a
Developer ID-signed, hardened-runtime, notarized macOS application, using an
appropriate direct-download container such as a DMG or ZIP. Mac App Store
submission, the Electron MAS build, and App Sandbox compatibility are not
first-release requirements.

**Rationale:** The existing product has an independently managed per-user
service, stable data outside an application sandbox, an exact bundled CLI
payload, and a CLI-owned LaunchAgent lifecycle. Making App Store sandbox rules
controlling constraints would force a substantially different helper and
storage design before the core desktop experience is proven.

Signing and notarization must cover the application and every nested
executable, including the bundled Portreeve CLI. Release verification must
exercise the signed, packaged artifact rather than only an unpackaged
development build.

## D8 - Keep desktop login behavior out of the first MVP

**Question:** Should the desktop application remain manually opened in the
first MVP, with no launch-at-login option?

**Answer:** Yes.

**Decision:** Portreeve Desktop does not register itself as a login item in the
first MVP. Opening, closing, crashing, or upgrading the management console has
no effect on whether the Portreeve service runs. Persistent login behavior
belongs exclusively to the native Portreeve service supervisor.

An optional desktop login item is deferred until there is a concrete
notification or continuous-monitoring use case that requires the UI process
to be present.

## D9 - Deliver Linux desktop packaging after the macOS MVP

**Question:** Should Linux desktop packaging be a separate follow-up milestone
after the macOS MVP, while keeping the application architecture and UI
platform-neutral from the beginning?

**Answer:** Yes.

**Decision:** The first public Portreeve Desktop milestone supports macOS.
Linux desktop packaging and native lifecycle validation are a distinct
follow-up milestone. The main-process adapters, renderer view models, IPC
contracts, UI language, and tests must avoid Mac-only assumptions so the Linux
work adds packaging and platform integration rather than replacing the
application architecture.

Windows remains outside both milestones until the Portreeve service has a
Windows transport, listener/process inspection, and native supervision model.

## D10 - Version the desktop application independently

**Question:** Should Portreeve Desktop have its own version number, independent
from the CLI/server version bundled with it?

**Answer:** Yes.

**Decision:** The desktop application and Portreeve CLI/server use independent
release versions. Every desktop build and release manifest records both the
desktop version and the exact bundled Portreeve version. UI-only changes do not
force a server release, and CLI/server releases remain independently
distributable.

Version equality is informational, not the compatibility rule. The desktop
uses the protocol range and required capabilities for live operations, plus
the lifecycle JSON contract version for CLI operations, to decide whether it
can manage an existing installation. The UI displays desktop, bundled,
managed-service, and running-server versions as distinct evidence.

## D11 - Make update discovery automatic but update execution explicit

**Question:** Should the first MVP perform a privacy-preserving desktop update
check while requiring the user to download and install the application and to
approve any subsequent managed-service upgrade separately?

**Answer:** Yes.

**Decision:** Portreeve Desktop checks a fixed release-manifest endpoint at
launch no more than once every 24 hours. The request contains no installation
identifier, analytics, project data, or dynamic query parameters. The
application records the check time locally, displays update availability, and
opens the signed direct-download page when the user chooses to update.

The first MVP does not download, install, restart, or replace the desktop
application automatically. Installing a newer desktop version also does not
silently replace the managed Portreeve service. If the new application bundles
a newer compatible Portreeve executable, it presents the separately confirmed
service-upgrade workflow from D4.

Failure to reach or validate the update endpoint is nonfatal and must not
affect local management capabilities. Update checks are the only first-MVP
outbound runtime network request; no telemetry is added.

## D12 - Make first-run onboarding an explicit install-and-start workflow

**Question:** When Portreeve is absent, should the desktop primary action be
explicitly labeled "Install and Start Portreeve" and orchestrate the separate
CLI operations under one confirmation?

**Answer:** Yes.

**Decision:** First-run onboarding presents the managed location, bundled
Portreeve version, and login-supervision effect, then requests one explicit
confirmation for "Install and Start Portreeve." The desktop:

1. invokes the exact bundled executable with `install --json`;
2. validates the resulting managed installation;
3. invokes `start --json`; and
4. validates socket health and that the responding PID matches the native
   supervisor's main PID.

Each step remains a distinct CLI operation and audit/evidence boundary. If
installation succeeds but start or health verification fails, the UI reports
the accurate installed-but-inactive or failed state and does not claim that
the workflow rolled back installation.

## D13 - Include a complete uninstall-and-reset path

**Question:** Should first-MVP uninstall remain strictly data-preserving?

**Answer:** No. Keep an option to delete all Portreeve data in scope so the
complete uninstall/reinstall lifecycle can be exercised.

**Decision:** The first public MVP includes both a normal data-preserving
uninstall and a separate complete uninstall-and-delete-data workflow. Complete
removal is a supported destructive operation, not an undocumented renderer
filesystem shortcut.

The Electron process must not recursively delete the Portreeve application
directory itself. The CLI remains the canonical lifecycle boundary and must
gain an explicit, structured, testable purge contract. That contract must
stop or refuse live activity as designed, remove native supervision and
managed executables, delete only validated Portreeve-owned state, and return a
versioned JSON result that identifies what was removed or refused.

The exact confirmation ceremony, handling of a live manual server, and safe
deletion boundary remain open.

## D14 - Make complete reset evidence-first and separately confirmed

**Question:** Should complete reset be a separate danger-zone workflow with a
CLI-produced dry-run inventory, typed confirmation, live-process safeguards,
and a structured deletion result?

**Answer:** Yes.

**Decision:** "Uninstall" remains the ordinary data-preserving action.
"Uninstall and Delete All Data" is visually and operationally separate. Before
confirmation, the desktop requests a nonmutating CLI dry run and displays the
exact paths and state that would be affected. The user must type `DELETE`.

An active supervised server may be stopped as part of the confirmed purge. An
active manual server blocks purge and must be stopped through the separate
explicit manual-server action first. The CLI reinspects native supervision,
socket health, processes, filesystem ownership, path types, permissions, and
symlinks immediately before mutation.

The desktop invokes the versioned CLI operation and does not delete paths
itself. The result identifies removed, retained, missing, and refused paths.
Partial failure is reported accurately and never rendered as a complete
reset.

## D15 - Require an ownership marker before recursive deletion

**Question:** Should every complete reset require a valid Portreeve ownership
marker inside the resolved application home before recursive deletion is
allowed?

**Answer:** Yes.

**Decision:** Portreeve application homes contain a versioned, nonsecret
ownership marker created only after the CLI validates the directory,
ownership, permissions, path types, and recognizable Portreeve state. Custom
homes used by tests follow the same initialization path and receive the same
marker. Existing installations created before the marker gain it only through
a validated migration or upgrade.

Complete reset refuses an absent, malformed, mismatched, or symlinked marker.
Possession of a valid marker is necessary but not sufficient: the CLI also
refuses filesystem roots, the user's home directory, and unsafe ancestors or
unrelated paths; revalidates live server and supervisor evidence; and does not
follow symlinks during deletion.

The marker proves Portreeve ownership of the deletion root. The dry-run and
execution phases both return marker evidence and must agree on the same
resolved path before mutation.

## D16 - Limit the first-MVP information architecture to Overview and Ports

**Question:** Should the first public MVP have only an Overview view and a
Ports view, with destructive lifecycle actions contained in an expandable
Overview danger section?

**Answer:** Yes.

**Decision:** The first-MVP application has two primary destinations:

- **Overview** shows installation, native-supervisor, and socket-server state;
  desktop, bundled, managed-service, and running-server versions; desktop
  update availability; ordinary lifecycle actions; and an expandable danger
  section for data-preserving uninstall and complete reset.
- **Ports** shows a searchable and filterable global inventory table and a
  detail panel for the selected port's claim and listener evidence.

There is no separate dashboard, settings, activity, claims, reclamation, or
danger-zone destination in the first MVP. Destructive controls are not shown
alongside ordinary start/stop/restart controls and require their independently
defined previews and confirmations.

## D17 - Poll visible state and preserve stale evidence

**Question:** Should the desktop use a coordinated visible-window refresh,
pause polling while hidden, prevent overlap, and retain failed snapshots as
explicitly stale evidence?

**Answer:** Yes.

**Decision:** The main process refreshes immediately when the application
window opens or regains focus. While the window is visible, one coordinated
refresh runs every five seconds: it obtains lifecycle status through the exact
known CLI and, when the socket is usable, obtains port inventory through the
official client. Polling pauses while the window is hidden or minimized.

Only one refresh or lifecycle mutation may own the relevant adapter at a time;
timer ticks never overlap and lifecycle actions trigger an immediate refresh
after completion. The UI includes a manual refresh control.

On refresh failure, the renderer retains the last successful snapshot, marks
it stale with its observation time, and displays the current layer-specific
error. It must not render stale evidence as current or replace a known prior
state with an empty success.

## D18 - Make lifecycle status a non-collapsing evidence snapshot

**Question:** Should `portreeve status --json` independently report
installation, native supervisor, socket server, execution mode, versions, and
layer-specific errors even when one layer is stopped, failed, unhealthy, or
incompatible?

**Answer:** Yes.

**Decision:** Lifecycle status becomes a versioned, non-collapsing snapshot.
It reports:

- installation as absent or installed, with managed-path and version evidence
  when observable;
- supervisor as unavailable, inactive, starting, active, or failed, with its
  kind, main PID, and layer error when applicable;
- socket as unavailable, healthy, unhealthy, or incompatible, with server
  evidence and error when applicable;
- effective mode as none, manual, supervised, or ambiguous;
- CLI, managed-service, and running-server versions; and
- the observation time and any evidence limitations.

Stopped, failed, incompatible, manual, and ambiguous conditions are structured
status results rather than top-level CLI exceptions. They may use the ordinary
state-difference exit band. A top-level error is reserved for invalid
invocation or failure to construct a trustworthy snapshot at all.

The desktop derives its view model from this snapshot and must not infer
supervision merely from a stored PID or a responding socket.

## D19 - Replace the unpublished lifecycle contract in place

**Question:** Should the desktop require lifecycle contract version 2 for
mutating operations while retaining compatibility with the existing version 1
shape?

**Answer:** No compatibility layer is necessary. Portreeve has not been
deployed or published and currently has one user, so previous lifecycle JSON
shapes do not need continued support.

**Decision:** Treat the current lifecycle CLI JSON as a pre-release contract
and replace its lifecycle payload shapes in place with one canonical
first-release schema. The CLI, documentation, tests, bundled executable, and
desktop main process all move together. The desktop has one runtime validator
and no legacy status parser, mutation fallback, or lifecycle capability matrix.

The existing top-level CLI JSON version may remain `1` because there is no
published consumer contract to distinguish. It must be frozen as the public
version only when the first release is actually published.

This simplification applies to lifecycle CLI output. The Unix-socket protocol
remains a separate versioned public boundary used by the official client and
is not changed merely to avoid lifecycle compatibility work.

No-downgrade behavior, independent desktop/server versions, explicit bundled
version evidence, and future compatibility negotiation remain required. They
protect installations after publication rather than preserving an unpublished
prototype shape.

## D20 - Make desktop lifecycle prerequisites part of the first CLI release

**Question:** Should Portreeve's first public CLI/server release wait until the
desktop-required lifecycle contracts, ownership marker, and complete-reset
operation are finished?

**Answer:** Yes.

**Decision:** The merged `0.1.0` implementation remains an unpublished
development baseline. Portreeve's first public CLI/server contract includes:

- the non-collapsing lifecycle status schema;
- stable structured results for install, start, stop, restart, uninstall, and
  upgrade;
- managed and running version evidence plus no-downgrade safeguards;
- the validated application-home ownership marker;
- complete-reset dry run and execution with the D14-D15 safety boundary; and
- documentation and tests for the exact JSON shapes consumed by the desktop.

No existing publication must be preserved, so these changes may refine the
first-release contract in place. Portreeve must not publish `0.1.0` merely to
preserve the earlier merged implementation boundary.

## D21 - Publish the CLI/server before the desktop application

**Question:** After the desktop lifecycle prerequisites pass, should the
CLI/server `0.1.0` release precede the first Portreeve Desktop release rather
than launching both simultaneously?

**Answer:** Yes.

**Decision:** Portreeve first publishes and verifies the standalone
CLI/server `0.1.0` through its GitHub Release and Homebrew channels. Portreeve
Desktop is published afterward with its independent application version and a
declared bundled Portreeve version.

The desktop release must exercise installation, service lifecycle, reset, and
reinstall against the real CLI/server release artifact rather than making the
desktop launch the first distribution test. This ordering preserves
independent release identities and lets the desktop bundle and compatibility
logic target a concrete public Portreeve release.

## D22 - Bundle the exact published CLI artifact

**Question:** Should the desktop application contain the byte-for-byte same
signed Portreeve executable published through the CLI/server GitHub Release and
referenced by Homebrew?

**Answer:** Yes.

**Decision:** The CLI/server release pipeline is the sole build authority for
the Portreeve executable. A desktop build consumes the already-produced,
architecture-specific, signed release artifact; verifies it against the
CLI/server release manifest and checksum before packaging; and does not rebuild,
patch, combine, or re-sign its contents.

The desktop release manifest records the desktop version, bundled Portreeve
version, source release, artifact name, and checksum. Packaging and
notarization verification recheck that the nested executable remains
byte-identical and validly signed. The desktop release fails if application
signing or packaging changes the nested executable.

## D23 - Publish separate native macOS desktop artifacts

**Question:** Should the first desktop release publish separate macOS ARM64
and x64 artifacts rather than a universal application?

**Answer:** Yes.

**Decision:** Each desktop release publishes distinct ARM64 and x64 macOS
artifacts. Each application contains only the matching architecture-specific
CLI artifact from D22 and is signed, notarized, packaged, and lifecycle-tested
on its native target.

The first release does not create a universal application, combine CLI
binaries with `lipo`, or carry both CLI architectures and select one at
runtime. The download page and update manifest identify architecture
explicitly so the user receives the correct artifact.

## D24 - Make the Electron renderer an untrusted presentation layer

**Question:** Should the desktop enforce a sandboxed local-only renderer with
context isolation, no Node integration, strict navigation/CSP controls, narrow
schema-validated IPC, and no raw shell or lifecycle authority?

**Answer:** Yes.

**Decision:** The renderer runs sandboxed with context isolation enabled and
Node integration disabled. It loads only packaged local content under a strict
Content Security Policy. Application navigation and new windows are denied;
approved external destinations open in the system browser.

A preload bridge exposes only named, allowlisted desktop operations and
subscriptions with runtime-validated inputs and outputs. It exposes no generic
IPC transport, shell command, executable path, arbitrary argument list,
filesystem primitive, or server/database import. The main process owns the
official client, exact CLI execution, update checking, refresh coordination,
and all lifecycle authority.

Reusable destructive authorization, lease secrets, raw command execution, and
other privileged material never cross into the renderer. Every lifecycle
operation revalidates its own evidence in the main process and CLI rather than
trusting renderer state.

## D25 - Exclude raw process command lines from renderer data

**Question:** Should the desktop main process omit raw process command lines
from the renderer because arguments may contain credentials, tokens, or
private URLs?

**Answer:** Yes.

**Decision:** The renderer's port-detail view model contains only the process
evidence needed for local diagnosis: PID, start time, executable basename,
working directory, numeric user identity, ownership/lineage relationship,
claim identity and lifecycle, listener addresses, and reconciliation
classification. It does not contain raw command arguments.

The main process explicitly maps protocol inventory records into this reduced
schema and discards the raw command string before IPC. The renderer never
receives the original inventory object by pass-through. Exposing additional
process details later requires a deliberate privacy review and schema change.

## D26 - Set the first desktop release floor to macOS 13

**Question:** Should the first desktop release support macOS 13 Ventura or
newer on both ARM64 and x64?

**Answer:** Yes.

**Decision:** Portreeve Desktop's first public release supports macOS 13 or
newer and publishes separately verified ARM64 and x64 artifacts. It may use a
current Electron line without retaining an older runtime solely for pre-Ventura
compatibility.

The release matrix must build, sign, notarize, install, launch, and execute the
desktop-to-service lifecycle on both native architectures. A development build
or cross-compiled package alone is not release evidence.

## Interview conclusion

The product boundary is settled. Portreeve Desktop is an optional management
console in this repository, not a supervisor or second installation. Electron
main-process adapters use the official socket client for live data and an
exact published CLI artifact for lifecycle work; the sandboxed renderer
receives only reduced, validated view models.

The delivery sequence is also settled: first finalize and publish the
desktop-required CLI lifecycle contract as Portreeve `0.1.0`; then prove a
read-only desktop engineering slice; then deliver the macOS public MVP with
ordinary lifecycle management, safe upgrade behavior, read-only ports, and
separately confirmed complete reset. Linux desktop packaging follows as a
separate milestone, and Windows remains deferred.

The safety boundary is explicit. There is one managed service per OS user.
The desktop never searches `PATH`, adopts a manual server, silently
downgrades, deletes data directly, or sends privileged/raw process data into
the renderer. Complete reset is CLI-owned, previewed, typed-confirmed,
ownership-marker-bound, and blocked by a live manual server.

The first public desktop release is a normal, manually opened macOS 13+
application with Overview and Ports views. It is distributed directly as
separate signed and notarized ARM64/x64 artifacts, versions independently from
the CLI/server, checks for updates without telemetry, and bundles the
byte-identical already-published architecture-specific CLI artifact.

Remaining questions are implementation-level rather than product-level:
exact lifecycle and IPC schemas, marker migration mechanics, package/bundle
identifiers, Electron tooling/version pins, refresh-performance thresholds,
release-manifest format, and signing/notarization workflow details. These must
be resolved from the approved design during specification and planning rather
than reopening settled product scope.
