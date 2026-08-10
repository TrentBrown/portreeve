# Desktop application

PortReeve Desktop is the graphical inspection and coordination surface for the same
per-user PortReeve installation managed by the CLI. It does not install a second server,
keep a separate registry, or bypass the HTTP/JSON Unix-socket protocol. The application
bundles a verified CLI artifact and can install that artifact into the one managed
per-user location used by native supervision.

## Overview and lifecycle

The Overview tab reports the desktop, bundled CLI, managed CLI, running-server,
supervisor, and socket layers independently. Lifecycle actions invoke an exact bundled
or managed executable from the Electron main process; the renderer cannot choose an
executable, run a shell command, or search `PATH`.

Available actions follow current evidence:

- install and start the managed PortReeve service;
- start, stop, or restart native per-user supervision;
- stop an explicitly manual `portreeve serve` process without adopting it;
- upgrade the managed CLI after version and artifact verification;
- uninstall supervision while retaining PortReeve data;
- preview and confirm a complete PortReeve data reset.

Install, reset, and upgrade decisions remain explicit. Update discovery only reports a
new desktop release and opens one fixed project download page after confirmation; it
does not download or install updates automatically.

Lifecycle operations display a stable outcome plus safe structured error codes and
messages. For example, an unsafe supervisor log mode is shown as an actionable
permission failure rather than only `internal`. Unstructured errors are generalized so
arbitrary exception detail does not become renderer content.

## Ports

The Ports tab uses the official JavaScript client to show global claimed and unclaimed
TCP listeners. The main process reduces inventory before publishing it to the renderer.
Claims show project, component, endpoint, worktree basename, mode, and timing; listeners
show reduced ownership and process evidence. Lease tokens, internal database fields, and
arbitrary executable paths are not exposed.

## Stacks

The Stacks tab reads definitions and current generation, activation, resolution, and
fresh provider evidence through the official client. It supports:

- creating or editing a stack with **Create or Edit Stack…** from structured project,
  component, endpoint, Docker, and dependency fields after selecting its root directory;
- reopening a registered stack directly from its details with **Edit Definition**;
- selecting and applying a checked-in `portreeve.stack.json` through the native file
  picker as a compatibility and recovery workflow;
- preparing or reusing one complete allocation generation;
- inspecting components, endpoints, dependencies, placements, host addresses,
  Docker-network addresses, and provider evidence;
- copying individual addresses and previewing a component-scoped sandbox discovery
  document for a launcher-supplied gateway;
- explicitly reconciling provider evidence after launcher loss;
- requesting evidence-gated activation ending after the project launcher stops its
  providers;
- previewing seven-day missing-stack-root pruning and typing `PRUNE` before
  execution.

The desktop's stack editor uses a fixed `portreeve.stack.json` at the selected or
registered stack root. Directory selection, file inspection, schema validation, and
writes remain in the trusted main process. The renderer receives an opaque document ID,
the editable definition, a root display name, and reduced validation issues; it does not
receive the full path or file fingerprint. Missing files are created exclusively, and
existing regular files are replaced atomically only after the exact bytes observed when
the editor opened are rechecked.

The dedicated editor replaces the normal Stacks list and details while it is open. New
drafts prefill only the selected root's basename as the project name and leave the
topology for the user to define. Navigation to another top-level tab, Back, Cancel, or
window close offers **Keep editing** or **Discard changes** whenever the draft is dirty.

If another program changes the file, PortReeve offers Overwrite or Cancel. Overwrite is
authorized by a one-use conflict capability bound to the newly observed bytes; a second
external change requires another confirmation. Malformed regular files can be replaced
after confirmation, but oversized files, symbolic links, and other non-regular
definition paths are refused. Saving precedes server apply, so a valid file remains
saved if the daemon is unavailable and can be applied later with an explicit retry.
Editing never prepares a stack generation automatically.

The editor keeps components, endpoints, and dependencies as ordered records with
stable local identities. Dependency selectors retain those identities, so renaming a
provider automatically updates the serialized reference. Removing a referenced
component or endpoint requires explicit confirmation and also removes the named
dependent entries. Incomplete drafts remain editable: touched fields show local
validation, submission shows the complete summary and first invalid field, and the
read-only JSON preview retains the latest valid result until the draft is valid again.
Valid output uses two-space indentation, a final newline, editor order, and omits schema
defaults such as TCP transport, required or published `true`, automatic allocation, and
the dependency endpoint when it is `default`.

The Stacks tab never starts or stops a project process or container, invokes Docker
Compose, owns application startup order, maps project environment variables, or asserts
application health. Those remain responsibilities of a project launcher. Stale stack
evidence remains visible for diagnosis but withholds stack mutation controls until
current evidence returns; the server revalidates every requested action as final
authority.

## Launchers

Launchers is the fourth primary tab, after Stacks. It is the low-friction bridge from an
applied stack's current PortReeve allocation to project-owned lifecycle commands. The
stack-linked browser shows configuration, exact-revision trust, integration maturity,
fresh evidence, action availability, bounded current-session output, and the latest
twenty safe operation records.

An applied stack without `portreeve.launcher.json` offers setup. The dedicated editor
provides Execution, Commands, Endpoint environment, Advanced, and Review sections. It
may prefill editable suggestions from supported manifests in the exact selected working
directory and always displays basename provenance. Discovery never runs project code or
recursively searches child repositories. The exact canonical JSON is visible before
**Save and Trust**.

The renderer holds only opaque stack, document, and session identifiers. Electron main
owns command discovery, exact-byte file replacement, trust, execution, output saving,
and attached-process termination. External changes offer Review, explicit Overwrite, or
Cancel; changing verified activation to command-only requires a separate downgrade
warning. Opening Launcher never executes a command.

Start, Stop, Restart, and Status availability follows the shared engine's current trust
and evidence policy. Partial Start and degraded Stop require explicit confirmation;
conflicts block Start. Attached Start has no timeout and blocks normal application exit
until the stack is stopped, the exact app-owned process group is explicitly terminated,
or exit is cancelled. Output is retained only in the current application session unless
the user explicitly selects **Save output**.

See [Project launchers](launchers.md) for the file schema, environment contract,
command-only and verified semantics, CLI workflow, degraded recovery, concurrency,
retention, and platform boundaries.

## Guide

Guide is the rightmost primary tab. It is a static, offline orientation surface that
describes the installed release's stable mental model without depending on current
server evidence. It explains that PortReeve coordinates addresses while project tools
coordinate work, and that listener ownership does not establish application readiness.
An always-visible **What is this?** link beneath the product name opens the Guide
at its identity section. That opening pairs a large, legible brand mark with a plain
product definition and a short explanation of the historical *portreeve* name. The link
uses the same unsaved-editor protections as primary-tab navigation.
The identity section also describes the motivating concurrent-development case: several
agents running independent copies of the same stack from different Git worktrees on one
machine, where shared default ports would otherwise collide frequently.

The Guide presents three integration paths:

- **Good — Built-in driver:** configure existing stack commands in Launchers and let
  PortReeve Desktop inject resolved endpoint variables and invoke them.
- **Better — Generated launcher:** move that integration into a separate launcher
  application or library that uses the PortReeve server without requiring the desktop
  at runtime.
- **Best — Native integration:** call PortReeve from the project's existing
  service-management code through the official client or common socket protocol.

A responsive semantic sequence diagram follows one stack from definition and durable
claims through allocation generation, activation leases, resolution, provider startup,
fresh-evidence confirmation, and shutdown. Concept callouts attach Claim, Generation,
Activation, and Lease to the messages that create them, and a nested state-model diagram
shows their lifetimes and containment. Compact sequence diagrams distinguish which
integration tool occupies the same lifecycle in the Good, Better, and Best paths. The
Good path includes the additional command-to-service handoff, while subdued identity
colors keep Desktop, generated and project tools, commands, services, and PortReeve
visually distinct. One shared actor legend beneath the comparison defines the union of
those identities without repeating explanations inside every card. Native expandable
sections cover host and Docker evidence, sandbox discovery, shared interfaces, trust
boundaries, and deliberate non-goals. The Guide adds no live refresh source, IPC
capability, external content, or runtime diagram dependency.

A visible sandbox-boundary sequence explains why isolated agent environments do not
remove the need for PortReeve. Containers may reuse internal ports, but browser-visible
and host-testable publications still share the host namespace. It follows the trusted
host launcher through allocation, loopback publication, Docker evidence, reduced
snapshot creation, read-only mounting, and browser access; the PortReeve control socket
and lease credentials never enter the sandbox.

## Trust and data boundary

Electron runs a sandboxed renderer with context isolation, Node integration disabled,
and a restrictive local content policy. The preload exposes only named, schema-validated
capabilities. The main process accepts IPC only from the primary `app://portreeve`
renderer frame and owns the native file picker, clipboard write, fixed download-page
navigation, exact CLI execution, and official client connection.

The desktop receives no general filesystem, shell, network-navigation, SQLite, Docker,
or PortReeve-socket capability. Stack view models omit full stack-root paths, claim and
lease identifiers, run identifiers, Docker labels, and credentials. Discovery previews
contain only their documented component-scoped address contract.

## Local package

Build and open an unsigned local macOS application bundle with the repository-pinned Bun
toolchain:

```sh
PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve \
PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download \
bun run release:build

bun run desktop:package
open dist/desktop/PortReeve-darwin-arm64/PortReeve.app
```

Always rebuild `dist/release` before packaging a development candidate. The desktop
packager deliberately consumes and verifies the existing release manifest; it does not
recompile the CLI, so skipping `release:build` can bundle an older server contract that
still reports the same development version.

The packaging script selects the physical host architecture and verifies the bundled
CLI against the generated release manifest and SHA-256 digest. This local bundle is a
release candidate for manual verification, not a signed or notarized public desktop
distribution.
