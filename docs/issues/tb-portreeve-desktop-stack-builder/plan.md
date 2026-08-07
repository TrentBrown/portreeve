# Plan - tb-portreeve-desktop-stack-builder

**Feature:** `tb-portreeve-desktop-stack-builder`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-07

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Correct the core stack-root contract before the desktop editor depends on it. The first
delivery slices establish one strict `stackRoot` vocabulary, real-path identity,
transactional overlap and live-activation safety, and deterministic CLI discovery.
Subsequent slices add a trusted desktop definition-document adapter and narrow IPC
schemas before building the renderer form model and dedicated view. The final slice
integrates recovery and save/apply outcomes, updates public documentation and examples,
and verifies the assembled feature in compiled CLI and packaged desktop runtimes.

Each intermediate PR must preserve a coherent caller contract within its declared
boundary. The renderer never receives general filesystem or socket authority, and no UI
slice may bypass server validation. Existing standalone claim and port-inventory flows
remain regression targets throughout the stack-specific rename.

## Steps

- **P1 - Establish the stack-root public contract.** Replace stack-specific
  `workspaceRoot` request, record, filter, client type, and response vocabulary with
  `stackRoot`; add real-path stack-root canonicalization distinct from standalone claim
  workspace canonicalization; update strict schemas, server routes, client runtime and
  types, fixtures, and contract documentation. **Advances:** R1, R8.

- **P2 - Enforce root and activation invariants transactionally.** Update storage and
  service relationships to map stack roots into endpoint claims, reject overlapping
  registered roots, retain exact-root-only claim adoption, preserve sibling roots,
  rename missing-root pruning behavior, and refuse changed definitions beneath live
  activations while permitting identical applies. Add persistence handling and focused
  race, adoption, activation, and pruning tests. **Advances:** R1, R3, R8.

- **P3 - Implement deterministic CLI discovery.** Replace stack CLI `--workspace` with
  `--stack-root`; implement explicit-file/root selection, upward definition discovery,
  and registered-root status fallback; update human and JSON output, CLI help, examples,
  and integration tests using a non-Git parent with child Git repositories. **Advances:**
  R1, R2, R8.

- **P4 - Add a trusted desktop definition-document boundary.** Create main-process
  services and strict IPC schemas for directory selection, known-stack edit resolution,
  valid/missing/invalid document loading, exact-byte fingerprints, exclusive creation,
  atomic replacement, conflict reporting, overwrite confirmation, validated save, and
  retryable apply. Keep full roots and general filesystem operations out of the renderer
  view model and preload API. **Advances:** R4, R6, R7, R8.

- **P5 - Build the editor draft model and serializer.** Implement stable draft identities
  for components and endpoints, complete schema conversion, automatic/preferred/exact
  port policy, dependency-preserving renames, confirmed cascading deletion, progressive
  validation, deterministic concise serialization, and exact read-only preview. Cover
  full-schema round trips and invalid intermediate states with unit tests. **Advances:**
  R5, R6.

- **P6 - Build the dedicated Stacks-tab editor.** Add `Create or Edit Stack...` and
  direct `Edit Definition`, the full-width component/detail editor, advanced allocation
  disclosure, dependency selectors, validation summary and focus behavior, JSON preview,
  dirty-navigation guards, and accessible confirmations. Preserve the existing manual
  apply and normal list/detail management views. **Advances:** R4, R5, R6, R7.

- **P7 - Integrate save, apply, recovery, and lifecycle outcomes.** Connect the renderer
  to the trusted document boundary; handle unchanged, conflict, overwrite, missing,
  invalid, saved-and-applied, and saved-but-not-applied flows; provide `Retry Apply`;
  surface live-activation refusal; return successful applies to stack details; and keep
  preparation explicit. Add coordinator, IPC, filesystem-race, server-unavailable, and
  packaged application tests. **Advances:** R3, R4, R7, R8.

- **P8 - Complete documentation and assembled verification.** Update README, desktop,
  client, CLI, protocol, stack, safety, migration, troubleshooting, and mixed-stack
  examples to the final contract. Run typecheck, lint, format, full tests, release build,
  compiled CLI integration, desktop packaging, automated UI/runtime smoke, and focused
  manual acceptance. Evaluate every rubric criterion and produce the feature completion
  report at the final real delivery boundary. **Advances:** R1, R2, R3, R4, R5, R6, R7,
  R8.

## Delivery sequence

1. **Contract and server slice:** P1-P2. No desktop caller consumes the new contract
   until protocol, client, storage, and server authority agree.
2. **CLI discovery slice:** P3. Proves the multi-repository non-Git parent model through
   the portable command surface.
3. **Desktop trusted-boundary slice:** P4. Establishes safe document and IPC primitives
   without exposing unfinished renderer controls.
4. **Desktop editor slice:** P5-P6. Delivers the complete form model and dedicated view.
5. **Integration and feature-final slice:** P7-P8. Exercises recovery, lifecycle,
   packaged runtime, documentation, and full rubric evidence.

Each later slice begins from updated `main` after the preceding PR merges and uses a
fresh sequential delivery branch under the stable feature ID.

## Verification

- Run targeted protocol, client, storage, service, CLI, desktop adapter, coordinator,
  state, and renderer suites in the slice that changes them.
- Run contract-level tests proving stack payloads contain `stackRoot` while standalone
  claim payloads retain `workspaceRoot`.
- Exercise a real non-Git stack root containing multiple child Git repositories through
  compiled CLI apply and status, including missing-file registered-root fallback.
- Exercise concurrent overlapping-root apply and changed-apply/live-activation races
  against real SQLite transactions.
- Exercise file creation, edit, external replacement, overwrite, invalid/missing
  recovery, daemon absence, retry apply, and explicit preparation in isolated temporary
  directories.
- Run the packaged Electron app through create, edit, validation, conflict, recovery,
  save/apply, retry, and navigation-guard smoke flows while checking reduced IPC data.
- **Final step:** Run full rubric evaluation and produce the completion report.
