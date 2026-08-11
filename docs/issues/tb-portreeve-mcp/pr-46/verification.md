# Verification - PR #46

**Scope:** MCP slice I-4, pinned diff
`1f1e2e4ff3961a9808cf3336ad33dd9eda5d6ff0..33d0d07c4876577eab0a1d5da26874b8c7a2d972`

| Category | Command | Result |
| --- | --- | --- |
| Toolchain | `bun run toolchain:check` under pinned Bun 1.3.14 | PASS - Bun 1.3.14 darwin/arm64 |
| Type check | `bun run typecheck` | PASS |
| Lint | `bun run lint` | PASS |
| Changed-file format | Pinned Bun Prettier over every source file in the pinned diff | PASS |
| Unit and integration | `bun test` | PASS - 453 tests, 0 failures, 2,219 assertions across 96 files |
| Receipt service | Receipt and consequential-action tests within the full suite | PASS - five-minute expiry, evidence binding, stale refusal, execute replay, and result persistence |
| MCP stdio | `bun test test/mcp/stdio.test.js` | PASS - 45 registered tools, strict schemas, real settings preview/execute/replay, and modern plus legacy discovery |
| Public socket/client | `bun test test/server/server-client.test.js` | PASS - 28 tests covering every consequential action family |
| Desktop document policy | Desktop stack-document tests within the full suite | PASS - shared canonical path and external-change protection |
| Documentation | `bun test test/release/documentation.test.js` | PASS - updated public socket, client, and MCP contracts |
| Build/runtime | `bun run build` | PASS - standalone `dist/portreeve` built with consequential tools and shared document primitives |
| Browser/E2E | N/A | No renderer behavior changes in I-4. |

## Known unrelated local failure

`bun run check` reaches and passes toolchain, typecheck, and lint, then stops only
because Prettier finds three ignored local handoff files under `.handoffs/`. Those
files predate this branch, are absent from Git and the PR, and remain intentionally
untouched. Formatting of every file in the pinned PR diff passes.

## Runtime observations

- The bridge now advertises 45 tools: 19 read-only and 26 mutation-classified tools.
  Preview tools persist nondestructive receipts; execute tools require the matching
  receipt plus an explicit target.
- Receipt execution retrieves the persisted proposal, recomputes current evidence in
  the daemon, refuses stale evidence, and replays a previously completed result before
  consulting later evidence.
- All seven consequential families are covered: port reclaim; claim reassign, delete,
  and prune; stack definition apply and stack prune; and settings changes.
- Stack-document reads return validated structure and fingerprints, never raw file
  contents. Writes use the fixed `portreeve.stack.json` path, reject links and
  nonregular files, enforce a 1 MiB limit, and atomically compare before replace.
- Unsafe any-owner eviction is intentionally absent.
