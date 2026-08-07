# Decision Scratchpad - tb-portreeve-stacks

**Feature start:** 2026-08-06

Working record of decisions made during this feature's lifetime. Append entries across
delivery branches and sessions. Triage at each PR boundary; promoted entries are
appended to `decisions.md`.

## [1] Rebuild claims table for canonical endpoint identity

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** SQLite migration runner, claims table, every persisted claim/lease/run
relationship, and migration fixtures

Add a migration mode that disables foreign-key enforcement only around one immediate
transaction, rebuilds claims with component and endpoint columns plus the new five-part
uniqueness constraint, copies every existing service as component with endpoint default,
restores enforcement, and fails if foreign_key_check reports any violation. This
preserves IDs and lets existing lease, run, listener, and history references continue to
resolve to the recreated claims table.

**Triggered by:** P1 must replace the service-only uniqueness constraint while
preserving existing relational data.

**Alternatives considered:** ALTER plus endpoint column - rejected because SQLite
retains the old service-level UNIQUE constraint; encode endpoint into the legacy service
column - rejected as a hidden storage invariant that corrupts the meaning of service;
reset the unreleased database - rejected because the approved spec requires assignment
and history preservation.

## [2] Normalize legacy service input to one canonical identity

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Protocol schemas, registry queries, client declarations, inventory
filters, CLI rendering, and desktop port view models

Use one normalization boundary that accepts service, component, or matching service plus
component; rejects conflicting aliases; defaults endpoint to default; and returns
canonical component and endpoint together with service as a compatibility alias. Persist
and compare only component and endpoint. Legacy inventory service filtering maps to
component while new component and endpoint filters remain first-class.

**Triggered by:** P1 adds first-class component and endpoint without breaking current
service-based clients.

**Alternatives considered:** Maintain separate legacy and stack claim types - rejected
because they could allocate duplicate identities and ports; remove service immediately -
rejected by AC5; store both service and component as independent authority - rejected
because disagreement would make identity ambiguous.

## [3] Content-address definitions and advertise registration separately

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Stack definition schema, canonical JSON hashing, SQLite revision
storage, health capabilities, server routes, official client, and CLI

Parse CLI and client input through one strict version-1 schema, materialize defaults,
sort JSON object keys recursively, and use the SHA-256 digest as the immutable
definition revision. Advertise only stack-definitions-v1 for apply/list/show support;
later slices add separate capabilities only when their complete route, client, and CLI
contracts are usable.

**Triggered by:** P2 introduces the first public stack protocol surface before
allocation generations and activations exist.

**Alternatives considered:** Use raw file bytes as the revision - rejected because
harmless key ordering would create drift; advertise one broad stacks-v1 capability now -
rejected because it would overstate incomplete activation and Docker behavior; defer all
public stack endpoints until the whole feature is complete - rejected because it
prevents a safe independently testable migration and registration slice.

## [4] Reject ambiguous names and hash with locale-independent ordering

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Version-1 stack definition validation and cross-platform revision
identity

Require every stack name to already be trimmed instead of transforming it, so component,
endpoint, and dependency record keys cannot silently collide. Sort canonical JSON keys
with JavaScript UTF-16 relational ordering rather than localeCompare, making the same
normalized definition hash identically across supported runtimes and operating systems.

**Triggered by:** Boundary review demonstrated that transformed record keys can collide
and localeCompare can vary with runtime locale data.

**Alternatives considered:** Trim record keys - rejected because api and a
whitespace-padded api can collapse silently; keep localeCompare - rejected because
canonical content addressing cannot depend on host locale or ICU data; restrict all
names to an ASCII regex now - deferred because the approved contract did not require a
narrower character set.

## [5] Keep stack coordination as overlays on canonical claims and leases

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** SQLite schema v4, stack allocation and activation services, existing
lease confirmation and expiry transactions, server routes, official client, CLI, and
public declarations

Add immutable stack_generations and stack_generation_endpoints snapshots plus
stack_activations and stack_activation_endpoints coordination records. Continue using
canonical claims as port-assignment authority and the existing leases and runs tables as
operating-system ownership authority. Beginning an activation inserts every selected
pending lease and its activation linkage in one immediate transaction; lease tokens are
returned only in the begin response. Renewal validates every supplied token before
extending the batch. Process confirmation reuses fresh listener and lineage inspection,
then confirms the underlying lease and updates the activation endpoint in the same
registry transaction. Lease expiry and abandonment update activation endpoint and
aggregate activation state. Standalone acquire, confirm, abandon, and release remain
unchanged.

**Triggered by:** P3 requires immutable generations, batch activation leases, renewal,
endpoint outcomes, and process-backed confirmation without breaking standalone
allocation

**Alternatives considered:** Create a separate stack-only lease and run system -
rejected because it would duplicate port and ownership authority; add activation fields
directly to canonical claim identity - rejected because generations and activations have
different lifetimes; create endpoint leases one at a time through the existing public
acquire path - rejected because partial activation leasing violates AC2; hold open bound
sockets in the daemon - rejected by the approved process-owned binding model

## [6] Keep discovery scoped, deterministic, and authority-free

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Stack discovery schemas and service, protocol routes, official client
and declarations, CLI, runtime snapshot files, and sandbox security boundary

Resolve one consumer component against one immutable generation and activation. Return
separate own-endpoint and declared-dependency maps so aliases cannot collide with
endpoint names. Each entry carries canonical provider identity plus host publication
facts and a nullable Docker-network address derived only from the checked-in definition.
Generate a separate version-1 sandbox document by replacing each host address with a
validated launcher-supplied gateway while retaining the allocated host port. The
document contains only revision, generation, activation, consumer, and scoped TCP
addresses; it excludes stack and worktree paths, claims, leases, runs, Docker
identifiers, socket paths, and all mutation authority. Reject stale generations,
definition drift, and ended or failed activations. The official client writes snapshots
by atomic same-directory replacement and reads an explicit path or
`PORTREEVE_ENDPOINTS_FILE` with optional expected generation and activation checks.

**Triggered by:** P4 introduces the first public dependency-resolution and
sandbox-discovery contract

**Alternatives considered:** Return the whole generation - rejected because it violates
component isolation; expose the daemon socket to sandboxes - rejected because it grants
mutation and reclamation authority; let Portreeve discover a platform gateway - rejected
because the trusted launcher owns sandbox topology; merge aliases and own endpoints into
one map - rejected because names can collide; include all address views in the sandbox
file - rejected because the sandbox needs only its rendered view

## [7] Model Docker runs as provider evidence and make reclamation launcher-only

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** SQLite schema v5, activation begin and confirmation contracts, Docker CLI adapter, inventory classification, reclamation results, official client, and CLI

Select process or Docker binding per component at activation begin, defaulting to process. Return Docker leases with the exact required Portreeve label set. A Docker confirmation uses the container ID only as a lookup key, then requires fresh running state, exact stack/component/revision/generation/activation/endpoint labels, an exact 127.0.0.1 host-to-container TCP publication, and a fresh lsof listener. Persist the confirmed run with binding_kind=docker, a nullable process PID, container identity, and the expected evidence contract. Inventory redacts non-Portreeve labels. Any freshly identified Docker-managed listener makes both normal reclamation and unsafe eviction return launcher-action-required with exact container IDs and zero signals.

**Triggered by:** P5 must confirm Docker publications without inventing process lineage or allowing Docker backend PIDs to be signaled

**Alternatives considered:**
Treat the Docker backend PID as the run root - rejected because it can be shared across containers; store Docker confirmation only on the activation endpoint - rejected because claim exclusivity and inventory need one canonical active-run model; let unsafeAnyOwner kill the backend - rejected because exact-port intent cannot safely authorize terminating shared Docker infrastructure; expose all inspected container labels - rejected because unrelated labels may carry private metadata

## [8] Persist lost activations as non-live evidence outcomes

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** SQLite schema v6, activation state schemas, coordination service, server protocol, official client, CLI, discovery guards, and migration fixtures

Add lost as an explicit persisted activation state excluded from the one-live-activation index. Reconciliation freshly evaluates every confirmed process or Docker provider. Only conclusive absence of every provider marks the activation lost and releases its stored run evidence; surviving or unobservable providers keep it live. Return per-provider evidence in the reconciliation response, while retaining confirmed and degraded as the activation health states. Evidence-gated end uses the same evaluator and may end only when every provider is conclusively gone.

**Triggered by:** P6 requires launcher-loss recovery from fresh process and Docker evidence while permitting replacement activation without trusting stored launcher or PID liveness.

**Alternatives considered:**
Represent lost only as failed - rejected because startup failure and post-confirmation provider loss have different recovery meaning; infer launcher loss from a stored PID or heartbeat - rejected by the approved authority boundary; leave the activation confirmed until a caller manually ends it - rejected because it permanently blocks safe replacement after all providers disappear.

## [9] Split stack-prune evidence planning from atomic deletion

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Stack administration service, registry deletion transaction, protocol and client schemas, CLI consent flow, and durable history

The administration layer produces candidate and blocker plans from filesystem, activation, listener, and Docker evidence and repeats that evaluation immediately before execution. The registry then atomically rechecks database-owned live work, deletes the inactive stack coordination graph and its endpoint claims, and appends a final stack.pruned identity and summary event. Pruning never invokes reclamation or process/container lifecycle operations.

**Triggered by:** P6 requires previewable missing-worktree pruning, fresh process and Docker blockers, execution-time revalidation, no reclamation, and retained history.

**Alternatives considered:**
Delete stacks and claims piecemeal through existing public methods - rejected because partial deletion could strand coordination records; put filesystem and Docker checks inside the registry - rejected because the registry owns durable transactions rather than platform adapters; omit blockers from dry-run - rejected by the approved operator contract.

## [10] Expose aggregate stack status for trusted inspection surfaces

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Registry read queries, stack coordination service, protocol schemas and route, official client declarations, desktop stack adapter, and public protocol/client documentation

Add a read-only stack status operation under the existing stack-activations-v1 capability. It returns the canonical stack, latest generation, latest activation, and freshly inspected provider evidence when the latest activation has confirmed endpoints. The server derives the aggregate from registry-owned relationships and the existing provider evaluator; clients and the desktop do not reconstruct current coordination state from history. The operation performs no reconciliation or mutation.

**Triggered by:** P7 requires the desktop to inspect each stack current generation, activation, placement, and fresh provider evidence, but listStacks returns only the definition and audit history is not an authoritative current-state index.

**Alternatives considered:**
Reconstruct status from history in the desktop - rejected because history is an audit trail rather than a current-state index; add database access to the desktop - rejected by the existing trust boundary; show only definitions and prepared results from the current desktop session - rejected because the desktop must inspect stacks created by project launchers and survive restarts.

## [11] Make the assembled mixed-stack smoke launcher-owned and release-gated

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** Native verification script, package scripts, Linux release jobs, mixed-stack example, and feature-final evidence

Add one explicit native verification harness that acts as a temporary trusted project launcher. It starts a disposable process listener and a uniquely named disposable Docker container, but it drives Portreeve exclusively through the official client and validates apply, prepare, mixed activation confirmation, scoped resolution, redacted snapshot publication and reading, current status, live-provider refusal, reconciliation, ending, pruning, and retained history. It owns exact cleanup for everything it creates. Run it manually on macOS Docker Desktop and in both Linux native release jobs; keep it out of the ordinary source test command because Docker is an optional runtime capability.

**Triggered by:** P8 requires one representative process-plus-Docker lifecycle across every public coordination phase without transferring project lifecycle authority to Portreeve

**Alternatives considered:**
Extend Portreeve itself with a stack launcher - rejected because application lifecycle remains project-owned; rely only on isolated deterministic tests - rejected because P8 requires assembled native evidence; run the native smoke on every macOS GitHub runner - rejected because hosted macOS runners do not provide the Docker Desktop environment required by the product contract

## [12] Treat exact Docker publication as authoritative without requiring an lsof listener

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** Docker activation confirmation, known-run inventory classification, deterministic and native integration tests, and Docker evidence documentation

Confirm Docker endpoints from fresh exact container inspection: running state, Portreeve activation labels, loopback host publication, allocated host port, and declared container port. Keep an observable lsof listener as corroborating inventory evidence, but do not require one because Linux Docker Engine may implement publication through kernel NAT without a userspace LISTEN socket. Query Docker evidence for a known Docker run even when lsof returns no listener so inventory can still classify the claimed port as docker-managed. Process-backed confirmation and reclamation continue to require fresh lsof evidence.

**Triggered by:** The P8 native mixed-stack release gate passed on macOS Docker Desktop but failed identically on Linux x64 and ARM64 after the container became HTTP-reachable because lsof correctly reported no userspace listener

**Alternatives considered:**
Require Docker's optional userland proxy in every supported Linux environment - rejected because Portreeve must support ordinary Docker Engine configuration; treat successful HTTP fetch as authority - rejected because application health is launcher-owned and a response does not prove container identity; keep the listener requirement and drop Linux verification - rejected because it would preserve a known false portability claim
