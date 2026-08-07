# Verification - PR #14

**Scope:** contract and server slice

**Pinned diff:**
`04ccf2e0ce436614b33bc4d71f42600da160d28f..561812e264ab70b930afa245b239bb9cde82a491`

**Toolchain:** repository-pinned Bun 1.3.14 on macOS ARM64

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | `bun run check` passed the pinned toolchain check and `tsc -p jsconfig.json` |
| Lint and format | PASS | ESLint, repository-wide Prettier check, and `git diff --check` passed |
| Unit tests | PASS | The complete suite passed 232 tests and 958 assertions across 54 files |
| Integration tests | PASS | Raw and official-client Unix-socket stack apply/list flows, SQLite persistence, overlap/adoption/liveness invariants, CLI JSON contracts, pruning, and reduced desktop schemas passed together |
| End-to-end/browser | N/A | This slice changes contracts and existing labels but introduces no new renderer workflow; dedicated editor interaction is scheduled for P6-P7 |
| Application runtime | PASS | The compiled standalone CLI integration in the full suite exercised the real server and updated stack contract; packaged desktop acceptance is reserved for P7-P8 |
| Branch documents | PASS | Branch-doc, issue, tracker, decision-triage, and PR-context validators pass at this boundary |

## Commands

```sh
PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run check

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test \
  test/cli/stacks.test.js \
  test/cli/operations.test.js \
  test/reclamation/service.test.js

python3 <workflow-root>/resources/scripts/validate_branch_docs.py \
  docs/issues/tb-portreeve-desktop-stack-builder
python3 <workflow-root>/resources/scripts/lint_issues.py \
  docs/issues/tb-portreeve-desktop-stack-builder
python3 <workflow-root>/resources/scripts/lint_tracker.py \
  docs/issues/tb-portreeve-desktop-stack-builder
python3 <workflow-root>/resources/scripts/gate_triage.py \
  docs/issues/tb-portreeve-desktop-stack-builder
```

## Focused behavior proven

- Stack requests, responses, list filters, client types, CLI output, desktop reduced
  models, history, pruning, and current public documentation use `stackRoot`.
- Standalone claims continue to use and canonicalize `workspaceRoot` independently.
- Both the official client and raw server resolve the exact selected directory without
  substituting a child Git repository root; missing paths and files are refused.
- Obsolete `workspaceRoot` stack request fields and list filters are rejected rather
  than silently treated as aliases or unfiltered queries.
- Equal, ancestor, and descendant registrations are refused transactionally; siblings
  succeed, and child-repository claims are not adopted by an enclosing stack.
- A live activation accepts the current definition idempotently but refuses a changed
  revision before discovery can become stale.

## Known failures and manual checks

- **Known unrelated failures:** none under the native repository-pinned runtime.
- **Pending manual verification:** none for this contract/server slice. The field editor,
  packaged desktop workflow, signing, notarization, publication, and release tags are
  outside this PR.
