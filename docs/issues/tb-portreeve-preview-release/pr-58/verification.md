# Verification - PR #58

**Scope:** slice
**Base:** `8ec88c0e8abd89b2e654e0baa929a2cc5e7d219f`
**Evaluated source:** `46097e47ed08bc5c1aa8b588f468ba1885fdcfbd`
**Toolchain:** Bun 1.3.14 on macOS ARM64

## Verification matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Pinned Bun 1.3.14 completed `bun run check`, including toolchain validation, generated-guide drift checking, and TypeScript checking. A real preview preparation compiled all four CLI targets and packed the client once. |
| Lint and formatting | PASS | Repository-wide ESLint and Prettier checks passed; `git diff --check` passed on the pinned PR diff. |
| Unit tests | PASS | 508 tests and 2,621 assertions passed. Native-evidence coverage includes deterministic ordering, exact target completeness, duplicate rejection, stale source rejection, altered digest rejection, loaded-record stage/matrix consistency, create-once evidence, and no-byte-change aggregation. |
| Integration tests | PASS | Preview `0.1.0-preview.58.2` was prepared from pinned source `46097e4`; the promoted macOS ARM64 executable passed manifest/checksum/format verification, version execution, manual server health/stop, and isolated supervised lifecycle install/start/active-upgrade/restart/stop/uninstall/purge/reinstall. |
| End-to-end/browser | N/A | This slice changes no Desktop renderer or browser surface. |
| Application runtime | PASS | The exact 64,519,394-byte promoted executable with SHA-256 `aa9e95414a27a97e87df44e2c159906ca81b6f47394fc40313bcecb982161627` produced a create-once evidence fragment after real native execution. |
| Known unrelated failures | NONE | All invoked checks passed with the repository-pinned toolchain. |

## Exact commands

```sh
/tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun install --frozen-lockfile
/tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun run check
/tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun scripts/prepare-release.js \
  --channel preview --version 0.1.0-preview.58.2
/tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun \
  scripts/collect-native-release-evidence.js \
  --record dist/releases/0.1.0-preview.58.2/release-record.json
git diff --check \
  8ec88c0e8abd89b2e654e0baa929a2cc5e7d219f..46097e47ed08bc5c1aa8b588f468ba1885fdcfbd
```

## Pending verification

macOS x64 and both Linux targets require their matching hosted runners. This
slice makes those results portable and safely aggregatable; the hosted matrix
that produces all four real fragments remains assigned to P6/P9. Desktop/DMG,
Homebrew cask, publication-adapter, and stable-negative verification also
remain later work.
