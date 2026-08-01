# Verification - PR #6

**Scope:** slice
**Base:** `e1f05e865fe264b8cdf83828de8fc635481f08d5`
**Head:** `5a5fba2153aa5f14bf1616d63ef40de4ab51abe6`

## Matrix

| Category | Result | Evidence |
|---|---|---|
| Build and typecheck | PASS | Native ARM64 Bun 1.3.14 completed `bun run typecheck`; the final source packages to `dist/desktop/Portreeve-darwin-arm64` with Electron 43.2.0 |
| Lint and format | PASS WITH BASELINE NOTE | ESLint, changed-scope Prettier, and `git diff --check` pass; aggregate `bun run check` continues to report only the unchanged ignored handoff described below |
| Unit tests | PASS | The complete native suite passed 160 tests with 610 assertions and no failures |
| Network integration | PASS | Request capture proves the single fixed URL has no query, body, credentials, or referrer; timeout, HTTP/schema failure, persisted cadence, invalid cache, and streamed 16 KiB body bounds pass |
| IPC and navigation | PASS | A trusted main-frame, no-argument capability is the only route to the fixed GitHub Releases page; renderer-selected URLs and navigation when no update is available are rejected |
| Nonblocking integration | PASS | Coordinator coverage proves local lifecycle and port refresh publishes before update discovery settles and update failure remains separate from local stale/error evidence |
| Application runtime | PASS WITH LIVE-ENDPOINT LIMITATION | The packaged ARM64 application launched at `app://portreeve/index.html`, showed update information unavailable without blocking Overview or Ports, refreshed local evidence, and exposed no download action |
| Persistence and privacy | PASS | Packaged execution wrote only `status`, `checkedAt`, and `latestVersion` to `~/Library/Application Support/Portreeve Desktop/update-state.json` with mode `0600` |

## Exact Commands

```text
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run typecheck
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run lint
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun x prettier --check apps/desktop/main/update.js apps/desktop/main/coordinator.js apps/desktop/main/index.js apps/desktop/main/ipc.js apps/desktop/preload apps/desktop/renderer apps/desktop/shared test/desktop docs/desktop-updates.md distribution/desktop-update.json docs/issues/tb-portreeve-desktop/issues.md docs/issues/tb-portreeve-desktop/scratchpad.md
git diff --check e1f05e865fe264b8cdf83828de8fc635481f08d5..5a5fba2153aa5f14bf1616d63ef40de4ab51abe6
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run desktop:package
```

## Packaged Inspection

- The accessibility tree identified the renderer URL as exactly
  `app://portreeve/index.html`.
- Overview rendered `Update information is unavailable. Local Portreeve
  management is unaffected.` because the fixed raw-main manifest is not live
  until this PR merges.
- No download button was exposed in the unavailable state. Local lifecycle
  controls and Ports remained rendered, and Refresh advanced the local
  observation timestamp while update state stayed unavailable.
- The resulting private state file was mode `0600` and contained only the
  reduced unavailable result. It was created by this inspection and left in
  place rather than removed through an unrequested destructive action.
- The package was rebuilt after commit `5a5fba2`, which changed only bounded
  manifest streaming and its regression test; the inspected UI path is
  otherwise unchanged.

## Known Limitations

- The manifest cannot report `available` from the fixed production URL until
  `distribution/desktop-update.json` reaches `main`. The available-state
  presentation, fixed navigation, and IPC refusal paths are deterministic-test
  evidence rather than a packaged live-endpoint recording in this boundary.
- The package is unsigned, unnotarized, and host-architecture ARM64 engineering
  output. Published CLI identity, x64 execution, signing, notarization, and the
  complete release lifecycle remain P9/R8.
- Repository-wide `bun run check` still reports only the unchanged ignored
  `.handoffs/HANDOFF-main-codex-2026-07-30T1214.md` in its aggregate Prettier
  step. Every PR #6 source and evidence path passes the scoped formatter.
