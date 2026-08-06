# Specification Evaluation - PR #8

**Pinned diff:**
`13db6838357fdd3e94b896f7498727651b9f5e64..958182c72addae5bea294109d4f695ad3a68d426`

## Verdict

**PASS for the PR slice.** AC2 and R2 pass for the approved process-backed activation
scope. R7 advances through an independently capability-gated activation surface but
remains `NOT YET` for the cumulative feature because P4-P7 still add discovery, Docker,
recovery and pruning, and desktop surfaces.

## Acceptance Criteria

| Criterion                         | Result                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 - Definition and identity     | PASS (prior slice)                   | PR #7 established the strict definition, revisions, and canonical endpoint identity consumed here                                                                                                                                                                                                                                                                                                      |
| AC2 - Allocation and activation   | PASS                                 | Schema v4 snapshots immutable generations and activation endpoints; exact and preferred allocation uses fresh inventory authority; immediate transactions create all endpoint leases or none and enforce one live worktree activation; tests cover concurrency, rollback, immutability, staleness, renewal, expiry, cancellation, dependency promotion, confirmation, degradation, ending, and history |
| AC3 - Process and Docker evidence | PARTIAL                              | Fresh process listener, instance, and lineage evidence is reused for process confirmation and generation validity. Docker confirmation is intentionally I-4                                                                                                                                                                                                                                            |
| AC4 - Dependency discovery        | NOT YET                              | I-3 / P4                                                                                                                                                                                                                                                                                                                                                                                               |
| AC5 - Compatibility               | PASS (prior and regression evidence) | Standalone acquire, confirm, abandon, and release remain unchanged; broad allocation, inventory, Node and Bun client, and npm-package tests pass                                                                                                                                                                                                                                                       |
| AC6 - Recovery and pruning        | NOT YET                              | I-5 / P6; this slice includes lease-expiry failure and conservative listener-gated ending only                                                                                                                                                                                                                                                                                                         |
| AC7 - Equivalent public surfaces  | PARTIAL                              | `stack-activations-v1` exposes prepare, generation inspection, begin, renew, activation inspection, process confirm, abandon, skip, and end through schemas, routes, official client declarations and runtime, JSON CLI, compiled CLI, and documentation. P4-P7 surfaces remain                                                                                                                        |
| AC8 - Desktop                     | NOT YET                              | I-6 / P7                                                                                                                                                                                                                                                                                                                                                                                               |

## Rubric

| #   | Criterion                   | Result  | Evidence                                                                                                                                                                                       |
| --- | --------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Definition and identity     | PASS    | Retained from PR #7                                                                                                                                                                            |
| R2  | Allocation and activation   | PASS    | The generation and activation storage model, immediate transactions, current-listener checks, exact/preferred selection, endpoint outcome aggregation, and focused integration matrix meet AC2 |
| R3  | Ownership confirmation      | NOT YET | Process confirmation is present; Docker and mixed-mode confirmation are I-4                                                                                                                    |
| R4  | Discovery isolation         | NOT YET | I-3                                                                                                                                                                                            |
| R5  | Compatibility and migration | PASS    | Retained from PR #7; existing suites remain green apart from the accepted environment-specific lifecycle baseline                                                                              |
| R6  | Safety and recovery         | NOT YET | I-4 and I-5                                                                                                                                                                                    |
| R7  | Client, CLI, and protocol   | PARTIAL | The P3 activation family is complete and separately capability-gated; the cumulative criterion remains open                                                                                    |
| R8  | Desktop                     | NOT YET | I-6                                                                                                                                                                                            |

## Scope Assessment

The slice does not start or stop a project process, invoke Docker or Compose, assert
application health, publish sandbox discovery, or add desktop controls. Ending an
activation only observes fresh listener state and updates Portreeve records after the
launcher has stopped providers.
