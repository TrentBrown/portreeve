# Plan - tb-portreeve-stacks

**Feature:** `tb-portreeve-stacks` **Spec:** [`spec.md`](spec.md) **Design:**
[`design.md`](design.md) **Interview:** [`interview.md`](interview.md) **Created:**
2026-08-06 **Status:** approved (2026-08-06)

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Build from the durable identity and transaction model outward. First migrate the
existing service claim into a canonical component/default-endpoint shape and add strict
stack-definition registration without changing standalone behavior. Then add immutable
generations and activation-scoped leases through the server, client, and CLI using
process-backed confirmation as the first complete path. Layer dependency resolution and
sandbox snapshots onto that stable generation model before adding a separately injected
Docker evidence adapter and Docker-specific refusal behavior.

Recovery, activation ending, and pruning follow only after both process and Docker
evidence can be reconciled safely. The desktop consumes the finished coordination APIs
through its existing main-process/client boundary and adds the required Stacks
experience plus actionable error presentation without gaining project lifecycle
authority.

Deliver the work through sequential PR slices. The exact feature branch may carry the
first slice; each later branch begins from updated `main` after the preceding slice
merges while retaining this cumulative feature folder. Do not advertise a capability
until its entire route/client/CLI contract is usable. Keep migrations transactional and
compatibility-tested at every boundary.

## Steps

- **P1. Canonicalize claim identity and migrate persisted state safely.** Replace
  service-only canonical identity with project, canonical worktree, component, endpoint,
  and TCP transport while accepting `service` as the compatibility alias for component
  plus endpoint `default`. Add a transactional migration from the current schema that
  preserves claim IDs, assignments, leases, runs, listener evidence, and history. Extend
  inventory, administration, CLI filters, client types, and desktop port view models
  with component/endpoint facts while retaining existing response fields and behavior.
  **Code areas:** `src/protocol/`, `src/domain/`, `src/storage/migrations.js`,
  `src/storage/registry.js`, allocation, reconciliation and administration services,
  `packages/client/`, port and claim CLI commands, desktop inventory schemas/view
  models, migration fixtures. **Verification:** old-database migration, identity
  normalization, conflicting alias rejection, assignment/history preservation, existing
  acquire-bind-confirm and desktop inventory regression suites. **Advances:** R1, R5.

- **P2. Add strict stack definitions, revisioning, and registration.** Define the shared
  version-1 `portreeve.stack.json` schema and normalization/hash rules; validate
  components, endpoints, required/optional flags, allocation constraints, dependencies,
  publication intent, and Docker metadata while rejecting unknown or forbidden
  configuration. Persist stack identity, immutable definition revisions, current
  revision, and links to reusable canonical claims. Implement idempotent apply,
  drift-aware status/list/show, file discovery and `--file` behavior, JavaScript client
  methods, server routes, and capability negotiation. **Code areas:** a focused
  `src/stacks/` domain/service, protocol schemas and routes, registry/migrations, client
  JavaScript and declarations, Commander stack commands, definition and protocol
  documentation. **Verification:** CLI/client normalization parity, canonical JSON/hash
  fixtures, invalid-definition matrix, repeated and changed apply tests, active-revision
  immutability, claim adoption and exact port conflict tests, old-server capability
  refusal. **Advances:** R1, R5, R7.

- **P3. Implement immutable generations and process-backed activations.** Add atomic
  preparation of a complete endpoint allocation generation, reuse and invalidation
  rules, exact/preferred behavior, activation exclusivity, required/optional selection,
  and activation-scoped batch leases with renewal and expiry. Reuse the existing process
  acquire-bind-confirm authority behind activation-aware endpoint confirmation, and
  expose prepare, begin, renew, abandon/skip, confirm, inspect/status, and end
  primitives through versioned routes, the official client, and JSON CLI. Keep the
  high-level helper's startup callback project-owned. **Code areas:** stack
  allocation/activation services, registry transactions and records, allocation
  integration, protocol schemas/server, client helper and types, Commander commands,
  history events. **Verification:** concurrent preparation and activation, rollback on
  exact conflicts, generation immutability, stale-generation refusal, lease
  renewal/expiry/cancellation, required/optional state matrix, process evidence
  confirmation, standalone/stack coexistence, compiled CLI flows. **Advances:** R2, R7.

- **P4. Add dependency resolution and restricted sandbox discovery.** Resolve
  component-owned endpoints and declared dependency aliases against one generation; emit
  distinct host and Docker-network facts and accept launcher-supplied sandbox gateway
  rendering without treating it as ownership evidence. Add deterministic,
  activation-scoped discovery-document generation and a client reader for explicit paths
  or `PORTREEVE_ENDPOINTS_FILE`, with strict redaction and stale-generation detection.
  **Code areas:** stack resolver/snapshot schemas and services, protocol/client/CLI
  operations, atomic runtime-file utilities, JavaScript discovery reader, docs and
  examples. **Verification:** dependency validation and scoping, circular address
  references, cross-generation rejection, host/Docker/sandbox view fixtures, atomic
  replacement, prohibited-field snapshots, stale-reader behavior, macOS and Linux
  gateway fixtures. **Advances:** R4, R7.

- **P5. Add Docker evidence and mixed-activation safety.** Create an injectable Docker
  evidence adapter whose initial implementation resolves and invokes a trusted host
  `docker` CLI/context. Support per-activation process or Docker placement, required
  Portreeve labels, fresh container inspection, published host/container mapping
  verification, and mixed activation confirmation. Classify Docker-managed listeners
  before reclamation; return structured launcher-required evidence and refuse all
  process signaling, including unsafe eviction. Docker absence remains a capability
  result and does not affect process-only stacks. **Code areas:** Docker platform
  adapter and inspection schemas, stack confirmation/reconciliation services,
  reclamation/inventory classification, server/client/CLI contracts, installation
  diagnostics and safety docs. **Verification:** deterministic adapter fixtures for
  absent, stopped, changed, mislabeled, mismapped, stale, and matching containers;
  shared-backend refusal tests; mixed process/Docker activation tests; real Docker
  Desktop macOS and Linux Engine integration smokes. **Advances:** R3, R6.

- **P6. Complete evidence-based recovery, ending, and stack pruning.** Reconcile lost
  launchers and provider state through fresh process/listener/Docker evidence;
  distinguish lost, active, confirmed, degraded, failed, and ended activation outcomes
  without a launcher heartbeat. Permit evidence-gated end only after providers are gone
  and preserve valid generations when possible. Add missing-worktree stack prune
  planning and transactional execution using the existing dry-run, interactive
  confirmation, noninteractive `--yes`, revalidation, and durable-history conventions.
  **Code areas:** stack reconciliation/administration services, registry
  deletion/history flows, protocol/client/CLI commands and output, prune consent
  helpers, safety and troubleshooting docs. **Verification:** launcher-loss matrices,
  partial survivor cases, replacement launcher behavior, reappearing-worktree and
  listener/container races, prune consent modes, no-reclamation assertions, retained
  history, compiled CLI recovery/prune flows. **Advances:** R6.

- **P7. Deliver desktop stack management and actionable failures.** Extend the
  main-process adapters, shared runtime schemas, serialized coordinator, preload
  allowlist, renderer state, and UI with a Stacks tab and the approved
  stack/revision/generation/activation/component/endpoint/dependency/address/
  placement/evidence views. Add file-picker definition apply, preparation, explicit
  reconciliation, copyable address and discovery previews, evidence-gated activation
  ending, and previewed/confirmed pruning. Preserve the no-shell/no-raw-socket renderer
  boundary and ensure both lifecycle and stack operations display safe actionable
  refusal/error details rather than generic `internal` summaries. **Code areas:**
  `apps/desktop/main/`, `apps/desktop/preload/`, `apps/desktop/shared/`, renderer
  HTML/state/styles, client adapters and packaged-app fixtures. **Verification:** strict
  desktop schema and IPC tests, mutation/refresh serialization, file-picker and
  cancellation paths, stale evidence and refusal rendering, no-orchestration security
  assertions, accessibility checks, packaged application stack workflows, and screenshot
  inspection. **Advances:** R8.

- **P8. Complete cross-surface documentation and feature-final verification.** Publish
  the complete definition, protocol, CLI, client, Docker-label, sandbox-discovery,
  migration, safety, troubleshooting, and desktop contracts. Exercise one representative
  mixed stack end to end across apply, prepare, activate, process and Docker
  confirmation, scoped resolution, sandbox snapshot, reconciliation, end, and prune. Run
  existing standalone and desktop regression matrices, compiled artifacts, native
  macOS/Linux Docker smokes, packaged desktop manual verification, full spec evaluation,
  independent judge, pattern review when applicable, code review, and the feature-final
  PR boundary. **Code areas:** `docs/`, examples/fixtures, release/runtime tests,
  workflow evidence packet, tracker, issues, and completion report. **Verification:**
  every R1-R8 evidence field, repository-wide checks, zero `NOT YET` or `FAIL`, and
  deterministic retention of this cumulative feature record. **Advances:** R1, R2, R3,
  R4, R5, R6, R7, R8.

## Verification

- **Per migration boundary:** Create a real current-version database fixture, migrate
  it, and rerun legacy acquisition, inventory, administration, and history behavior
  before testing new stack paths.
- **Per protocol boundary:** Validate request and response schemas at server, client,
  CLI JSON, and desktop IPC boundaries; test capability mismatch and stable structured
  failures.
- **Per evidence boundary:** Use dependency-injected deterministic process and Docker
  fixtures, then run native platform smokes where `lsof`, Docker Desktop, Docker Engine,
  launchd, or systemd behavior is part of the claim.
- **Per desktop boundary:** Test reduced runtime schemas and mutation serialization,
  then inspect the packaged application and complete the human-visible failure and stack
  workflows.
- **Per PR:** Run typecheck, lint, format check, targeted unit/integration suites,
  relevant compiled/package smokes, scoped spec evaluation, judge, review, and
  explain-diff against one pinned boundary.
- **Final step:** Run the complete Definition of Done, evaluate R1-R8, and produce the
  completion report.
