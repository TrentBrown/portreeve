# Plan - tb-portreeve-desktop

**Feature:** `tb-portreeve-desktop`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-07-30
**Status:** approved (2026-07-30)

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Deliver the feature as four sequential integration slices while keeping the
feature record cumulative:

1. finalize and harden the first public CLI lifecycle and purge contracts;
2. prepare and natively verify the standalone CLI/server authority, deferring
   its first publication when npm authentication is unavailable;
3. build the secured, non-shipping Electron engineering slices against a
   checksummed local release candidate; and
4. publish the standalone authority, replace the provisional desktop input
   with its exact published executable, then complete packaging and native
   release proof.

Each later delivery branch begins from updated `main` after the preceding PR
merges. The desktop never reaches through the public boundaries established by
the design: its main process invokes only the bundled CLI by an exact path for
lifecycle operations and uses the official JavaScript client for socket
health and inventory. SQLite, server modules, generic shell execution, and
`PATH` lookup remain outside the application.

Keep the privileged Electron main process, narrow preload bridge, and
untrusted renderer as separate modules. Put runtime schemas on every CLI and
IPC boundary and derive reduced renderer view models in the main process.
Model refresh and mutation as one serialized state coordinator so stale
evidence, focus polling, and non-overlap are properties of one control path.

Use deterministic unit tests for schema, version-policy, path-safety,
redaction, refresh, and view-model behavior. Add subprocess and packaged-app
integration tests for exact CLI invocation and IPC. Use real LaunchAgent
exercises, signed/notarized artifacts, and native ARM64/x64 hosts where the
operating system is part of the requirement.

## Steps

- **P1. Define the first-release lifecycle schemas and layered status
  collector.** Add runtime-validated lifecycle result schemas and one
  non-collapsing status snapshot that independently observes installation,
  supervisor, socket, mode, versions, limitations, and layer errors. Replace
  the current unpublished JSON shapes in place, centralize their rendering,
  document exit semantics, and exercise absent, inactive, failed, manual,
  supervised, ambiguous, unhealthy, and incompatible fixtures. **Code areas:**
  `src/supervision/`, a dedicated lifecycle contract/schema module,
  `src/cli/commands/lifecycle.js`, `src/cli/output/`, `docs/cli-contract.md`,
  lifecycle and compiled-runtime tests. **Verification:** schema fixtures,
  layer-failure decision tables, CLI JSON contract tests, compiled CLI smokes,
  and real supervisor/socket observations. **Advances:** R1.

- **P2. Make lifecycle mutations evidence-rich and version-safe.** Refactor
  install/upgrade, start, stop, restart, explicit manual-server stop, and
  data-preserving uninstall to return stable before/after outcomes and
  per-step failures. Compare bundled/source, managed, and running versions
  before mutation; allow compatible management without adoption, require
  explicit upgrade, refuse downgrade, and preserve truthful partial success.
  Keep all state-changing decisions inside the CLI lifecycle service.
  **Code areas:** `src/supervision/manager.js`,
  `src/supervision/factory.js`, platform supervisor adapters,
  `src/cli/commands/lifecycle.js`, lifecycle schemas and tests.
  **Verification:** version-policy matrix, manual/supervised conflict tests,
  rollback and partial-failure tests, repeated-operation tests, and real
  LaunchAgent/systemd-user lifecycle exercises. **Advances:** R2.

- **P3. Add ownership marking and the CLI-owned complete-reset contract.**
  Create and validate a versioned application-home ownership marker during
  safe initialization or recognized-state migration. Implement a nonmutating
  purge preview and separately confirmed execution bound to current marker,
  canonical-root, supervisor, socket, process, ownership, mode, and symlink
  evidence. Permit confirmed purge to stop supervised service state, refuse a
  live manual server, avoid following symlinks, and report removed, retained,
  missing, and refused paths accurately. **Code areas:**
  `src/platform/paths.js`, a focused purge/ownership service,
  `src/supervision/`, lifecycle CLI commands and schemas, safety and
  installation documentation. **Verification:** adversarial roots/home paths,
  marker migration, malformed/mismatched/symlink markers, ownership/mode
  failures, preview-to-execution races, partial deletion failures, manual
  server refusal, supervised cleanup, and reinstall tests. **Advances:** R3.

- **P4. Freeze, verify, and publish Portreeve CLI/server `0.1.0`.** Extend the
  existing source, compiled-runtime, release-manifest, Homebrew, npm-client,
  and native lifecycle matrices to cover P1-P3. Update public contract,
  installation, migration, safety, and troubleshooting documentation. Satisfy
  repository visibility, npm, signing/checksum, and native Linux ARM64 runner
  prerequisites; publish the standalone CLI/server authority before any
  desktop release artifact is built from it. **Code areas:** `scripts/`,
  `.github/workflows/`, `docs/`, release tests, release metadata.
  **Verification:** complete existing release matrix, exact executable
  checksums, native macOS/Linux lifecycle and purge smokes, Homebrew flow, npm
  consumer test, and published artifact inspection. **Advances:** R1, R2, R3,
  R8.

- **P5. Establish the Electron workspace, security boundary, and read-only
  engineering slice.** Add `apps/desktop` as a vanilla-JavaScript workspace
  with separately versioned metadata and pinned Electron/build dependencies.
  Create a normal sandboxed, context-isolated, Node-disabled window using only
  packaged local content, strict CSP, denied navigation/new windows, and
  allowlisted external links. For this non-shipping slice, bundle the
  architecture-matching, checksummed local `0.1.0` release candidate and record
  its provisional identity. Expose a narrow runtime-validated preload surface
  for snapshot retrieval and refresh subscription; use the exact bundled CLI
  for lifecycle status and the workspace copy of the official client for
  global inventory. Provisional artifacts do not satisfy published-artifact
  identity and may not be used for a public desktop release. **Code areas:**
  root workspace/tooling,
  `apps/desktop/main/`, `apps/desktop/preload/`,
  `apps/desktop/renderer/`, desktop packaging inputs and tests.
  **Verification:** Electron configuration/security assertions, bundled-path
  invocation tests, client integration tests, no-`PATH`/shell/SQLite/server
  import checks, and a packaged read-only smoke covering absent, manual,
  supervised, unavailable, incompatible, and stale states. **Advances:** R4,
  R6.

- **P6. Build the serialized desktop state coordinator and reduced view
  models.** In the main process, combine layered CLI status and client
  inventory into runtime-validated renderer snapshots. Redact raw command
  lines, executable paths not intended for display, secrets, and privileged
  protocol fields. Refresh immediately on open/focus and every five seconds
  while visible; pause while hidden, prevent overlap with refreshes or
  mutations, refresh after each mutation, and preserve the last successful
  snapshot with explicit stale time and current errors after failure.
  **Code areas:** `apps/desktop/main/` orchestration and adapters, shared
  desktop-only schemas, narrow preload API, renderer state store.
  **Verification:** fake-clock polling tests, visibility/focus tests,
  serialization/race tests, failure recovery, stale-state tests, schema
  rejection, and sensitive-field snapshots. **Advances:** R4, R6.

- **P7. Complete Overview, Ports, onboarding, lifecycle, uninstall, and reset
  workflows.** Implement the two-view MVP with accessible status layers,
  independent version display, searchable/filterable port inventory, selected
  port details, and reduced claim/listener evidence. Add explicit Install and
  Start orchestration, start/stop/restart, manual-server stop, confirmed
  upgrade, data-preserving uninstall, and the separate purge danger flow with
  CLI preview, typed `DELETE`, execution, and accurate partial outcomes. Every
  action is a named preload operation and the main process/CLI revalidates
  authority at execution time. **Code areas:** desktop renderer components and
  styles, main-process lifecycle adapter/coordinator, preload schemas, desktop
  end-to-end fixtures. **Verification:** state/action matrix, confirmation and
  cancellation tests, installed-but-inactive partial onboarding, manual-server
  cases, reset preview drift, keyboard/accessibility checks, packaged
  application end-to-end workflows, and screenshot inspection for data
  leakage. **Advances:** R2, R3, R5, R6.

- **P8. Add independent version display and privacy-preserving update
  notification.** Record desktop, bundled CLI, managed CLI, and running server
  versions independently. Define and validate the fixed desktop update
  manifest, cache only the last-check/result needed for a 24-hour cadence,
  send no dynamic parameters or identifiers, fail without affecting local
  management, and open only the approved signed-download page. Keep desktop
  installation manual and service upgrade separately confirmed through P7.
  **Code areas:** desktop version/manifest modules, main-process update
  adapter, Overview presentation, tests and release documentation.
  **Verification:** version-combination fixtures, request capture, cadence and
  clock tests, malformed/offline manifest tests, external-link allowlist tests,
  and proof that discovery performs no mutation. **Advances:** R7.

- **P9. Publish the standalone authority and produce separate signed/notarized
  native desktop artifacts with exact CLI identity.** Complete P4 by publishing
  and inspecting the GitHub Release and npm client, then configure
  `release.yml` as the npm trusted publisher. Build macOS 13+ ARM64 and x64
  applications separately with hardened runtime and Developer ID signing.
  Replace every provisional desktop input with the matching downloaded
  published CLI artifact without rebuild, patch, combination, or independent
  re-signing; record both product versions and source artifact identity in the
  desktop manifest; and verify the nested executable checksum before packaging,
  after application signing, and after notarization. **Code areas:** desktop build
  configuration, entitlements, packaging/release scripts, CI workflows,
  manifests, distribution documentation. **Verification:** architecture and
  deployment-target inspection, codesign verification, notarization/stapling,
  nested CLI checksum/signature comparison, clean install, and native ARM64/x64
  packaged lifecycle smokes. **Advances:** R4, R5, R6, R7, R8.

- **P10. Run feature-final verification and preserve completion evidence.**
  Execute the complete Definition of Done and R1-R8 matrix against source,
  compiled CLI artifacts, and both packaged desktop architectures. Exercise
  install, start, layered status, ports, upgrade, stop, data-preserving
  uninstall, purge, and reinstall with exact release artifacts. Run spec
  evaluation, independent judge, pattern review when applicable, code review,
  and the feature-final PR boundary; resolve or explicitly surface every
  remaining platform or release prerequisite. **Code areas:** release jobs,
  workflow evidence packet, tracker, issues, and completion report.
  **Verification:** every rubric evidence field, zero `NOT YET`/`FAIL`, and
  deterministic retention of the cumulative feature record. **Advances:** R1,
  R2, R3, R4, R5, R6, R7, R8.

## Verification

- **Per step:** Run strict JavaScript checking, lint/format gates, targeted unit
  and integration tests, and relevant compiled/package smokes. Update rubric
  status only from preserved evidence.
- **Per lifecycle contract:** Validate every CLI JSON result at production and
  test boundaries, verify exit semantics, and retain before/after evidence for
  mutations and refusals.
- **Per Electron boundary:** Inspect packaged runtime configuration, IPC
  allowlists, renderer payloads, navigation behavior, and outbound requests;
  source-only configuration assertions are insufficient.
- **Per release target:** Execute the exact advertised CLI and desktop
  artifacts natively on the matching architecture. Cross-compilation alone
  does not satisfy release evidence.
- **Final step:** Run full rubric evaluation and produce the completion report.
