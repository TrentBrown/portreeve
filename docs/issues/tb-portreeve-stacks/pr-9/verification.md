# Verification - PR #9

**Pinned diff:**
`ca7b552e4aaf0690b80c554aa20afff7576c40b2..fcb75bfcf7cc93af5f1f412e6c55bd4dcbed2811`
**Toolchain:** pinned native Bun 1.3.14 on macOS ARM64

## Matrix

| Category            | Result | Evidence                                                                                                                                                                                                                   |
| ------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build and typecheck | PASS   | `bun run typecheck` and `bun run build` completed; the compiled binary exposed `stacks resolve` and `stacks snapshot`                                                                                                      |
| Lint                | PASS   | `bun run lint` completed without findings                                                                                                                                                                                  |
| Changed-file format | PASS   | Prettier checked every supported path in the pinned PR diff with the repository ignore file disabled                                                                                                                       |
| Unit tests          | PASS   | Resolution scoping, circular references, host and Docker-network facts, snapshot redaction, stale generations, failed activations, strict parsing, atomic replacement, permissions, and expected-identity rejection passed |
| Integration tests   | PASS   | Live Unix-socket server/client discovery, old-daemon capability refusal, source and compiled Commander CLI flows, npm package contents, and public documentation coverage passed                                           |
| End-to-end/browser  | N/A    | This slice adds no renderer workflow; desktop stack support remains I-6. CLI and client tests exercise the complete P4 public path against a live server                                                                   |
| Application runtime | PASS   | The compiled CLI listed and executed both discovery commands; snapshot file mode writes through the official dependency-free client runtime                                                                                |
| Branch documents    | PASS   | `validate_branch_docs.py`, `lint_issues.py`, `lint_tracker.py`, and `gate_triage.py` all passed after decision promotion                                                                                                   |

## Commands

```sh
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run typecheck
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run lint
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun x prettier \
  --check --ignore-path /dev/null <supported-files-from-pinned-diff>
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run build
./dist/portreeve stacks --help
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test \
  test/stacks/discovery-service.test.js \
  test/runtime/discovery-reader.test.js \
  test/server/server-client.test.js \
  test/cli/stacks.test.js \
  test/protocol/schemas.test.js \
  test/release/documentation.test.js
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test
python3 <workflow-root>/resources/scripts/validate_branch_docs.py \
  docs/issues/tb-portreeve-stacks
python3 <workflow-root>/resources/scripts/lint_issues.py \
  docs/issues/tb-portreeve-stacks
python3 <workflow-root>/resources/scripts/lint_tracker.py \
  docs/issues/tb-portreeve-stacks
python3 <workflow-root>/resources/scripts/gate_triage.py \
  docs/issues/tb-portreeve-stacks
git diff --check
```

## Test Results

- **Focused matrix:** 41 passed, 0 failed, 181 assertions across 6 files.
- **Broad matrix:** 192 passed, 1 accepted baseline failure, 742 assertions across 50
  files.
- **Accepted baseline:** `test/cli/operations.test.js:75` expects `status` to exit `0`,
  while this account's installed launchd state produces the documented state-difference
  exit code `10`. The same environmental failure was accepted with PRs #7 and #8, and
  this pinned diff changes no lifecycle status implementation.

## Portability Note

The gateway rendering fixtures cover macOS `host.docker.internal` and Linux-style
`172.17.0.1` inputs. Native execution was macOS ARM64; checked-in CI and release
workflows remain the Linux and cross-target portability gates.
