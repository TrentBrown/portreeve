# Interview - tb-portreeve-stacks

**Feature start:** 2026-08-06 **Status:** complete (2026-08-06)

Working design notes captured during the Grill Me interview. This file is the primary
design-phase artifact before `design.md` exists. Capture settled answers, draft
contracts, examples, rationale, and important open questions as the interview
progresses.

Update this file after each settled decision or other high-value design clarification.

This file is the output of Grill Me and the input to the Design step. It is not a
substitute for `design.md`; it is the source material from which `design.md` is
synthesized.

## Settled decisions

### D1 - One runnable stack per worktree

**Question:** Can one Git worktree host more than one independently runnable stack at
the same time?

**Answer:** No. A single Git worktree can have only one independently runnable stack
active at a time. Concurrent instances of the same project use distinct worktrees.

**Decision:** Portreeve may use the canonical worktree as part of stack identity and
must reject or replace conflicting activation within that worktree rather than
introducing a user-selected instance discriminator.

### D2 - Component and endpoint are protocol concepts

**Question:** Should stack component and endpoint identity be first-class in the initial
public protocol?

**Answer:** Yes. Both are first-class. An omitted endpoint is compatibility shorthand
for the endpoint named `default`.

**Decision:** The canonical stack-aware identity includes component and endpoint. All
API surfaces that accept an omitted endpoint normalize it to `default` before
persistence or comparison.

### D3 - Existing non-stack clients remain compatible

**Question:** What compatibility boundary must the stack and sandbox additions preserve?

**Answer:** Preserve the existing non-stack contract while adding the new concepts.

**Decision:** Existing `service` requests remain valid and normalize to a component with
the same name and endpoint `default`. Conflicting `service` and `component` values are
rejected. Existing acquire, confirm, abandon, release, and `withPort()` behavior and
response shapes remain unchanged. Inventory continues to support the existing `service`
field and filter while adding canonical component and endpoint information. Stack and
Docker APIs are additive; internal persistence may change without requiring existing
non-stack callers to change.

### D4 - Projects own topology; Portreeve owns coordination state

**Question:** Where does the authoritative stack definition live, and what does
Portreeve persist from it?

**Answer:** Use a checked-in declarative project definition and keep Portreeve out of
project process supervision.

**Decision:** A checked-in declarative stack file defines components, endpoints, and
dependencies. A project launcher applies that definition through the Portreeve CLI or
client protocol. Portreeve validates and persists a normalized snapshot, definition
revision, port allocations, and activation state, but never executes project commands.
Project tooling retains startup order, environment injection, health checks, Docker
Compose execution, and shutdown.

### D5 - A prepared allocation is one immutable generation

**Question:** May endpoint allocations drift independently while a stack is starting?

**Answer:** No. A prepared stack allocation is an all-or-nothing generation.

**Decision:** Preparing a stack returns one coherent, immutable plan containing every
published endpoint and its allocated host address. Components acquire and confirm
against that generation. If any endpoint must be reassigned, the entire generation
becomes stale and the launcher must prepare a replacement and regenerate all derived
environment or Docker configuration before continuing. Sticky assignments should
normally keep unaffected port numbers, but they belong to the replacement generation.

### D6 - Definition, allocation, and activation have distinct identities

**Question:** Should definition revisions, allocation plans, and individual start
attempts share one version identifier?

**Answer:** No. Maintain three distinct identities and lifetimes.

**Decision:** A definition revision changes when the normalized checked-in definition
changes. An allocation generation identifies one immutable endpoint-to-port plan and may
survive a routine stop/start while it remains valid. An activation ID changes on every
start or restart attempt, even when the definition and allocation generation are
unchanged. Activation identity is included in confirmation evidence and Docker labels so
current resources can be distinguished from debris left by earlier activations without
trusting a stored PID.

### D7 - Portreeve owns host publications; launchers render address views

**Question:** Which host, Docker-network, and sandbox-facing addresses does Portreeve
allocate and verify?

**Answer:** Portreeve owns only the host publication; project definitions and trusted
launchers supply the other address views.

**Decision:** Portreeve allocates and verifies the host-loopback publication. The
checked-in definition declares fixed container ports and Docker service names. Host
consumers use the allocated loopback address; consumers on the same Compose network use
service DNS and the declared container port. A trusted host launcher renders the
platform-specific host-gateway address for a Codex sandbox and injects it without
exposing Portreeve's control socket. Portreeve returns the host and Docker-network facts
but does not represent a sandbox gateway as an allocated or independently verified
listener.

### D8 - Docker confirmation uses fresh listener and Docker evidence

**Question:** How does Portreeve confirm a Docker-published endpoint when the host
listener belongs to Docker's backend rather than the container process?

**Answer:** Use a Docker-specific confirmation path based on fresh host and Docker
inspection evidence.

**Decision:** The trusted launcher labels the container with stack, component, endpoint,
definition revision, allocation generation, and activation identity, then submits the
container ID during confirmation. Portreeve performs fresh host-side Docker inspection
and verifies that the container is running, its labels match the pending activation, and
its published host and container ports match the allocation and checked-in definition.
Fresh listener evidence must also show that the host publication is listening. A
container ID is only a lookup key and is never proof by itself. Process-lineage rules
are not applied to Docker's host backend.

### D9 - Docker reclamation is launcher-mediated initially

**Question:** May normal or unsafe port reclamation signal Docker's shared host backend
or directly stop a container?

**Answer:** No. Docker-managed listeners require launcher-mediated reclamation,
including for unsafe eviction.

**Decision:** Portreeve never signals Docker backend or proxy PIDs and does not stop
containers in the initial stack implementation. Fresh evidence identifies the exact
container and Portreeve returns a structured `launcher_action_required` result. The
trusted project launcher may stop that container through Docker and retry.
Process-oriented `unsafe-evict` refuses a Docker-managed listener even with
`unsafeAnyOwner`, because a shared Docker backend cannot be killed as a port-scoped
action. A future explicit container-aware reclamation protocol remains possible.

### D10 - One strict JSON schema serves the file, CLI, and client

**Question:** What is the initial public input contract for stack definitions?

**Answer:** Standardize a checked-in JSON file and accept the same parsed shape through
the JavaScript client.

**Decision:** The standard file is `portreeve.stack.json` at the canonical worktree root
and begins with schema version `1`. It is strict declarative JSON and contains no
commands, secrets, environment values, or executable code. `portreeve stacks apply`
discovers it by default and accepts `--file` as an override. The JavaScript client
accepts the same object through `applyStack(definition)`. Both paths share validation
and normalization, and unknown fields are rejected initially.

### D11 - Durable generations and activation-scoped leases are separate

**Question:** Should preparing a durable stack allocation immediately issue short-lived
endpoint leases?

**Answer:** No. Separate durable preparation from the leases used during an actual start
attempt.

**Decision:** `prepare` creates or reuses an immutable allocation generation without
starting a lease deadline. `beginActivation(generation)` creates a new activation
identity and atomically issues pending leases for endpoints that must bind. The client
keeps leases alive during startup and providers confirm individually. Cancellation or
timeout abandons unconfirmed leases but does not discard an otherwise valid durable
generation. A genuine collision or reassignment invalidates the generation. Leases
coordinate Portreeve clients; only binding plus fresh evidence proves operating-system
ownership.

### D12 - Allocation constraints and activation requirements are independent

**Question:** How do required or optional endpoints interact with exact or preferred
host ports and the all-or-nothing allocation generation?

**Answer:** Treat allocation constraints and activation readiness as separate concepts.

**Decision:** `exactPort` requires a particular numeric host port and prevents
generation preparation when unavailable; `preferredPort` permits fallback. Endpoints are
required by default. A required endpoint must confirm before the activation is ready. An
optional endpoint still receives an allocation in the complete generation but may be
explicitly skipped; its omission or failure marks the activation degraded rather than
failed. A required component cannot depend on an optional endpoint unless that endpoint
is included as required for the activation.

### D13 - One runtime instance per component initially

**Question:** Does the initial protocol support multiple replicas of one component?

**Answer:** No. Replica semantics are explicitly out of scope initially.

**Decision:** Each named component has exactly one runtime instance in an activation,
and its named endpoints refer to that process or container. A project that needs
multiple instances before replica support may model them as distinct components. Future
replica support must explicitly define per-replica identity or a separately modeled
load-balanced front door rather than changing the meaning of the initial component
endpoint identity.

### D14 - Initial Docker evidence uses a portable host CLI adapter

**Question:** Which Docker platforms and evidence mechanism are in initial scope?

**Answer:** Support macOS Docker Desktop and Linux Docker Engine through a host-side
Docker CLI adapter.

**Decision:** Docker evidence is accessed through an adapter interface whose initial
implementation invokes a trusted installed `docker` CLI and its configured context. The
supervised server resolves the executable during installation or controlled
configuration; protocol callers cannot submit an arbitrary executable path. Docker
absence or access failure disables Docker capabilities without breaking process-backed
stacks. Direct Engine API integration remains a future adapter. Native Windows support
is initially out of scope.

### D15 - Portreeve confirms network ownership, not application health

**Question:** Does Portreeve readiness include application-level health?

**Answer:** No. Portreeve's responsibility ends at confirmed network ownership.

**Decision:** Endpoint lifecycle distinguishes assigned, leased, observed, confirmed,
skipped, failed, and released states. An activation is confirmed when all required
endpoints have fresh matching ownership evidence, and is degraded when required
endpoints are confirmed while optional endpoints were skipped or failed. The public
protocol uses `confirmed` rather than the ambiguous term `ready`. HTTP or application
health checks and dependency startup delays remain project-launcher responsibilities.

### D16 - Initial endpoint facts remain application-neutral

**Question:** Do initial endpoint records include application URL schemes and paths?

**Answer:** No. Persist only network-level address and port facts.

**Decision:** Initial endpoints use TCP transport and contain host/address and port
facts. Portreeve does not persist schemes, URL paths, query parameters, credentials,
environment-variable names, or other application configuration. Endpoint names may carry
project meaning without being interpreted. Client formatting helpers may construct
higher-level values only when the caller supplies the scheme or other application
details explicitly.

### D17 - Sandboxes receive an activation-scoped read-only snapshot

**Question:** How may sandboxed consumers discover endpoints without gaining daemon
control authority?

**Answer:** Use a generated, read-only discovery document rather than exposing the
Portreeve socket.

**Decision:** The trusted launcher requests the sandbox-facing endpoint views, writes an
activation-scoped document atomically in host-managed runtime state, and mounts it
read-only. The document contains definition revision, allocation generation, activation
identity, and resolved addresses, but no lease tokens, socket path, host worktree path,
process evidence, Docker IDs, or mutation authority. The JavaScript library reads an
explicit file or the conventional `PORTREEVE_ENDPOINTS_FILE`. A launcher replaces the
snapshot when the generation changes, allowing consumers to detect stale loaded data.

### D18 - Binding kind is selected for each activation

**Question:** Is process-versus-Docker placement permanently part of component topology?

**Answer:** No. The launcher selects each component's binding kind for an activation.

**Decision:** The definition declares stable logical components, endpoints,
dependencies, publication intent, and any Docker-specific facts required when Docker is
selected. `beginActivation` selects process or Docker binding for each component,
including mixed activations. Portreeve validates that the definition contains the facts
required by each selection. Logical component/endpoint identity and its allocation may
survive a later placement change, while confirmation and reclamation use the adapter
selected by the current activation.

### D19 - Dependencies are address-consumption references

**Question:** Do component dependencies define Portreeve-enforced startup order?

**Answer:** No. They define coherent address discovery for consumers.

**Decision:** A component declares named dependency aliases that reference component
endpoints in the same definition. Portreeve validates and resolves those references
within one allocation generation and scopes component or sandbox discovery views to the
component's own endpoints and declared dependencies. Required dependencies must be
present in the activation. Portreeve does not order startup, wait for application
health, or reject circular address dependencies merely because they are cyclic;
launchers remain responsible for whether their startup and health strategy supports a
cycle.

### D20 - Definition application is explicit, idempotent, and non-mutating

**Question:** How are definition revisions applied and how is drift handled while an
older activation remains active?

**Answer:** Apply normalized content explicitly and never mutate an existing generation
or activation.

**Decision:** Portreeve hashes the normalized definition to identify a revision.
Applying identical content is idempotent. Changed content becomes the latest applied
revision but does not alter existing generations or activations, which remain
permanently tied to their original revision and generation. Status reports the latest
applied and active revisions when they differ. Portreeve does not watch or load project
files silently. A high-level launcher helper may apply automatically before preparing so
normal startup does not require a separate manual command.

### D21 - Stack identity is project plus canonical worktree

**Question:** Does durable stack identity require a user-visible stack name or instance
discriminator?

**Answer:** No. Project and canonical worktree are the complete natural key.

**Decision:** Portreeve assigns an internal immutable stack ID, but callers do not
choose a name or instance value. Applying a different topology creates a new revision of
the same worktree stack. Commands run inside a worktree resolve that stack without
another selector; global diagnostics expose project, worktree, and internal ID. A
distinct concurrently runnable stack requires a distinct Git worktree. No replacement
for `PORTREEVE_INSTANCE` is introduced.

### D22 - Missing-worktree stack pruning is evidence-gated

**Question:** How may registrations for deleted worktrees be pruned?

**Answer:** Follow the existing claims-prune consent model and never reclaim live
resources as part of pruning.

**Decision:** A stack is eligible only when its canonical worktree is missing, its last
use is older than the configured threshold, and fresh evidence shows no pending
activation, confirmed endpoint, live listener, or matching running Docker container.
`--dry-run` reports candidates and blockers. A naked interactive command shows the plan
and prompts; noninteractive execution requires `--yes`, and `--json` is not consent.
Execution revalidates each candidate, removes inactive stack records and associated
endpoint claims, and retains durable history including a final identity and summary
event. Pruning never stops or reclaims resources.

### D23 - Launcher crash recovery follows provider evidence

**Question:** What happens when a project launcher exits unexpectedly while its
providers may remain alive?

**Answer:** Use fresh provider evidence rather than a launcher PID or permanent
heartbeat.

**Decision:** A launcher's startup keepalive ending allows unconfirmed leases to expire
and the activation attempt to fail. Confirmed endpoints do not depend on launcher
liveness. Later status, activation, or reconciliation takes fresh process, listener, and
Docker evidence. If all confirmed providers are gone, Portreeve marks the activation
lost and permits another activation, reusing the allocation generation when still valid.
If providers remain, the activation remains active and a replacement launcher may
continue managing it or stop the survivors before requesting a new activation. Docker
survivors remain launcher-mediated.

### D24 - Public commands coordinate but do not orchestrate projects

**Question:** Should Portreeve expose project stack start, stop, or restart commands?

**Answer:** No. Its CLI and library expose coordination operations only.

**Decision:** Portreeve provides operations for applying, preparing, activating,
resolving, snapshotting, inspecting, listing, ending, and pruning stack coordination
state. It does not provide `stacks start`, `stacks stop`, or `stacks restart`, which
would imply ownership of project or Compose commands and conflict with the daemon
lifecycle command names. A high-level JavaScript session helper may wrap negotiation
around a caller-provided startup callback, but the project launcher owns that callback
and every process lifecycle operation.

### D25 - Matching standalone claims are reused but active runs are not adopted

**Question:** What happens to existing standalone service claims when a worktree first
applies an explicit stack definition?

**Answer:** Reuse matching canonical claims and assignments, but do not silently convert
an active legacy run into a stack activation.

**Decision:** Stored service identities migrate to component plus default endpoint
identities without changing assigned ports. Applying a definition links matching claims
and reuses their assignments; conflicting exact-port requirements fail visibly.
Unmentioned claims remain standalone during the retrofit period. Definition application
may occur while a legacy run is live, but a new activation reports that binding and
requires the project launcher to stop and restart it through the stack-aware flow
because it lacks activation identity. Legacy clients remain usable outside stack
activations during the transition.

### D26 - Stack additions complete the first public protocol version

**Question:** Should the unreleased local protocol become version 2 for stack support?

**Answer:** No. Keep the definitive first public contract at version 1 and use
capability negotiation.

**Decision:** Existing `/v1` envelopes and allocation routes remain. Version 1 gains
canonical component/endpoint identity, legacy service normalization, and additive stack,
Docker, and sandbox routes. New clients require explicit versioned capabilities such as
stack coordination, Docker evidence, and sandbox discovery and therefore reject older
local servers cleanly. Legacy clients require none of those capabilities. No parallel
v1/v2 implementation is introduced before the first public release.

### D27 - Desktop stack support is part of the initial release

**Question:** May desktop stack-management support be deferred until after the initial
stack-aware release?

**Answer:** No. Include desktop support in the first version.

**Decision:** The initial stack-aware release includes a desktop experience for the new
stack model in addition to the server, protocol, client, CLI, Docker, and sandbox work.
The exact desktop inspection and mutation surfaces remain to be settled, but they must
preserve the boundary that project launchers own process and Compose lifecycle
operations.

### D28 - Desktop manages coordination state but does not launch projects

**Question:** What stack support belongs in the initial desktop application?

**Answer:** Include stack observability and safe coordination controls without crossing
into project or Compose lifecycle management.

**Decision:** The desktop includes a global Stacks tab; stack, revision, generation,
activation, component, endpoint, dependency, address, placement, and safe evidence
views; explicit refresh and reconciliation; definition application through a file
picker; allocation preparation; copyable resolved addresses and discovery-document
previews; evidence-gated activation ending; and previewed, confirmed stack pruning. All
operations expose safe actionable failure details. The desktop does not start or stop
project processes, run Compose, stop containers, or perform launcher-mediated
reclamation.

## Carryover publication blocker

Before Portreeve is published, the desktop app must expose safe, actionable failure
details for lifecycle operations. The current generic `internal` failure presentation is
not sufficient. This is retained as a separate pre-publication requirement and does not
determine the stack protocol.

## Open questions

- None. The interview was closed for design synthesis on 2026-08-06.
