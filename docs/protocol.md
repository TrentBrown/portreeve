# PortReeve socket protocol

## Transport and authority

Protocol version 1 is HTTP/JSON over one private per-user Unix socket. There is no TCP
control listener. The default socket is:

- macOS: `~/Library/Application Support/Portreeve/portreeve.sock`
- Linux: `${XDG_STATE_HOME:-~/.local/state}/portreeve/portreeve.sock`

`PORTREEVE_SOCKET` or a CLI `--socket` option may override this bootstrap location. The
server creates the socket with mode `0600`; clients must not open the SQLite registry
directly.

Every response includes a request UUID. A caller may provide its own UUID in
`x-portreeve-request-id`.

```json
{
  "protocolVersion": 1,
  "requestId": "a8ad107e-b878-4ea4-b1a7-b0e29857aee7",
  "data": {}
}
```

Failures use the same envelope:

```json
{
  "protocolVersion": 1,
  "requestId": "a8ad107e-b878-4ea4-b1a7-b0e29857aee7",
  "error": {
    "code": "conflict",
    "message": "The exact port is unavailable.",
    "retryable": false,
    "details": {}
  }
}
```

Error codes are `conflict`, `incompatible_protocol`, `invalid_input`,
`invalid_lease_token`, `lease_expired`, `lease_not_pending`, `not_found`, `unavailable`,
and `internal`.

## Compatibility

Every mutating request includes:

```json
{
  "client": {
    "softwareVersion": "0.1.0",
    "protocol": { "minimum": 1, "maximum": 1 },
    "requiredCapabilities": ["two-phase-allocation-v1"]
  }
}
```

The server requires protocol-range overlap and every named capability. Software versions
may differ when protocol and capability negotiation still succeeds. `GET /v1/health`
advertises the server version, range, capabilities, PID, and asserted `manual` or
`supervised` mode.

Version 1 capabilities are:

- `claims-v1`
- `two-phase-allocation-v1`
- `listener-evidence-v1`
- `reclamation-v1`
- `administration-v1`
- `observability-v1`
- `lifecycle-control-v1`
- `stack-definitions-v1`
- `stack-activations-v1`
- `stack-discovery-v1`
- `launcher-operations-v1`
- `mcp-foundations-v1`
- `docker-evidence-v1` when the configured host Docker CLI and daemon are available

## Allocation workflow

### Acquire

`POST /v1/leases/acquire`

```json
{
  "client": {
    "softwareVersion": "0.1.0",
    "protocol": { "minimum": 1, "maximum": 1 },
    "requiredCapabilities": ["two-phase-allocation-v1"]
  },
  "claim": {
    "project": "caregiver",
    "workspaceRoot": "/canonical/worktree",
    "component": "website",
    "endpoint": "default",
    "transport": "tcp"
  },
  "allocation": {
    "mode": "sticky",
    "preferredPort": 3000,
    "replacementPolicy": "never"
  }
}
```

`mode` is `sticky` or `ephemeral`. Use either `preferredPort` (fallback allowed) or
`exactPort` (no fallback), never both. Replacement policy is `never`, `graceful`, or
`force-after-grace`.

The response contains `claimId`, `leaseId`, a one-time `leaseToken`, `port`,
`expiresAt`, and `reusedAssignment`. The client must bind before expiration. A trusted
coordinator that still owns the token may extend a pending standalone lease with
`POST /v1/leases/{leaseId}/renew`; the response contains the lease ID and new
expiration. Stack activation leases use the activation-scoped batch renewal endpoint.

`component` and `endpoint` are the canonical identity fields. An omitted `endpoint`
means `default`. Existing callers may continue sending `service` as an alias for
`component` with endpoint `default`; if both are supplied, they must agree.

### Confirm or abandon

After successfully binding, call `POST /v1/leases/{leaseId}/confirm` with `client`,
`leaseToken`, and the positive `rootPid` of the service process tree. PortReeve takes
fresh listener evidence and confirms only when every listener belongs to that process
tree. The response contains `claimId`, `leaseId`, `runId`, `port`, and `confirmedAt`.

When binding or startup fails, call `POST /v1/leases/{leaseId}/abandon` with `client`,
`leaseToken`, and one of `address-in-use`, `startup-error`, or `client-cancelled`.

### Release

`POST /v1/runs/{runId}/release` with `client` marks a confirmed run released. A sticky
claim retains its assignment; an ephemeral assignment expires under the configured
policy.

## Inventory and administration

| Method and path                            | Purpose                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /v1/ports`                            | List claimed and/or listening ports; accepts classification, claimed, listening, project, workspace, service, and port query filters |
| `GET /v1/ports/{port}`                     | Inspect one port with complete listener and ownership evidence                                                                       |
| `POST /v1/ports/{port}/reclaim`            | Evidence-bound normal reclaim with `client`, `policy`, and `dryRun`                                                                  |
| `POST /v1/ports/{port}/unsafe-evict`       | Exact-port unsafe eviction; requires `unsafeAnyOwner: true` for that operation                                                       |
| `GET /v1/claims`                           | List durable claims; accepts project, workspaceRoot, component, and endpoint filters                                                 |
| `GET /v1/claims/{claimId}`                 | Read one claim                                                                                                                       |
| `POST /v1/claims/{claimId}/reassign`       | Assign an idle claim a new preferred or exact port                                                                                   |
| `POST /v1/claims/{claimId}/delete`         | Delete an idle, listener-free claim                                                                                                  |
| `POST /v1/claims/prune`                    | Find or delete old missing-workspace claims using `olderThanMilliseconds` and `dryRun`                                               |
| `GET /v1/stacks`                           | List applied stack definitions; accepts project and canonical `stackRoot` filters                                                    |
| `GET /v1/stacks/{stackId}`                 | Read one applied stack and its normalized current definition                                                                         |
| `POST /v1/stacks/apply`                    | Validate and atomically apply a definition; requires `stack-definitions-v1`                                                          |
| `POST /v1/stacks/prune`                    | Preview or delete old missing-stack-root stacks with fresh evidence revalidation                                                     |
| `POST /v1/stacks/{stackId}/status`         | Read the current definition plus latest generation, activation, and fresh provider evidence                                          |
| `POST /v1/stacks/{stackId}/prepare`        | Create or reuse a complete immutable allocation generation; requires `stack-activations-v1`                                          |
| `POST /v1/stack-activations/begin`         | Create one activation and atomically lease its selected endpoints                                                                    |
| `GET /v1/stack-activations`                | List activations; accepts stackId, generationId, and state filters                                                                    |
| `GET /v1/stack-activations/{id}`           | Inspect activation and endpoint states without returning lease tokens                                                                |
| `GET /v1/stack-generations`                | List immutable generations; accepts stackId and state filters                                                                         |
| `GET /v1/stack-generations/{id}`           | Inspect one immutable allocation generation                                                                                          |
| `POST /v1/stack-activations/{id}/renew`    | Validate and renew a batch of pending activation leases                                                                              |
| `POST /v1/stack-activations/{id}/confirm`  | Confirm one process or Docker endpoint using binding-appropriate fresh evidence                                                       |
| `POST /v1/stack-activations/{id}/abandon`  | Fail one pending endpoint; a required failure cancels the remaining pending batch                                                    |
| `POST /v1/stack-activations/{id}/skip`     | Skip one optional pending endpoint                                                                                                   |
| `POST /v1/stack-activations/{id}/reconcile` | Reconcile launcher loss using fresh process, listener, and Docker provider evidence                                                  |
| `POST /v1/stack-activations/{id}/end`      | End only after fresh evidence shows every confirmed process or Docker provider has stopped                                           |
| `POST /v1/stack-activations/{id}/resolve`  | Resolve one consumer's own endpoints and declared dependencies from its activation generation; requires `stack-discovery-v1`         |
| `POST /v1/stack-activations/{id}/snapshot` | Render one redacted endpoint document using a launcher-supplied gateway; requires `stack-discovery-v1`                              |
| `POST /v1/launcher-operations/begin`       | Begin one renewable per-stack launcher coordination session; returns a one-time credential                                        |
| `GET /v1/launcher-operations/{id}`         | Inspect one active or retained terminal launcher operation without returning its credential                                        |
| `POST /v1/launcher-operations/{id}/renew`  | Renew an active launcher operation using its credential                                                                               |
| `POST /v1/launcher-operations/{id}/complete` | Idempotently complete an operation with strict safe outcome metadata                                                                |
| `GET /v1/stacks/{stackId}/launcher-operations` | Read up to the latest twenty retained launcher operations for one stack                                                          |

### Consequential action receipts

The public protocol also offers evidence-bound preview and execute pairs for actions
that can terminate a process or change durable state. A preview records the explicit
target, proposal, and caller-visible evidence in the daemon and returns a receipt that
expires after five minutes. Execute accepts the receipt and explicit target, recomputes
the evidence in the daemon, rejects a mismatch, and durably records its result. Retrying
a completed receipt returns that recorded result without repeating the effect.

| Preview and execute paths | Protected action |
| --- | --- |
| `POST /v1/actions/ports/{port}/reclaim/preview` and `POST /v1/actions/ports/{port}/reclaim/execute` | Normal owner-verified reclaim; unsafe any-owner eviction has no receipt API |
| `POST /v1/actions/claims/{claimId}/reassign/preview` and `POST /v1/actions/claims/{claimId}/reassign/execute` | Idle claim reassignment to the selected preferred or exact port |
| `POST /v1/actions/claims/{claimId}/delete/preview` and `POST /v1/actions/claims/{claimId}/delete/execute` | Idle, listener-free claim deletion |
| `POST /v1/actions/claims/prune/preview` and `POST /v1/actions/claims/prune/execute` | Missing-worktree claim pruning |
| `POST /v1/actions/stacks/apply/preview` and `POST /v1/actions/stacks/apply/execute` | Canonical document creation or replacement plus durable stack apply |
| `POST /v1/actions/stacks/prune/preview` and `POST /v1/actions/stacks/prune/execute` | Missing-root stack pruning with process, Docker, launcher, and filesystem evidence |
| `POST /v1/actions/settings/preview` and `POST /v1/actions/settings/execute` | Validated public runtime-setting updates |

Execute bodies contain `client` and `receiptId`; target-specific execute paths also
carry the port, claim ID, or canonical stack root. The proposal comes from the daemon's
stored receipt rather than from the execute caller.

Inventory classifications are `available`, `verified`, `idle`, `pending`, `unclaimed`,
`conflicting`, `mixed`, and `docker-managed`. A live PID alone never establishes
ownership; PortReeve compares fresh listener and binding-appropriate process or Docker
evidence.

## Launcher-operation coordination

`launcher-operations-v1` coordinates Desktop and CLI lifecycle work without moving
project-command authority into the daemon. Begin identifies the stack, fixed lifecycle
operation, finite or attached execution mode, exact launcher revision, caller operation
ID, and optional allocation generation. The response contains the safe operation record,
a one-time credential, and a 10-second renewal interval. The credential is never returned
by inspect or history routes and only its SHA-256 hash is stored.

An operation expires 30 seconds after begin or its latest renewal. Expiry records the
terminal outcome `lost`; it never runs a command, adopts a process, or signals anything.
Same-stack sessions serialize by default. An attached Start may admit one finite Status
or Stop companion, while different stack roots remain independent.

Completion accepts only bounded outcome, exit or signal, degraded flag, evidence and
failure summaries, and a reduced integration assessment. That assessment can record the
declared maturity mode, an exact generation and activation match, and whether a
command-only launcher merits an upgrade suggestion. Unknown fields are rejected, so
commands, environment values, credentials, process identities, and raw stdout or stderr
cannot enter this contract.
An identical completion retry returns `changed: false`; different metadata conflicts.
PortReeve retains the latest twenty terminal records per stack plus active sessions and
also emits begin, complete, and lost events through the existing global history surface.

## Stack definitions

`POST /v1/stacks/apply` accepts `client`, `stackRoot`, and a strict version-1
definition. `stackRoot` must name an existing directory; the server resolves its real
path without substituting a Git root. PortReeve rejects a root that equals, contains,
or is contained by another registered stack root, while sibling roots remain valid.
Stack identity is the definition's `project` plus that canonical root. PortReeve
normalizes schema defaults, hashes the canonical JSON with SHA-256,
stores that immutable revision, and links each published component endpoint to its
sticky claim. Reapplying equivalent JSON returns `changed: false`. Changed content is
refused while an activation is `starting`, `confirmed`, or `degraded`; otherwise it
updates the stack's current revision without changing an existing port assignment. See
[Stack definitions](stacks.md).

`GET /v1/stack-document?stackRoot=...` reads only the fixed
`portreeve.stack.json` beneath an explicit canonical root and returns its structured
definition, validation issues, and fingerprint without raw file contents.
`POST /v1/actions/stack-definition/validate` validates a structured definition without
filesystem access. Receipt-bound stack apply owns fixed-path creation or replacement,
exact-byte conflict handling, and atomic writes. These operations are not general file
discovery or arbitrary-path APIs. Apply does not prepare a generation or start
providers.

## Stack generations and activations

Preparation accepts `client` and the path-selected `stackId`. It returns `reused` and a
generation whose endpoint-to-port plan never changes. Preparation does not create
leases. Beginning accepts `generationId`, optional `requiredEndpoints`, optional
`skippedEndpoints`, and component-keyed `bindings`. Omitted bindings default to
`process`; `docker` requires complete Docker definition data and the dynamically
advertised `docker-evidence-v1` capability. It refuses a stale definition revision or
another live activation for the same canonical stack root.

The begin response contains an activation plus a private token for every newly leased
endpoint. Tokens are not returned by later inspection. Each lease identifies its
binding kind; Docker leases also return the service, container port, and exact
PortReeve labels the launcher must apply. Renewal accepts a non-empty array of
`{ leaseId, leaseToken }` and validates the complete batch before extending any
deadline. Confirm, abandon, and skip accept one lease credential. Process confirmation
requires `rootPid` and fresh lineage evidence. Docker confirmation requires
`bindingKind: "docker"` and a container ID lookup key, then freshly verifies running
state, exact labels, loopback host/container publication, and an `lsof` listener.

Reconcile accepts only `client` and returns `{ changed, activation, providers }`.
Each provider result is `active`, `gone`, or `unknown` with a safe reason and listener
count. Only conclusive absence of every confirmed provider changes the activation to
`lost`; active or unavailable evidence preserves the live activation.

End accepts only `client`. It refuses while leases remain pending, a process or Docker
provider remains active, provider evidence is unavailable, or an unresolved listener is
present. It does not signal providers. Successful ending releases the activation's run records and returns
`{ changed, activation }`; repeated ending is idempotent.

Stack prune accepts `client`, `olderThanMilliseconds`, and `dryRun`. Its result separates
`candidates` from `blocked` stacks and reports deleted stack and claim IDs plus
execution-time skips. Execution revalidates filesystem, listener, process, Docker, lease,
run, and activation evidence, performs no reclamation, and retains a final history
summary.

`exactPort` is a preparation constraint and never falls back. `preferredPort` may fall
back. Separately, required endpoints must confirm; optional endpoints may be skipped or
fail, producing a `degraded` activation after all required endpoints confirm. Required
endpoint failure or expiry fails the activation and cancels its other unconfirmed
leases. See [Stack definitions and activation](stacks.md).

## Stack dependency discovery

Resolution accepts `client` and one consumer `component`. The activation selects exactly
one immutable generation; failed, lost, ended, stale, or definition-drifted activations refuse
discovery. The response contains the definition revision, generation ID, activation ID,
consumer name, and two separate maps:

- `own` contains only the consumer's published endpoints.
- `dependencies` contains only aliases declared by that consumer.

Every entry identifies its canonical provider component and endpoint and supplies the
allocated host-publication address. `dockerNetwork` is either the definition's Docker
service and fixed container port or `null`; it is an address fact, not container
ownership evidence. Circular dependency references are valid because every address is
drawn from the same precomputed generation.

Snapshot rendering additionally accepts `gatewayHost`. It returns a strict
`schemaVersion: 1` document whose addresses use that launcher-supplied host and the
generation's allocated host ports. It excludes stack-root paths, claims, leases, tokens,
runs, PIDs, Docker identifiers, socket paths, and mutation authority. PortReeve
validates but does not discover or independently verify the gateway.

## Settings and observability

| Method and path        | Purpose                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `GET /v1/config`       | Read validated server settings                                                             |
| `POST /v1/config`      | Apply a non-empty partial `updates` object with `client`                                   |
| `GET /v1/history`      | Query a newest-first page of structured events by limit, opaque `afterCursor`, event type, entity type, entity ID, or timestamp |
| `GET /v1/logs`         | Read recent bounded diagnostic entries                                                     |
| `POST /v1/server/stop` | Request graceful shutdown through the protected socket; requires `lifecycle-control-v1`    |

Default allocation range is `10240-49151`. The default lease TTL is 15 seconds,
ephemeral assignment TTL one hour, graceful shutdown window five seconds, history bound
10,000 events, and diagnostic retention three 1 MiB files. Change settings through the
API/CLI rather than a general config file.

History pages contain `{ items, page: { nextCursor } }`, default to 50 entries, and
permit at most 200 entries per request. A non-null cursor continues toward older
events. Each event includes nullable diagnostic `origin` metadata. Origin can identify
library, CLI, Desktop, or MCP calls, but is never ownership or authorization evidence.
