# Verification - PR #21

**Scope:** desktop stack editor draft model and serializer

**Pinned diff:**
`0654648f3ef348ed02c1cbbbb58ecc528a57d268..4fb4a5c41eab3e6878d9941f32ddd341829cc4e6`

**Toolchain:** repository-pinned Bun 1.3.14 on macOS ARM64

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | `bun run check` passed the pinned toolchain check and `tsc -p jsconfig.json` |
| Lint and format | PASS | Repository-wide ESLint and Prettier checks passed; `git diff --check` passed on the pinned source diff |
| Unit tests | PASS | The complete suite passed 253 tests and 1,084 assertions across 57 files; the focused editor-model and desktop-security suite passed 13 tests and 64 assertions |
| Integration tests | N/A | P5 adds a pure renderer model and changes no IPC, filesystem, database, server, or public protocol contract; P4 trusted-boundary integration remains green in the full suite |
| End-to-end/browser | N/A | P5 intentionally exposes no visible renderer entry point; interactive form coverage belongs to P6-P8 |
| Application runtime | N/A | The model is not loaded by the current renderer until P6; packaged runtime verification would not exercise this slice |
| Branch documents | PASS | Workflow branch-document, issue, tracker, and decision-triage validators pass for the cumulative feature record |

## Commands

```sh
PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run check

/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 test \
  test/desktop/stack-editor-model.test.js \
  test/desktop/security.test.js

git diff --check \
  0654648f3ef348ed02c1cbbbb58ecc528a57d268..4fb4a5c41eab3e6878d9941f32ddd341829cc4e6

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

- New drafts prefill only the editable project name and permit incomplete topology.
- Full v1 definitions round-trip component names, Docker service names, endpoint
  publish/required flags, automatic/preferred/exact host-port policies, optional
  container ports, dependency aliases, targets, and required flags.
- Dependencies store stable local component and endpoint identities. Provider renames
  update generated references without rewriting the dependency records.
- Referenced component or endpoint deletion reports every affected consumer and refuses
  mutation until the caller explicitly confirms the cascade.
- Untouched invalid controls stay quiet, touched controls expose their own issues, and
  submit returns the complete issue list plus the first invalid control identity.
- Invalid intermediate drafts retain the latest valid preview. Valid preview bytes are
  exactly the bytes returned for saving: concise two-space JSON with a final newline,
  omitted schema defaults, and editor record order even for integer-like names.
- Serialized output parses successfully through the authoritative strict stack schema;
  nested endpoint maps avoid delimiter-based identity collisions.
- The renderer model imports no Node, filesystem, shell, server, storage, socket, or
  network capability.

## Known failures and manual checks

- **Known unrelated failures:** none.
- **Pending manual verification:** none within P5. The visible editor, accessible focus
  movement, deletion dialog, preview presentation, and save/apply interaction remain
  explicitly assigned to P6-P8.
