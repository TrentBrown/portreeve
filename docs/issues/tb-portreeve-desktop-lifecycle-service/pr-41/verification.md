# Verification - PR #41

**Scope:** slice
**Pinned base:** `91f824dc7625701d05001a33dc510fd279e8f5c1`
**Pinned head:** `6e8e645538e7be56b868d4e66da3281c5eee39c0`

## Matrix

| Category | Command | Result |
| --- | --- | --- |
| Build and typecheck | `bun run check` | PASS. Pinned Bun 1.3.14; toolchain check and TypeScript check completed. |
| Lint and format | `bun run check` | PASS. ESLint and Prettier check completed with no findings. |
| Unit and regression tests | `bun run check` | PASS. 420 tests, 2,047 assertions, 0 failures across 88 files. |
| Focused Desktop contract | `bun test test/desktop/package-verification.test.js test/desktop/lifecycle-controller.test.js test/desktop/artifact.test.js` | PASS. 9 tests and 38 assertions cover version drift, module inclusion/exclusion, ASAR markers, direct-controller operations, purge token confinement, and artifact checksums. |
| Dual-runtime contract | `bun run desktop:runtime-verify` | PASS. The same eight-operation direct-controller contract ran under Bun 1.3.14 and Electron Node 43.2.0. |
| Compiled release build | `PORTREEVE_RELEASE_BASE_URL=https://example.invalid/releases PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve bun run release:build` | PASS. Produced the six versioned PortReeve 0.1.0 release artifacts and manifest. |
| Compiled CLI runtime | `bun run release:verify -- --native` | PASS. Verified manifest/checksums/formats and ran the native version plus isolated manual-server health/shutdown smoke. |
| Packaged application runtime | `bun run desktop:package` | PASS. Built the arm64 Electron app, revalidated the checksum-selected embedded executable, inspected `app.asar`, and launched the real `.app` through its isolated read-only status smoke. |
| Packaged icon integrity | `cmp apps/desktop/assets/branding/PortReeve.icns dist/desktop/PortReeve-darwin-arm64/PortReeve.app/Contents/Resources/electron.icns` | PASS. The packaged icon is byte-identical. Electron Packager's existing secondary `.icon`-format warning did not affect the `.icns` payload. |
| API/database integration | N/A | This slice changes build verification and a read-only internal startup mode; no daemon protocol, client API, registry schema, or database flow changes. |
| Browser/Playwright E2E | N/A | No renderer behavior changed. The applicable application-level check is the real packaged Electron startup smoke above. |

## Known Failures and Deferred Checks

No verification failures remain. Real macOS lifecycle mutations, forced
interruption and next-launch recovery, normal-close protection around a live
mutation, and Linux systemd-user lifecycle execution are deliberately deferred
to P7/I-6, the final feature slice.
