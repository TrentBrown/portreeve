# Verification - PR #26

**Scope:** P2 / I-2 daemon launcher-operation coordination

**Pinned diff:**
`20f6d42bfd6504ac2de00d39dd17ca475dc8c668..3634833b6d6fb68ddedee5fefe388d9bbb78ddb8`

**Verification toolchain:** Bun 1.3.14 on macOS arm64, resolved through the
repository-required ephemeral toolchain without changing the user's global Bun

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | `bun run toolchain:check`, `bun run typecheck`, and `bun run build` pass; the compiled CLI is produced at `dist/portreeve` |
| Lint and format | PASS WITH REPOSITORY LIMITATION | `bun run lint`, changed-file Prettier, and `git diff --check` pass; repository-wide Prettier still reports only the unrelated pre-existing `.handoffs/HANDOFF-main-codex-2026-08-08T1338.md` |
| Unit tests | PASS | Launcher-operation service tests cover credentials, renewal, completion, admission, audit rollback, expiry, and retention; protocol schemas reject command, environment, and output fields |
| Integration tests | PASS | Real SQLite and Unix-socket tests cover migration, independent database connections, official-client routes, capability refusal, server-start expiry, history, stack mutation blocking, npm packaging, and Node consumption |
| End-to-end/browser | N/A | This slice deliberately adds no renderer or Desktop workflow; those remain P7-P8 |
| Application runtime | PASS | A real Bun server over a private Unix socket advertises the capability and completes begin, renew, complete, inspect, recent-history, invalid-credential, and restart-expiry flows |
| Branch documents | PASS | Branch-doc, issue, tracker, spec, and decision-triage validators pass; the historical `interview.md` status warning remains non-blocking |

## Commands

```sh
PINNED_BUN=/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun
"$PINNED_BUN" run toolchain:check
"$PINNED_BUN" run typecheck
"$PINNED_BUN" run lint
"$PINNED_BUN" test test/launcher test/protocol test/server test/storage test/stacks test/release/npm-package.test.js test/release/documentation.test.js
"$PINNED_BUN" run build
env -u PORTREEVE_SUPERVISOR_DEFINITION -u PORTREEVE_SUPERVISOR_LABEL -u PORTREEVE_SUPERVISOR_UNIT "$PINNED_BUN" test
PORTREEVE_SUPERVISOR_DEFINITION="$(mktemp -d /tmp/portreeve-p2-lifecycle.XXXXXX)/com.portreeve.p2.plist" \
  PORTREEVE_SUPERVISOR_LABEL=com.portreeve.p2.test \
  "$PINNED_BUN" test test/cli/lifecycle-commands.test.js
python3 <workflow-root>/resources/scripts/validate_branch_docs.py docs/issues/tb-portreeve-launcher
python3 <workflow-root>/resources/scripts/lint_issues.py docs/issues/tb-portreeve-launcher
python3 <workflow-root>/resources/scripts/lint_tracker.py docs/issues/tb-portreeve-launcher
python3 <workflow-root>/resources/scripts/gate_triage.py docs/issues/tb-portreeve-launcher
```

## Results

- Focused protocol, storage, server, stack, package, and documentation run: 114 tests,
  483 assertions, 0 failures.
- Complete normal repository run: 321 passes and 3 host-state failures across 324 tests.
- The affected lifecycle-command file passes 5 tests and 22 assertions against an
  isolated supervisor identity, demonstrating every unique repository test passing.
- New launcher-operation tests alone pass 11 service and socket cases covering both
  direct persistence and the public HTTP/JSON Unix-socket contract.

## Behavior proven

- The capability is additive, and older daemons are refused before launcher mutation.
- Begin returns a random credential while SQLite stores only its SHA-256 hash.
- Same-root admission is transactional across database connections; sibling roots run
  independently, and attached Start admits only one finite Status or Stop companion.
- Renewal extends a thirty-second deadline. Exact-deadline, lazy, and server-start
  expiry record `lost` at the deadline without adopting or signaling a process.
- Completion is transactional and idempotent only for identical normalized metadata.
  Audit-write failure rolls terminal state back.
- Strict schemas and bounded fields contain no command, environment, credential, or raw
  output channel. The latest twenty terminal records remain available per stack while
  begin, complete, and lost events feed the existing bounded global history.
- Active launcher work blocks changed stack definitions, stack deletion, and pruning.

## Known unrelated limitations and manual checks

- The user's active `com.portreeve.server` LaunchAgent is intentionally left running.
  Three legacy lifecycle-command assertions therefore observe active supervision in the
  monolithic test invocation; their isolated rerun passes completely.
- The user's global Bun remains 1.2.18. Verification uses the required Bun 1.3.14
  ephemerally and does not modify global tooling.
- No Desktop manual check applies because P2 exposes no Desktop surface.
