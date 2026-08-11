# Verification - PR #50

**Scope:** client-guides slice I-1, pinned diff
`998ce8dda11a0dce5d1504907692a0515e9b19d9..74fa05ce3a8d0f239cc98c4576f60dc6b3947609`

| Category | Command | Result |
| --- | --- | --- |
| Toolchain | Repository checks under pinned Bun 1.3.14 | PASS - Bun 1.3.14 darwin/arm64 |
| Documentation freshness | `bun run docs:check` | PASS - 49 CLI commands and 51 MCP tools current |
| Documentation tests | `bun test test/docs/client-guides.test.js` | PASS - 5 tests, 23 assertions |
| Type check | `bun run typecheck` | PASS |
| Lint | `bun run lint` | PASS |
| Changed-file format | Pinned Bun Prettier over the pinned diff | PASS |
| Unit and integration | `bun test` | PASS - 470 tests, 0 failures, 2,337 assertions across 101 files |
| Build/runtime | `bun run build` | PASS - standalone `dist/portreeve` built |
| Browser/E2E | N/A | No visible Desktop behavior changes in I-1. |

## Deterministic generation observations

- The generated catalogs contain every registered MCP tool and every executable CLI
  leaf command. All 49 CLI leaves have one of the five mandatory safety classes.
- Generation replaces only strict marked regions and produces a committed static
  Desktop bundle. `docs:check` proves the committed Markdown and bundle are fresh.
- Negative tests reject malformed or nested markers, raw HTML including mid-line
  tags, unsafe links, unsupported Markdown, duplicate anchors, and unresolved links.
- The generated Desktop bundle stores one safe authored AST plus structured reference
  catalogs, avoiding a duplicate copy of the large generated schema prose.

## Local formatting note

Repository-wide formatting sees ignored, uncommitted handoff files that are outside
this PR. Every changed file in the pinned diff passes Prettier and those user-owned
handoffs remain untouched.
