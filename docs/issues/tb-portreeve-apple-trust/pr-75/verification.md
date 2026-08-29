# Verification - PR #75

**Scope:** `0de186b584be0ef4318c34cba5169dc1c5a76dd1..f12b1241b9cb7f0aac609b36bc130821106766b6`

**Verdict:** PASS WITH KNOWN UNRELATED LOCAL FAILURES

## Verification Matrix

| Category | Command | Result |
|---|---|---|
| Toolchain | isolated pinned Bun 1.3.14 baseline binary under `/tmp` | PASS; repository-required `Bun 1.3.14 (darwin/x64)` |
| Documentation | `bun run docs:check` as part of `bun run check` | PASS; 49 CLI commands and 51 MCP tools current |
| Build/typecheck | `tsc -p jsconfig.json` | PASS |
| Lint | `eslint` over every changed JavaScript and test file | PASS |
| Format | `prettier --check .` | PASS |
| Diff hygiene | `git diff --check` | PASS |
| Focused unit/integration | pinned Bun 1.3.14 over Desktop artifact/package, Apple trust contract/producer, release preparation/record/native evidence/Desktop distribution, and workflow-source suites | PASS; 62 tests, 415 expectations |
| Workflow docs | `validate_branch_docs.py`, `lint_issues.py`, and `lint_tracker.py` against the cumulative feature home | PASS, PASS, PASS |
| Real Desktop package | `bun scripts/package-desktop.js --release-directory dist/release --output /tmp/portreeve-slice2-desktop --arch x64 --no-smoke` | PASS; exact x64 application produced |
| Application structure | executable/helper checks plus `codesign --verify --deep --strict --verbose=4` | PASS; one executable CLI under flat `Contents/Helpers`, none under `Contents/Resources`, x86_64, version 0.1.0, deep strict signature valid |
| Mounted DMG runtime | `createAndVerifyDesktopDmg(...)` for the real x64 application | PASS; 174659613-byte DMG, SHA-256 `eaf7c978b65edd9ab81ce4b77f8f55de7b14b985bfbbd1331687a5826bf72c14`; mount re-ran package, architecture, signature, and helper identity verification |
| Cross-architecture hardware | Native ARM64 execution | N/A for this slice; optional by explicit user decision and deferred to hosted evidence slices P5/P7-P8 |
| Live Apple credentials | Developer ID/notary protected run | N/A for this slice; no credential access is authorized before reviewed code reaches `main`, and protected rehearsal is P8 |

## Repository-wide Gate

`bun run check` preserved its real exit status of 1. All documentation,
typecheck, lint, formatting, release, Desktop, and Slice 2 tests passed. The run
reported 563 passing tests and five failures in unchanged launcher/MCP/CLI test
areas:

- `test/launcher/command-session.test.js` observed prompt SIGTERM completion
  instead of requiring SIGKILL escalation.
- `test/mcp/stdio.test.js` and
  `test/cli/launcher-commands.test.js` exceeded their five-second local limits.
- `test/cli/stacks.test.js` and `test/cli/operations.test.js` received this
  host's non-AVX Bun warning on stderr before an expected JSON body.

The three timing-sensitive failures were rerun separately and remained local
runtime/timing behavior; the command-session test passes under the host's
installed Bun 1.2.18, while the pinned baseline produces the prompt SIGTERM
result. None of the five failing files or their launcher/MCP implementation
dependencies is changed in the pinned PR diff. These failures are recorded,
not converted into a passing whole-suite result.

## Security and Failure Evidence

- Public identity, Team ID, key ID, issuer ID, and product key name are
  validated before credential decoding.
- Failure injection proves partial certificate-import setup still restores the
  original keychain list, deletes the ephemeral keychain, and removes the
  private temporary directory.
- Workflow-source assertions prove qualification precedes the protected job;
  the job is main-only, Apple Silicon, `contents: read`, nonpublishing, and has
  exactly one intentional upload root.
- The protected producer signs each macOS CLI once, compares the same bytes and
  Developer ID facts after application signing and after mounting the final
  DMG, and removes its work and credential roots on every exit path.
