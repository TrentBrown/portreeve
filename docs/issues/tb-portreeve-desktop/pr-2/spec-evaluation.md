# Spec Evaluation - PR #2

**Scope:** P1-P3 prerequisite slice
**Base:** `2e1ed01d038ae94b1a296e18229d15f00ffa9f55`
**Head:** `3b5bb6b59678313fe1486d9998d29f8cfb78e2a3`
**Verdict:** PASS for this slice; feature incomplete

## Definition of Done

- **Build status:** PASS - typecheck and six-artifact release build completed.
- **Lint status:** PASS - ESLint and changed-file Prettier checks completed.
- **Tests written:** lifecycle schemas and service states, semantic-version
  ordering, ownership marker migration and refusal, purge safety and drift,
  lifecycle CLI outcomes, compiled CLI manual-stop and purge behavior, and
  extended native release lifecycle coverage.
- **Test suite status:** PASS for changed behavior; 31 focused tests pass and
  two unrelated broad-suite host failures are preserved in
  [`verification.md`](verification.md).
- **Integration verified:** Yes - compiled executable plus a temporary native
  macOS x64 LaunchAgent lifecycle.
- **Application runs:** Yes for the standalone CLI/server; desktop is not part
  of this slice.
- **Pending manual verification:** Native Linux systemd-user verification in
  P4, followed by the desktop and signed/notarized release work in P5-P10.

## Acceptance Criteria

| # | Status | Evidence |
|---|---|---|
| AC1 | PASS | `LifecycleStatusSchema`, independent manager observations, layer-error fixtures, compiled CLI status, documentation, and native supervisor/socket status prove one non-collapsing snapshot for ordinary states. |
| AC2 | PARTIAL / NOT YET | Common before/after mutation results, manual/supervised separation, incompatibility refusal, no-downgrade policy, partial outcomes, and native LaunchAgent exercises pass. Native systemd-user exercise remains in P4. |
| AC3 | PASS | Marker initialization/migration, strict canonical-root and ownership checks, recursive `lstat` evidence, symlink/manual/incompatible refusal, deterministic preview token, changed-evidence refusal, partial cleanup reporting, compiled CLI reset, and native purge/reinstall pass. |
| AC4 | NOT YET | Read-only Electron slice is P5-P6. |
| AC5 | NOT YET | Public desktop workflows are P7. |
| AC6 | NOT YET | Electron security and refresh are P5-P7. |
| AC7 | NOT YET | Desktop versions and update policy are P8. |
| AC8 | NOT YET | Publication, native release matrix, desktop packaging, signing, and notarization are P4 and P9-P10. |

## Rubric

| # | Result | Scope | Evidence |
|---|---|---|---|
| R1 | PASS | P1 | Strict runtime schemas, layered collector tests, compiled CLI state evidence, and native macOS x64 supervisor/socket lifecycle. |
| R2 | NOT YET | P2 plus P4 | The contract and macOS behavior pass, but the specified native systemd-user evidence is pending. |
| R3 | PASS | P3 | Adversarial ownership/filesystem/token tests plus compiled and native purge/reinstall execution. |
| R4 | NOT YET | Future | Desktop integration is P5-P6/P9. |
| R5 | NOT YET | Future | Desktop MVP workflows are P7/P9. |
| R6 | NOT YET | Future | Electron security and freshness are P5-P7/P9. |
| R7 | NOT YET | Future | Version/update behavior is P8-P9. |
| R8 | NOT YET | Future | Publication and native desktop release identity are P4/P9-P10. |

No in-scope criterion fails. This is not feature completion: R2 and R4-R8
remain `NOT YET`.
