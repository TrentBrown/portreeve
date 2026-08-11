# Judge - PR 38

## Judge Evaluation

**Verdict:** PASS

### Rubric Evaluation

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| R4 | Deadlines and recovery | PASS for slice | `src/supervision/deadline.js:3-125` defines the shared budgets, AbortSignal, bounded child options, and referenced intentional waits. `src/supervision/command.js:21-48` hard-stops an expired control subprocess. `src/supervision/service.js:177-257` owns the overall transaction and fresh recovery deadline, returning partial or failed according to after-evidence. Deterministic timeout tests cover unchanged and changed state, Node process lifetime, client abort, and stubborn native children. |
| R5 | Cross-process exclusion | PASS for slice | `src/supervision/lock.js:23-98` uses atomic Unix bind and fresh connection evidence, treats PID as metadata only, and safely rejects non-socket or foreign-owner paths. `src/supervision/service.js:134-239` acquires before before-evidence and releases after recovery/after-evidence for every mutation including purge. Tests cover active contention, twelve-way stale recovery, connected-peer release, read concurrency, busy outcomes, and purge-safe placement. |
| R8 | Compatibility and native parity | PASS for slice | Public client methods only gain optional AbortSignal parameters, CLI exit bands retain their meanings, purge adds the spec-required `failed` state, and launchd/systemd adapters preserve their definitions while receiving shared contexts. The broad, isolated lifecycle, compiled runtime, compiled CLI, and Node runtime checks pass. Complete feature R8 correctly remains `NOT YET`. |

R1-R3, R6, and R7 are not claimed by I-2 and remain assigned to later
sequential slices.

### Scope Check

- **Scope creep found:** No
- **Details:** Changes are confined to lifecycle deadline/lock policy, its
  propagation through existing supervisors and the official health client,
  adapter-compatible result handling, cumulative workflow records, and direct
  tests. Desktop direct-service migration is not pulled into this slice.

### Gap Check

- **Unaddressed AC:** None within I-2/P2.
- Real Linux systemd-user execution, real macOS lifecycle mutation, packaged
  Electron behavior, and forced interruption remain explicitly assigned to
  later native/final verification issues rather than being implied complete.

### Contradiction Check

- **Contradictions found:** None.
- The listener itself is fresh owner evidence; stored PID and operation fields
  remain diagnostic.
- The lock lives outside the marker-owned purge root.
- Service deadlines bound actual work rather than racing an adapter promise.
- Status and purge preview remain lock-free.

### Concerns

Unix socket pathname cleanup has the normal narrow stale-recovery race between
fresh refusal evidence and unlink, mitigated by ownership/type checks, immediate
atomic rebind, bounded retries, and twelve-way contention coverage. Required
real Linux and interruption checks remain visible future gates. Neither concern
blocks this I-2 slice.

