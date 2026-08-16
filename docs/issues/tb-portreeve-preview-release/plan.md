# Plan - tb-portreeve-preview-release

**Feature:** `tb-portreeve-preview-release`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-16

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Refactor the existing release scripts into one record-driven engine while
preserving `release:build` and `release:verify` as compatibility entry points
until their callers move. The engine owns policy, state transitions, artifact
identity, and publication planning; GitHub Actions supplies runners,
credentials, and artifact transport without reimplementing those rules.

Build each CLI executable once, carry it through native evidence collection,
and embed the exact matching macOS bytes into architecture-specific Desktop
packages. Permit local preparation to record pending native evidence, but make
publication eligibility require a complete aggregated record. Treat signing as
an explicit future-capable transformation and stable trust as fail-closed.

Deliver in four natural slices: core release state/invocation, promoted native
and Desktop distribution artifacts, hosted publication/Homebrew policy, and
alpha experience/operator documentation. Each slice expands the same release
record rather than introducing another manifest or workflow-specific state
model.

## Steps

- **P1. Define the versioned release domain and transition engine.** Add schemas
  for release identity, maturity/channel/trust, stages, artifacts, verification
  evidence, and publication state. Implement atomic record persistence,
  predecessor/digest validation, prerelease/stable policy checks, and test
  fixtures for invalid transitions, altered bytes, and resumable preparation.
  **Code areas:** new release modules under `scripts/`, release schema/fixtures,
  `test/release/`. **Advances:** R1, R3, R4.

- **P2. Add authoritative prepare/publish command surfaces.** Add
  `release:prepare` and `release:publish` package scripts with explicit
  channel/version/record inputs, actionable help/errors, a versioned
  `dist/releases/<version>/` workspace, and a reviewable publication plan.
  Isolate remote mutation behind injectable GitHub/tap adapters; require
  explicit confirmation and immutable-version checks. Retain old build/verify
  commands only as thin engine-backed compatibility surfaces. **Code areas:**
  `package.json`, release command modules, publication adapters,
  `test/release/`. **Advances:** R1, R3, R4, R8.

- **P3. Promote the complete CLI/client artifact set once.** Move the current
  four-target compilation, client packing, formula/checksum generation, native
  inspection, and lifecycle verification into record-aware stages. Preserve
  exact bytes across runner transport and merge native evidence without
  rebuilding. **Code areas:** `scripts/release.js`, `scripts/release-lib.js`,
  `scripts/verify-release.js`, release tests. **Advances:** R2, R3, R5.

- **P4. Produce architecture-specific Desktop applications and DMGs.** Make
  Desktop packaging accept an explicit promoted CLI artifact and target
  architecture, record the embedded identity, generate conventional ARM64/x64
  DMGs, verify their contents/mountability, and run packaged Desktop smokes on
  matching native runners. Add signing/notarization stage hooks that preserve
  unsigned preview behavior and reject stable records without real evidence.
  **Code areas:** `scripts/package-desktop.js`, `scripts/desktop-package-lib.js`,
  new DMG/release helpers, Desktop package tests. **Advances:** R2, R3, R4, R6.

- **P5. Generate formula, cask, checksums, and lifecycle-safe distribution
  plans.** Extend Homebrew rendering to produce `portreeve.rb` and
  `portreeve-app.rb` from recorded GitHub assets/digests. Verify syntax and
  clean install/uninstall paths while preserving service state/data and keeping
  install/start/purge explicit. Include separate DMG URLs and caveats in the
  publication plan. **Code areas:** release/Homebrew libraries,
  `scripts/verify-release.js`, test fixtures. **Advances:** R2, R6.

- **P6. Rebuild the hosted workflow around the common engine.** Add
  channel/version dispatch inputs, build-once artifact transport, native
  CLI/lifecycle and Desktop package jobs, release-record aggregation, and a
  gated publication job. Remove npm credentials and npm publication from the
  preview dependency graph while leaving npm fail-closed/deferred. Version
  Desktop update metadata so preview/maturity/trust cannot masquerade as a
  stable update. **Code areas:** `.github/workflows/release.yml`, distribution
  update manifest/schema, workflow/update tests. **Advances:** R3, R4, R5, R6.

- **P7. Add the alpha and unsigned-preview user experience.** Place the Alpha
  Preview notice at the top of README and a persistent accessible indicator in
  Desktop's global header. Add safe DMG/Homebrew installation, scoped
  Gatekeeper Open Anyway, explicit Service setup, non-destructive uninstall,
  and separate purge guidance; add release-note/cask caveat sources and tests
  rejecting unsafe bypass text. **Code areas:** `README.md`, Desktop renderer
  HTML/CSS/tests, installation/release documentation. **Advances:** R7.

- **P8. Add operator documentation, project skill, and contract drift tests.**
  Write `docs/releasing.md`, create
  `.agents/skills/release-portreeve/SKILL.md`, document direct/agent/GitHub
  invocation, and test that help, workflow inputs, runbook examples, skill
  boundaries, and release-record schema remain aligned. The skill may prepare
  and explain but may not bypass the publication gate. **Code areas:** docs,
  project skill, package help, documentation/contract tests. **Advances:** R8.

- **P9. Rehearse the complete preview and stable-negative paths.** Prepare an
  unsigned alpha prerelease workspace, inspect all generated artifacts and the
  publication plan, exercise fake GitHub/tap publication without mutation, and
  prove stable preparation fails without Apple evidence. Run the complete
  native matrix in CI where local architecture cannot supply evidence. Do not
  create a public tag/release or change the real tap without the final human
  publication approval. **Advances:** R1, R2, R3, R4, R5, R6, R7, R8.

## Verification

- **Per-slice:** Run formatting, typecheck/lint, focused release/Desktop/docs
  tests, and the compatible portion of `bun run check`; inspect generated
  records and artifacts rather than relying only on exit codes.
- **Native matrix:** Execute the promoted CLI and lifecycle on macOS/Linux
  ARM64/x64, and execute packaged Desktop/DMG smokes on macOS ARM64/x64.
- **Safety matrix:** Exercise preview success, stable missing-evidence failure,
  altered/stale record rejection, existing-version refusal, npm absence, and
  publication-adapter dry runs.
- **Manual application check:** Confirm the Alpha Preview indicator remains
  visible and accessible across every Desktop tab and that installation copy is
  understandable at normal and minimum window sizes.
- **Final step:** Run full rubric evaluation and produce the completion report.
