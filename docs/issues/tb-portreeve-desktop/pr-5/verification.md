# Verification - PR #5

**Scope:** slice
**Base:** `75c463705bb5ff96b9c4bb411789959e3e81c7ac`
**Head:** `42fe1efdec01fdb47d3a30987daf1470c5aa3e1f`

## Matrix

| Category | Result | Evidence |
|---|---|---|
| Build and typecheck | PASS | Native ARM64 Bun 1.3.14 completed `bun run typecheck`; `bun run desktop:package` produced `dist/desktop/Portreeve-darwin-arm64` with Electron 43.2.0 |
| Lint and format | PASS WITH BASELINE NOTE | ESLint, changed-scope Prettier, and `git diff --check` pass; aggregate Prettier continues to report only the unchanged historical handoff recorded by PR #4 |
| Unit tests | PASS | The complete native suite passed 149 tests with 558 assertions; the focused desktop suite passed 23 tests with 87 assertions |
| Integration tests | PASS | Fixed CLI argv, strict mutation envelopes, one-shot main-process purge-token confinement, official-client inventory validation, selected-evidence reduction, mutation/refresh serialization, partial onboarding, adapter failure recovery, state/action derivation, SemVer upgrade ordering, and user-data separation pass |
| End-to-end | PASS WITH LIMITED MUTATION SCOPE | The packaged ARM64 app launched at `app://portreeve/index.html`, rendered the absent onboarding state, opened and cancelled Install and Start, expanded the danger zone, kept unavailable uninstall disabled, and rendered an exact refused reset preview without executing a lifecycle or deletion mutation |
| Application runtime | PASS | The packaged app verified the bundled ARM64 CLI, displayed independent desktop/bundled/managed/running versions, exposed only the expected absent-state action, and quit cleanly |
| Packaged data boundary | PASS | Live verification found an initial Electron/CLI home collision, then the corrected package wrote Chromium data to `~/Library/Application Support/Portreeve Desktop`; the existing CLI home modification time did not change during the corrected launch |
| Artifact identity | PASS FOR PROVISIONAL INPUT | The nested executable is native ARM64 and SHA-256 `c1620f62828f2f88a9a57e45f0a5a3c52a2d5effeec0b0e195964a8fd6bfa435`, matching the provisional manifest |

## Exact Commands

```text
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun x prettier --check apps/desktop/README.md apps/desktop/main apps/desktop/preload apps/desktop/renderer apps/desktop/shared test/desktop docs/issues/tb-portreeve-desktop/issues.md docs/issues/tb-portreeve-desktop/scratchpad.md
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run typecheck
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run lint
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test test/desktop
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run desktop:package
git diff --check
file dist/desktop/Portreeve-darwin-arm64/Portreeve.app/Contents/Resources/portreeve/portreeve-v0.1.0-macos-arm64
shasum -a 256 dist/desktop/Portreeve-darwin-arm64/Portreeve.app/Contents/Resources/portreeve/portreeve-v0.1.0-macos-arm64
```

## Packaged Inspection

- The accessibility tree identified the sole renderer URL as exactly
  `app://portreeve/index.html`.
- Overview showed Mode `None`, Installation `Absent`, Supervisor and Socket
  `Unavailable`, Desktop `0.1.0`, Bundled CLI `0.1.0`, and no managed/running
  version.
- Install and Start opened a modal explaining installation, native
  supervision, and service start. The operation was cancelled; no mutation ran.
- The reset preview displayed its exact paths and a marker refusal while the
  execution field and Delete button remained disabled.
- Isolated review found that normal rendering re-enabled an absent-state
  Uninstall button. Commit `d93e619` fixed the ordering, added a direct
  uninstall-state matrix, and the repackaged accessibility tree reports
  `button (disabled) Uninstall service`.
- Code review found prerelease upgrade ordering was lexicographic. Commit
  `42fe1ef` implements SemVer precedence and covers numeric prerelease and build
  metadata cases.
- The reset refusal revealed historical Electron cache files in the CLI home
  from the earlier package. The source now sets a distinct desktop `userData`
  directory and a repackaged launch populated only `Portreeve Desktop`. The
  pre-existing CLI-home cache files were deliberately not deleted or moved.

## Known Limitations

- A destructive packaged reset and native install/start/upgrade/uninstall cycle
  were not executed against the developer's real user account. The exact CLI
  contracts already pass native lifecycle matrices from PRs #2-#3; this slice
  adds adapter/coordinator/UI tests and safe packaged confirmation/preview
  inspection without changing host supervision.
- The package is unsigned, unnotarized, and host-architecture ARM64 engineering
  output. Published input replacement, x64 desktop execution, signing,
  notarization, and the complete release lifecycle remain P9.
- Repository-wide `prettier --check .` still reports the unchanged ignored
  `.handoffs/HANDOFF-main-codex-2026-07-30T1214.md`; every PR #5 source and
  evidence path passes the scoped formatter.
