# Interview - tb-portreeve-desktop-lifecycle-service

**Feature start:** 2026-08-10
**Status:** concluded 2026-08-10

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - Remove all desktop lifecycle subprocess calls

**Question:** Should the desktop stop spawning the CLI for every lifecycle
operation while retaining the exact bundled executable as the installation
payload and public command-line product?

**Answer:** Yes.

**Decision:** Replace desktop subprocess invocation for lifecycle status,
install or upgrade, start, stop, manual stop, restart, uninstall, purge preview,
and purge execution. The trusted Electron main process calls one shared
structured lifecycle service directly. The desktop continues to bundle and
checksum-verify the standalone PortReeve executable because those exact bytes
remain the installed supervised server, terminal CLI, and MCP entry point. Do
not leave a partial CLI-backed desktop lifecycle path.

## D2 - Keep lifecycle administration out of the public client

**Question:** Should the shared lifecycle service remain internal or become
part of the official `portreeve` JavaScript client?

**Answer:** Keep it internal.

**Decision:** The official client remains the portable, public binding to the
daemon's Unix-socket coordination protocol. Native installation, launchd or
systemd supervision, executable promotion, and complete purge remain in an
internal typed lifecycle application service shared by the CLI and trusted
Electron main process. Do not enlarge the public npm client's authority or
platform dependencies. A separate administrative package would require a
future concrete consumer and design.

## D3 - Bind the embedded controller to the bundled artifact version

**Question:** Should a desktop package require the lifecycle service embedded
in Electron to match the version of the verified CLI/server artifact it offers
to install?

**Answer:** Yes.

**Decision:** Packaging and startup validation require the embedded lifecycle
controller's PortReeve version to equal the bundled artifact manifest version.
The separately versioned desktop application may differ, and the controller may
observe or manage a compatible newer installed service under the existing
no-downgrade rules. A mismatched controller and bundled artifact is a packaging
defect: compatible read-only daemon operations may remain available, but native
lifecycle mutations are disabled and the desktop displays the exact mismatch.

## D4 - One canonical structured lifecycle contract

**Question:** Should the CLI and desktop share the same lifecycle status,
mutation, evidence, error, and purge result contract?

**Answer:** Yes.

**Decision:** The internal lifecycle application service owns one canonical
typed contract for layered status, before and after evidence, mutation outcome,
changed state, safe structured errors, purge preview receipts, and purge
results. The CLI adds only argument parsing, terminal consent, exit-code
mapping, JSON envelopes, and human rendering. Electron main adds only operation
serialization and renderer-safe view-model reduction. Neither adapter defines
independent lifecycle success or failure semantics.

## D5 - Construct one fixed trusted desktop controller

**Question:** Should Electron main construct one lifecycle controller at startup
from verified paths, or allow operation callers to supply lifecycle targets?

**Answer:** Construct one fixed trusted controller.

**Decision:** Trusted main-process startup creates the desktop lifecycle
controller from the checksum-verified bundled executable, default per-user home
and socket, platform-selected supervisor, and matched controller version.
Renderer IPC names allowlisted operations only and never supplies an executable,
home, socket, supervisor identity, filesystem path, environment override, or
command argument. The CLI retains explicit development and test overrides;
desktop-only injection remains an explicit startup mechanism outside renderer
control.

## D6 - Put deadlines and timeout recovery in the shared service

**Question:** After removing the killable CLI child, where should lifecycle
deadlines and timeout recovery live?

**Answer:** Put them in the shared lifecycle service.

**Decision:** The shared service owns bounded native-command execution,
lifecycle wait-loop deadlines, and overall operation timing. Desktop must not
simulate cancellation with an unabortable `Promise.race`. Once a mutation has
started, expiry is reported as an uncertain outcome rather than cancellation;
the service gathers fresh after-evidence and returns the canonical `partial` or
`failed` result with a structured timeout error. CLI and desktop consume the
same recovered result.

## D7 - Block normal desktop close during lifecycle mutation

**Question:** Should the desktop permit normal application shutdown while
trusted main-process lifecycle code is mutating supervision or files?

**Answer:** No; block normal close until the operation settles.

**Decision:** Read-only status and purge preview do not block close. Install or
upgrade, start, stop, manual stop, restart, uninstall, and purge execution block
normal window and application close until the shared service returns a terminal
result or reaches its deadline. The UI identifies the active operation and does
not offer a misleading Cancel action after mutation begins. Operating-system
force quit remains irreducible; the next launch diagnoses and recovers any
uncertain state using fresh lifecycle evidence.

## D8 - Serialize lifecycle mutation across processes

**Question:** Should the shared service prevent a terminal CLI lifecycle
mutation from racing a desktop lifecycle mutation?

**Answer:** Yes.

**Decision:** The shared lifecycle service owns a per-user cross-process
mutation lock. Status and nonmutating previews remain concurrent, but only one
CLI or desktop mutation may span before-evidence, mutation, rollback, and
after-evidence at a time. Contenders fail promptly with structured
`lifecycle_busy` evidence rather than waiting indefinitely. Lock acquisition is
atomic, ownership metadata is diagnostic rather than authority based only on a
PID, and crash recovery uses fresh evidence to distinguish an active owner from
an abandoned lock. The lock location and lifetime must remain valid through
complete data purge.

## D9 - Surface complete renderer-safe failure evidence

**Question:** Should this refactor make desktop lifecycle failures actionable
without exposing raw privileged output to the renderer?

**Answer:** Yes.

**Decision:** Desktop lifecycle failures retain a concise summary and add an
expandable, copyable renderer-safe diagnostic packet. It includes operation,
lifecycle layer, stable error code, safe message, timeout state, native exit
code when applicable, before and after state, partial-versus-failed outcome,
and suggested recovery. Raw exceptions, stack traces, unrestricted stdout or
stderr, command arguments, credentials, and unvalidated filesystem paths do not
cross the preload boundary. This requirement explicitly replaces opaque
messages such as `install: failed (internal)` with actionable safe evidence.

## D10 - Preserve public behavior except approved safeguards

**Question:** Is this refactor allowed to redesign existing lifecycle behavior,
or must it preserve current contracts except for explicitly approved changes?

**Answer:** Preserve existing behavior except for the approved safeguards.

**Decision:** Preserve CLI lifecycle command names, flags, JSON envelopes, and
exit-code bands; managed locations and native supervisor definitions;
ownership, no-downgrade, rollback, and purge policies; desktop lifecycle
actions, confirmations, and availability rules; and the daemon protocol,
registry schema, and public client contract. Intentional behavior changes are
limited to cross-process busy protection, service-owned timeout recovery,
normal-close blocking during mutation, controller/artifact mismatch refusal,
and richer renderer-safe failure details.

## D11 - Require the full native verification matrix

**Question:** Is unit and adapter testing sufficient, or must the refactor pass
real CLI, packaged desktop, macOS, and Linux lifecycle verification?

**Answer:** Require the full native matrix.

**Decision:** Completion requires shared-service unit coverage for every
outcome, deadline, lock, rollback, and purge receipt; CLI/direct-call contract
parity; existing CLI lifecycle suites on macOS and Linux; cross-process
contention; packaged desktop lifecycle states; an isolated real macOS
install/start/restart/stop/upgrade/uninstall/purge smoke; the Linux
`systemd --user` gate; and interruption/recovery evidence. A required native
target that cannot be exercised leaves explicit pending manual verification and
prevents the feature from being declared complete.

## D12 - One runtime-neutral lifecycle implementation

**Question:** Should Bun CLI and Electron main use separate lifecycle
implementations or execute one runtime-neutral service?

**Answer:** Use one runtime-neutral implementation.

**Decision:** The shared lifecycle service uses JavaScript and compatible Node
APIs that execute under both the Bun-compiled CLI and Electron's Node main
process. Bun-specific behavior stays in CLI and build adapters;
Electron-specific behavior stays in desktop adapters. Command runners, clocks,
platform evidence, and destructive filesystem operations are injectable where
deterministic tests require it. Do not fork lifecycle behavior by runtime, and
run the common contract tests under both environments before compiled and
packaged acceptance.

## Closing summary

The refactor has a firm boundary: remove every desktop lifecycle CLI subprocess
while retaining the exact executable as the installed server, public CLI, and
future MCP entry point. CLI and Electron become sibling adapters over one
internal, runtime-neutral lifecycle service; the public JavaScript client
remains a daemon-protocol client.

Safety remains stronger than a mechanical in-process conversion. Desktop pins
one verified controller, controller and bundled artifact versions must match,
all callers share canonical results, deadlines and recovery live in the
service, normal close is blocked during mutation, cross-process mutation is
serialized, and renderer-safe failure evidence becomes actionable. Existing
user-facing behavior remains stable except for those approved safeguards.

The remaining unknowns are specification and planning details rather than open
product choices: the exact lock mechanism and purge-surviving location,
operation deadline values, internal module boundaries, diagnostic field schema,
and sequential delivery slices. These must satisfy the approved native macOS,
Linux, compiled CLI, and packaged Electron verification matrix.
