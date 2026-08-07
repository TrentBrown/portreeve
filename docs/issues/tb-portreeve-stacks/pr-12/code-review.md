# Code Review - PR #12

**Pinned diff:**
`3ecd8a53e9d057faf939e9432c5140809cebb3bc..1579046c42a1ad54bedc5f87cf57b672997cf99c`

## Findings

No remaining findings.

## Corrections Made During Review

- Replaced renderer-owned `navigator.clipboard` access, which the desktop permission
  policy denies, with a trusted-frame-only, schema-validated, length-bounded main-process
  clipboard capability.
- Prevented the five-second evidence poll from rebuilding an unchanged Stacks panel, so
  expanded component details, keyboard focus, and an in-progress sandbox gateway value
  survive routine timestamp-only refreshes.
- Changed prepared stacks to display `prepared` rather than the definition-only
  `defined` label.

## Review Notes

- The aggregate status endpoint is read-only and derives the latest stack relationships
  from registry queries plus the existing fresh provider evaluator.
- The desktop adapter is the only stack integration boundary and uses the official
  HTTP/JSON Unix-socket client. The renderer receives only strict reduced view models.
- File selection remains in the main process; the selected definition's directory is
  the canonical worktree submitted to the server, while the renderer receives no full
  path.
- All lifecycle and stack mutations serialize with polling. Failed mutations refresh
  evidence before their structured result returns.
- Stack-action availability depends on current stack evidence. The server revalidates
  prepare, reconcile, end, and prune decisions at execution time.
- Pruning retains the seven-day default, previews candidates and blockers, and requires
  the explicit `PRUNE` confirmation before execution.
- Renderer controls cannot invoke a shell, Docker, Compose, SQLite, arbitrary external
  navigation, or raw Portreeve socket operations.

## Residual Risks and Test Gaps

- The manual packaged workflow exercised definition apply and preparation, not every
  action against a live mixed-provider activation; deterministic and socket integration
  tests cover the remaining paths.
- Per-stack status and per-component resolution polling may become chatty with many
  confirmed stacks; no correctness or first-release usability failure was observed.
- Native Linux desktop packaging and complete mixed-stack release verification remain
  I-7/P8 rather than this focused P7 slice.
