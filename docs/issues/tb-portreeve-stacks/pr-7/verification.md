# Verification - PR #7

**Scope:**
`8e14a33c42fa59bd1909555d4e9bbe7dffde48eb..3db03073f3848e740882327461a7d2ebea57f01c`
**Toolchain:** pinned native Bun 1.3.14 on macOS ARM64

## Matrix

| Category            | Result | Evidence                                                                                                                                                                                              |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build and typecheck | PASS   | `bun run typecheck` completed without errors; the broad suite also passed compiled-runtime and standalone-CLI build tests                                                                             |
| Lint                | PASS   | `bun run lint` completed without findings                                                                                                                                                             |
| Changed-file format | PASS   | Prettier checked every path in the pinned PR diff with the repository ignore file disabled                                                                                                            |
| Unit tests          | PASS   | Definition normalization, invalid definitions, deterministic hashing, service idempotence, revision retention, identity normalization, inventory filtering, and desktop view-model tests passed       |
| Integration tests   | PASS   | Real version-1 database migration, server/client stack apply-list-show, old-server capability refusal, source CLI apply/list/status/show, compiled CLI, Node/Bun client, and npm tarball tests passed |
| End-to-end/browser  | N/A    | This slice adds no renderer workflow; the approved Stacks UI is I-6. The source CLI flow exercised the complete definition-registration path through a live Unix-socket server                        |
| Application runtime | PASS   | Compiled runtime and standalone Commander CLI tests passed under pinned Bun 1.3.14                                                                                                                    |

## Commands

```sh
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run typecheck
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun run lint
git diff --name-only -z 8e14a33c42fa59bd1909555d4e9bbe7dffde48eb..3db03073f3848e740882327461a7d2ebea57f01c \
  | xargs -0 .cache/tools/bun-1.3.14/bun-darwin-aarch64/bun x prettier --check --ignore-path /dev/null
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test
```

The first three commands passed. The broad test command passed 171 tests with 646
assertions and failed one pre-existing lifecycle-status assertion in
`test/cli/operations.test.js`.

## Known unrelated failure

`test/cli/operations.test.js` expects a temporary manual server to produce lifecycle
status exit `0`. On this development account, the already installed Portreeve launchd
state makes that evidence an ordinary state difference and the command exits `10`. The
same isolated test was run from a temporary detached worktree at the pinned base commit
and failed identically:

```sh
git worktree add --detach /tmp/portreeve-base-XXXXXX \
  8e14a33c42fa59bd1909555d4e9bbe7dffde48eb
.cache/tools/bun-1.3.14/bun-darwin-aarch64/bun test \
  /tmp/portreeve-base-XXXXXX/test/cli/operations.test.js
```

Base result: 0 passed, 1 failed, expected exit `0`, received exit `10`. This PR does not
change the lifecycle manager, status command, or that test. The new stack CLI
integration test passed independently.

The repository-wide `bun run check` convenience command also sees two gitignored
`.handoffs/*.md` files and asks Prettier to format them. They are user-owned handoff
artifacts outside the PR. The pinned changed-file format gate above passed every tracked
PR path without modifying those files.
