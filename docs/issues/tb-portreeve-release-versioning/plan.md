# Plan - tb-portreeve-release-versioning

**Feature:** `tb-portreeve-release-versioning`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-18

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Introduce release-version helpers and deterministic build-time injection while
leaving checked-in package versions as development bases. Flow the coordinated
version through native build, staged client packing, Desktop packaging, Homebrew
generation, records, and update comparison. Verify both metadata and executable
behavior with preview.4 fixtures.

## Steps

- **P1.** Add semantic-core validation and a reusable Bun build-time server
  version override. **Advances:** R1, R4.
- **P2.** Use the coordinated identity for native artifact names, compiled CLI,
  staged client package/version source, manifests, records, and formula.
  **Advances:** R1, R2, R4.
- **P3.** Flow the coordinated identity through Desktop bundles, DMG/cask
  metadata, runtime reporting, and update checks without placing a prerelease in
  constrained Apple numeric version fields. **Advances:** R2, R3.
- **P4.** Update runbook and focused tests; prove Homebrew ordering, candidate
  smoke behavior, and full repository health. **Advances:** R1-R5.

## Verification

- Focused release and Desktop unit/integration tests.
- Local native preview build and `--version` execution on the host architecture.
- Disposable Homebrew preview-upgrade behavior where practical.
- `bun run check`.
- **Final step:** Run full rubric evaluation and produce the completion report.
