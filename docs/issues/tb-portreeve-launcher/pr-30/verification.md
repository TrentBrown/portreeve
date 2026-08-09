# Verification - PR #30

**Scope:** P6 / I-6, evaluated from `9e59c0d8283c2b49d5f731d15d6abb6a97f0fd67`
through pinned source `8786913293e42b4bd55331eab262918766711bd5`.

## Matrix

| Category | Result | Evidence |
|---|---|---|
| Build | PASS | Pinned Bun 1.3.14: `bun run build`; toolchain check passes and emits `dist/portreeve`. |
| Typecheck | PASS | `bun run typecheck`. |
| Lint | PASS | `bun run lint`. |
| Changed-file format | PASS | `git diff --name-only -z <base>..<head> \| xargs -0 bun x prettier --check`; all matched files use Prettier style. |
| Unit tests | PASS | Focused launcher, protocol, operation, server, and CLI matrix: 65 tests, 225 assertions, zero failures. |
| Integration tests | PASS | Real POSIX process-group tests prove closed input, bounded output, graceful/forced exact-group signaling, stale-group refusal, and registry cleanup. Real Unix-socket tests prove attached Start admits finite Status and Stop, Stop leaves the attached group alive, explicit termination ends it, and safe terminal history excludes executable data. |
| Verified activation | PASS | Real Unix-socket activation prepares the supplied generation, confirms a live process-backed listener, and accepts verified Start only for the matching generation and activation. Unit tests reject exit-zero without verification and mismatched generation evidence. |
| CLI/shared runtime | PASS | CLI regression tests cover shared lifecycle invocation and human/JSON rendering; attached Start uses the same runtime and SIGINT/SIGTERM cancellation path. |
| End-to-end UI | N/A | P6 changes no renderer or IPC surface; the Desktop trusted boundary, quit guard, and Launcher UI are P7-P8. |
| Application runtime | PASS | `bun run build` produces the standalone CLI; real macOS child processes and a real daemon socket exercise the new runtime behavior. Packaged Desktop attached-quit smoke remains P9. |

## Commands

```text
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run build
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run typecheck
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run lint
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test test/launcher/command-session.test.js test/launcher/lifecycle-service.test.js test/launcher/definition.test.js test/launcher/operation-service.test.js test/server/launcher-operations.test.js test/protocol/schemas.test.js test/cli/launcher-commands.test.js
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test
PORTREEVE_SUPERVISOR_LABEL=com.portreeve.test.p6.$$ PORTREEVE_SUPERVISOR_DEFINITION=/tmp/portreeve-p6-supervisor-$$.plist /Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test test/cli/lifecycle-commands.test.js
```

## Broad-suite reconciliation

The normal machine-aware run reports 366 passes and three failures, all in
`test/cli/lifecycle-commands.test.js`. Each failure observes the user's active
`com.portreeve.server` LaunchAgent instead of the fixture's intentionally absent
supervisor. Running that complete file with a unique supervisor label and definition
passes 5 tests and 22 assertions. Therefore all 369 unique repository tests pass across
the normal run plus the isolated lifecycle rerun.

## Pending manual verification

None for the P6 source slice. Desktop quit protection and packaged-app behavior are
deliberately assigned to P7-P9 and are not claimed here.
