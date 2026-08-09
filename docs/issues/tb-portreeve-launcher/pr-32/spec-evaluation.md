# Spec Evaluation - PR #32

**Verdict:** PASS for P8 / I-8. The Desktop Launcher slice satisfies its planned UI
requirements and completes cumulative R1, R2, R3, R5, and R7. R4 and R8 remain
`NOT YET` only for feature-final P9 verification.

## Acceptance criteria

| Criterion | Slice result | Evidence |
|---|---|---|
| AC1 - Configuration and trust | SATISFIED | The dedicated editor creates or edits the canonical opaque document, validates progressive fields, shows exact JSON, protects dirty navigation and external changes, requires explicit overwrite or cancel, warns on downgrade, and trusts only the saved revision. |
| AC2 - Assisted setup and environment | SATISFIED | Main performs exact-directory discovery; renderer receives editable suggestions and basename-only provenance. Deterministic endpoint mappings and nonsecret current previews never persist assigned ports. |
| AC3 - Command-only lifecycle | SATISFIED | Evidence and trust state determine Start, Stop, Restart, and Status availability. Partial/degraded paths require explicit confirmation. Progress, cancellation, bounded output, and results use the shared engine. |
| AC4 - Attached Start | ADVANCES, remains incomplete | UI supports unbounded attached Start, retained output, explicit cancel/termination, and close blocking. The final packaged attached-close manual acceptance remains P9. |
| AC5 - Verified activation | SATISFIED | Declared and observed maturity are visible, safe history retains integration assessment, command-only upgrade suggestions appear, and verified-to-command-only changes require an explicit downgrade warning before Save and Trust. |
| AC7 - Desktop experience | SATISFIED | Launcher is the fourth primary tab with onboarding, stack-linked master-detail navigation, full editor sections, controls and reasons, evidence, preview, output Copy/Save, safe history, stale states, and Stacks cross-links. Existing lifecycle actionable failures remain visible. |
| AC8 - Degraded and platform behavior | ADVANCES, remains incomplete | Desktop renders stale/degraded authority and requires consent while shared policy refuses unsafe operations. Final Linux, reset/retention, and release evidence remains P9. |

## Rubric

| # | Criterion | Result | Scope | Notes |
|---|---|---|---|---|
| R1 | Launcher configuration and trust | PASS | Cumulative | Desktop completes the already-tested strict file and trust contract. |
| R2 | Setup and endpoint environment | PASS | Cumulative | Suggestions, provenance, validation, current preview, and no-port persistence pass. |
| R3 | Command-only lifecycle | PASS | Cumulative | Desktop exposes every shared-engine action state and confirmation boundary. |
| R4 | Attached execution | NOT YET | P8 advances | Implementation and automated close protection pass; P9 owns packaged quit acceptance. |
| R5 | Verified activation | PASS | Cumulative | Maturity, upgrade suggestions, and downgrade confirmation are presented. |
| R7 | Desktop operation and diagnostics | PASS | Cumulative | The complete required Launcher experience is present and packaged workflow tested. |
| R8 | Degraded and platform behavior | NOT YET | P8 advances | Degraded UI passes; final platform, retention, and existing-client matrix remains P9. |

## Definition of Done

- **Build status:** PASS - standalone CLI and packaged macOS Desktop build.
- **Lint and format:** PASS - ESLint and pinned-diff Prettier.
- **Tests written:** model, renderer wiring/accessibility, safe discovery and provenance,
  action guards, exact definitions, environment preview, output/history, and close flow.
- **Test suite status:** PASS across host-isolated runs - 77 Desktop tests and all 381
  unique repository tests.
- **Integration verified:** Yes - real opaque documents, shared runtime, packaged Save
  and Trust, action execution, bounded output, and history.
- **Application runs:** Yes - packaged app completes the isolated Launcher workflow.
- **Pending final verification:** P9 feature-final release, platform, retention, attached
  quit, and external-edit workflows.

No in-scope criterion fails. Feature completion is not claimed.
