# Verification - PR #1

**Scope:** `c9995782662ec1de08f648022ad412ecb00ac84f` through
`b37c2ed311b5a3f42f9ac1fa0ee4a225fd5d40af`

## Current source gate

| Category | Command | Result |
|----------|---------|--------|
| Dependency lock | `bun ci` with Bun 1.3.14 on macOS ARM64 | PASS; 84 installs across 103 packages, no changes |
| Format | `bun run format` | PASS; no changes |
| Typecheck, lint, format, unit and integration | `bun run check` | PASS; 104 tests, 365 assertions |
| Release workflow regression | `bun test test/release/documentation.test.js` after permission hardening | PASS; 4 tests, 28 assertions |
| Diff integrity | `git diff --cached --check` before each commit | PASS |
| Credential scan | staged scan for private-key, GitHub, npm, and AWS credential patterns | PASS; no matches |

The 104-test gate includes compiled-runtime, Unix-socket server/client, SQLite
migration and concurrency, real TCP bind and `lsof` inspection, process
lineage, SIGTERM/SIGKILL reclamation, administration, CLI JSON and exit-code
contracts, native-supervisor adapters, release metadata, npm consumer, and
no-telemetry tests.

## Workflow document gates

| Command | Result |
|---------|--------|
| `validate_branch_docs.py docs/issues/tb-portreeve-initial-release` | PASS |
| `lint_spec.py docs/issues/tb-portreeve-initial-release` | PASS |
| `lint_issues.py docs/issues/tb-portreeve-initial-release` | PASS |
| `lint_tracker.py docs/issues/tb-portreeve-initial-release` | PASS |
| `gate_triage.py docs/issues/tb-portreeve-initial-release` | PASS |

## Preserved cross-platform and release evidence

- The complete source gate previously passed natively on Linux ARM64.
- Exact standalone artifacts passed foreground and native-supervisor smokes on
  macOS ARM64, macOS x64 under Rosetta, and Linux ARM64 with a real systemd
  user manager.
- Linux ARM64 and x64 standalone artifacts passed clean glibc-container
  command and protocol smokes; Linux x64 container execution is supplemental
  emulated evidence rather than the required authoritative native job.
- The generated Homebrew formula installed, ran, and removed the checksummed
  macOS artifact in a temporary tap.
- The dependency-free npm tarball installed and ran in a clean Node consumer;
  `npm publish --dry-run --ignore-scripts --access public ./packages/client`
  passed.

## Known external blockers

The slice is fit for draft review, but feature completion and publication are
not claimed. R8 remains `NOT YET` until:

1. a self-hosted Linux ARM64 runner labeled `portreeve-release` executes the
   authoritative release matrix;
2. the repository is public so Homebrew can fetch GitHub release assets
   anonymously; and
3. npm publication credentials are configured and verified.

No release tag, GitHub Release, Homebrew publication, or npm publication was
performed.
