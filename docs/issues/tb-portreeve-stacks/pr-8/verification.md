# Verification - PR #8

**Pinned diff:**
`13db6838357fdd3e94b896f7498727651b9f5e64..958182c72addae5bea294109d4f695ad3a68d426`
**Toolchain:** pinned native Bun 1.3.14 on macOS ARM64

## Matrix

| Category            | Result | Evidence                                                                                                                                                                                                                                                                |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build and typecheck | PASS   | `bun run typecheck` and `bun run build` completed; the compiled binary exposed the complete `stacks` command family                                                                                                                                                     |
| Lint                | PASS   | `bun run lint` completed without findings                                                                                                                                                                                                                               |
| Changed-file format | PASS   | Prettier checked every path in the pinned PR diff with the repository ignore file disabled                                                                                                                                                                              |
| Unit tests          | PASS   | Generation reuse and immutability, concurrent preparation, exact rollback, preferred fallback, stale revisions and stale run evidence, batch renewal, expiry and cancellation, required dependency promotion, endpoint outcomes, audit history, and ending tests passed |
| Integration tests   | PASS   | Schema-v4 migration, concurrent activation, real Unix-socket server/client process confirmation, old-server capability refusal, source CLI, npm tarball, and documentation endpoint coverage passed                                                                     |
| End-to-end/browser  | N/A    | This slice adds no renderer workflow; desktop stack support remains I-6. The CLI test exercises apply, prepare, generation inspection, begin, abandon, activation inspection, and end through a live server                                                             |
| Application runtime | PASS   | Compiled runtime and standalone Commander CLI tests passed under pinned Bun 1.3.14; `dist/portreeve stacks --help` exposed every new command                                                                                                                            |

## Commands

```sh
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run typecheck
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run lint
git diff --name-only -z \
  13db6838357fdd3e94b896f7498727651b9f5e64..958182c72addae5bea294109d4f695ad3a68d426 \
  | xargs -0 .cache/tools/bun-1.3.14/bun-darwin-aarch64/bun x prettier \
      --check --ignore-path /dev/null
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run build
./dist/portreeve stacks --help
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test
```

## Test Result

- **183 passed** across 48 files.
- **1 accepted baseline failure:** `test/cli/operations.test.js:75` expects `status` to
  exit `0`, while the installed launchd state on this account correctly produces the
  state-difference exit code `10`. The same environmental failure was reproduced and
  accepted on the PR #7 base and no code in this slice changes lifecycle status.
- **704 assertions** were evaluated.

## Portability Note

This local boundary was executed on macOS ARM64. The repository's checked-in release
workflow remains the native Linux and cross-target portability gate.
