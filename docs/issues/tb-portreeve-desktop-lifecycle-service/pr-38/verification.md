# Verification - PR 38

**Scope:** slice
**Base:** `5d6319ee68efc651465e31064bfa6c7d7edbed72`
**Head:** `cda478965f4dd9b21798e2bcf839effd51b91faf`
**Toolchain:** Bun 1.3.14 on macOS arm64; Node runtime smoke through the available `node` executable

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Pinned Bun 1.3.14 completed `bun run typecheck` and `bun run build`; the standalone executable was emitted at `dist/portreeve`. |
| Lint and formatting | PASS | `bun run lint`, `bun run format:check`, and `git diff --check` completed without findings. |
| Unit tests | PASS | The broad suite passed 406 tests with 1,966 assertions. Deadline tests prove timed-out partial/failed recovery, a referenced foreground Node wait, stubborn-child termination, bounded peer release, busy refusal, read concurrency, and purge timeout semantics. |
| Integration tests | PASS | The isolated lifecycle CLI fixture passed five tests with 22 assertions. A real compiled-CLI contender returned `lifecycle_busy`, `refused`, and exit code 20 while a separate process held the listener lease. A killed helper left an abandoned Unix socket that one of twelve concurrent contenders recovered while every other contender failed busy. |
| End-to-end/browser | N/A | This safety slice changes the shared lifecycle service and the Desktop result schema only; the Desktop direct-service migration and user-visible failure presentation remain I-3 and I-4. |
| Application runtime | PASS | The broad suite includes compiled-runtime and standalone Commander CLI coverage. A dedicated Node subprocess completed a lifecycle wait, proving the shared wait does not let a foreground Node process exit early. |
| Native platform | PARTIAL | launchd and systemd-user adapter contracts pass under deterministic runners, and an isolated macOS launchd identity exercises lifecycle CLI status, refusal, preview, and purge. Real macOS/Linux lifecycle and interruption evidence remains the planned P7 gate. |
| Branch documents | PASS | Decision triage promoted all I-2 decisions. Deterministic branch validators are rerun before packet finalization. |

## Commands

```text
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run typecheck
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run lint
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run format:check
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run build

test_files=($(rg --files test -g '*.test.js' |
  rg -v '^test/cli/lifecycle-commands\.test\.js$'))
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14   test --reporter=dot $test_files

HOME=<private-temporary-home> PORTREEVE_SUPERVISOR_DEFINITION=<private-temporary-plist> PORTREEVE_SUPERVISOR_LABEL=<unique-test-label> PORTREEVE_LIFECYCLE_RUNTIME_DIRECTORY=<private-temporary-runtime> /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14   test --reporter=dot test/cli/lifecycle-commands.test.js

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14   test test/supervision/lifecycle-deadline.test.js   test/supervision/lifecycle-lock.test.js   test/supervision/lifecycle-service.test.js   test/supervision/native-adapters.test.js

./dist/portreeve stop-manual --json
# Run with isolated HOME, PortReeve paths, and supervisor identity while a
# separate lifecycle-lock-holder process owns lifecycle-mutation.sock.
# Observed exit 20 and error.code lifecycle_busy.

node --input-type=module --eval   "import { LifecycleMutationLock } from './src/supervision/lock.js'; ..."
```

## Known unrelated failures

None.

The developer's real launchd service may be active, so the host-sensitive
`test/cli/lifecycle-commands.test.js` is intentionally run with a temporary
home, definition, label, and lifecycle runtime directory. This protects
legitimate user state and is the supported isolation for that fixture.

## Manual checks

None required for I-2 review. Real macOS launchd, Linux systemd-user, packaged
Desktop, normal-close protection, and forced-interruption recovery remain
explicit I-5/I-6 verification work and prevent feature-level completion.
