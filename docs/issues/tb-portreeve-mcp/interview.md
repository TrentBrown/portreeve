# Interview - tb-portreeve-mcp

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

## D1 - Defining client and deployment boundary

**Question:** Which single usage scenario should define version one: a
host-running MCP-capable agent, or an agent whose entire MCP host is confined
inside a sandbox?

**Answer:** The primary desire is for the single PortReeve service to offer MCP
access that is as easy as possible for any agent to use. A local host-running
agent is the sensible defining example. Version one need not be defined by an
MCP host that is itself wholly sandboxed or remote.

**Decision:** Optimize version one for local MCP-capable agent hosts running as
the same operating-system user as PortReeve. Preserve the possibility of a
future sandbox or remote bridge, but do not let that harder transport and trust
boundary drive the initial release.

## D2 - MCP transport and process topology

**Question:** Should local agents launch a dedicated stdio MCP bridge, or should
the persistent PortReeve service expose one shared Streamable HTTP endpoint?

**Answer:** A shared loopback endpoint initially sounded simpler, but safely
supporting control would require endpoint discovery, another supervised
listener, Origin validation, authentication and credential distribution,
client permissions, multi-client lifecycle handling, and materially broader
testing. Those costs outweigh the benefit of one shared MCP URL.

**Decision:** Version one uses stdio only. Each MCP host launches a lightweight
`portreeve mcp serve` bridge process from the existing PortReeve installation.
The bridge calls the official JavaScript client over the existing private Unix
socket and delegates all authority to the single persistent PortReeve daemon.
It owns no database or independent allocation state. Do not add Streamable HTTP,
a TCP listener, HTTP authentication, or remote access in the initial release.

## D3 - Full-featured MCP boundary

**Question:** Should version one be read-only, literally mirror the complete CLI
command tree, or expose a broad MCP-native coordination surface?

**Answer:** Build a full-featured MCP server from the start, but distinguish the
ordinary PortReeve coordination model from CLI-only host administration,
emergency escape hatches, and project shell execution.

**Decision:** Version one targets broad parity with the ordinary public
PortReeve server protocol. It includes typed inspection and configuration
operations, ordinary claim and stack mutations, evidence-bound preview/execute
operations, and the complete activation lifecycle. It does not expose
`ports unsafe-evict`, complete purge, PortReeve installation or native service
lifecycle commands, or Launcher operations that execute project shell commands.
MCP tools must be designed around structured inputs and results rather than
copying CLI flags. File-oriented CLI operations return or accept structured
content instead of arbitrary filesystem paths. Raw lease tokens remain inside
the bridge and are represented to the model by opaque handles.

## D4 - Global discovery and explicit mutation scope

**Question:** Should an MCP session see the complete per-user PortReeve registry,
or should it be implicitly confined to the worktree from which the MCP host
launched the bridge?

**Answer:** Use the global model with explicit targeting.

**Decision:** Every MCP session may discover the global per-user PortReeve
state, with optional project, canonical-root, component, endpoint, and other
domain filters where the underlying contract supports them. Mutating tools must
require explicit claim, stack, generation, activation, endpoint, or other
stable target identifiers. Do not infer a mutation target from the MCP bridge's
current working directory; MCP hosts may launch configured servers from
arbitrary directories.

## D5 - In-memory lease credential custody

**Question:** Should the MCP bridge keep raw lease credentials only in memory
for its process lifetime, or persist them so a later MCP session can resume
privileged control of a pending activation?

**Answer:** Keep them in memory only.

**Decision:** Raw lease tokens never enter model-visible MCP results and are
never persisted by the MCP adapter. The bridge stores them in a process-local
vault behind opaque handles and renews pending leases only while it owns the
corresponding live operation. When the bridge exits or loses custody, ordinary
lease expiry and PortReeve reconciliation provide cleanup. A later bridge may
inspect and reconcile the activation but cannot recover privileged token-based
control; it begins a new attempt when safe.

## D6 - Modern stateless MCP with SDK compatibility

**Question:** How does the MCP `2026-07-28` stateless specification affect the
bridge, and should PortReeve support both modern and legacy MCP clients?

**Answer:** Adopt the current specification while retaining practical
compatibility for agent hosts that have not upgraded yet.

**Decision:** Design PortReeve's MCP contracts for the stateless,
sessionless `2026-07-28` protocol. Every stateful domain operation uses an
explicit durable PortReeve identifier or process-local opaque handle rather
than hidden MCP session context. Use the official TypeScript MCP SDK v2 and its
standard stdio dual-era support so modern clients use `server/discover` and
self-describing requests while supported legacy clients use the SDK's
`initialize` compatibility path. Do not implement a separate PortReeve legacy
protocol stack or promise compatibility beyond the SDK's maintained window.

## D7 - Bounded automatic lease renewal

**Question:** Should the bridge require manual renewal within every short lease
TTL, renew indefinitely while its process remains alive, or renew automatically
inside a bounded custody window?

**Answer:** Use bounded automatic renewal with explicit extension.

**Decision:** Beginning an activation through MCP starts automatic renewal of
the bridge-held pending endpoint credentials, but only until a fixed wall-clock
custody deadline. Confirming, skipping, or abandoning an endpoint removes its
credential from renewal immediately. A caller may explicitly extend custody
before the deadline through a typed tool; silence never renews indefinitely.
When custody ends, the bridge stops renewing and normal PortReeve lease expiry
and reconciliation take over. The exact default window, maximum extension, and
renewal cadence are specification decisions grounded in the configured lease
TTL.

## D8 - Tools-only MCP surface

**Question:** Should PortReeve duplicate read capabilities as URI-addressable
MCP resources, or expose reads and mutations consistently as tools?

**Answer:** Every proposed resource can be expressed as a tool call, and no
initial PortReeve use case requires application-selected attachable content.

**Decision:** Version one exposes tools only. Read-only inspection uses typed
tools alongside mutating tools; resources and prompts are not advertised.
Avoid duplicating inventory, stack, activation, or status contracts through
both tools and resources. Static orientation belongs in server instructions and
tool descriptions. Resources may be added compatibly later only when a concrete
MCP-host workflow benefits from browseable or attachable content.

## D9 - Generated host setup guidance

**Question:** Should PortReeve generate exact MCP-host configuration for the
user, or directly modify the configuration files of supported agent hosts?

**Answer:** Have the CLI and desktop provide the information needed to set up
PortReeve, without automatically editing third-party configuration.

**Decision:** Version one provides canonical, host-specific setup guidance for
launching `portreeve mcp serve` over stdio. The CLI can render machine-readable
configuration and copyable instructions for recognized hosts, while the
desktop presents the same information in an approachable setup interface.
PortReeve does not silently discover or modify Codex, Claude Code, or other
third-party configuration files. Direct configuration installation may be
added later only as an explicit, separately designed operation.

## D10 - Resilient bridge when the daemon is unavailable

**Question:** Should `portreeve mcp serve` fail when the central PortReeve
service is unavailable, or remain running with diagnostic behavior?

**Answer:** Keep the MCP bridge running and make the failure understandable and
recoverable.

**Decision:** The stdio MCP bridge starts and advertises its tools even when it
cannot reach the PortReeve Unix socket. A diagnostic tool reports structured
availability evidence and actionable CLI/Desktop setup guidance. Tools that
require the daemon return typed unavailable errors rather than terminating the
bridge. Connection attempts are made again on subsequent calls so restoring
the central service repairs the integration without restarting the agent host.
The bridge does not install, supervise, or automatically start the PortReeve
service.

## D11 - Two-tier mutation safety

**Question:** Should every MCP mutation require a preview, should agent-host
approval be sufficient, or should PortReeve distinguish routine coordination
from externally consequential changes?

**Answer:** Use a two-tier model with direct routine coordination and explicit
preview-and-execute protection for consequential mutations.

**Decision:** Read operations and ordinary activation lifecycle operations are
single-step typed tools. This includes operations whose authority is already
bounded by a bridge-held opaque handle, such as renewal, confirmation, skip,
release, and abandonment of the bridge's own pending work. Operations that can
affect external processes, durable configuration, or resources outside that
bounded activation require a preview followed by execute. Preview returns a
short-lived evidence receipt that binds the proposed action to the state
PortReeve observed; execute rejects stale or mismatched evidence. PortReeve
does not treat an MCP host's optional approval UI as a substitute for its own
safety contract.

## D12 - Diagnostic MCP client attribution

**Question:** Should PortReeve distinguish operations from concurrent MCP
bridges in history, and what identity may safely be used?

**Answer:** Include an optional client label and record it with MCP-originated
history events.

**Decision:** Generated host configuration assigns a sensible human-readable
client label, such as `codex`, and permits the user to choose a more specific
label such as `codex-backend-worktree`. Each bridge invocation also creates a
random run identifier for correlating its history events. PortReeve records the
MCP origin, client label, and run identifier as diagnostic attribution only.
None of these values, including any observed PID, grants authority or proves
ownership; durable target identifiers and bridge-held opaque handles remain the
authorization evidence.

## D13 - Focused operation-specific tools

**Question:** Should the MCP surface use a few broad domain tools with an
`action` parameter, or focused tools for individual operations?

**Answer:** Use focused, operation-specific tools.

**Decision:** Version one exposes narrowly scoped typed tools with consistent
domain-oriented names, even if broad protocol coverage produces roughly twenty
to thirty tools. Each tool has one principal operation, a precise input and
output schema, accurate safety and idempotency annotations, and a focused
description. Preview and execute are separate tools. Avoid action multiplexers
with large conditional schemas, while also avoiding separate tools for trivial
field or presentation variations.

## D14 - Structured canonical stack manifests

**Question:** Should MCP stack operations accept arbitrary manifest paths or
operate on structured definitions anchored to a canonical worktree root?

**Answer:** Use structured definitions and the canonical worktree model.

**Decision:** MCP stack tools accept a worktree root and a typed stack
definition rather than arbitrary paths or raw JSON text. PortReeve resolves the
canonical `portreeve.stack.json` location, validates the definition, and
returns structured reads. Creating a new file or replacing an existing file is
a consequential mutation governed by preview and execute; replacement binds
the preview to the expected file fingerprint so an external change invalidates
the operation. Successful execution returns the canonical path, resulting
fingerprint, and durable stack identifier. The contract does not become a
general-purpose filesystem read/write API.

## D15 - Structured results with bounded pagination

**Question:** How should MCP results remain machine-reliable, human-readable,
and bounded when PortReeve inventories or histories become large?

**Answer:** Return structured data plus concise summaries and require bounded
pagination for collections.

**Decision:** Every tool declares a precise output schema and returns
authoritative structured content. Responses also carry a concise text summary
for human display and compatibility behavior. Collection tools use stable
cursor pagination with conservative defaults and enforced maximum page sizes;
MCP does not offer an unlimited inventory or history dump. Page responses state
whether more data is available and provide an opaque continuation cursor.

## D16 - Previewed global settings updates

**Question:** Should MCP expose machine-wide PortReeve settings as read-only,
or allow validated changes despite their cross-project impact?

**Answer:** Allow setting changes through the consequential-mutation safety
flow.

**Decision:** MCP provides a direct structured settings read and a preview and
execute pair for supported public runtime settings, including allocation and
lease policy. Preview reports current values, proposed values, validation
results, and known impact. MCP does not expose installation locations,
supervisor internals, socket permissions, complete purge, or other native
service-management settings. Unsupported and immutable fields are rejected by
schema and server validation.

## D17 - Structured observability without raw logs

**Question:** Should MCP expose raw daemon and launcher logs, or provide a
stable structured observability contract?

**Answer:** Expose structured history and diagnostics while excluding raw log
retrieval.

**Decision:** MCP provides bounded, filterable operational history and a typed
diagnostics tool covering daemon availability, protocol and version
compatibility, socket evidence, and recent structured failures. Tool errors use
stable codes, retryability metadata, and actionable details. Raw daemon logs,
launcher logs, and arbitrary command output are not MCP content; they remain
available through existing CLI and filesystem troubleshooting paths.

## D18 - Dedicated desktop MCP tab

**Question:** Should desktop MCP setup live only in the Guide or have a
dedicated operational surface?

**Answer:** Add a dedicated MCP tab.

**Decision:** The desktop adds an `MCP` tab for setup and diagnostics. It
explains the per-host stdio bridge and single-daemon relationship, shows daemon
and protocol compatibility, allows selection of a supported host configuration
format and an optional client label, renders the exact configuration, and
offers copy actions. It links to the Guide's best-integration explanation but
does not edit third-party files or launch agent hosts.

## D19 - Exact executable paths by default

**Question:** Should generated MCP host configuration rely on `PATH`, or invoke
the exact PortReeve executable installed on the current machine?

**Answer:** Default to the exact executable and offer a deliberate portable
variant.

**Decision:** CLI and desktop configuration generation resolves and emits the
stable absolute path of the managed or currently installed PortReeve CLI by
default. This avoids the restricted `PATH` commonly inherited by GUI-launched
agent hosts and remains stable when the managed executable is upgraded in
place. Users may explicitly request output using the bare `portreeve` command
when they maintain a portable shell environment. Generated absolute-path
configuration is expected to be machine-specific.

## D20 - Initial MCP host setup formats

**Question:** Which host-specific configuration formats must PortReeve support
initially while remaining usable by other MCP hosts?

**Answer:** Support generic stdio, Codex, and Claude Code formats.

**Decision:** Version one configuration generation includes a canonical generic
stdio descriptor plus maintained profiles for Codex CLI/Desktop and Claude
Code. The generic descriptor is the compatibility path for any other conforming
MCP host. Additional named profiles are added only when their user value
justifies the independent compatibility obligation created by changing
third-party configuration formats.

## D21 - Fail-closed bridge and daemon compatibility

**Question:** How should the MCP bridge behave when its PortReeve protocol
version differs from the already-running daemon after an upgrade?

**Answer:** Keep diagnostics available but fail closed for incompatible domain
operations.

**Decision:** The bridge checks daemon protocol compatibility before domain
operations. Compatible version differences proceed normally. If versions are
incompatible, the bridge remains alive and `diagnostics_get` reports bridge and
daemon versions with exact restart or update guidance, while all daemon-backed
domain reads and mutations return a structured `protocol_incompatible` error.
The bridge does not restart or upgrade the daemon automatically.

## D22 - Semantically idempotent mutations

**Question:** How should MCP mutations avoid duplicate effects when a host or
agent retries after a lost or timed-out response?

**Answer:** Make every mutation semantically idempotent rather than requiring
agents to manage request UUIDs.

**Decision:** Mutation identity is derived from explicit durable targets,
desired state, bridge handles, and evidence receipts. Repeating allocation for
the same endpoint returns its current allocation; beginning an equivalent
pending activation returns that activation and the bridge's existing handle;
repeating lifecycle transitions returns the already-achieved state; and
repeating receipt execution returns its recorded outcome. A genuinely new
activation generation or replacement must be explicitly distinguishable from
a retry. Tool outputs clearly state whether an operation changed state or
returned an existing result.

## D23 - Polling and cursors instead of push subscriptions

**Question:** Should MCP bridges receive pushed live state changes, or should
agents observe PortReeve through explicit bounded reads?

**Answer:** Use polling and history cursors in version one.

**Decision:** Inspection results expose current state and revisions where
appropriate, and structured history accepts an opaque `afterCursor` for
efficient change polling. MCP tools return immediately with bounded results.
The bridge does not register daemon subscriptions or send unsolicited state
notifications in version one. Push behavior remains a later enhancement only
if a concrete host workflow demonstrates the need.

## D24 - Complete initial MCP capability boundary

**Question:** Which existing public-protocol families belong in the complete
initial MCP surface, and which host-administration or escape-hatch operations
remain outside it?

**Answer:** Include the proposed broad coordination surface and retain the
listed exclusions.

**Decision:** Version one includes health and diagnostics; port inventory,
inspection, and evidence-bound normal reclaim; claim inspection, reassignment,
deletion, and pruning; standalone lease acquisition, confirmation,
abandonment, and run release; stack inspection, canonical manifest validation
and application, pruning, status, and preparation; generation inspection; the
complete activation lifecycle; dependency resolution; redacted Docker-sandbox
discovery snapshots; launcher coordination sessions without shell execution;
validated global settings; and structured operational history. Consequential
changes use preview and execute, and credentials remain behind bridge-local
handles.

Version one excludes unsafe any-owner eviction, raw logs and arbitrary command
output, PortReeve installation and native service lifecycle, complete purge,
project shell-command execution, arbitrary filesystem access, Streamable HTTP,
MCP resources and prompts, and push subscriptions.
