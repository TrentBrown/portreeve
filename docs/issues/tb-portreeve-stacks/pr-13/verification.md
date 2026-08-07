# Verification - PR #13

**Scope:** feature-final

**Complete feature diff:**
`8e14a33c42fa59bd1909555d4e9bbe7dffde48eb..16b5395a1ca0f0c4e04662da2c30a04ed2655fa2`

**Focused final slice:**
`0fc3865867a3dd0af9ad1485f2fcb4160cddce60..16b5395a1ca0f0c4e04662da2c30a04ed2655fa2`

**Toolchain:** pinned Bun 1.3.14; local macOS ARM64 plus GitHub-hosted native matrix

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | The pinned repository gate, standalone six-artifact build, native executable checks, lifecycle checks, Homebrew formula checks, and Electron packaging complete without errors |
| Lint and format | PASS | ESLint, repository-wide Prettier verification, and `git diff --check` pass |
| Unit tests | PASS | 225 tests and 930 assertions pass across definitions, allocation, migrations, evidence, discovery, recovery, CLI, client, desktop, supervision, security, and release policy |
| Integration tests | PASS | Unix-socket protocol, official JavaScript client, Commander CLI, SQLite migrations, process confirmation, Docker confirmation without a userspace listener, snapshot publication, and desktop adapters pass together |
| End-to-end/native | PASS | One disposable mixed process/Docker stack completes apply through history-retaining prune on macOS Docker Desktop and both Linux architectures |
| Application runtime | PASS | The unsigned packaged macOS ARM64 app launches against the supervised service with healthy Overview evidence and renders the Stacks inspection/apply/prune surface |
| Cross-platform release | PASS | GitHub run [31213447475](https://github.com/TrentBrown/portreeve/actions/runs/31213447475) passes build plus native macOS x64/ARM64 and Linux x64/ARM64 jobs; tag-only publication jobs skip |
| Branch documents | PASS | Branch-doc, issue, tracker, decision-triage, PR-context, feature-final retention, and pending-packet validators pass |

## Commands

```sh
BUN=/tmp/portreeve-bun-1.3.14.XG7gfn/bun-darwin-aarch64/bun

"$BUN" run check
"$BUN" test test/stacks/docker-evidence.test.js test/server/server-client.test.js
"$BUN" run stacks:verify

PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve \
PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download \
  "$BUN" run release:build
"$BUN" run release:verify -- --native --lifecycle
"$BUN" run release:verify -- --homebrew

PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve \
PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download \
  "$BUN" run desktop:package

gh workflow run release.yml --ref tb-portreeve-stacks-07-feature-final
gh run watch 31213447475 --exit-status

python3 <workflow-root>/resources/scripts/validate_branch_docs.py \
  docs/issues/tb-portreeve-stacks
python3 <workflow-root>/resources/scripts/lint_issues.py \
  docs/issues/tb-portreeve-stacks
python3 <workflow-root>/resources/scripts/lint_tracker.py \
  docs/issues/tb-portreeve-stacks --final
python3 <workflow-root>/resources/scripts/gate_triage.py \
  docs/issues/tb-portreeve-stacks
```

## Native assembled result

The local macOS Docker Desktop run produced a confirmed mixed activation, distinct
process and Docker ports, component-scoped resolution, a redacted sandbox snapshot,
live-provider end refusal, active and lost reconciliation, explicit ending, missing-
worktree pruning, and retained `stack.pruned` history. Its exact disposable process,
container, authority home, worktree, snapshot, and runtime paths were removed.

The first hosted Linux run
[31212030145](https://github.com/TrentBrown/portreeve/actions/runs/31212030145)
failed on both architectures after the container became HTTP-reachable because Docker
Engine used kernel NAT without a userspace listener. The source boundary corrects the
false platform assumption: exact fresh Docker identity, labels, running state, loopback
publication, host port, and container port are authoritative for Docker, while `lsof`
remains authoritative for processes and corroborating Docker inventory evidence. The
two subsequent hosted matrices, including the final exact-SHA run, pass on both Linux
architectures.

## Desktop manual result

`dist/desktop/Portreeve-darwin-arm64/Portreeve.app` launched successfully. Overview
reported supervised, installed, active, healthy, and version `0.1.0` across desktop,
managed CLI, and running server layers. The Stacks tab rendered the project-owned
launcher boundary, Apply definition and Prune stale stacks controls, and its empty-state
guidance. The smoke inspection made no service or stack mutation.

## Known failures and manual checks

- **Known unrelated failures:** none.
- **Pending manual verification:** none for this feature. Signing, notarization, npm
  trusted publishing, release tags, and public distribution remain deliberately
  deferred release operations rather than stack-feature verification gaps.
