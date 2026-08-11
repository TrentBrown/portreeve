# Verification - PR 37

**Scope:** slice
**Base:** `a237358c710509dc14a337f87a4641641a985a94`
**Head:** `d51b75bc7eb6669e28c30a44a9d9b453f5796765`
**Toolchain:** Bun 1.3.14 on macOS arm64

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Pinned Bun 1.3.14 completed `bun run typecheck` and `bun run build`; the standalone executable was emitted at `dist/portreeve`. |
| Lint and formatting | PASS | `bun run lint`, changed-file Prettier formatting, and `git diff --check` completed without findings. Final evidence formatting and branch-document checks run before packet finalization. |
| Unit tests | PASS | Nine focused shared-service, CLI envelope, and exit-band tests passed with 43 assertions. New service tests cover every mutation name plus succeeded, no-change, refused, partial, and failed outcomes. |
| Integration tests | PASS | The broad suite excluding the host-sensitive native lifecycle fixture passed 390 tests with 1,942 assertions. The isolated lifecycle CLI fixture passed five tests with 22 assertions against a temporary launchd definition and label. |
| End-to-end/browser | N/A | This slice does not change renderer or browser behavior. Desktop migration is assigned to later feature issues. |
| Application runtime | PASS | The broad suite included compiled runtime and standalone Commander CLI tests; the explicit compiled build also completed successfully. |
| Branch documents | PASS | `lint_spec.py`, `lint_issues.py`, `lint_tracker.py`, and `validate_branch_docs.py` passed provisionally. Decision triage and final reruns occur before packet finalization. |

## Commands

```text
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run typecheck
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run lint
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run build

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test \
  test/cli/lifecycle.test.js test/cli/exit.test.js \
  test/supervision/lifecycle-service.test.js

PORTREEVE_SUPERVISOR_DEFINITION=/tmp/com.portreeve.desktop-lifecycle-i1.plist \
PORTREEVE_SUPERVISOR_LABEL=com.portreeve.desktop-lifecycle.i1 \
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  test --reporter=dot test/cli/lifecycle-commands.test.js

rg --files test | rg '\.test\.js$' | \
  rg -v '^test/cli/lifecycle-commands\.test\.js$' | \
  xargs /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  test --reporter=dot

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 x prettier \
  --check <changed files and feature folder>

python3 <workflow-root>/resources/scripts/lint_spec.py \
  docs/issues/tb-portreeve-desktop-lifecycle-service
python3 <workflow-root>/resources/scripts/lint_issues.py \
  docs/issues/tb-portreeve-desktop-lifecycle-service
python3 <workflow-root>/resources/scripts/lint_tracker.py \
  docs/issues/tb-portreeve-desktop-lifecycle-service
python3 <workflow-root>/resources/scripts/validate_branch_docs.py \
  docs/issues/tb-portreeve-desktop-lifecycle-service
git diff --check
```

## Known unrelated failures

An earlier combined `bun run check` invocation applied the temporary launchd
override to the entire suite. It reached 391 passing tests but caused two
`test/supervision/factory.test.js` assertions to observe the explicit temporary
definition instead of the default definition they are designed to verify. The
source was unchanged. The final matrix separates the default-environment broad
suite from the isolated native lifecycle fixture; both final commands pass.

The developer's real launchd service is active, so the host-sensitive
`test/cli/lifecycle-commands.test.js` cannot use the default supervisor identity
without observing that legitimate installation. Its existing supported
temporary definition and label isolate the fixture from user state.

## Manual checks

None required for this non-desktop extraction slice. Real launchd, systemd-user,
packaged desktop, close-protection, and interruption checks remain explicit
later-feature gates.
