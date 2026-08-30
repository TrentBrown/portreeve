# Verification - PR #82

**Scope:** Feature final, P1-P8 (`I-1` through `I-13`)
**Feature range:** `9c126fb4074072fb1a74039313072256c89d7f72..d5e582520b6a009f1629b5e3daea486aa7a99d07`
**Final-slice range:** `1da97cb2a1983fe416f6abab763e6b4b06222c9f..d5e582520b6a009f1629b5e3daea486aa7a99d07`
**Result:** PASS

## Matrix

| Category | Command or evidence | Result |
|---|---|---|
| Build and typecheck | Repository-pinned Bun 1.3.14 `bun run check`, including toolchain check, generated-document validation, and TypeScript | PASS |
| Lint and formatting | The full check includes ESLint and Prettier; `git diff --check` also passed | PASS |
| Unit and regression tests | Repository-pinned Bun 1.3.14 `bun run check` | PASS - 581 tests, 3,040 expectations, 0 failures |
| Workflow documents | `validate_branch_docs.py`, `lint_issues.py`, `lint_tracker.py --final`, and `gate_triage.py` | PASS |
| Release integration | Hosted run [33281790384](https://github.com/TrentBrown/portreeve/actions/runs/33281790384) from reviewed `main` ran prepare, four preliminary native jobs, qualification, protected production, two native Apple jobs, and trusted finalization | PASS |
| Candidate inspection | Pinned Bun 1.3.14 `release:inspect` on downloaded artifact `9723538117` | PASS - 13 artifacts, 4 native targets, 2 Desktop DMGs, no public mutation |
| Native Apple runtime | Current ARM64 job `99181031696` and x64 job `99181031659` verified their exact signed CLI, app, and DMG sets natively | PASS |
| Application runtime | Both mounted apps passed strict signing, Gatekeeper execution assessment, exact embedded-CLI equality, application smoke, and lifecycle smoke | PASS |
| End-to-end/browser | No browser or renderer interaction changed; hosted CLI/Desktop release lifecycle is the applicable end-to-end path | N/A |
| API/database/cross-repo | No API or database contract changed. Cross-repository after-state checks confirmed Homebrew remained unchanged | PASS / N/A |
| Homebrew disposable smoke | The exact command stopped before mutation because formula and cask `0.1.0-preview.4` are already installed | N/A - safe refusal preserved installed application, service, and data; no replacement or uninstall was authorized |
| Publication | Workflow input was `publish=false`; job `99181252598` was skipped, producer evidence says `publicationAuthority=false`, and all before/after public authorities match | PASS |

The shell-default Bun 1.2.18 correctly failed the repository toolchain guard.
Verification was rerun without dependency changes through the pinned Bun 1.3.14
binary and passed completely; the rejected invocation is not a product failure.

## Trusted packet evidence

- ARM64 signed CLI: 64,537,728 bytes, SHA-256
  `e9915a8d71178bec1b90da3cf6a772e1d150ba48050d80b0105873182e9c217f`.
- x64 signed CLI: 70,245,616 bytes, SHA-256
  `ca5863c97d0c7b237a913ab1705a893404fa5012c731b5ed30a55b62eab741a8`.
- ARM64 DMG: 170,178,882 bytes, SHA-256
  `31ede1d5059bd5ca750810c666e58dfb436623e3762eef7773d713048d23fc90`,
  Apple request `f9666ed3-036e-4893-8e7f-72527f3538fe` accepted.
- x64 DMG: 177,609,992 bytes, SHA-256
  `b74a8d2af4e5c026a083dd5e1bac15b8a31d009658911245b14a9084b5f67b62`,
  Apple request `8802be2d-776b-4726-bbad-e450170eca54` accepted.
- Publication plan SHA-256:
  `ac75019cd5addd954d8611142d6419fc96b0e1b5952fa030f2b23ca7408fee9d`,
  exactly matching the sealed digest file.

## Completion report

- **Build status:** PASS - pinned Bun 1.3.14 full check.
- **Lint status:** PASS - ESLint, Prettier, diff check, and lifecycle validators.
- **Tests written:** Release-record, Apple contract/producer/native evidence,
  packaging, finalization, publication, workflow, and negative recovery tests
  landed across PRs #74-#81.
- **Test suite status:** PASS - 581 tests, 3,040 expectations, 0 failures.
- **Integration verified:** Yes - complete protected hosted matrix plus exact
  downloaded-record inspection and public-state comparison.
- **Application runs:** Yes - both native Apple documents record successful app,
  CLI, quarantine, and lifecycle smoke.
- **Pending manual verification:** None. A personal physical-machine or
  cross-architecture installation remains optional by the approved spec.
- **Feature-record retention:** `tracked`; all 68 current feature-record files
  were tracked at the pinned feature-final source, with no retention decision
  required.

## Known failures

None. Failed previews `.5` through `.9` remain durable, consumed diagnostic
history and were not reused. Preview.10 was one protected attempt and succeeded.
