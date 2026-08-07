# Specification Evaluation - PR #12

**Pinned diff:**
`3ecd8a53e9d057faf939e9432c5140809cebb3bc..1579046c42a1ad54bedc5f87cf57b672997cf99c`

## Verdict

**PASS for the PR slice.** AC8 and R8 now pass. The desktop exposes the approved stack
inspection and coordination actions through a reduced, validated main/preload/renderer
boundary, withholds mutation when stack evidence is unavailable, delegates all authority
to the official client/server contracts, and shows safe actionable operation details.
The additive read-only status operation preserves AC7/R7. I-7/P8 remains open for
complete assembled-feature and cross-platform release verification.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| AC1 - Definition and identity | PASS (prior slice) | Retained from PR #7; the desktop applies the same strict definition through the official client |
| AC2 - Allocation and activation | PASS (prior slice) | Retained from PR #8; packaged-app preparation created the same immutable server-owned generation |
| AC3 - Process and Docker evidence | PASS (prior slice) | Retained from PR #10; the desktop only displays freshly server-evaluated provider evidence |
| AC4 - Dependency discovery | PASS (prior slice) | Retained from PR #9; the desktop displays component-scoped resolutions and redacted snapshot previews |
| AC5 - Compatibility and migration | PASS (prior slice) | Retained from PR #7; the complete legacy and migration suites remain green |
| AC6 - Recovery and pruning | PASS (prior slice) | Retained from PR #11; desktop reconcile/end/prune call the existing evidence-gated contracts and never signal providers directly |
| AC7 - Equivalent public surfaces | PASS | The additive status route/client/CLI operation reports current stack, generation, activation, and provider evidence through protocol v1 without orchestration |
| AC8 - Desktop | PASS | Stacks tab, definition apply, prepare, reconcile, end, prune, address/snapshot copy, stale-evidence withholding, actionable failure details, narrow IPC, automated tests, packaging, and the manual apply/prepare workflow all pass |

## Rubric

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| R1 | Definition and identity | PASS | Retained from PR #7 |
| R2 | Allocation and activation | PASS | Retained from PR #8 |
| R3 | Ownership confirmation | PASS | Retained from PR #10 |
| R4 | Discovery isolation | PASS | Retained from PR #9 |
| R5 | Compatibility and migration | PASS | Retained from PR #7 and the complete 224-test gate |
| R6 | Safety and recovery | PASS | Retained from PRs #10-#11; desktop actions preserve server-owned revalidation and consent |
| R7 | Client, CLI, and protocol | PASS | Strict aggregate status schemas, route, official client, CLI JSON, docs, and socket integration pass |
| R8 | Desktop | PASS | Reduced desktop schemas and view models, trusted IPC, serialized refresh/mutation state, safe failure rendering, no-orchestration assertions, packaged build, and manual app workflow pass |

## Scope Assessment

The desktop does not start or stop project processes, invoke Docker or Compose, inspect
SQLite, open the Portreeve socket from the renderer, accept arbitrary shell/navigation
input, infer application health, or expose claims, leases, run identifiers, credentials,
or full worktree paths in its stack view model. Polling refreshes current evidence without
destroying unchanged in-progress component inspection or gateway input.
