# Code Review - PR #11

**Pinned diff:**
`655f1ac668fc3aa2454124dc4d07a8719b79c070..a025a19f9d0347d8ee3237b0764ab6986edd098c`

## Findings

No remaining findings.

## Corrections Made During Review

- Added standalone compiled-executable coverage for activation reconciliation and
  missing-worktree stack pruning through the real Unix socket.
- Added the missing execution-time Docker race case, proving that a matching container
  appearing after initial planning causes the candidate to be skipped just like a
  reappearing worktree or listener.

## Review Notes

- `lost` is persisted as a non-live activation state. It preserves prior activation
  evidence while allowing a replacement activation to reuse a still-valid generation.
- Process providers are gone only when the listener disappears or fresh inventory no
  longer maps the listener to the confirmed run. Ambiguous ownership remains unknown and
  blocks ending and pruning.
- Docker providers are freshly inspected against the original definition revision,
  generation, activation, component, endpoint map, publication, and container ID. A
  matching running container remains active even during a transient missing-listener
  observation.
- Reconciliation releases only persisted run evidence after every provider is
  conclusively gone; it never signals a process or invokes container lifecycle.
- Stack prune planning reports candidates and explicit blockers. Execution repeats path,
  provider, listener, and Docker checks before entering an immediate SQLite transaction
  that rejects any new live activation, lease, or confirmed run.
- Deletion removes the stack coordination graph and its linked canonical claims in one
  transaction, then retains `claim.pruned` and `stack.pruned` history with identity and
  count summaries.
- `--json` affects presentation only. It is neither consent nor an interactive bypass;
  noninteractive execution still requires `--yes`.
- The official client and CLI use the same HTTP/JSON Unix-socket protocol as every other
  Portreeve operation and capability-gate the additive surface.

## Residual Risks and Test Gaps

- External evidence and SQLite deletion have an unavoidable final time-of-check/time-of-
  use interval. Conservative blockers, immediate revalidation, atomic durable-state
  checks, and the absence of reclamation limit the consequence.
- The full matrix is native on macOS ARM64. Native Linux-host and packaged desktop
  workflows remain P8 and P7 respectively.
- No real Docker container is created or stopped in this slice; deterministic adapter
  cases cover matching, missing, unavailable, and reappearing evidence, building on PR
  #10's real Docker Desktop confirmation smoke.
