# Verification - PR #48

**Scope:** MCP slice I-6, pinned diff
`a9fc44d9bc2897c1a1a9cf16779aa55861c686ef..f25f36837356f17304d4ba21ba568c43368381f0`

| Category | Command | Result |
| --- | --- | --- |
| Toolchain | `bun run toolchain:check` under pinned Bun 1.3.14 | PASS - Bun 1.3.14 darwin/arm64 |
| Type check | `bun run typecheck` | PASS |
| Lint | `bun run lint` | PASS |
| Changed-file format | Pinned Bun Prettier over every source and documentation file in the pinned diff | PASS |
| Unit and integration | `bun test` | PASS - complete repository suite, zero failures |
| Setup contracts | `bun test test/mcp/setup.test.js test/cli/mcp-setup-commands.test.js test/desktop/mcp-setup.test.js test/desktop/ipc.test.js` | PASS - all host formats, exact/portable modes, labels, IPC rejection, and Desktop setup surfaces |
| CLI runtime | `bun src/cli/main.js mcp setup --host codex --portable --label codex-local --json` | PASS - valid versioned Codex setup without daemon access |
| Compiled runtime | `./dist/portreeve mcp setup --host codex --portable --label compiled-check --json` after `bun run build` | PASS - standalone executable contains the setup generator |
| Browser/Desktop E2E | Deferred to I-7 | The final slice owns packaged Desktop launch and real-host compatibility; I-6 has static renderer, strict IPC, preload, main-adapter, and security tests. |

## Known unrelated local failure

The aggregate `bun run check` is not used as evidence because its repository-wide
Prettier phase includes three ignored local handoff documents under `.handoffs/` that
predate this branch and are absent from Git. Typecheck, lint, the full test suite, and
formatting of every file in the pinned PR diff pass.

## Runtime observations

- Generic JSON, Codex TOML, and Claude Code JSON all carry the same exact stdio command
  and argument vector.
- Exact mode resolves the stable managed executable path in trusted CLI or Electron
  main-process code. Portable mode emits only bare `portreeve`.
- The CLI generator is pure and works while the daemon is absent. Desktop combines
  the same preview with reduced daemon compatibility evidence.
- Renderer requests contain only host, portable, and optional label. Unknown fields,
  injected paths, unknown hosts, and malformed labels are rejected before generation.
- Copying is the only output-side Desktop capability. No Codex or Claude file is read
  or written, and no host or project command is launched.
