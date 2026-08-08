# Judge Evaluation - PR #16

**Verdict:** PASS

**Evaluation range:**
`4740cf4a6012eac339595a289727c9ec3236557b..b9f72833160ea3d723640717a26dfd992113311d`

## Rubric Evaluation

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| R4 | Desktop containment contribution | PASS | `apps/desktop/main/stack-document.js:17-113` owns root and document resolution; `apps/desktop/shared/schemas.js:201-242` and `apps/desktop/main/ipc.js:113-149` expose only UUID-based named capabilities; `apps/desktop/preload/index.cjs:164-183` has no path or generic filesystem parameter |
| R6 | Validation contribution | PASS | `apps/desktop/main/stack-document.js:371-430` bounds UTF-8 bytes, parses JSON, validates the strict definition schema, and refuses partial interpretation; IPC rejects unknown fields and oversized drafts before invoking the coordinator |
| R7 | File-safety contribution | PASS | `apps/desktop/main/stack-document.js:116-206` binds overwrite authority to current evidence; lines 325-352 rotate conflict tokens; lines 432-528 refuse unsafe targets, create exclusively, recheck evidence, sync, and atomically replace; real-filesystem tests cover changed, missing, invalid, symlink, and oversized states |
| R8 | Save/apply contribution | PASS | `apps/desktop/main/stack-document.js:185-270` verifies saved bytes before official-client apply, preserves `saved-not-applied`, safely reduces unavailable errors, and rechecks the saved fingerprint before retry; `apps/desktop/main/coordinator.js:236-262` returns fresh snapshot evidence; no prepare capability is invoked |

The complete R4, R6, R7, and R8 criteria correctly remain `NOT YET` because P4 does
not claim the later editor view, progressive draft model, or visible recovery flows.

## Scope Check

- **Scope creep found:** No.
- **Details:** The diff is limited to main-process document authority, strict named
  IPC/preload methods, coordinator/adapter integration, tests, current desktop boundary
  documentation, and cumulative workflow records. It adds no orchestration, topology,
  general renderer filesystem access, automatic allocation, or visible editor UI.

## Gap Check

- **Unaddressed AC:** None within P4. The visible portions of AC4 and AC6-AC8 remain
  explicitly scheduled for P5-P8 and are not represented as complete in the tracker.

## Contradiction Check

- **Contradictions found:** None.
- Project-owned `portreeve.stack.json` remains the source of truth. Applied database
  state is only a recovery seed when a known file is missing or invalid, and it is never
  written without a validated draft plus the required conflict confirmation.
- Save precedes apply, and neither saving nor retrying prepares ports, preserving the
  launcher/Portreeve authority boundary.

## Concerns

An uncooperative external writer can still race in the very small interval between the
last evidence check and the atomic rename because ordinary portable filesystem APIs do
not offer compare-and-swap replacement by content hash. The implementation minimizes
that interval by preparing and syncing the temporary file first, then rechecking before
rename. The approved Overwrite/Cancel model did not require cooperative file locking,
and this residual does not block P4.
