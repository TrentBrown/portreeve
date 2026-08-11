# Verification - PR #47

**Scope:** MCP slice I-5, pinned diff
`8d1595ba60b86b154beb6a7e8d510eff1f7bbf17..4c32f2c9a7755109251bad0495597b4ca42d7039`

| Category | Command | Result |
| --- | --- | --- |
| Toolchain | `bun run toolchain:check` under pinned Bun 1.3.14 | PASS - Bun 1.3.14 darwin/arm64 |
| Type check | `bun run typecheck` | PASS |
| Lint | `bun run lint` | PASS |
| Changed-file format | Pinned Bun Prettier over every source file in the pinned diff | PASS |
| Unit and integration | `bun test` | PASS - 457 tests, 0 failures, 2,269 assertions across 97 files |
| Catalog and authority audit | `bun test test/mcp/catalog.test.js` | PASS - exactly 51 frozen tools; excluded shell, listener, resource, and prompt authority absent |
| Launcher custody | `bun test test/mcp/launcher-credential-custody.test.js` | PASS - opaque output, automatic and explicit renewal, extension cap, isolation, expiry, settlement, and close |
| MCP stdio lifecycle | `bun test test/mcp/stdio.test.js` | PASS - 51-tool dual-era discovery plus real snapshot and launcher begin/renew/get/list/complete/replay calls |
| Build/runtime | `bun run build` | PASS - standalone `dist/portreeve` built with the complete MCP catalog |
| Browser/E2E | N/A | No renderer behavior changes in I-5. |

## Known unrelated local failure

`bun run check` reaches and passes toolchain, typecheck, and lint, then stops only
because Prettier finds three ignored local handoff files under `.handoffs/`. Those
files predate this branch, are absent from Git and the PR, and remain intentionally
untouched. Formatting of every file in the pinned PR diff passes.

## Runtime observations

- Legacy and 2026 stateless discovery return exactly the frozen 51-tool catalog:
  22 read tools and 29 mutation-classified tools, all closed-world and idempotent.
- The snapshot tool returns only a typed in-memory endpoint document for an explicit
  activation, component, and gateway host. It does not write or read arbitrary files.
- Launcher begin requires an explicit stack, operation, caller operation ID, and
  launcher revision. PortReeve coordinates ownership but never executes the command.
- Raw launcher credentials remain in one bridge-local vault. Automatic renewal uses
  the earlier of one-third remaining deadline or ten seconds; custody defaults to ten
  minutes, caps at sixty, and ends immediately on completion.
- A real second bridge cannot renew the first bridge's launcher handle. Equivalent
  begin and completion retries return the existing or achieved safe result.
- Launcher history is retained and returned at a maximum of twenty records per stack
  with opaque cursor pages.
