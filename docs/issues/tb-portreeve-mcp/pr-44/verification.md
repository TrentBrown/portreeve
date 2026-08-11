# Verification - PR #44

**Scope:** MCP slice I-2, pinned diff
`80659a4492f0c507491335daa85a0f9b2a7abbb6..b8d5a1dd915334932d474978ec7cb5f7fe75d4bd`

| Category | Command | Result |
| --- | --- | --- |
| Toolchain | `bun run toolchain:check` | PASS - Bun 1.3.14 darwin/arm64 |
| Type check | `bun run typecheck` | PASS |
| Lint | `bun run lint` | PASS |
| Changed-file format | Pinned Bun Prettier over every changed file | PASS |
| Unit and integration | `bun test` | PASS - 439 tests, 0 failures, 2,133 assertions across 95 files |
| MCP stdio | `bun test test/mcp/stdio.test.js` | PASS - legacy, modern stateless, unavailable, incompatible, retry, and SIGTERM coverage |
| Public reads | Server/client/storage tests within full suite | PASS - filtered claims, generations, and activations |
| Build/runtime | `bun run build` | PASS - standalone `dist/portreeve` built with MCP bridge |

## Known unrelated local failure

The global `bun run check` stops only when Prettier encounters three ignored local
handoff files in `.handoffs/`. They predate this branch, are absent from Git and the
PR, and remain intentionally untouched. The pinned typecheck, lint, full suite, build,
and formatting of every PR file pass.

## Runtime observations

- Standard output contains parseable MCP frames only; bridge diagnostics use stderr.
- The official SDK accepts both a 2025-era initialize sequence and the 2026-07-28
  per-request stateless envelope with `server/discover`.
- Diagnostics remain callable with no daemon or an incompatible daemon. Daemon-backed
  tools fail with stable structured codes, and one long-lived bridge succeeds after
  the daemon starts without reconnecting the MCP host.
- Every collection defaults to 50, caps at 200, and returns an opaque cursor. The
  fifteen registered tools are read-only, idempotent, closed-world operations.
