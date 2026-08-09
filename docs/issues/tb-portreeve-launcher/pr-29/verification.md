# Verification - PR #29

**Scope:** P5 / I-5 complete launcher CLI workflow

**Pinned diff:**
`4f4b0f48f6c7e9914f802995fffb8cf6fb7f69f2..05a6b52eda7d4bfb3995420a22d602b7e165e644`

**Toolchain:** Bun 1.3.14 on macOS arm64 through the repository-required pinned
runtime. The user's installed PortReeve service and `com.portreeve.server` LaunchAgent
were not stopped, reconfigured, or replaced.

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Toolchain check, TypeScript checking, and `bun run build` pass; `dist/portreeve` is produced from the pinned source. |
| Lint and format | PASS WITH HOST NOTE | Repository ESLint, changed-file Prettier, and pinned-diff whitespace checks pass. The aggregate `bun run check` stops only because Prettier discovers an ignored pre-existing handoff file outside the PR diff. |
| Unit tests | PASS | Launcher document, discovery, trust/cache, evidence, command-session, lifecycle, Commander registration, explicit-consent, rendering, and exit-path tests pass. |
| Integration tests | PASS | A real private SQLite daemon and Unix socket are exercised through the official client for applied-stack selection, exact-revision trust, generation allocation, all four lifecycle operations, fresh-process cached degraded Status/Stop, and daemon-required Start. |
| End-to-end/browser | N/A | P5 adds no renderer surface. Interactive prompt behavior is exercised through the same command functions with deterministic terminal adapters. |
| Application runtime | PASS | The standalone compiled executable exposes the launcher command tree and runs a trusted launcher Start through the real daemon and login shell. The same test is in the repository's macOS/Linux native-smoke matrix. |
| Branch documents | PASS | Cumulative issues, tracker, decision log, and PR packet are reconciled; deterministic validators pass after triage. |

## Commands and results

```sh
PINNED_BUN=/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun
"$PINNED_BUN" run toolchain:check
"$PINNED_BUN" run typecheck
"$PINNED_BUN" run lint
"$PINNED_BUN" run build
git status --short | sed -E 's/^...//' | rg '\.(js|md)$' | xargs "$PINNED_BUN" x prettier --check
"$PINNED_BUN" test test/launcher test/cli/launcher-commands.test.js test/cli/program.test.js test/cli/stack-selection.test.js test/runtime/compiled-cli.test.js
"$PINNED_BUN" test
PORTREEVE_SUPERVISOR_DEFINITION=/tmp/portreeve-pr29-supervisor.plist PORTREEVE_SUPERVISOR_LABEL=com.portreeve.pr29.test "$PINNED_BUN" test test/cli/lifecycle-commands.test.js
```

- Focused launcher, CLI, and compiled surface: 57 tests, 237 assertions, 0 failures.
- Normal repository run: 356 tests, 353 passes, 3 host-state failures, 1,502
  assertions.
- Isolated lifecycle rerun: 5 tests, 22 assertions, 0 failures.
- Every one of the repository's 356 unique tests passes across the normal run and the
  isolated supervisor-identity rerun.

## Behavior proven

- `launcher init` discovers the enclosing root independently of Git, displays
  manifest provenance, resolved shell and working directory, suggested endpoint
  mappings, and exact canonical JSON, then exclusively creates and trusts the file.
- `launcher validate` accepts valid unapplied project files without implying that they
  may execute. `launcher trust` requires an interactive review of the resolved shell,
  working directory, complete commands, and exact file revision.
- Start, Stop, Restart, and Status use the shared lifecycle engine. JSON output remains
  one versioned document, human mode streams bounded command output, and nonzero states
  map consistently to state-difference, conflict, unavailable, or invalid-input exits.
- Untrusted or externally changed definitions do not execute. A partially observed
  Start requires interactive confirmation or `--run-start-anyway`; degraded Stop
  requires interactive confirmation or `--allow-degraded`.
- A fresh process may use only an exact-root cached applied-stack snapshot. Start and
  Restart still refuse without the daemon, Status is visibly cached/local, and Stop
  remains explicitly confirmed and uncoordinated.
- The compiled executable runs the same Commander and shared-engine code on the native
  current target. The release workflow runs repository checks on macOS arm64/x64 and
  Linux arm64/x64; those remote native-smoke jobs remain the cross-platform release
  authority.

## Host notes

The three normal-run failures are the known legacy lifecycle assertions that discover
the user's real active `com.portreeve.server` LaunchAgent while using temporary homes.
The same five-test file passes completely with an isolated supervisor definition and
label. This is host-state sensitivity, not a source regression.

The aggregate `bun run check` also finds the ignored pre-existing
`.handoffs/HANDOFF-main-codex-2026-08-08T1338.md` and stops at Prettier. Every changed
JavaScript and Markdown file passes Prettier, and the handoff was intentionally left
untouched.
