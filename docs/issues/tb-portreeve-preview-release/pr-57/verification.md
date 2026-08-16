# Verification - PR #57

**Scope:** slice
**Base:** `a8e7da6906d9200a5a8719b03f88d8ca6ee73346`
**Evaluated source:** `b3aa0663579100c3b1ecc60bffb2995abd38f725`
**Toolchain:** Bun 1.3.14 on macOS ARM64

## Verification matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Repository-pinned Bun 1.3.14 completed `bun run check`, including toolchain validation and TypeScript checking. |
| Lint and formatting | PASS | `bun run check` completed ESLint and repository-wide Prettier checks; `git diff --check` passed. |
| Unit tests | PASS | The broad suite passed 502 tests and 2,597 assertions. New release-record and preparation tests cover policy, ordered stages, approval binding, strict persisted-record validation, artifact tampering, dirty source, immutability, interruption, and exact-source resume. |
| Integration tests | PASS | A real release build compiled all four macOS/Linux ARM64/x64 executables, packed the client, generated formula/checksums/manifest, and passed native macOS executable, lifecycle, and Homebrew verification. |
| End-to-end/browser | N/A | This slice changes no user-facing Desktop or browser surface. |
| Application runtime | N/A | The runtime product is unchanged; the affected release runtime was exercised through the compiled executable and native lifecycle smoke. |
| Known unrelated failures | NONE | All invoked checks passed with the pinned toolchain. |

## Exact commands

```sh
/tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun install --frozen-lockfile
/tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun run check
PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download \
PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve \
  /tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun run release:build
/tmp/portreeve-bun-1.3.14/bun-darwin-aarch64/bun run release:verify -- \
  --native --lifecycle --homebrew
```

## Pending verification

The complete feature still requires native evidence on Linux ARM64/x64 and
macOS x64, dual-architecture Desktop/DMG packaging, cask verification, hosted
workflow rehearsal, and final publication-adapter dry runs. Those are tracked
in later plan steps and are not claimed by this slice.
