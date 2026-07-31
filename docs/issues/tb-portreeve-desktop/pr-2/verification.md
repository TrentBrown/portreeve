# Verification - PR #2

**Scope:** slice
**Base:** `2e1ed01d038ae94b1a296e18229d15f00ffa9f55`
**Head:** `3b5bb6b59678313fe1486d9998d29f8cfb78e2a3`
**Evaluated:** 2026-07-30

## Matrix

| Category | Result | Command and evidence |
|---|---|---|
| Build/typecheck | PASS | Pinned Bun 1.3.14 `bun run typecheck`; TypeScript checked `jsconfig.json` without errors. `bun run release:build` produced the six expected release artifacts. |
| Lint | PASS | Pinned Bun 1.3.14 `bun run lint`; ESLint completed without findings. |
| Format | PASS | Pinned Bun 1.3.14 `bun x prettier --check` over every changed source, test, documentation, and feature-record file; all matched files passed. |
| Unit tests | PASS with unrelated host exception | Focused lifecycle, ownership, purge, schema, version, CLI-program, and compiled-runtime command: 33 pass, 1 unrelated host failure, 153 assertions. All changed-logic tests passed, including paths added during shutdown, retained supervisor definitions, nested migration contents, and invalid confirmation tokens. The full suite reached 110 pass and the same two known unrelated host failures described below. |
| Integration tests | PASS | Compiled standalone CLI exercised manual status, supervised-only stop refusal, explicit `stop-manual`, purge preview, evidence-token execution, and root removal. |
| Native runtime | PASS | `PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download bun run release:build && bun run release:verify -- --native --lifecycle`; verified six `0.1.0` artifacts and a temporary macOS x64 LaunchAgent lifecycle through install, start, active reinstall, restart, stop, uninstall with data preservation, purge, and clean reinstall. |
| Browser/frontend E2E | N/A | This prerequisite slice has no desktop renderer or browser surface. |
| Workflow document gates | PASS | `validate_branch_docs.py`, `lint_spec.py`, `lint_issues.py`, `lint_tracker.py`, and `gate_triage.py` all passed for `docs/issues/tb-portreeve-desktop`. |

## Focused test command

```sh
/Users/trent.brown/.bun/install/cache/bun-darwin-x64-baseline-v1.3.14 test \
  test/cli/lifecycle.test.js \
  test/cli/operations.test.js \
  test/cli/program.test.js \
  test/platform/ownership.test.js \
  test/runtime/compiled-cli.test.js \
  test/supervision/lifecycle-manager.test.js \
  test/supervision/lifecycle-schemas.test.js \
  test/supervision/purge.test.js \
  test/supervision/version.test.js
```

## Known unrelated host failures

1. `test/cli/operations.test.js` spawns the Bun source CLI and expects stderr to
   contain only its JSON error document. On this non-AVX host, both available
   Bun installations prepend their own CPU compatibility warning to the child
   stderr stream, so `JSON.parse` encounters `warn` before the Portreeve JSON.
   The same run passes the changed lifecycle, purge, compiled CLI, and manager
   assertions.
2. `test/reclamation/service.test.js` has a pre-existing real-process timing
   race: the stubborn-child case times out while `lsof` can still report the
   killed PID. It reproduces when run independently and no reclamation source
   file changed in this slice.

Neither failure is waived as a product behavior failure; both remain recorded
for host/tooling follow-up. They do not contradict the P1-P3 evidence.

## Pending evidence

- Native Linux systemd-user lifecycle and purge verification remains part of
  P4/I-3 and keeps R2 from passing at this boundary.
- Desktop, packaging, signing, notarization, ARM64, and user-interface
  verification are outside this slice and remain P5-P10.
