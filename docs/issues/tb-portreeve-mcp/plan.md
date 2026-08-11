# Plan - tb-portreeve-mcp

**Feature:** `tb-portreeve-mcp`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-10

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Build the MCP feature contract-first and deliver it through sequential branches
whose PRs can be reviewed and merged independently. Extend the daemon protocol
and official JavaScript client only where the approved MCP safety model needs
capabilities that do not exist yet: bounded cursor collections, MCP origin
attribution, evidence receipts with replayable outcomes, canonical stack
document operations, and semantically idempotent mutations. Keep these
facilities general PortReeve application contracts rather than embedding MCP
transport policy in the daemon.

Add the official TypeScript MCP SDK v2 as an isolated runtime dependency for a
new `src/mcp/` adapter. The adapter owns stdio framing, tool registration,
bridge-run attribution, process-local credential handles, and bounded renewal.
It reaches domain state exclusively through the public JavaScript client. A
declarative tool catalog should keep names, schemas, annotations, summaries,
and exclusions auditable without introducing action-multiplexing tools.

Land safe observation and diagnostics before credential-bearing workflows.
Then add the vault and ordinary coordination lifecycle, followed by the generic
receipt service and consequential mutations. Complete the catalog with
structured history, Docker snapshots, and launcher coordination that never
executes project commands. Add host configuration generation to the CLI and
Desktop only after the bridge contract is stable. Finish with compiled,
packaged, cross-era, cross-host, cross-platform, concurrent-bridge, unavailable
daemon, incompatible daemon, and Docker-backed verification.

Record the MCP dependency/version pin, public protocol and storage schema
changes, receipt persistence model, canonical-document service boundary, and
Desktop IPC expansion in `scratchpad.md` when their implementation decisions
are made.

## Steps

- **P1. Establish protocol and client foundations.** Define the complete MCP
  capability matrix and stable tool naming catalog. Add the official MCP SDK v2
  dependency and extend public protocol schemas, server routes, storage, and the
  official JavaScript client for cursor pagination, MCP origin attribution,
  evidence receipts with durable execution outcomes, explicit idempotency
  semantics, and any currently uncovered included operation. Preserve existing
  CLI behavior through adapters and fixtures. **Advances:** R1, R2, R3, R5,
  R6, R7.

- **P2. Build the stdio bridge, diagnostics, and bounded reads.** Add
  `portreeve mcp serve`, dual-era `serveStdio` hosting, stdout framing guards,
  bridge run/client labels, capability and protocol checks, stable errors, and
  a declarative tools-only registry. Implement health, diagnostics, settings
  reads, and globally filterable/paginated port, claim, stack, generation,
  activation, and history reads. Keep the bridge alive across unavailable or
  incompatible daemons and retry the socket on later calls. **Advances:** R1,
  R2, R3, R7.

- **P3. Add credential custody and ordinary coordination.** Implement an
  in-memory cryptographically opaque handle vault, ten-minute default and
  sixty-minute maximum custody deadlines, TTL-derived renewal scheduling,
  explicit custody extension, immediate credential removal on settlement, and
  shutdown cleanup. Expose semantically idempotent standalone acquire,
  confirm, abandon, and release plus stack prepare/begin/renew/resolve/confirm/
  skip/abandon/reconcile/end operations. Prove multi-bridge isolation and lost
  custody recovery. **Advances:** R4, R5.

- **P4. Add evidence-bound consequential mutations.** Implement the generic
  five-minute preview/execute receipt contract with target, action, evidence,
  revision or fingerprint binding, stale rejection, completed replay, and
  durable history. Apply it to normal reclaim, claim reassignment/deletion/
  pruning, stack creation/replacement/pruning, and supported settings changes.
  Extract or share canonical stack-document behavior so the daemon and Desktop
  enforce one location, validation, fingerprint, traversal, symlink, overwrite,
  and external-change policy. Keep unsafe any-owner eviction absent.
  **Advances:** R5, R6, R7.

- **P5. Complete and audit the coordination catalog.** Add redacted
  Docker-sandbox snapshots, launcher coordination begin/renew/complete and
  evidence/history tools without shell execution, remaining included
  generation/activation inspections, and bounded structured operational
  history. Snapshot the full tool catalog and prove every approved family is
  present while every excluded administration, shell, filesystem, raw-log,
  resource, prompt, subscription, and network-listener surface is absent.
  **Advances:** R2, R5, R7.

- **P6. Add CLI and Desktop MCP setup.** Add configuration-generation commands
  for generic stdio, Codex, and Claude Code with exact-installed-path defaults,
  an explicit portable variant, optional client labels, copyable instructions,
  and no third-party writes. Add the Desktop `MCP` tab, validated main-process
  generator/diagnostic authority, strict IPC/preload schemas, renderer-safe
  status and errors, host-format selection, and clipboard actions. Link the
  Guide without implying that MCP owns project lifecycle. **Advances:** R3,
  R8.

- **P7. Prove shipped compatibility and complete the feature.** Compile the
  bridge into the existing standalone executable, inspect packaged Desktop
  contents, and run modern `2026-07-28` plus maintained legacy-era stdio
  discovery/calls. Exercise real Codex and Claude Code configuration, multiple
  simultaneous bridges, absent and incompatible daemons, credential leakage,
  receipt expiry/replay/staleness, macOS and Linux standalone runtimes,
  packaged macOS Desktop behavior, and Docker-backed activation. Run the full
  rubric evaluation, independent judge, and completion report. **Advances:**
  R1, R2, R3, R4, R5, R6, R7, R8.

## Verification

- **Protocol and client contracts:** Validate every new request/response schema,
  error, cursor, origin field, receipt transition, compatibility range, and CLI
  adapter against deterministic fixtures.
- **MCP conformance:** Use the official SDK v2 client and server test utilities
  plus raw framed transcripts to verify modern and legacy stdio negotiation,
  discovery, schemas, structured content, annotations, bounded collections,
  cancellation, stderr handling, and stdout purity.
- **Credential safety:** Seed recognizable secrets through every bridge path;
  inspect tool results, summaries, errors, diagnostics, history, logs, Desktop
  IPC, and persistence. Use fake clocks and real process exit for custody and
  renewal bounds.
- **Mutation safety:** Change listeners, Docker evidence, revisions, settings,
  documents, symlinks, and fingerprints between preview and execute; verify
  stale rejection and idempotent replay.
- **Coordination integration:** Run complete standalone and stack activation
  lifecycles, retries after lost responses, concurrent bridges, bridge death,
  daemon loss/restoration, protocol mismatch, launcher sessions without shell
  execution, and redacted Docker snapshots.
- **Setup and Desktop:** Snapshot generic/Codex/Claude configuration formats;
  verify exact and portable executable variants, no external writes, strict
  IPC, clipboard behavior, responsive/accessibility behavior, and complete safe
  failures in the packaged app.
- **Release matrix:** Run full Bun checks, standalone compilation, packaged
  Electron verification, macOS and Linux stdio clients, real Codex and Claude
  tool calls, Docker-backed activation, and the existing PortReeve native
  release regression gates.
- **Final step:** Run full rubric evaluation and produce the completion report.
