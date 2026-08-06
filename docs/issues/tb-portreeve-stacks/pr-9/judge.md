# Judge Evaluation - PR #9

**Pinned diff:**
`ca7b552e4aaf0690b80c554aa20afff7576c40b2..fcb75bfcf7cc93af5f1f412e6c55bd4dcbed2811`

**Verdict:** PASS WITH CONCERNS

## Rubric Evaluation

| #   | Criterion                 | Result                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4  | Discovery isolation       | PASS                            | `StackDiscoveryService` selects context through one activation, rejects inactive or drifted state, and maps only the requested component's published endpoints and declared aliases (`src/stacks/discovery-service.js:27`, `src/stacks/discovery-service.js:73`). Resolution keeps allocated host and definition-derived Docker-network facts distinct (`src/stacks/discovery-service.js:156`). Snapshot rendering replaces only the host view with a validated launcher gateway and excludes authority-bearing records (`src/stacks/discovery-service.js:48`). The client reader strictly rejects unknown fields, oversized documents, and unexpected definition/generation/activation/component identity (`packages/client/src/discovery.js:56`, `packages/client/src/discovery.js:102`). Focused tests cover scoping, circular references, both gateway fixtures, deterministic redaction, drift, failed activation, file replacement, and stale identity. |
| R7  | Client, CLI, and protocol | PASS for P4; cumulative NOT YET | `stack-discovery-v1` is separately advertised. Strict schemas, two HTTP/JSON routes, official client methods and declarations, Commander resolve/snapshot commands, atomic file utilities, npm packaging, and public documentation expose the whole P4 contract (`src/protocol/schemas.js:364`, `src/server/server.js:378`, `packages/client/src/client.js:232`, `src/cli/program.js:338`). Older servers are refused through capability negotiation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Scope Check

- **Scope creep found:** No.
- The diff implements P4/I-3. It does not invoke Compose, discover Docker topology,
  control project processes, reconcile lost launchers, prune records, or add desktop
  controls.

## Gap and Contradiction Check

- **Unaddressed in-scope acceptance criteria:** None for AC4.
- **Contradictions found:** None. Host allocation, Docker-network definition, and
  launcher-rendered gateway remain different facts. A snapshot supplies addresses but
  carries no ownership or mutation authority.
- **Intentionally deferred:** Docker evidence (P5), recovery and pruning (P6), and
  desktop support including visible failure details (P7).

## Concerns

- Portreeve validates the gateway as a safe host token but deliberately cannot prove
  that it is reachable from a particular sandbox; that topology remains launcher-owned.
- Atomic replacement is proven on the supported macOS/POSIX development path. Native
  Windows replacement semantics are outside the approved first-version scope.
- Existing snapshot directories are not permission-tightened; the written file itself is
  always created with mode `0600`, and newly created directories request `0700`.
- The broad suite retains one lifecycle-status failure caused by this account's existing
  launchd state. It is unchanged from the accepted PR #7 and #8 baseline.
