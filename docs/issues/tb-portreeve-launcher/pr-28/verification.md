# Verification - PR #28

**Scope:** P4 / I-4 finite command-only launcher execution

**Pinned diff:**
`3c5ce33d983a3e0b2d139642b5005f6bccc4bebf..34f2a16a4711a96c070f4304010fea7d55fb5536`

**Toolchain:** Bun 1.3.14 on macOS arm64 through the repository-required pinned
runtime. The user's installed PortReeve service and `com.portreeve.server` LaunchAgent
were not stopped, reconfigured, or replaced.

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Toolchain check, `bun run typecheck`, and `bun run build` pass; `dist/portreeve` is produced from the pinned head. |
| Lint and format | PASS | Repository ESLint, changed-file Prettier, and pinned-diff whitespace checks pass. |
| Unit tests | PASS | Real command-session tests cover login-shell invocation, closed stdin, ordered streams, UTF-8-safe one-megabyte truncation, reserved-context scrubbing, timeout, TERM/KILL escalation, cancellation, spawn failure, and platform selection. Lifecycle tests cover every evidence gate, partial repair, minimal cleanup context, stale-generation refusal, advisory Status, custom/composed behavior, degraded policy, renewal loss, and renewal/completion serialization. |
| Integration tests | PASS | A private SQLite daemon and Unix socket are exercised through the official client for stack apply, generation preparation, environment injection into a real shell, daemon operation begin/complete, fresh evidence, and history inspection. |
| End-to-end/browser | N/A | P4 introduces the shared engine but no CLI command or renderer surface; those are P5 and P7-P8. |
| Application runtime | PASS | Real POSIX child processes execute with isolated process groups; timeout/cancellation tests signal only those groups. The socket integration writes the allocated port from the injected environment and proves raw output/environment do not enter daemon history. |
| Branch documents | PASS | Cumulative issues, tracker, decision log, and the PR packet are reconciled; deterministic validators pass after triage. |

## Commands and results

```sh
PINNED_BUN=/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun
"$PINNED_BUN" run build
"$PINNED_BUN" run lint
"$PINNED_BUN" run typecheck
"$PINNED_BUN" test test/launcher/command-session.test.js test/launcher/lifecycle-service.test.js test/launcher/environment-service.test.js test/launcher/evidence-service.test.js test/launcher/operation-service.test.js
"$PINNED_BUN" test
PORTREEVE_SUPERVISOR_DEFINITION=/tmp/com.portreeve.p4-codex-test.plist PORTREEVE_SUPERVISOR_LABEL=com.portreeve.p4.codex.test "$PINNED_BUN" test test/cli/lifecycle-commands.test.js
```

- Focused launcher surface: 36 tests, 120 assertions, 0 failures.
- Normal repository run: 350 tests, 347 passes, 3 host-state failures, 1,464
  assertions.
- Isolated lifecycle rerun: 5 tests, 22 assertions, 0 failures.
- Every one of the repository's 350 unique tests passes across the normal run and the
  isolated supervisor-identity rerun.

## Behavior proven

- Commands run through the selected login shell with closed stdin, no PTY, inherited
  ordinary environment, scrubbed ambient `PORTREEVE_*` values, and exact current
  PortReeve context.
- Each shell owns a new POSIX process group. Timeout and cancellation send SIGTERM,
  wait the grace period, and may send SIGKILL only to that group; Stop is never invoked
  implicitly.
- Retained output is ordered, UTF-8 safe, truncation-marked, and bounded to one
  megabyte across the complete launcher operation, including composed Restart.
- Start refuses verified, fully observed, conflicting, and uncertain states. Partial
  evidence requires explicit Run Start Anyway and retains its generation.
- Stop invokes only the project command and remains runnable with minimal applicable
  context when no generation exists. Status output does not replace listener evidence.
- Missing Restart composes Stop, fresh evidence, fresh allocation validation or
  preparation, and Start; remaining partial or conflicting state prevents Start.
- Healthy-daemon execution begins, renews, and completes a safe operation session.
  An in-flight renewal settles before completion, and lost renewal cancels the exact
  command group.
- Daemon outage blocks Start/Restart, permits Status only with exact-revision cache,
  and requires explicit confirmation for cached Stop. Local evidence remains labeled
  uncoordinated.

## Host note

The three normal-run failures are the known legacy lifecycle assertions that discover
the user's real active `com.portreeve.server` LaunchAgent while using temporary homes.
The same five-test file passes completely with an isolated supervisor definition and
label. This is host-state sensitivity, not a source regression, and the real service
was intentionally left running.
