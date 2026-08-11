# Spec Evaluation - PR 39

**Scope:** slice
**Base:** `6e2b36359d3ecc788ed6f328bf24fd2f30366f32`
**Head:** `7efceb1c2fe0adbea0d457579d00b4b355f1240d`
**Verdict:** PASS for I-3; feature criteria remain `NOT YET` where close
protection, complete safe diagnostics, packaging, or final native evidence is
still required.

## Definition of Done

- **Build status:** PASS - pinned Bun 1.3.14 completed typecheck, standalone
  build, and an Electron-main bundle smoke.
- **Lint status:** PASS - ESLint, repository Prettier, and diff whitespace
  checks passed.
- **Tests written:** Direct-controller contract, fixed authority, mismatch,
  purge-token, renderer-state, strict schema, and no-subprocess security tests
  cover the slice.
- **Test suite status:** PASS - 411 tests with 2,004 assertions.
- **Integration verified:** Yes - the exact verified executable becomes the
  service installation source; the live developer supervisor no longer leaks
  into isolated CLI fixtures.
- **Application runs:** The compiled CLI and Electron-main bundle pass. Full
  packaged Desktop execution is intentionally I-5/P6.
- **Pending manual verification:** Packaged Desktop, real launchd/systemd-user
  mutation, close handling, and interruption recovery remain future gates.

## Acceptance Criteria

| # | Status | Evidence |
| --- | --- | --- |
| AC1 | PASS for slice | Electron main now invokes the same `LifecycleService` used by the CLI for status, every lifecycle mutation, and purge. The Desktop CLI subprocess adapter and fallback test are deleted. `sourceExecutable` is the checksum-verified artifact path. Packaged inspection remains P6. |
| AC2 | PASS for slice | The direct controller validates canonical lifecycle status, mutation, purge preview, and purge result schemas, checks operation/token identity, and preserves the existing renderer reduction and evidence-bound one-use purge flow. Complete diagnostic enrichment remains AC7/P5. |
| AC3 | PASS for slice | Startup constructs one controller from the verified artifact and embedded version. Production passes no home, socket, supervisor, environment, path, or argument override. Exact mismatch preserves reads, visibly emits both versions, suppresses lifecycle controls, prevents purge execution, and refuses every mutation before service entry. Existing manager no-downgrade policy remains unchanged. Packaged identity proof remains P6. |
| AC4 | PASS from prior slice | The direct controller adopts the service-owned deadline and recovery behavior delivered in PR 38 without adding a caller timeout. Final interruption evidence remains P7. |
| AC5 | PASS from prior slice | Desktop and CLI now enter the same cross-process mutation lease through the shared service. Final native contention evidence remains P7. |
| AC6 | NOT YET | Existing coordinator behavior remains, but active-operation close blocking and interruption recovery are I-4/I-6. |
| AC7 | NOT YET | The mismatch message is safe and visible, but the complete copyable failure packet remains I-4/P5. |
| AC8 | NOT YET | Existing broad, compiled CLI, Bun bundle, Node import, and native adapter suites pass; packaged Electron plus real macOS/Linux lifecycle evidence remains P6-P7. |

## Rubric

| # | Result | Scope | Notes |
| --- | --- | --- | --- |
| R1 | PASS for slice | I-3 removes every Desktop lifecycle CLI subprocess and routes all operations to the shared service while retaining verified installation bytes. Packaged inspection remains before feature PASS. |
| R2 | PASS for slice | Direct and CLI adapters consume the same strict canonical status, mutation, and purge schemas. Complete renderer diagnostic presentation remains P5. |
| R3 | PASS for slice | Fixed main-process inputs and exact mismatch refusal/visibility are implemented and tested. Packaged mismatch and richer safe diagnostics remain P5-P6. |
| R4 | PASS from I-2 | The Desktop no longer adds adapter-owned timeouts and inherits canonical service recovery. |
| R5 | PASS from I-2 | Direct Desktop mutations use the same cross-process lock as CLI mutations. |
| R6 | NOT YET | Close protection and interruption behavior remain I-4/I-6. |
| R7 | NOT YET | Full renderer-safe diagnostic packets remain I-4. |
| R8 | NOT YET | Compatibility advances, but packaged Electron and complete native targets remain required. |

## Slice conclusion

I-3 satisfies P4 and advances R1, R3, and R8 without claiming complete-feature
success. No in-scope failure blocks review or merge of this intermediate PR.
