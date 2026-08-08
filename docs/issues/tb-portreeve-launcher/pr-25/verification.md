# Verification - PR #25

**Scope:** P1 / I-1 configuration and trust slice

**Pinned diff:**
`68fc6f906ba8e505d29fcbb5279378c6e936bd21..78b9fcd78d6f27611c1cfdbec4fc5f6a7f5b1c95`

**Verification toolchain:** Bun 1.3.14 on macOS arm64, resolved through an
ephemeral `npx bun@1.3.14` installation without changing the user's global Bun

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Pinned Bun 1.3.14 passes the repository toolchain check and `bun run typecheck` |
| Lint and format | PASS WITH REPOSITORY LIMITATION | Pinned Bun 1.3.14 passes `bun run lint`, changed-file Prettier, and `git diff --check`; repository-wide Prettier stops only on the unrelated pre-existing `.handoffs/HANDOFF-main-codex-2026-08-08T1338.md` |
| Unit tests | PASS WITH HOST-STATE ISOLATION | Focused launcher coverage passes 23 tests and 69 assertions. The complete suite records 309/312 passing while three lifecycle assertions observe the user's real active LaunchAgent; the affected lifecycle file passes 5/5 with an isolated supervisor identity, demonstrating all 312 unique tests passing across the two runs |
| Integration tests | PASS | Real filesystem tests cover exclusive create, exact-byte replacement, symlink containment, private state, stale-lock recovery, and reset scope |
| End-to-end/browser | N/A | This slice deliberately exposes no CLI or Desktop launcher workflow |
| Application runtime | N/A | Command execution begins in P4; this slice contains no runtime command path |
| Branch documents | PASS | Spec, issue, tracker, branch-doc, and decision-triage validators pass |

## Commands

```sh
PINNED_BUN=/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun
"$PINNED_BUN" run toolchain:check
"$PINNED_BUN" run typecheck
"$PINNED_BUN" run lint
"$PINNED_BUN" x prettier --check src/launcher test/launcher src/platform/paths.js test/platform/paths.test.js docs/issues/tb-portreeve-launcher
"$PINNED_BUN" test test/launcher test/platform/paths.test.js test/supervision/purge.test.js
env -u PORTREEVE_SUPERVISOR_DEFINITION -u PORTREEVE_SUPERVISOR_LABEL -u PORTREEVE_SUPERVISOR_UNIT "$PINNED_BUN" test
PORTREEVE_SUPERVISOR_DEFINITION="$(mktemp -d /tmp/portreeve-pr25-lifecycle.XXXXXX)/com.portreeve.pr25.plist" \
  PORTREEVE_SUPERVISOR_LABEL=com.portreeve.pr25.test \
  "$PINNED_BUN" test test/cli/lifecycle-commands.test.js
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

## Known unrelated limitations and manual checks

- The user's global Bun remains 1.2.18. Verification used Bun 1.3.14 ephemerally, so no
  global toolchain or installed PortReeve state was changed.
- A monolithic source-suite run sees the user's real active
  `com.portreeve.server` LaunchAgent in three lifecycle-command assertions. The run
  records 309 passes and 3 host-state failures. Re-running that affected file against a
  temporary definition and supervisor label passes all 5 tests and 22 assertions.
- Repository-wide `bun run check` reaches formatting after passing the pinned toolchain,
  typecheck, and lint gates, then reports only the unrelated existing handoff file named
  above. Changed-file formatting passes.
- No project-command or Desktop manual check applies to this foundation slice.
