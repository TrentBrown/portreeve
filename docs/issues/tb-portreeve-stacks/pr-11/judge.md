# Judge Evaluation - PR #11

**Pinned diff:**
`655f1ac668fc3aa2454124dc4d07a8719b79c070..a025a19f9d0347d8ee3237b0764ab6986edd098c`

**Verdict:** PASS WITH CONCERNS

## Rubric Evaluation

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| R5 | Compatibility and migration | PASS | Schema v6 adds `lost` to activation state and excludes it from the one-live index without changing existing records (`src/storage/migrations.js:305`). A direct v5 migration fixture and the full legacy suite pass. |
| R6 | Safety and recovery | PASS | Reconciliation evaluates only fresh confirmed-provider evidence and changes state only when every provider is gone (`src/stacks/coordination-service.js:575`). Process evidence compares fresh inventory to the exact run; Docker evidence re-inspects exact labels/publication and treats a matching running container as active even without a host listener (`src/stacks/coordination-service.js:662`). Ending uses the same provider evaluator and refuses active or unknown evidence (`src/stacks/coordination-service.js:616`). Pruning requires missing-path age eligibility, live-work/listener/Docker checks, execution-time revalidation, and an atomic database guard before history-preserving deletion (`src/stacks/administration-service.js:42`, `src/storage/registry.js:2367`). |
| R7 | Client, CLI, and protocol | PASS | Strict reconcile/prune schemas, socket routes, official client methods and declarations, Commander commands, stable JSON/exit-code behavior, and public documentation are present. The compiled binary performs both operations against a real Unix-socket server. |

## Scope Check

- **Scope creep found:** No.
- The diff implements P6/I-5 plus its workflow records. It does not add project
  orchestration or begin P7's desktop UI and IPC work.

## Gap Check

- **Unaddressed in-scope AC:** None for AC6 or AC7.
- The recovery matrix includes partial process survivors, unknown ownership, all-gone
  replacement activation, a matching running Docker provider without a listener, and
  deterministic Docker disappearance.
- The prune matrix includes consent, age/path eligibility, pending work, unavailable
  Docker evidence, matching containers, worktree/listener/container races, database
  revalidation, no lifecycle authority, and retained identity/history.

## Contradiction Check

- **Contradictions found:** None.
- Stored PIDs and container IDs remain inspection keys rather than authority.
- A Docker provider remains active while its freshly inspected container and exact
  labels/publication match, even if `lsof` temporarily reports no listener.
- Unknown evidence preserves the activation or blocks pruning; it never becomes
  permission to delete or signal.
- Portreeve performs no process or container reclamation during stack pruning.

## Concerns

- Filesystem, listener, and Docker evidence cannot be made atomic with the final SQLite
  transaction. The service rechecks all three immediately before deletion and the
  registry atomically rechecks database-owned live work, but an external resource can
  still appear in the final evidence-to-transaction interval. Because pruning performs
  no signaling or lifecycle action, the residual risk is lost Portreeve metadata rather
  than termination of the external resource.
- This P6 packet uses deterministic Docker evidence rather than starting and removing a
  real project container. PR #10 proved the adapter and exact container/publication
  contract against Docker Desktop; native macOS/Linux integrated recovery and pruning
  remain P8 release evidence.
- Explicit reconciliation is caller-triggered. Portreeve does not infer launcher loss
  in the background, which preserves the approved fresh-evidence boundary but means a
  replacement launcher must reconcile before a lost activation stops blocking it.
