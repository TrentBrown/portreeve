# Verification - PR #80

**Scope:** Slice 11, P2/P4/P7/P8 (`I-12`)
**Pinned base:** `2042850b8f8573e6b1b77c4c41ead68677cebae9`
**Pinned source:** `181028b2a0e8d2bfc75b70799dea9440b7b958c8`
**Result:** PASS

## Matrix

| Category | Command or evidence | Result |
|---|---|---|
| Build and typecheck | `bun run check` includes toolchain validation, generated-document validation, and `tsc -p jsconfig.json` | PASS |
| Lint and formatting | `bun run check` includes `eslint .` and `prettier --check .`; `git diff --check` also passed | PASS |
| Unit tests | `bun test test/release/apple-trust-producer.test.js test/release/documentation.test.js` | PASS - 25 tests, 303 expectations |
| Integration tests | The producer staging test constructs a qualified predecessor artifact set, overlays signed CLI bytes, executes the real authoritative metadata rewrite, and proves both signed output consistency and untouched input authority | PASS |
| Broad regression | `bun run check` | PASS - 579 tests across 118 files, 3,034 expectations, 0 failures |
| End-to-end/browser | Not applicable: this slice changes a hosted release producer and operator contract, not a browser or renderer flow | N/A |
| Application runtime | Not applicable before merge: the changed path runs only in the protected macOS release environment; no credentials or Apple requests are used at this boundary | N/A |
| Manual/protected verification | Dispatch `0.1.0-preview.9` with `channel=preview`, `trust=true`, and `publish=false` only after PR #80 lands on reviewed `main` | PENDING FINAL SLICE |

## Corrected failure contracts

- Trusted staging begins from one untouched predecessor manifest and performs
  exactly one authoritative predecessor-to-signed rewrite.
- Request-bound notarization candidates remain available until the full
  producer record and `apple-trust-producer.json` evidence are durable.
- `GITHUB_RUN_ATTEMPT > 1` is rejected before credential activation or Apple
  submission; operators dispatch the next unused preview instead of using
  GitHub **Re-run jobs**.
- Publication authority remains absent and installer topology remains separate
  ARM64 and x64 DMGs.

## Known failures

None. The full check completed without failures or new warnings.
