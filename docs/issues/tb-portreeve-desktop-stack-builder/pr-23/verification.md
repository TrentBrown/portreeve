# Verification - PR #23

**Scope:** feature-final P1-P8 / I-1-I-7 assembled desktop stack builder

**Complete feature diff:**
`04ccf2e0ce436614b33bc4d71f42600da160d28f..c71eb051b498e60191e4f4faf58f5bf3fa441a58`

**Focused PR diff:**
`bd70b34bffdcb5115527278c7ac42fb63f49cf83..c71eb051b498e60191e4f4faf58f5bf3fa441a58`

**Toolchain:** repository-pinned Bun 1.3.14 on macOS ARM64

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | Exact pinned source passed the repository toolchain check and `tsc -p jsconfig.json`; release assembly produced all six release artifacts; Electron packaging produced `dist/desktop/Portreeve-darwin-arm64` |
| Lint and format | PASS | Exact pinned source passed repository-wide ESLint, Prettier, and `git diff --check` |
| Unit tests | PASS | Exact pinned source passed 300 tests and 1,288 assertions, including stack root, editor model/view, document safety, protocol, client, CLI, server, storage, lifecycle, and documentation suites |
| Integration tests | PASS | The full suite exercises the official client through the Unix socket and SQLite registry, compiled Node/Bun consumers, filesystem races, process lineage, Docker evidence adapters, lifecycle supervision, and npm-package assembly |
| End-to-end/runtime | PASS | `stacks:verify` completed a real mixed process/Docker activation; native release verification exercised installation and lifecycle; the packaged macOS app created, saved/applied, reopened, and displayed an explicitly unprepared stack |
| Public documentation | PASS | README, protocol, client, CLI, stack, desktop, safety, migration, troubleshooting, and mixed-stack guidance describe one canonical non-Git-capable root, project launcher authority, and desktop file ownership |
| Branch documents | PASS | Feature structure, issues, final tracker, and decision-triage validators pass; Decision 10 was explicitly approved and promoted |
| Retention | PASS | `feature_final.py` reports `tracked`: every current cumulative feature-record file is in Git, so no human retention decision is required |

## Commands

```sh
PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run check

PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve \
PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download \
PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run release:build

PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run stacks:verify

PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run release:verify -- --native --lifecycle

PORTREEVE_BUN_BINARY=/Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 \
  /Users/trent.brown/.bun/install/cache/bun-darwin-aarch64-v1.3.14 run desktop:package

git diff --check \
  04ccf2e0ce436614b33bc4d71f42600da160d28f..c71eb051b498e60191e4f4faf58f5bf3fa441a58

python3 <workflow-root>/resources/scripts/validate_branch_docs.py \
  docs/issues/tb-portreeve-desktop-stack-builder
python3 <workflow-root>/resources/scripts/lint_issues.py \
  docs/issues/tb-portreeve-desktop-stack-builder
python3 <workflow-root>/resources/scripts/lint_tracker.py --final \
  docs/issues/tb-portreeve-desktop-stack-builder
python3 <workflow-root>/resources/scripts/gate_triage.py \
  docs/issues/tb-portreeve-desktop-stack-builder
```

## Packaged desktop acceptance

The exact packaged app at
`dist/desktop/Portreeve-darwin-arm64/Portreeve.app` opened against the matching
supervised 0.1.0 service. The Stacks tab exposed **Create or Edit Stack…**, **Apply
definition…**, and **Prune stale stacks…**. Selecting a disposable non-Git root
prefilled only its basename, and adding component `api` plus endpoint `http` produced a
current exact JSON preview. **Save and Apply** wrote and registered the definition,
returned `saved-and-applied`, and retained explicit `Not prepared` generation evidence.
**Edit Definition** reopened the complete clean form. The app then quit normally.

The disposable project was moved recoverably to the user's Trash. A dry-run stack prune
identified only that deleted-root test record, and the confirmed prune removed its stack
and claim while retaining history. The matching release candidate was reinstalled and
restored to healthy supervised service after the exact full test gate.

## Active-host port evidence

Two invalid preliminary runs demonstrated the original test race rather than product
failure. Kernel-selected ports 59353 and 59358 were acquired by Windsurf language server
PID 22141 after the probes closed. A predictable low-band correction then lost port
21060 to legitimate VS Code Code Helper PID 9498. Fresh `lsof` evidence was honored in
both cases; neither process was signaled. The approved final helper samples
non-repeating unpredictable ports from 10240-32767, verifies each with a real bind, and
skips occupied candidates. Exact pinned full and focused gates pass with this helper.

## Known failures

None under the pinned Bun 1.3.14 toolchain and exact source SHA. A shell-default Bun
1.2.18 run was rejected by the repository toolchain check and its AVX warning polluted
child JSON stderr; it is invalid evidence and not a Portreeve failure.
