# Spec - tb-portreeve-stacks

**Feature:** `tb-portreeve-stacks` **Created:** 2026-08-06 **Approved:** 2026-08-06
**Status:** validated (gate passed 2026-08-06) **Design:** [`design.md`](design.md)

## Summary

Portreeve must coordinate one coherent, versioned endpoint plan for every component in a
worktree stack, safely confirm mixed host-process and Docker activations, provide
restricted sandbox discovery, preserve standalone client compatibility, and expose the
same coordination model through the protocol, JavaScript client, CLI, and desktop
application without becoming a project process orchestrator.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** A strict version-1 `portreeve.stack.json` submitted through either the CLI or
  JavaScript client produces the same normalized, content-addressed definition.
  Reapplying identical content is idempotent; changed content creates a new revision
  without mutating active state. Invalid, unknown, executable, or secret-bearing fields
  are rejected. Stack identity is project plus canonical worktree.
- **AC2.** Preparation creates one complete immutable allocation generation. Exact-port
  conflicts fail without a partial generation; preferred ports may fall back. Beginning
  an activation atomically leases its selected endpoints and prevents a second
  activation for that worktree. Required, optional, degraded, expired, and
  stale-generation outcomes follow the approved design.
- **AC3.** Process endpoints confirm only through fresh listener and process-instance
  evidence. Docker endpoints confirm only through fresh listener evidence plus matching
  container state, labels, host publication, and container port. Mixed activations work.
  Missing Docker capability does not impair process-only stacks. Portreeve never
  represents application health as confirmation.
- **AC4.** Consumers resolve only their own endpoints and declared dependency aliases
  from one generation. Host, Docker-network, and launcher-rendered sandbox views remain
  distinct. Generated sandbox discovery documents contain revision, generation,
  activation identity, and resolved addresses; exclude control or ownership credentials;
  and make stale generations detectable.
- **AC5.** Existing `service` requests normalize to the same-named component and
  `default` endpoint. Existing acquisition methods and response shapes continue working.
  Inventory retains `service` compatibility while exposing component and endpoint.
  Existing stored assignments and history survive migration, matching claims are reused,
  and active legacy runs are not silently adopted.
- **AC6.** Launcher loss is reconciled using fresh provider evidence rather than stored
  launcher or PID state. Docker-managed listeners are refused by process reclamation and
  unsafe eviction with a structured launcher-required result. Stack pruning follows
  dry-run, interactive, and `--yes` consent; revalidates candidates; never removes live
  resources; and retains history.
- **AC7.** Protocol version 1, capability negotiation, JavaScript client, and CLI expose
  equivalent apply, prepare, activation, resolve, snapshot, inspect/status,
  reconcile/end, list, and prune capabilities with versioned JSON results. They do not
  start or stop project processes, run Compose, or perform application health
  orchestration.
- **AC8.** The desktop provides the approved Stacks views and safe coordination actions,
  including definition application, preparation, reconciliation, activation ending, and
  pruning. It never performs project or container orchestration. Lifecycle and stack
  failures display safe, actionable codes and details instead of collapsing to generic
  `internal` messages.

## Rubric

| #   | Criterion                   | Pass                                                                                                           | Fail                                                                                                                                 | Evidence                                                                                |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| R1  | Definition and identity     | CLI and client normalize identically; revision and validation behavior match AC1                               | Any divergent normalization, silent unknown field, unstable identity, or active-state mutation                                       | Schema, client/server integration, canonical-worktree, and revision tests               |
| R2  | Allocation and activation   | Generation, port constraints, atomic leases, exclusivity, and required/optional outcomes match AC2             | Partial generations, mixed-generation resolution, concurrent activation, or incorrect endpoint outcome                               | Storage transaction and end-to-end activation tests                                     |
| R3  | Ownership confirmation      | Process, Docker, mixed-mode, and capability behavior match AC3                                                 | A stale ID alone confirms, Docker uses process lineage, a mismatched publication confirms, or process-only operation requires Docker | Process/Docker adapter unit tests plus native Docker integration smoke                  |
| R4  | Discovery isolation         | Dependency scoping and all three address views are correct; the snapshot is read-only and generation-aware     | Cross-generation values, excess authority or data, an exposed socket or token, or undetectable staleness                             | Resolution, snapshot-schema, redaction, macOS gateway, and Linux gateway fixture tests  |
| R5  | Compatibility and migration | Legacy calls and responses work; assignments and history survive; matching claims are reused safely            | A legacy regression, reassignment or data loss, ambiguous aliases, or silent active-run adoption                                     | Migration tests against a version-1 fixture plus existing client and inventory suites   |
| R6  | Safety and recovery         | Crash reconciliation, Docker refusal, and prune consent and revalidation match AC6                             | A PID or heartbeat is treated as authority, a Docker backend is signaled, a live stack is pruned, or consent is bypassed             | Recovery, reclamation, CLI-consent, and concurrent revalidation tests                   |
| R7  | Client, CLI, and protocol   | Coordination operations and capability negotiation are available and consistent without orchestration behavior | A missing surface, incompatible JSON or client behavior, unguarded old-server use, or project lifecycle execution                    | Protocol schema, server/client, CLI contract, compiled-runtime, and documentation tests |
| R8  | Desktop                     | Approved stack inspection and actions work and actionable failures are visible                                 | A missing required view or action, stale unsafe mutation, project orchestration, or generic-only failure presentation                | Desktop schema, state, and IPC tests plus packaged-app manual workflow verification     |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
