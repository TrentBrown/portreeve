# Verification - PR #27

**Scope:** P3 / I-3 launcher endpoint environment and evidence services

**Pinned diff:**
`12f4b014abcc422c59a30bc922432d2beda97130..2da42e61e849b7af9175ffc110a39bc7fbd75384`

**Toolchain:** Bun 1.3.14 on macOS arm64 through the repository-required ephemeral
runtime; the user's global toolchain and running PortReeve service were not changed.

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Toolchain check, `bun run typecheck`, and `bun run build` pass; `dist/portreeve` is produced. |
| Lint and format | PASS WITH REPOSITORY LIMITATION | ESLint, changed-file Prettier, and `git diff --check` pass. Repository-wide Prettier retains the unrelated ignored `.handoffs/HANDOFF-main-codex-2026-08-08T1338.md` limitation. |
| Unit tests | PASS | Mapping, identity, stale-generation, activation, cache, six evidence-state, stale-provider, and degraded-local cases pass. |
| Integration tests | PASS | A real SQLite daemon and private Unix socket are exercised through the official client for stack apply, generation preparation, environment resolution, cache, inventory, and evidence classification. |
| End-to-end/browser | N/A | P3 introduces no CLI command or renderer surface. |
| Application runtime | PASS | The real in-process server and official HTTP/JSON Unix-socket client complete the affected workflow. |
| Branch documents | PASS | Branch, issues, tracker, and decision-triage validators pass; only the historical `interview.md` status warning remains. |

## Commands and results

```sh
PINNED_BUN=/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun
"$PINNED_BUN" run toolchain:check
"$PINNED_BUN" run typecheck
"$PINNED_BUN" run lint
"$PINNED_BUN" run build
"$PINNED_BUN" test --reporter=dot test/launcher test/stacks test/reconciliation test/server test/protocol
"$PINNED_BUN" test --reporter=dot test/administration test/allocation test/desktop test/docker test/domain test/inspection test/launcher test/observability test/platform test/protocol test/reclamation test/reconciliation test/release test/runtime test/security test/server test/stacks test/storage test/supervision
"$PINNED_BUN" test --reporter=dot test/cli/claim-commands.test.js test/cli/claims.test.js test/cli/config-commands.test.js test/cli/error-body.test.js test/cli/exit.test.js test/cli/lifecycle.test.js test/cli/observability-commands.test.js test/cli/operations.test.js test/cli/output-render.test.js test/cli/port-commands.test.js test/cli/program.test.js test/cli/serve.test.js test/cli/stack-commands.test.js test/cli/stack-selection.test.js test/cli/stacks.test.js
PORTREEVE_SUPERVISOR_DEFINITION="<temporary>/com.portreeve.p3.plist" PORTREEVE_SUPERVISOR_LABEL=com.portreeve.p3.test "$PINNED_BUN" test test/cli/lifecycle-commands.test.js
```

- Affected surface: 100 tests, 364 assertions, 0 failures.
- New launcher and local-state surface: 11 tests, 34 assertions, 0 failures.
- All repository tests across host-isolated runs: 332 tests, 1,415 assertions, 0
  failures (278 non-CLI + 49 ordinary CLI + 5 lifecycle).

## Behavior proven

- Host ports, host URLs, container ports, and Docker-network URLs resolve from one
  current generation; assigned ports never enter the checked-in launcher.
- The fixed context is limited to stack root, stack ID, generation ID, socket, and an
  active matching activation ID. Stale generations, roots, and activations are refused.
- The private exact-revision cache contains only resolved strings and endpoint facts
  needed for later degraded evidence.
- Command-only listeners are observed but never promoted to verified ownership.
  Matching active provider evidence is required for verified; mismatched ownership is
  conflicting; unavailable or missing evidence is uncertain.
- Provider rows from older generations cannot contaminate current classification.
- Fresh local `lsof` evidence is labeled local and uncoordinated and can never report
  verified or conflicting ownership.

## Host note

The installed `com.portreeve.server` LaunchAgent was intentionally left alone. The five
legacy lifecycle-command tests therefore use a temporary supervisor identity; every
repository test passes without stopping or modifying the user's service.
