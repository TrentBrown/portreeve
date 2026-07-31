# Verification - PR #3

**Scope:** slice
**Base:** `a3a1518ec2d2401dc2dcbea4358769e9cdbafde2`
**Head:** `74023e4fef729929b15251e56907f0d9ed82c006`
**Workflow run:** [30593716275](https://github.com/TrentBrown/portreeve/actions/runs/30593716275)

## Matrix

| Category | Result | Evidence |
|---|---|---|
| Build and typecheck | PASS | `bun run check` passed in the GitHub build job and every native job with pinned Bun 1.3.14; local `bun run typecheck` passed |
| Lint and format | PASS | `bun run lint` passed; Prettier passed for every tracked JS, JSON, Markdown, and YAML file; release workflow YAML parsed successfully with Ruby |
| Unit tests | PASS | Native local Bun 1.3.14: `bun test` passed 126 tests with 471 assertions |
| Integration tests | PASS | Release run built six artifacts, verified checksums and formats, packed and consumed the npm client, and exercised the public client/server protocol |
| End-to-end | N/A | No browser or frontend files are in this slice |
| Application runtime | PASS | Native lifecycle install/start/upgrade/restart/stop/uninstall/purge/reinstall passed on macOS ARM64/x64 and Linux ARM64/x64; Homebrew install/version/uninstall passed on both macOS architectures |

## Exact Commands

```text
bunx prettier --check .github/workflows/release.yml test/release/documentation.test.js
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release.yml')"
bun test test/release/documentation.test.js
bun test test/platform/paths.test.js test/supervision/native-adapters.test.js test/supervision/purge.test.js test/supervision/lifecycle-manager.test.js
bun run typecheck
bun run lint
git diff --check

/tmp/.../bun-darwin-aarch64/bun test
git ls-files | rg '\.(js|json|md|ya?ml)$' | .../bun-darwin-aarch64/bun x prettier --check

gh workflow run release.yml --repo TrentBrown/portreeve --ref tb-portreeve-desktop-02-cli-release
gh run watch 30593716275 --repo TrentBrown/portreeve --exit-status
```

## Native Release Results

| Target | Lifecycle | Package-manager smoke |
|---|---|---|
| macOS ARM64 | PASS | Homebrew PASS |
| macOS x64 | PASS | Homebrew PASS |
| Linux ARM64 | systemd-user PASS | N/A |
| Linux x64 | systemd-user PASS | N/A |

The manual dispatch was intentionally untagged, so `release-policy`,
`publish-github`, and `publish-npm` were skipped. It created no public release
artifacts.

## Known Environment Findings

- The machine-wide Bun executable is an obsolete Intel Bun 1.2.18 binary
  running under translation. The repository requires Bun 1.3.14, so the
  unqualified local `bun run check` correctly failed at `toolchain:check`.
- A temporary native Bun 1.3.14 binary then passed all 126 tests. The only
  obstacle to the aggregate local formatting script was the intentionally
  gitignored `.handoffs/` document; formatting every tracked supported file
  passed.
- GitHub-hosted jobs used the pinned native Bun 1.3.14 toolchain and passed the
  complete `bun run check` command.

## Pending Manual Verification

First publication remains pending authenticated npm authority. After PR #3 is
merged, the release operator must configure `NPM_TOKEN`, create the approved
`v0.1.0` tag, inspect the resulting npm package and GitHub Release, configure
npm trusted publishing, and then remove the bootstrap token.
