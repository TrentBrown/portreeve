# Branch Tracker - tb-portreeve-release-versioning

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-18

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | CLI coordinated version | PASS | [#72](https://github.com/TrentBrown/portreeve/pull/72) | Preview.4 native filenames and runtime `--version` were verified from the local release candidate. |
| R2 | Client and Homebrew coordinated version | PASS | [#72](https://github.com/TrentBrown/portreeve/pull/72) | Tarball, formula, cask, manifest, and Homebrew ordering retain the full prerelease. |
| R3 | Desktop coordinated release identity | PASS | [#72](https://github.com/TrentBrown/portreeve/pull/72) | Packaged metadata and launch smoke report preview.4 while the Apple short version remains numeric. |
| R4 | Source compatibility guard | PASS | [#72](https://github.com/TrentBrown/portreeve/pull/72) | Unit and preparation tests reject a release whose semantic core differs from source. |
| R5 | Release safety and regression coverage | PASS | [#72](https://github.com/TrentBrown/portreeve/pull/72) | Full 550-test gate, focused release suites, native smoke, and Desktop smoke passed without publication. |

## PR Log

Append PR boundary entries here.

### PR #72 - Coordinated preview release identity

- **Status:** in review
- **Packet:** [`pr-72/boundary.json`](pr-72/boundary.json)
- **Source:** `e0fc14d458d66312d58a0cfe06949c2365bfcc01..2bf50cfb7a91940910d89c81a7286142bc36a7a6`
- **Scope:** feature-final; all five rubric criteria pass and the feature record is tracked.
