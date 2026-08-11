# Verification - PR 39

**Scope:** slice
**Base:** `6e2b36359d3ecc788ed6f328bf24fd2f30366f32`
**Head:** `7efceb1c2fe0adbea0d457579d00b4b355f1240d`
**Toolchain:** Bun 1.3.14 on macOS arm64; direct-controller smoke through the available Node executable

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Pinned Bun 1.3.14 completed `bun run typecheck` and `bun run build`; the standalone executable was emitted at `dist/portreeve`. Bun also bundled the Electron main entry with 127 modules and no unresolved import. |
| Lint and formatting | PASS | `bun run lint`, `bun run format:check`, and `git diff --check` completed without findings. |
| Unit tests | PASS | The full suite passed 411 tests with 2,004 assertions. Focused Desktop controller, coordinator, renderer-state, view-model, and security coverage passed 26 tests with 137 assertions. |
| Integration tests | PASS | The direct controller exercises status, every lifecycle mutation, purge preview/execution, one-use token confinement, fixed artifact provenance, mismatch refusal, and preservation of stack operations. Five CLI lifecycle tests with 22 assertions pass while a real PortReeve launchd service is active. |
| End-to-end/browser | N/A | I-3 changes the Electron main authority and a small renderer compatibility presentation. DOM state and source-contract tests cover the visible mismatch path; packaged interactive Desktop verification is explicitly assigned to I-5/P6. |
| Application runtime | PASS | The full suite includes the compiled standalone CLI. The Electron main entry bundled successfully, and Node imported and constructed the direct controller's mismatch boundary successfully. |
| Native platform | PARTIAL | Deterministic launchd and systemd-user adapter tests pass. The formerly host-sensitive CLI fixture now uses unique supervisor labels/units and passes without stopping the developer's live service. Real macOS/Linux lifecycle and packaged Desktop gates remain I-5/I-6. |
| Branch documents | PASS | The I-3 decision was promoted, issues/tracker were reconciled, and deterministic workflow document validators pass. |

## Commands

```text
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run check
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run build

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test \
  test/desktop/lifecycle-controller.test.js \
  test/desktop/view-model.test.js \
  test/desktop/renderer-state.test.js \
  test/desktop/coordinator.test.js \
  test/desktop/security.test.js

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test \
  test/cli/lifecycle-commands.test.js

pr39_bundle_dir="$(mktemp -d)"
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 build \
  apps/desktop/main/index.js --target=node --format=esm \
  --external electron --outdir "$pr39_bundle_dir"

node --input-type=module --eval \
  "import and construct createDesktopLifecycleController mismatch smoke"
```

## Known unrelated failures

None in the final pinned source.

An initial pre-commit full run exposed that `test/cli/lifecycle-commands.test.js`
could observe the developer's real active launchd label while using temporary
data and socket paths. The evaluated source fixes that isolation defect by
injecting unique native supervisor identities. The final full run passes while
the legitimate user service remains running.

## Manual checks

None required for I-3 review. Packaged Desktop identity inspection, interactive
Desktop smoke behavior, normal-close protection, real launchd/systemd-user
mutation, and forced-interruption recovery remain explicit I-4 through I-6
work and prevent feature-level completion.
