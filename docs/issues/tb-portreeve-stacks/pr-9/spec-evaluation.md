# Specification Evaluation - PR #9

**Pinned diff:**
`ca7b552e4aaf0690b80c554aa20afff7576c40b2..fcb75bfcf7cc93af5f1f412e6c55bd4dcbed2811`

## Verdict

**PASS for the PR slice.** AC4 and R4 pass for component-scoped dependency resolution
and restricted sandbox discovery. R7 advances through an independently capability-gated
discovery surface but remains `NOT YET` for the cumulative feature because P5-P7 still
add Docker ownership evidence, recovery and pruning, and desktop operations.

## Acceptance Criteria

| Criterion                         | Result                               | Evidence                                                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 - Definition and identity     | PASS (prior slice)                   | PR #7 established the strict content-addressed definition consumed by discovery                                                                                                                                                                                                                  |
| AC2 - Allocation and activation   | PASS (prior slice)                   | PR #8 established immutable generations and activation identity; P4 selects exclusively through one activation's generation                                                                                                                                                                      |
| AC3 - Process and Docker evidence | PARTIAL                              | Existing process evidence remains unchanged. Docker-network values are definition facts, not ownership claims; fresh Docker confirmation remains I-4                                                                                                                                             |
| AC4 - Dependency discovery        | PASS                                 | The resolver returns only one consumer's published endpoints and declared aliases from one activation generation, separates host and nullable Docker-network facts, rejects definition drift and inactive activations, and renders a redacted launcher-gateway snapshot with detectable identity |
| AC5 - Compatibility               | PASS (prior and regression evidence) | Standalone acquisition behavior is unchanged; discovery has its own capability and older daemons are refused before invocation                                                                                                                                                                   |
| AC6 - Recovery and pruning        | NOT YET                              | I-5 / P6                                                                                                                                                                                                                                                                                         |
| AC7 - Equivalent public surfaces  | PARTIAL                              | Strict schemas, HTTP/JSON socket routes, official JavaScript methods and declarations, Commander commands, snapshot utilities, and public docs expose P4. P5-P7 remain                                                                                                                           |
| AC8 - Desktop                     | NOT YET                              | I-6 / P7                                                                                                                                                                                                                                                                                         |

## Rubric

| #   | Criterion                   | Result  | Evidence                                                                                                                             |
| --- | --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Definition and identity     | PASS    | Retained from PR #7                                                                                                                  |
| R2  | Allocation and activation   | PASS    | Retained from PR #8                                                                                                                  |
| R3  | Ownership confirmation      | NOT YET | Docker and mixed-mode confirmation are I-4                                                                                           |
| R4  | Discovery isolation         | PASS    | Component scoping, single-generation identity, three distinct address views, redaction, strict reading, and stale checks satisfy AC4 |
| R5  | Compatibility and migration | PASS    | Retained from PR #7; broad adjacent regressions pass apart from the accepted machine-state baseline                                  |
| R6  | Safety and recovery         | NOT YET | I-4 and I-5                                                                                                                          |
| R7  | Client, CLI, and protocol   | PARTIAL | The P4 discovery family is complete and separately capability-gated; the cumulative criterion remains open                           |
| R8  | Desktop                     | NOT YET | I-6                                                                                                                                  |

## Scope Assessment

The slice does not start or stop project processes, inspect Docker, assert application
health, expose the daemon socket to sandboxes, or grant lease/run credentials. The
launcher remains responsible for selecting a correct platform gateway and mounting the
generated file read-only.
