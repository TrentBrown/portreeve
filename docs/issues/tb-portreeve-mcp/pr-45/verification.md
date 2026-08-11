# Verification - PR #45

**Scope:** MCP slice I-3, pinned diff
`500c6559bd314c893bf7177815f72234b315641d..8a875b30ecc79914c3012e42370af9f4771a3934`

| Category | Command | Result |
| --- | --- | --- |
| Toolchain | `bun run toolchain:check` under pinned Bun 1.3.14 | PASS - Bun 1.3.14 darwin/arm64 |
| Type check | `bun run typecheck` | PASS |
| Lint | `bun run lint` | PASS |
| Changed-file format | Pinned Bun Prettier over every source file in the pinned diff | PASS |
| Unit and integration | `bun test` | PASS - 448 tests, 0 failures, 2,180 assertions across 96 files |
| Credential custody | `bun test test/mcp/credential-custody.test.js` | PASS - opaque output, TTL cadence, isolation, atomic rollback, sibling settlement, extension bounds, expiry, and close |
| MCP stdio lifecycle | `bun test test/mcp/stdio.test.js` | PASS - standalone and three-endpoint stack lifecycle, retry replay, cross-bridge refusal, bridge-exit recovery, modern and legacy framing |
| Public socket contract | Allocation and server/client tests within the full suite | PASS - standalone renewal requires a valid pending-lease token and returns no credential |
| Build/runtime | `bun run build` | PASS - standalone `dist/portreeve` built with coordination tools and custody cleanup |
| Browser/E2E | N/A | No frontend or browser behavior changes in I-3. |

## Known unrelated local failure

`bun run check` reaches and passes toolchain, typecheck, and lint, then stops only
because Prettier finds three ignored local handoff files under `.handoffs/`. Those
files predate this branch, are absent from Git and the PR, and remain intentionally
untouched. Formatting of every file in the pinned PR diff passes.

## Runtime observations

- The bridge now advertises 29 tools: 17 read-only and 12 ordinary idempotent
  mutations, all with closed-world annotations and strict input/output schemas.
- Raw lease tokens appear only inside the process-local custody module and official
  socket-client calls. MCP structured content and text summaries contain only random
  43-character handles and safe lease metadata.
- A second bridge cannot use the first bridge's handle. Equivalent same-bridge
  retries return `changed: false` with the existing or achieved result.
- Pending leases renew by the earlier of one-third remaining TTL or ten seconds.
  Custody defaults to ten minutes, activation custody caps at sixty minutes from
  acquisition, and endpoint settlement removes all credentials the daemon settled
  atomically.
- Closing a bridge stops renewal. After normal daemon expiry, another caller can
  acquire the released port, proving lost-custody recovery without credential
  persistence.
