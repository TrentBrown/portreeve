# Verification - PR #32

**Scope:** P8 / I-8, evaluated from `57988dce6376a2043d459f4cbc9bf635b2302e17`
through pinned source `ae4709d8cc086ed78bfcce6364b411903be8c2b6`.

## Matrix

| Category | Result | Evidence |
|---|---|---|
| Build | PASS | Pinned Bun 1.3.14: `bun run build`; emits `dist/portreeve`. |
| Typecheck | PASS | `bun run typecheck`. |
| Lint | PASS | `bun run lint`. |
| Changed-file format | PASS | Prettier check over all files in the pinned diff. |
| Unit tests | PASS | Focused Launcher model/view/adapter: 10 tests and 83 expectations. Complete Desktop suite: 77 tests and 411 expectations. |
| Integration tests | PASS | Main-process discovery, opaque document editing, strict schemas, shared lifecycle sessions, output, cancellation, saving, close protection, and safe history pass against real temporary files and shared services. |
| End-to-end UI | PASS | Isolated packaged macOS app: missing launcher suggestions and basename provenance render; Save and Trust succeeds; reload shows the exact trusted revision and enabled actions; Status produces bounded output and one safe history record; saved editor remains clean and refresh remains enabled. |
| Application runtime | PASS | `bun run desktop:package` produces `dist/desktop/PortReeve-darwin-arm64`; the packaged app loads and completes the isolated Launcher workflow. |
| Existing clients | PASS | All 381 unique repository tests pass across the host-aware run and isolated lifecycle reconciliation. No public non-Desktop contract changed. |

## Commands

```text
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run build
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run typecheck
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run lint
git diff --name-only -z 57988dce6376a2043d459f4cbc9bf635b2302e17..ae4709d8cc086ed78bfcce6364b411903be8c2b6 | xargs -0 ./node_modules/.bin/prettier --check
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test test/desktop/launcher-adapter.test.js test/desktop/launcher-model.test.js test/desktop/launcher-view.test.js
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test test/desktop
TMPDIR=<short-private-temp> /Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test
TMPDIR=<short-private-temp> PORTREEVE_SUPERVISOR_LABEL=<isolated-label> PORTREEVE_SUPERVISOR_DEFINITION=<isolated-definition> /Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test test/cli/lifecycle-commands.test.js
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run desktop:package
PORTREEVE_HOME=<isolated-home> PORTREEVE_SOCKET_PATH=<isolated-socket> <packaged-PortReeve-executable>
```

## Broad-suite reconciliation

The normal machine-aware run reports 378 passes and three failures, all in
`test/cli/lifecycle-commands.test.js`. Each observes the user's active
`com.portreeve.server` LaunchAgent instead of the fixture's intentionally absent
supervisor. Running that complete file with a unique supervisor label and definition
passes all five tests. Therefore all 381 unique repository tests pass across the normal
run plus the isolated lifecycle rerun.

An attempted verification with an x86 baseline Bun binary emitted a CPU warning into
child-process stderr and produced invalid CLI fixture output. It is not product evidence.
All recorded gates use the pinned native arm64 Bun 1.3.14 binary.

The repository-wide `bun run format:check` also notices the ignored local handoff file
`.handoffs/HANDOFF-main-codex-2026-08-08T1338.md`, which is outside the pinned diff. The
required changed-file format gate passes.

## Pending final verification

P9 retains the feature-final packaged attached-process quit workflow, packaged
external-edit conflict workflow, macOS/Linux native release matrix, documentation,
retention/reset review, and complete assembled acceptance pass. None is claimed by P8.
