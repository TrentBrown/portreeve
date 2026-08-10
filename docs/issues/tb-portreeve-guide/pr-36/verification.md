# Verification - PR #36

**Scope:** feature-final
**Base:** `78c5e201138b036f4cfea33cb50d22f5644ed5a3`
**Evaluated source:** `5f78614c82b7015bdf3abbca10403e0070b2ffd6`
**Toolchain:** Bun 1.3.14 on macOS arm64

## Verification matrix

| Category | Result | Evidence |
|---|---|---|
| Build and typecheck | PASS | Pinned Bun 1.3.14 completed `bun run typecheck`; `bun run release:build` generated the release directory. |
| Lint | PASS | Pinned Bun 1.3.14 completed `bun run lint` with no findings. |
| Changed-file formatting | PASS | Pinned Prettier checked every changed source, test, public-doc, and feature-record path; `git diff --check` also passed. |
| Focused unit/regression tests | PASS | Five affected suites passed 19 tests and 238 assertions, covering Guide markup, navigation, Launchers naming, renderer security, local protocol packaging, and public documentation. |
| Broad test suite | PASS WITH ENVIRONMENT LIMITATION | 387 of 390 tests passed with 1,821 assertions. The three failures are pre-existing environment-sensitive CLI lifecycle tests that require no native supervisor; this developer account currently has the real `com.portreeve.server` launchd agent active. No changed Guide file is imported by those tests. |
| API/database integration | N/A | This renderer-only feature changes no main-process, preload, IPC, client, server, protocol, database, or migration contract. Existing protocol and security suites pass. |
| Desktop package | PASS | A fresh release was built, and `bun run desktop:package` produced `dist/desktop/PortReeve-darwin-arm64/PortReeve.app`. Packaging retained an existing non-blocking Electron warning about the `.icns` input being skipped as an `.icon` format. |
| Application runtime | PASS | The freshly packaged application opened against the running per-user server. Its primary navigation showed Overview, Ports, Stacks, Launchers, Guide. Guide selection hid runtime evidence and the four other primary sections. |
| Responsive and accessible smoke | PASS | The packaged Guide was inspected at its normal width and resized to the 720-pixel supported minimum. Integration cards and the architecture reflowed to one column without clipping; the accessibility tree exposed headings, lists, figure content, and six native disclosures. The first disclosure expanded and exposed its content. |

## Exact commands

```sh
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run typecheck
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run lint
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 x prettier --check \
  .agentic-workflow.json \
  apps/desktop/renderer/index.html \
  apps/desktop/renderer/renderer.js \
  apps/desktop/renderer/styles.css \
  docs/desktop.md \
  docs/issues/tb-portreeve-guide \
  test/desktop/guide-view.test.js \
  test/desktop/launcher-view.test.js \
  test/release/documentation.test.js
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test \
  test/desktop/guide-view.test.js \
  test/desktop/launcher-view.test.js \
  test/desktop/security.test.js \
  test/desktop/protocol.test.js \
  test/release/documentation.test.js
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test
PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve \
PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download \
PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run release:build
PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run desktop:package
```

## Known unrelated failures

Repository-wide `bun run check` also reaches the successful typecheck and lint stages,
then stops because Prettier finds two ignored handoff documents written before this
branch:

- `.handoffs/HANDOFF-logo-exploration-codex-2026-08-09T0842.md`
- `.handoffs/HANDOFF-main-codex-2026-08-08T1338.md`

Those local coordination files are intentionally preserved and are not present in the
pinned PR diff. The broad suite's three lifecycle failures likewise come from the real
active launchd service, whose `mainPid` was detected in fixtures that expect an
unsupervised account. The service was not stopped or altered for this test run.

## Pending manual verification

None required before review. A human content/design review of the Guide remains the
purpose of the draft PR.
