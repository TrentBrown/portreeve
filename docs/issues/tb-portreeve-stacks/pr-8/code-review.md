# Code Review - PR #8

**Pinned diff:**
`13db6838357fdd3e94b896f7498727651b9f5e64..958182c72addae5bea294109d4f695ad3a68d426`

## Findings

No remaining findings.

The boundary review found and fixed three audit and interface issues before this report
was pinned:

1. Automatic activation state transitions and sibling-lease cancellation initially
   changed durable state without corresponding history. They now emit
   `stack.activation.state_changed` and ordinary `lease.abandoned` events in the same
   transaction (`src/storage/registry.js:2213`).
2. Batch-created leases and activation-end run releases initially bypassed the ordinary
   `lease.acquired` and `run.released` history contracts. Both paths now append the
   ordinary entity events transactionally, with activation identity in the payload
   (`src/storage/registry.js:910`, `src/storage/registry.js:995`).
3. The CLI's convenient `component.endpoint` syntax is ambiguous when either canonical
   name contains a dot. `stacks begin` now also accepts a strict JSON endpoint
   reference, and the contract documents when to use it
   (`src/cli/commands/stacks.js:273`).

## Review Notes

- Preparation derives every candidate from the current stack revision, existing sticky
  assignment, configured ranges and exclusions, platform ephemeral range, database
  reservations, and fresh inventory. The registry then revalidates relational and port
  constraints inside an immediate transaction.
- Concurrent generation creation returns the already-created valid generation;
  concurrent activation creation is serialized and allows only one live activation for a
  canonical worktree.
- Activation lease tokens are returned only from begin and never from inspection. CLI
  renewal and outcome commands read credentials from private files rather than process
  arguments.
- Required failure cancels the remaining pending batch. Optional failure or skipping
  produces a degraded activation after required endpoints confirm.
- Process confirmation delegates to the established allocation evidence path. Stored run
  or PID state alone cannot explain a current listener.
- End is deliberately conservative: it refuses pending leases or any fresh listener and
  never signals a provider.

## Residual Risks and Test Gaps

- Listener inspection and the following database mutation are separate system calls. A
  process can race into a selected port; bind and confirmation remain the final
  authority, and a future recovery slice can improve the surrounding workflow without
  weakening evidence.
- Crash recovery and pruning are deliberately deferred to I-5, so this slice does not
  yet reconstruct launcher intent after a lost activation caller.
- Desktop stack management and safe failure-detail presentation are deliberately
  deferred to I-6.
- One broad lifecycle test fails because this account already has supervised Portreeve
  state. The identical baseline was accepted with PR #7 and is documented in
  `verification.md`.
