# Spec Evaluation - PR #7

**Scope:** I-1 / P1-P2 at
`8e14a33c42fa59bd1909555d4e9bbe7dffde48eb..3db03073f3848e740882327461a7d2ebea57f01c`

## Completion Report

### Definition of Done

- **Build status:** PASS - typecheck, compiled runtime, and standalone CLI build passed.
- **Lint status:** PASS - ESLint and pinned changed-file Prettier checks passed.
- **Tests written:** claim migration and endpoint identity; strict definition and
  canonical revision; transactional registration and revision changes; old-server
  capability refusal; live server/client and CLI definition flows; inventory and desktop
  compatibility.
- **Test suite status:** PASS for the changed scope - all new and affected tests passed.
  The broad suite passed 171 tests and reproduced one unrelated lifecycle-status failure
  on the base commit; see `verification.md`.
- **Integration verified:** Yes - database v1 migration, public socket protocol,
  official client, source and compiled CLI, npm package, and reduced desktop inventory
  schemas.
- **Application runs:** Yes - compiled CLI/runtime tests passed. No renderer workflow is
  introduced by this slice.
- **Pending manual verification:** Human acknowledgment of the documented base-branch
  lifecycle test failure before marking the draft ready.

### Acceptance Criteria

| #   | Criterion                                                          | Status  | Evidence                                                                                                                                                  |
| --- | ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Strict content-addressed definitions and project/worktree identity | PASS    | Shared Zod schema, locale-independent canonical JSON, immutable revisions, idempotent and changed-apply tests, CLI/client live flow                       |
| AC2 | Immutable generations and activation leases                        | NOT YET | Planned for I-2                                                                                                                                           |
| AC3 | Process and Docker confirmation                                    | NOT YET | Planned for I-4                                                                                                                                           |
| AC4 | Scoped discovery and sandbox snapshots                             | NOT YET | Planned for I-3                                                                                                                                           |
| AC5 | Legacy alias, migration, and assignment compatibility              | PASS    | Real v1 SQLite fixture preserves claim, lease, run, listener, assignment, and history; existing acquisition/inventory suites pass                         |
| AC6 | Recovery, Docker reclamation refusal, and stack prune              | NOT YET | Planned for I-4-I-5                                                                                                                                       |
| AC7 | Equivalent complete coordination surfaces                          | NOT YET | Definition apply/list/show/status and `stack-definitions-v1` are complete; activation, resolution, and pruning surfaces remain intentionally unadvertised |
| AC8 | Desktop Stacks experience and actionable failures                  | NOT YET | P1 only carries component/endpoint facts through the existing desktop inventory model; I-6 owns the UI                                                    |

### Rubric

| #   | Criterion                   | Result  | Scope   | Notes                                                                                                                                                  |
| --- | --------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Definition and identity     | PASS    | I-1     | CLI and client use one server schema; normalization, strict validation, canonical hashing, project/worktree identity, and revision behavior are tested |
| R2  | Allocation and activation   | NOT YET | I-2     | No capability advertised                                                                                                                               |
| R3  | Ownership confirmation      | NOT YET | I-4     | No Docker capability advertised                                                                                                                        |
| R4  | Discovery isolation         | NOT YET | I-3     | No discovery capability advertised                                                                                                                     |
| R5  | Compatibility and migration | PASS    | I-1     | Compatibility alias and full relational migration fixture pass; assignments are reused without creating an activation                                  |
| R6  | Safety and recovery         | NOT YET | I-4-I-5 | Existing reclamation behavior remains green in affected tests                                                                                          |
| R7  | Client, CLI, and protocol   | NOT YET | I-1-I-3 | Definition sub-surface is complete and capability-gated; the criterion requires later coordination operations too                                      |
| R8  | Desktop                     | NOT YET | I-6     | Only backward-compatible inventory facts are present                                                                                                   |

**Verdict:** I-1 satisfies R1 and R5. No in-scope criterion fails. Future criteria
remain `NOT YET` as required for this sequential slice.
