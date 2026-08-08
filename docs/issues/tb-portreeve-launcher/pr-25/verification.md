# Verification - PR #25

**Scope:** P1 / I-1 configuration and trust slice

**Pinned diff:**
`68fc6f906ba8e505d29fcbb5279378c6e936bd21..78b9fcd78d6f27611c1cfdbec4fc5f6a7f5b1c95`

**Available toolchain:** Bun 1.2.18 on macOS x64; repository requires Bun 1.3.14

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS WITH TOOLCHAIN LIMITATION | `bun run typecheck` passes; the pinned `bun run check` refuses before execution because the host Bun is 1.2.18 rather than 1.3.14 |
| Lint and format | PASS | `bun run lint`, changed-file Prettier, and `git diff --check` pass |
| Unit tests | PASS | Focused launcher, platform-path, and purge suite passes 23 tests and 69 assertions |
| Integration tests | PASS | Real filesystem tests cover exclusive create, exact-byte replacement, symlink containment, private state, stale-lock recovery, and reset scope |
| End-to-end/browser | N/A | This slice deliberately exposes no CLI or Desktop launcher workflow |
| Application runtime | N/A | Command execution begins in P4; this slice contains no runtime command path |
| Branch documents | PASS | Spec, issue, tracker, branch-doc, and decision-triage validators pass |

## Commands

```sh
bun run typecheck
bun run lint
bunx prettier --check src/launcher test/launcher src/platform/paths.js test/platform/paths.test.js docs/issues/tb-portreeve-launcher
bun test test/launcher test/platform/paths.test.js test/supervision/purge.test.js
python3 <workflow-root>/resources/scripts/validate_branch_docs.py docs/issues/tb-portreeve-launcher
python3 <workflow-root>/resources/scripts/lint_issues.py docs/issues/tb-portreeve-launcher
python3 <workflow-root>/resources/scripts/lint_tracker.py docs/issues/tb-portreeve-launcher
python3 <workflow-root>/resources/scripts/gate_triage.py docs/issues/tb-portreeve-launcher
```

## Focused behavior proven

- Strict version-1 configuration normalizes defaults, rejects unknown and contradictory
  fields, uses structured endpoint references, and produces deterministic canonical bytes.
- Trust revisions hash exact source bytes, so a semantically equivalent external edit is
  still a new revision requiring review.
- Working directories remain within the real canonical stack root even through symlinks.
- Launcher creation is exclusive and replacement is atomic and baseline-bound.
- Discovery reads only exact-directory package, Make, and Compose files, reports
  provenance, and leaves ambiguous operations blank.
- Shared state is strict, private, atomically replaced, cross-process locked, recoverable
  after stale locks without PIDs, and located inside complete-reset scope.

## Known unrelated failures and manual checks

- `bun run toolchain:check` reports: repository requires Bun 1.3.14, but
  `/Users/trent.brown/.bun/bin/bun` is 1.2.18. The old runtime emits an AVX warning to
  stderr and fails the compiled-runtime dotenv-autoload assertion.
- A broad source-suite run recorded 299 passes. Its remaining CLI JSON failures contain
  the Bun warning in stderr, lifecycle isolation tests observe the user's active installed
  LaunchAgent, and one real-process reclamation test times out under this mismatched host
  runtime. None touches `src/launcher` or the added path field.
- Re-run `bun run check` with repository-pinned Bun 1.3.14 in clean lifecycle isolation
  before merging. No project-command or Desktop manual check applies to this slice.
