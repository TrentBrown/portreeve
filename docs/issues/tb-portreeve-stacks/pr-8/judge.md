# Judge Evaluation - PR #8

**Pinned diff:**
`13db6838357fdd3e94b896f7498727651b9f5e64..958182c72addae5bea294109d4f695ad3a68d426`

**Verdict:** PASS WITH CONCERNS

## Rubric Evaluation

| #   | Criterion                 | Result                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2  | Allocation and activation | PASS                            | Migration 4 persists immutable generation snapshots and activation endpoint state (`src/storage/migrations.js:187`). Preparation uses current definition identity, exact and preferred constraints, exclusions, database reservations, and fresh reconciled listener ownership (`src/stacks/coordination-service.js:51`). Immediate registry transactions reuse concurrent preparation, create all activation leases or roll back, reject stale revisions, and enforce worktree exclusivity (`src/storage/registry.js:640`, `src/storage/registry.js:995`). Confirmation reuses the existing listener and process-lineage authority (`src/allocation/service.js:202`). State aggregation cancels sibling leases on required failure and records transitions (`src/storage/registry.js:2213`). Focused tests cover every P3 matrix axis, including concurrent prepare and begin and stale stored-run evidence (`test/stacks/coordination-service.test.js:126`). |
| R7  | Client, CLI, and protocol | PASS for P3; cumulative NOT YET | `stack-activations-v1` is separately advertised (`src/protocol/constants.js:19`). Strict schemas, versioned routes, official client methods and declarations, Commander commands, JSON integration, compiled CLI, and public docs expose prepare, inspect, begin, renew, confirm, abandon, skip, and end (`packages/client/src/client.js:120`, `src/cli/commands/stacks.js:68`, `test/cli/stacks.test.js:12`). The old-server client refusal is explicit (`test/server/server-client.test.js:154`).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Scope Check

- **Scope creep found:** No.
- The diff implements P3/I-2 and the storage and API changes required by it. It does not
  add project commands, Docker execution, sandbox authority, or desktop controls. The
  ending primitive inspects listeners but never signals a provider.

## Gap Check

- **Unaddressed in-scope acceptance criteria:** None for AC2's process-backed slice.
- **Intentionally deferred:** dependency address resolution and sandbox documents (P4),
  Docker evidence (P5), recovery and pruning (P6), and desktop support (P7).

## Contradiction Check

- **Contradictions found:** None. A generation is allocation intent, a lease is
  temporary startup authority, confirmation is evidence-backed ownership rather than
  health, and Portreeve remains outside project-process orchestration.

## Concerns

- Listener inspection necessarily precedes the registry transaction at prepare, begin,
  and end boundaries. Database mutations remain atomic, and confirmation is the final
  ownership authority, but an unrelated process can race into the inspected port.
- The broad suite has one lifecycle-status failure caused by this developer account's
  existing launchd state. It is unchanged from the accepted PR #7 baseline; all P3 and
  adjacent regression tests pass.
- Native verification is macOS ARM64. Linux remains covered by CI and release workflows
  rather than this local packet.
