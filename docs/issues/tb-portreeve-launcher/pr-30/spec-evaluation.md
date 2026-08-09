# Spec Evaluation - PR #30

**Verdict:** PASS for P6 / I-6. The slice satisfies its planned shared-engine
requirements and introduces no rubric failure. Cumulative R4, R5, and R6 remain
`NOT YET` because their approved criteria include later Desktop and packaged-runtime
work.

## Acceptance criteria

| Criterion | Slice result | Evidence |
|---|---|---|
| AC4 - Attached Start execution | ADVANCES, remains incomplete | Application-local no-timeout process groups use closed stdin, bounded streaming output, one tracked group per stack, concurrent finite Status/Stop, composed attached Restart, explicit exact-group termination, stale-group refusal, and close-guard inventory. Real process and socket tests pass. Desktop exit blocking and packaged smoke are P7-P9. |
| AC5 - Verified activation integration | ADVANCES, remains incomplete | The engine supplies the exact current generation context, rejects exit-zero and mismatched evidence, accepts a real matching confirmed activation, retains intentionally degraded verification through the existing evidence classifier, suggests command-only upgrades, and requires explicit downgrade validation. Desktop editor warning, confirmation, and trust UX are P8. |
| AC6 - Shared engine, CLI, and concurrency | ADVANCES, remains incomplete | CLI and later Electron main share one runtime and lifecycle service. Renewable attached sessions permit Status or Stop companions, attached Restart uses finite Stop then attached Start, lost sessions remain daemon-recorded without adoption, and strict safe history adds only a reduced maturity summary. Desktop main-process parity is P7. |

## Rubric

| # | Criterion | Result | Scope | Notes |
|---|---|---|---|---|
| R4 | Attached execution | NOT YET | P6 advances | All P6 process and coordination outcomes pass, including real exact-group termination. Desktop quit protection and packaged macOS smoke remain. |
| R5 | Verified activation | NOT YET | P6 advances | Exact-generation enforcement, real activation confirmation, upgrade detection, and downgrade validation pass. Desktop transition behavior remains. |
| R6 | Shared engine and coordination | NOT YET | P6 advances | Shared CLI engine and daemon coordination pass for finite and attached modes. Desktop adapter parity remains. |

## Definition of Done

- **Build status:** PASS - pinned Bun 1.3.14 `bun run build`.
- **Lint status:** PASS - `bun run lint`; changed-file Prettier check passes.
- **Tests written:** attached process-group, stale-group, lifecycle maturity,
  downgrade, strict protocol, durable safe metadata, real concurrent socket operation,
  and real confirmed-activation coverage.
- **Test suite status:** PASS across host-isolated runs - 65 focused tests and all 369
  unique repository tests pass. The normal run's three active-LaunchAgent fixture
  collisions pass 5/5 under an isolated supervisor identity.
- **Integration verified:** Yes - real POSIX child groups, Unix socket, SQLite operation
  history, official JavaScript client, `lsof` evidence, and activation confirmation.
- **Application runs:** Yes for the P6 CLI/shared-engine boundary; packaged Desktop is a
  planned later boundary.
- **Pending manual verification:** None for P6.

No in-scope criterion fails. Feature completion is not claimed.
