# Verification - PR #15

**Scope:** deterministic CLI discovery slice

**Pinned diff:**
`757bb1a3b554fd3aa630ef5294761baeaefb4389..279f5f11bb585c4eb3a3c2f8e67070fd4c4c4415`

**Toolchain:** repository-pinned Bun 1.3.14 on macOS ARM64

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | `bun run check` passed the pinned toolchain check and `tsc -p jsconfig.json` |
| Lint and format | PASS | Repository-wide ESLint and Prettier checks passed; `git diff --check` passed before the source commits |
| Unit tests | PASS | The complete suite passed 235 tests and 976 assertions across 55 files; `test/cli/stack-selection.test.js` covers nearest-file, explicit-root, selector-conflict, path-boundary, and invariant behavior |
| Integration tests | PASS | Source and compiled CLIs applied from one child Git repository under a non-Git parent, reported status from another, and retained status after the definition was removed; source CLI tests also prove explicit file/root selection and missing-file apply refusal |
| End-to-end/browser | N/A | This slice changes the CLI and documentation only; no renderer workflow changes |
| Application runtime | PASS | `test/runtime/compiled-cli.test.js` built the standalone executable, ran a real server, initialized two actual child Git repositories, applied through upward discovery, removed the file, and resolved status through registered state |
| Branch documents | PASS | Workflow branch-document, issue, tracker, and decision-triage validators pass for the cumulative feature record |

## Commands

```sh
/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run check

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test \
  test/cli/stack-selection.test.js \
  test/cli/stacks.test.js \
  test/runtime/compiled-cli.test.js \
  test/release/documentation.test.js

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

- Implicit apply and status start from the current real directory and choose the nearest
  enclosing `portreeve.stack.json`; Git repository boundaries never redefine the root.
- `stacks apply --stack-root PATH` reads the conventional file from exactly that root,
  while `--file PATH` uses the selected file's parent. Supplying both is invalid input.
- If no definition is present, status uses the one registered root containing the
  current real directory. Path-boundary tests prevent prefix lookalikes from matching,
  and conflicting enclosing records surface the violated non-overlap invariant.
- Apply has no database fallback. With the file removed, implicit apply exits `50` and
  reports how to provide a file or root.
- Human help text, JSON behavior, CLI documentation, and the mixed process/Docker
  example agree with the implemented resolution order.

## Known failures and manual checks

- **Known unrelated failures:** none.
- **Pending manual verification:** none for P3. Desktop field editing, packaged desktop
  interaction, signing, notarization, publication, and release tags remain later scope.
