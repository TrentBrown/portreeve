# Verification - PR #66

**Scope:** feature final
**Pinned feature range:** `b13ccd5d8a86dcf36dfaf6986ab7214fcd74face..6d304b9d9c5adeeef6927f2f5ac3919bccd3d404`
**Pinned slice range:** `95a221670e19f859ae872aab3aa895341ce2e0d0..6d304b9d9c5adeeef6927f2f5ac3919bccd3d404`

## Verification matrix

| Category | Command | Result | Evidence |
|---|---|---|---|
| Toolchain | pinned Bun 1.3.14 `toolchain:check` through `bun run check` | PASS | Exact required Bun executed as native macOS ARM64. |
| Generated docs | `bun run docs:check` through `bun run check` | PASS | 49 CLI commands and 51 MCP tools are current. |
| Typecheck | `bun run typecheck` through `bun run check` | PASS | Complete JavaScript module graph checked with no errors. |
| Lint | `bun run lint` through `bun run check` | PASS | No ESLint findings. |
| Format | `bun run format:check` through `bun run check` | PASS | All matched files use Prettier style. |
| Focused release suite | publication, adapter, record, documentation, and PR-state tests | PASS | 43 focused tests passed before final sequencing correction; the affected publication suite then passed 9/9. |
| Broad suite | pinned Bun 1.3.14 `bun run check` | PASS | 542 tests across 114 files, 2,852 assertions, 0 failures at the pinned head. |
| Hosted/public mutation | N/A | N/A | Verification deliberately performs no release, PR merge, tag, tap update, or Desktop metadata mutation. The next authorized release exercises the live GitHub path. |
| Application runtime/UI | N/A | N/A | Release tooling, workflow, and documentation only; daemon and Desktop runtime behavior are unchanged. |

## Changed behavior exercised

- The GitHub Release remains the first publication surface and is verified immutably.
- Homebrew and Desktop metadata adapters contain no direct-main Git or contents-API
  mutation path and pass exact candidate bytes to the shared PR publisher.
- Plan SHA-256, source commit, deterministic branch identity, allowlisted paths, file
  checksums, mergeability, merge commit, destination bytes, and cleanup are enforced.
- Exact absent, open, merged, blocked, transient, partial, and cleanup-retry states are
  deterministic and fail closed on conflicting evidence.
- Adapter provenance is validated before the next publication surface may run.
- New approvals and completions require both PR URLs and verified merge commits.
- A serialized legacy completed record remains readable without invented PR identity;
  a legacy partial approval cannot silently change transport.
- Only the environment-gated publish job declares `contents: write` and
  `pull-requests: write`; preparation stays read-only and secret-free.
- The plan, runbook, credential guidance, recovery instructions, and release skill all
  describe the implemented PR sequence and external-review fallback.

## Known failures

The first broad attempt used the shell's Bun 1.2.18 and was correctly rejected by the
repository's 1.3.14 toolchain guard before tests ran. A generic `npx ... run check`
attempt then exposed npm's `npm_execpath`, so the final run invoked the exact cached Bun
1.3.14 binary and set `npm_execpath` to that same binary. This changed no dependencies
or repository policy. The pinned full run passed.

## Pending manual verification

None required for merge. Live GitHub API behavior is intentionally deferred to the next
explicitly authorized release because exercising it would create public release and PR
state.
