# Verification - PR #4

**Scope:** slice
**Base:** `b4f88abf6536ccdbfb28a525fe401b3b0a547f54`
**Head:** `a01bcef31bc442a423b3cf7bcc99cf3c2897691c`

## Matrix

| Category | Result | Evidence |
|---|---|---|
| Build and typecheck | PASS | Native ARM64 Bun 1.3.14 completed `bun run typecheck`; `bun run desktop:package` produced `dist/desktop/Portreeve-darwin-arm64` with Electron 43.2.0 |
| Lint and format | PASS WITH BASELINE NOTE | `bun run lint`, changed-file Prettier, and `git diff --check` passed; aggregate local Prettier also sees an unchanged ignored handoff file and is recorded below |
| Unit tests | PASS | Native ARM64 Bun 1.3.14 passed 141 tests with 523 assertions; the focused desktop slice passed 15 tests with 52 assertions |
| Integration tests | PASS | Exact CLI invocation, timeout/output boundaries, official-client inventory validation, schema rejection, IPC main-frame trust, protocol containment, five-second polling, stale recovery, and sensitive-field reduction passed |
| End-to-end | PASS WITH LIMITED SCOPE | The packaged ARM64 app launched as a real Electron application, loaded only `app://portreeve/index.html`, and exposed the expected accessible Overview/Ports shell and explicit stale/error state |
| Application runtime | PASS | The app verified the bundled `portreeve-v0.1.0-macos-arm64`, rendered absent/unavailable evidence without mutation controls, and quit cleanly |
| Artifact identity | PASS FOR PROVISIONAL INPUT | The nested executable is native ARM64 and its SHA-256 `c1620f62828f2f88a9a57e45f0a5a3c52a2d5effeec0b0e195964a8fd6bfa435` exactly matches the bundled manifest |

## Exact Commands

```text
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run typecheck
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run lint
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test test/desktop
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test
git ls-files -m -o --exclude-standard -z | xargs -0 .cache/tools/bun-1.3.14/bun-darwin-aarch64/bun x prettier --check
git diff --check
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run desktop:package
PORTREEVE_DESKTOP_DIAGNOSTICS=1 dist/desktop/Portreeve-darwin-arm64/Portreeve.app/Contents/MacOS/Portreeve
file dist/desktop/Portreeve-darwin-arm64/Portreeve.app/Contents/Resources/portreeve/portreeve-v0.1.0-macos-arm64
shasum -a 256 dist/desktop/Portreeve-darwin-arm64/Portreeve.app/Contents/Resources/portreeve/portreeve-v0.1.0-macos-arm64
```

## Packaged Inspection

- Electron diagnostics reached `main-entry`, `app-ready`,
  `artifact-verified`, `window-created`, and `renderer-loaded`.
- Accessibility inspection identified the renderer URL as exactly
  `app://portreeve/index.html`.
- The window showed Mode `None`, Installation `Absent`, Supervisor and Socket
  `Unavailable`, and the redacted current inventory error.
- The artifact card labeled version `0.1.0` as a local release candidate that
  is not for distribution and displayed its checksum prefix.
- Earlier interaction in the same slice exercised the Ports tab and its empty
  inventory table while the authority was absent.

## Known Environment Finding

`bun run check` reaches Prettier and reports
`.handoffs/HANDOFF-main-codex-2026-07-30T1214.md`. That historical handoff is
ignored, absent from the pinned PR diff, and intentionally preserved. Every
changed file passes Prettier, while typecheck, ESLint, and the full native test
suite pass independently. No GitHub PR workflow is configured; `release.yml`
runs only by tag or manual dispatch.

## Deferred Release Evidence

This is an unsigned, non-notarized, host-architecture engineering package. It
does not satisfy R8. Published artifact replacement, native x64 packaging,
Developer ID signing, notarization, and public distribution remain explicitly
deferred to P9.
