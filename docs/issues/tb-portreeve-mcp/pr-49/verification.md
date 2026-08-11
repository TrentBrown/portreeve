# Verification - PR #49

**Scope:** feature-final MCP evaluation pinned to
`a237358c710509dc14a337f87a4641641a985a94..df50f0633d4e145c6ba7d1461db916598e53d4d8`;
final slice pinned to
`cde5e6c812de0105ba353d67706993a92f27f4f3..df50f0633d4e145c6ba7d1461db916598e53d4d8`.

| Category | Command | Result |
| --- | --- | --- |
| Toolchain | `bun run toolchain:check` under pinned Bun 1.3.14 | PASS - Bun 1.3.14 darwin/arm64 |
| Type check | `bun run typecheck` | PASS |
| Lint | `bun run lint` | PASS |
| Changed-file format | Pinned Bun Prettier over every final-slice source and documentation file | PASS |
| Full repository suite | `bun test` | PASS - 465 tests, 0 failures, 2,314 assertions |
| Release build | `bun run release:build` with release metadata inputs | PASS - four standalone executables, npm package, formula, manifest, and checksums |
| Native release | `bun run release:verify --native` | PASS - six release artifacts and compiled macOS ARM64 daemon/bridge |
| MCP release matrix | `bun run mcp:release-verify --docker` | PASS - exact/portable setup for three hosts; modern and legacy MCP; two concurrent bridges; absent/incompatible daemons; macOS ARM64 plus Linux ARM64/x64 under Docker |
| Real MCP hosts | `bun scripts/verify-mcp-release.js --hosts` | PASS - installed Codex 0.146.0 and Claude Code 2.1.220 each invoked `portreeve_diagnostics` through the compiled bridge |
| Desktop runtime | `bun run desktop:runtime-verify` | PASS - direct-controller contract under Bun 1.3.14 and Electron 43.2.0 |
| Packaged Desktop | `bun run desktop:package` | PASS - ASAR identity, MCP main/preload/renderer surface, embedded artifact, and read-only launch smoke |
| Docker activation | `bun run stacks:verify` | PASS - real mixed process/Docker activation confirmed, resolved, reconciled, ended, pruned, and retained history |

## Required failure and safety coverage

- The compiled bridge keeps MCP stdout frame-pure and serves exactly 51 tools in
  both the maintained `2025-11-25` initialization era and stateless
  `2026-07-28` discovery era.
- Compiled diagnostics remain callable with an absent or protocol-incompatible
  daemon; daemon operations return stable unavailable or incompatible errors.
- Two simultaneous compiled bridges observe the same daemon PID and receive
  distinct bridge run IDs.
- Full-suite credential tests prove lease and launcher tokens never cross MCP,
  persistence, history, setup, or Desktop boundaries; expiry, extension limits,
  settlement, replay, bridge isolation, and bridge-exit cleanup pass.
- Full-suite receipt tests prove five-minute expiry, evidence staleness,
  mismatched targets, single execution, durable result replay, document
  fingerprints, and process/Docker evidence changes.
- Canonical document traversal, symlink, size, conflict, and external-edit tests
  pass, as do cursor bounds, history bounds, snapshot redaction, and excluded
  authority audits.

## Known unrelated local failure

The aggregate `bun run check` is not used as evidence because its repository-wide
Prettier phase includes three ignored local handoff documents under `.handoffs/`
that predate this branch and are absent from Git. Typecheck, lint, all 465 tests,
release and Desktop gates, and formatting of every tracked final-slice file pass.

## Environment note

Docker Desktop initially attempted to resolve the missing Linux x64 image through a
stalled local credential helper. The public multi-architecture Node image was pulled
anonymously with an isolated Docker configuration; the durable verifier now uses
`--pull never`, so compatibility runs are deterministic and never contact a registry.
