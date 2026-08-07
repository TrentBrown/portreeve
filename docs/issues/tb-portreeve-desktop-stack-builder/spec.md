# Spec - tb-portreeve-desktop-stack-builder

**Feature:** `tb-portreeve-desktop-stack-builder`
**Created:** 2026-08-07
**Status:** approved 2026-08-07

## Summary

Portreeve must let developers create and edit complete project-owned stack definitions
through the desktop Stacks tab while preserving strict validation, safe filesystem
concurrency, and the existing launcher authority boundary. Before the first public
release, the same feature must correct the stack identity contract from Git-oriented
`workspaceRoot` semantics to arbitrary, non-overlapping filesystem `stackRoot` semantics
across protocol, client, CLI, server, storage relationships, desktop behavior,
documentation, and tests.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** All stack-specific protocol payloads,
  JavaScript-client APIs and types, records, filters, CLI options, output, and
  documentation use `stackRoot`. A stack root may be any canonical existing directory,
  including a non-Git parent containing multiple child repositories. Standalone claims
  retain `workspaceRoot`, and no pre-public stack compatibility alias is required.

- **AC2.** CLI stack operations accept explicit
  `--stack-root` and `--file` selection. Implicit apply and status discover an enclosing
  `portreeve.stack.json` from directories inside the stack, including child Git
  repositories. When the file is missing, status can resolve a registered enclosing
  root; apply still requires a file.

- **AC3.** Sibling stack roots are allowed, while
  ancestor/descendant registrations are refused atomically. Standalone claims are
  adopted only at the exact root. Missing-root pruning uses the stack root. A changed
  definition is refused while that stack has a live activation, while an identical
  apply remains idempotent.

- **AC4.** The existing Stacks tab provides
  `Create or Edit Stack...` and direct `Edit Definition` actions. Editing uses a
  dedicated in-tab view with navigation guards. Trusted main-process code resolves roots
  and performs filesystem operations; the renderer receives neither arbitrary paths nor
  general filesystem or Portreeve-socket authority.

- **AC5.** The editor creates and round-trips every variable
  field in the current strict stack schema. New definitions infer only the editable
  project name. Host ports default to automatic allocation, with preferred and exact
  ports under advanced settings. Renames update dependencies, and deleting referenced
  topology requires explicit cascading confirmation.

- **AC6.** Incomplete drafts are allowed, touched
  fields receive inline validation, and invalid saves show a summary and focus the first
  error. A read-only preview shows the exact concise, deterministic JSON that will be
  written. The trusted main process and server independently revalidate the complete
  definition.

- **AC7.** New definitions are created exclusively and
  existing files use exact-byte external-change detection plus atomic replacement. A
  conflict offers `Overwrite` or `Cancel` and never overwrites silently. Missing
  known-stack files can be reconstructed from applied state; invalid files require
  explicit replacement and are never partially interpreted.

- **AC8.** `Save and Apply` writes the canonical file before
  contacting the daemon. A successful write survives an unavailable or refusing server
  and produces an actionable `Saved, but not applied` state with `Retry Apply`. Apply
  does not prepare ports automatically. The existing manual apply action and non-stack
  claim/inventory workflows remain functional.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Stack-root contract | Every stack-facing public surface uses canonical `stackRoot`; arbitrary non-Git roots work; standalone claims retain `workspaceRoot` | Mixed vocabulary, Git requirement, compatibility ambiguity, or broken standalone claims | Protocol/schema, client type/runtime, route, documentation, and regression tests |
| R2 | CLI discovery | Explicit and implicit resolution work from stack roots and child repositories; missing-file status fallback is deterministic | Git incorrectly changes the root, apply proceeds without a file, or resolution is ambiguous | CLI integration tests using a non-Git parent and child Git repositories |
| R3 | Server safety | Overlapping roots, cross-root adoption, and changed applies under live activation are refused atomically; valid siblings and idempotent applies succeed | Any prohibited mutation succeeds, valid mutation fails, or concurrency bypasses enforcement | Storage/service concurrency, adoption, activation, and pruning tests |
| R4 | Desktop containment | Both editor entry points and dedicated view work without widening renderer capabilities | Missing entry path, unusable navigation, leaked paths, or renderer filesystem/socket authority | IPC/schema/view-model tests and packaged desktop smoke |
| R5 | Complete editor | Every schema field round-trips; defaults, renames, and cascading deletion behave as specified | Valid data is dropped, host ports become mandatory, references dangle, or unsupported fields cannot be edited | Form-model unit tests and full-schema fixtures |
| R6 | Validation and output | Progressive validation, error focus, deterministic concise serialization, and exact preview agree | Invalid files can be written, preview differs, errors are inaccessible, or defaults expand unexpectedly | Validation/serializer tests and interactive UI smoke |
| R7 | File safety and recovery | Exclusive creation, atomic replacement, conflict confirmation, and missing/invalid recovery follow AC7 | Silent overwrite, race loss, partial invalid recovery, or database state silently replaces a valid file | Filesystem integration and simulated-race tests |
| R8 | Save/apply lifecycle | Save survives apply failure, retry works, live-activation refusal is actionable, and preparation remains explicit | Save is rolled back, failures collapse to generic errors, retry fails, or ports prepare implicitly | Coordinator/IPC integration tests and supervised packaged-app verification |

## Changes

None. Initial approved specification derived from the approved design and completed
interview.
