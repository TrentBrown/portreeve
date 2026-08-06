# Verification - PR #10

**Pinned diff:**
`f16addf71026c8fe8fdc231d20154f451e4b9624..885ffc5c00fd21ea1fdc43e39974bdb850ca12ba`
**Toolchain:** pinned native Bun 1.3.14 on macOS ARM64; Docker Desktop 4.55.0
with Linux Engine 29.1.3

## Matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Build and typecheck | PASS | The repository `check` gate ran the pinned toolchain check and TypeScript checking without errors |
| Lint and format | PASS | ESLint and repository-wide Prettier verification completed without findings |
| Unit tests | PASS | Adapter normalization, stopped/stale/mislabeled/mismapped/missing evidence, capability absence, protocol unions, schema migration, mixed activation, and reclamation refusal tests pass |
| Integration tests | PASS | Official socket client and Commander CLI apply, prepare, begin, and confirm Docker-backed endpoints; process-only behavior remains available without Docker |
| End-to-end/browser | N/A | This slice adds no renderer workflow; desktop Stacks views remain I-6/P7 |
| Application runtime | PASS | A real temporary Docker Desktop container completed apply, prepare, begin, exact labeling, loopback publication, socket confirmation, and Docker-managed inventory; it was then stopped and auto-removed |
| Branch documents | PASS | Branch-doc, issue, tracker, and decision-triage validators pass for the PR boundary |

## Commands

```sh
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun run check

/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun test \
  test/docker/adapter.test.js \
  test/stacks/docker-evidence.test.js \
  test/server/server-client.test.js \
  test/reclamation/service.test.js \
  test/cli/stacks.test.js \
  test/protocol/schemas.test.js \
  test/storage/registry.test.js

docker version --format '{{json .}}'
/Users/trent.brown/.npm/_npx/60c3515df86f25b1/node_modules/.bin/bun \
  .cache/docker-e2e-smoke.js

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

## Results

- **Complete repository gate:** 206 passed, 0 failed, 817 assertions across 52 files.
- **Native Docker smoke:** activation `confirmed`; inventory `docker-managed`; the exact
  64-character container ID and allocated loopback port matched fresh Docker inspection.
- **Cleanup:** the temporary `portreeve-p5-e2e-20260806` and
  `portreeve-smoke-p5-20260806` containers were stopped with `--rm`; follow-up inventory
  found neither container.
- **Known unrelated failures:** none under the pinned Bun 1.3.14 toolchain. The prior
  installed-launchd test baseline was removed by isolating the test's HOME and native
  supervisor configuration from the developer's real Portreeve installation.

## Portability Note

The native run exercised macOS Docker Desktop talking to its real ARM64 Linux Engine and
validated macOS host-listener behavior. Deterministic adapter tests cover unavailable and
malformed CLI behavior without a platform dependency. A native Linux-host Docker smoke
remains a portability concern for CI/release validation; no Linux-specific contract or
alternate command path is introduced by this slice.
