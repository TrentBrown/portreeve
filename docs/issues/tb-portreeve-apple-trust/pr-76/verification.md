# Verification - PR #76

**Scope:** `d54fdc0056109a5b0e8442da74332f593f9fe5ed..5d89cb14a6064cd65a07a489690be2d86568e02e`

**Verdict:** PASS WITH KNOWN UNRELATED LOCAL FAILURES

## Verification Matrix

| Category | Command | Result |
|---|---|---|
| Toolchain | isolated pinned Bun 1.3.14 baseline binary under `/tmp` | PASS; repository-required `Bun 1.3.14 (darwin/x64)` |
| Documentation | `bun run docs:check` as part of `bun run check` | PASS; generated CLI and MCP documentation current |
| Build/typecheck | `tsc -p jsconfig.json` | PASS after the corrective commit |
| Lint | `eslint .` as part of `bun run check` | PASS |
| Format | `prettier --check .` as part of `bun run check` | PASS |
| Diff hygiene | `git diff --check d54fdc...5d89cb1` | PASS |
| Focused unit/integration | pinned Bun 1.3.14 over release record, protected producer, native Apple evidence, Desktop packaging/finalization, publication, documentation, preparation, and package-verification suites | PASS; 64 tests, 495 expectations, 0 failures across 9 files |
| Workflow docs | `validate_branch_docs.py`, `lint_issues.py`, and `lint_tracker.py` against the cumulative feature home | PASS, PASS, PASS |
| Release integration | source-isolated producer output, signed-identity metadata rewrite, exact native aggregation, trusted finalization, sealed-plan inspection, and publisher preflight | PASS through focused integration and negative-path tests |
| Browser/E2E | frontend runtime behavior | N/A; this slice changes release tooling, workflow orchestration, tests, and documentation only |
| Native Apple runtime | live Developer ID, notarization, staple, Gatekeeper, ARM64, and Intel runner execution | N/A for this slice; implemented collectors are intentionally exercised by protected P8 from reviewed `main` |

## Repository-wide Gate

The repository-wide `bun run check` preserved its real exit status of 1. It
reported 567 passing tests, five failures, and 2921 expectations. Documentation,
typecheck, lint, formatting, and every changed release surface passed. The five
failures are in unchanged launcher, MCP, and CLI paths:

- `test/launcher/command-session.test.js` observed SIGTERM completion before
  the fixture's expected SIGKILL escalation.
- `test/mcp/stdio.test.js` exceeded its five-second local limit.
- `test/cli/launcher-commands.test.js` exceeded its five-second local limit.
- `test/cli/stacks.test.js` and `test/cli/operations.test.js` received this
  host's non-AVX Bun warning before their expected JSON bodies.

None of those files or their launcher/MCP implementation dependencies is in
the pinned PR diff. The failures are recorded rather than converted into a
passing whole-suite claim.

## Corrective Verification

The first boundary review found that the new validator demanded hardened
runtime from a DMG even though the producer correctly records that fact only
for executable code. GateReeve entered remediation before any passage was
claimed. Commit `5d89cb14a6064cd65a07a489690be2d86568e02e`
scopes hardened-runtime enforcement to the CLI and application, keeps DMG
identity, timestamp, Gatekeeper, notarization, and staple checks strict, and
adds a regression fixture for the distinction. Typecheck and the complete
focused suite passed again at that exact corrected source.

## Security and Failure Evidence

- The protected producer remains main-only, read-only, publication-token-free,
  and the sole holder of Apple signing/notarization material.
- Native ARM64 and Intel jobs receive the protected output read-only and each
  create exactly one architecture-bound evidence document.
- Aggregation rejects missing, duplicate, stale, translated, synthetic,
  cross-architecture, or identity-inconsistent evidence.
- The signed CLI transformation rewrites the manifest, Homebrew formula,
  checksums, and release-record identities before any downstream verifier
  consumes the tree.
- Finalization consumes the aggregated exact evidence, writes a create-once
  publication plan and digest, and both inspection and publication reject a
  changed digest.
- Trust and publication jobs retain separate environments, credentials,
  permissions, and approvals. No publication action was executed.
