# Verification - PR #72

**Pinned diff:**
`e0fc14d458d66312d58a0cfe06949c2365bfcc01..2bf50cfb7a91940910d89c81a7286142bc36a7a6`
**Scope:** feature-final
**Toolchain:** pinned Bun 1.3.14 on macOS ARM64

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | `bun run check` completed its generated-document, typecheck, lint, format, and complete test gates. A real four-target preview.4 release build completed. |
| Lint and format | PASS | ESLint, Prettier, and `git diff --check` completed without findings. |
| Unit tests | PASS | The full repository suite passed: 550 tests, 0 failures, and 2,887 expectations. Focused version, release, Homebrew, and Desktop tests also passed. |
| Integration tests | PASS | A staged client tarball, release manifest, formula, cask inputs, native executable, and packaged Desktop were built from the coordinated version path. |
| End-to-end/browser | N/A | This change does not alter renderer interaction. Packaged Electron launch smoke covers the changed Desktop identity path. |
| Application runtime | PASS | The native arm64 executable reported `0.1.0-preview.4`; `verify-release.js --native` passed; packaged Desktop launch smoke reported preview.4 for Desktop, controller, and bundled artifact. |
| Homebrew semantics | PASS | Homebrew's Ruby `Version` comparator ordered preview.2, preview.3, preview.4, then stable 0.1.0. Generated formula and cask retain preview.4. |
| Apple metadata | PASS | The packaged app kept `CFBundleShortVersionString=0.1.0` while `app.asar` metadata carried `portreeveReleaseVersion=0.1.0-preview.4`. |
| Publication safety | PASS | All release work used local rehearsal directories. No tag, GitHub release, tap update, Desktop update record, or npm publication occurred. Preview.3 was not modified. |
| Branch documents | PASS | Workflow branch validation, issue lint, tracker lint, and decision triage gates passed. |

## Commands

```sh
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run check

PORTREEVE_RELEASE_VERSION=0.1.0-preview.4 \
PORTREEVE_RELEASE_DIRECTORY="$PWD/dist/release-versioning-smoke" \
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run release:build

"$PWD/dist/release-versioning-smoke/portreeve-v0.1.0-preview.4-macos-arm64" --version

PORTREEVE_RELEASE_DIRECTORY="$PWD/dist/release-versioning-smoke" \
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun scripts/verify-release.js --native

/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test \
  test/release/release-version.test.js \
  test/release/release-lib.test.js \
  test/release/prepare-release.test.js \
  test/release/homebrew-smoke.test.js \
  test/release/desktop-distribution.test.js \
  test/desktop/package-verification.test.js \
  test/desktop/release-channel.test.js

brew ruby -e 'require "version"; versions=%w[0.1.0-preview.2 0.1.0-preview.3 0.1.0-preview.4 0.1.0]; puts versions.sort_by { |v| Version.new(v) }'
```

## Concrete Candidate Results

- Native artifact: `portreeve-v0.1.0-preview.4-macos-arm64`
- Native `--version`: `0.1.0-preview.4`
- Client archive: `portreeve-0.1.0-preview.4.tgz`
- Manifest identities: release, software, and client all `0.1.0-preview.4`
- Formula version: `0.1.0-preview.4`
- Desktop release identity: `0.1.0-preview.4`
- Apple short version: `0.1.0`
- Full repository result: 550 passed, 0 failed

## Residual Risk

The exact hosted multi-architecture publication pipeline was not run because that would
create or mutate public release state. Existing protected publication gates remain in
place; the next preview release will exercise them with the coordinated identity.
