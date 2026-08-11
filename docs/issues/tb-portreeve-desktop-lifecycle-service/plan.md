# Plan - tb-portreeve-desktop-lifecycle-service

**Feature:** `tb-portreeve-desktop-lifecycle-service`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-10

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Extract lifecycle orchestration from `src/cli/commands/lifecycle.js` into one
runtime-neutral internal application service while retaining
`src/supervision/manager.js` and the platform supervisors as the native
mechanism layer. The service becomes the only owner of lifecycle transaction
semantics: before and after evidence, outcomes, deadlines, mutation exclusion,
rollback visibility, purge receipts, and safe errors.

Move the CLI onto this service first and prove observable compatibility before
changing the desktop. Add bounded execution and cross-process locking at the
shared boundary so both callers receive the safeguards automatically. Then
replace `apps/desktop/main/cli-adapter.js` with a trusted main-process adapter
that constructs the service from the verified artifact and fixed platform
defaults. Extend the coordinator, preload schemas, renderer, and window close
guard only after the shared contract is stable.

Use thin runtime adapters where Bun and Electron differ. Keep lifecycle policy
in ordinary JavaScript using APIs supported by both runtimes. Inject clocks,
command runners, lock evidence, and destructive filesystem operations for
deterministic tests. If a new dependency or native-specific lock mechanism is
needed, record and approve that decision before adding it.

Deliver the feature through sequential, independently reviewable PR slices:

1. shared lifecycle service plus CLI migration and parity;
2. service-owned deadlines, recovery, and cross-process mutation exclusion;
3. trusted desktop migration, close protection, and safe diagnostics; and
4. packaging, dual-runtime, and native verification completion.

## Steps

- **P1. Extract the canonical lifecycle application service.** Move mutation
  execution and common status/purge orchestration out of CLI command handlers
  into an internal service near the existing supervision layer. Define and
  validate one status, mutation, timeout, busy-error, purge-preview, and
  purge-result contract. Keep `LifecycleManager` and launchd/systemd adapters
  below this service. Add unit fixtures for all terminal outcomes and before/
  after evidence. **Advances:** R1, R2, R8.

- **P2. Add bounded execution and cross-process exclusion.** Centralize native
  command, readiness wait, and overall-operation deadline policy in the shared
  service. Return fresh after-evidence and `partial` or `failed` on expiry after
  possible mutation. Implement a per-user atomic mutation lock outside the
  purge root, covering the complete lifecycle transaction and returning
  `lifecycle_busy` to contenders. Prove abandoned-owner recovery with fresh
  evidence rather than PID identity alone. Record the final lock-mechanism
  decision and any dependency decision in `scratchpad.md`. **Advances:** R4,
  R5, R8.

- **P3. Convert the CLI into a presentation adapter.** Route status, install,
  start, stop, stop-manual, restart, uninstall, purge preview, and purge
  execution through the shared service. Leave argument parsing, interactive
  consent, human rendering, JSON envelopes, and exit-code mapping in the CLI.
  Add golden parity coverage for existing command names, flags, envelopes,
  output meanings, exit bands, no-downgrade, rollback, and purge confirmation.
  **Advances:** R1, R2, R4, R5, R8.

- **P4. Construct the trusted Electron lifecycle controller.** Replace the
  desktop CLI adapter with an in-process main-process adapter over the shared
  service. Bind it to the checksum-verified artifact, default per-user paths,
  platform-selected supervisor, and embedded PortReeve version. Reject an
  exact controller/artifact mismatch for mutations while preserving compatible
  read-only daemon features. Remove lifecycle subprocess code and its fallback
  tests; retain the standalone artifact as installation payload. **Advances:**
  R1, R3, R8.

- **P5. Complete desktop lifecycle safety and diagnostics.** Extend coordinator
  state and close guarding so every lifecycle mutation identifies the active
  operation and blocks normal window/application close, while status and purge
  preview do not. Reduce canonical failures to the approved copyable diagnostic
  packet, update strict shared/preload schemas and renderer presentation, and
  add seeded leakage tests for raw output, paths, credentials, arguments, and
  stacks. Preserve existing actions, confirmation flows, availability rules,
  and final refresh behavior. **Advances:** R2, R3, R6, R7.

- **P6. Prove packaging and runtime parity.** Make desktop packaging verify the
  embedded controller version against the release manifest and inspect the
  packaged bundle for the expected artifact and absence of lifecycle CLI
  spawning. Run the common contract suite under Bun and Electron's Node
  context, followed by compiled CLI and packaged desktop lifecycle smokes.
  **Advances:** R1, R3, R8.

- **P7. Execute native and interruption verification.** Run existing and new
  lifecycle suites, real cross-process contention, isolated macOS launchd
  install/start/restart/stop/upgrade/uninstall/purge, Linux systemd-user
  lifecycle verification, desktop close protection, and force-interruption/
  next-launch recovery. Keep any unavailable required native target explicitly
  pending rather than converting it to a pass. Reconcile every rubric criterion
  from evidence. **Advances:** R1, R2, R3, R4, R5, R6, R7, R8.

## Verification

- **Shared contract:** Exercise every status, mutation, purge, refusal,
  no-change, partial, failed, timeout, and busy result through deterministic
  service tests.
- **CLI compatibility:** Compare command parsing, human meanings, JSON
  envelopes, exit bands, no-downgrade, rollback, and purge receipts before and
  after migration.
- **Concurrency:** Hold a mutation in one real process and prove a second
  process receives `lifecycle_busy` before the holder is released; separately
  prove status and preview remain available and abandoned ownership recovers.
- **Desktop security and UX:** Verify fixed controller inputs, mismatch refusal,
  strict IPC schemas, diagnostic redaction, active-operation visibility, close
  blocking, existing action availability, and post-operation refresh.
- **Runtime and packaging:** Run the common contract under Bun and Electron
  Node, inspect the packaged app, and smoke the compiled standalone artifact.
- **Native hosts:** Capture macOS launchd and Linux systemd-user lifecycle
  records plus interruption/recovery evidence. Missing required host evidence
  remains a blocking manual-verification item.
- **Final step:** Run full rubric evaluation and produce the completion report.
