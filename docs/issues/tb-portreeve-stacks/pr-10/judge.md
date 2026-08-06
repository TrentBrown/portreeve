# Judge Evaluation - PR #10

**Pinned diff:**
`f16addf71026c8fe8fdc231d20154f451e4b9624..885ffc5c00fd21ea1fdc43e39974bdb850ca12ba`

**Verdict:** PASS WITH CONCERNS

## Rubric Evaluation

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| R3 | Ownership confirmation | PASS | Per-component bindings default to process and require the optional Docker capability only when selected (`src/stacks/coordination-service.js:197`). Docker leases carry exact required labels (`src/stacks/coordination-service.js:328`). Confirmation freshly inspects the submitted container ID, recomputes all labels, verifies the exact loopback host/container mapping, checks `lsof`, and only then commits the Docker run (`src/stacks/coordination-service.js:412`). Schema v5 makes process and Docker provider evidence mutually exclusive (`src/storage/migrations.js:258`). Tests cover matching, stopped, stale-label, mismapped, missing, unavailable, mixed, socket-client, CLI, and native Docker cases. |
| R6 | PASS for P5; cumulative NOT YET | Fresh Docker inventory takes precedence over process ownership and exposes only Portreeve labels (`src/reconciliation/inventory.js:70`). Both reclamation modes return a launcher action with zero signals; a persisted Docker run refuses even when fresh Docker discovery is unavailable (`src/reclamation/service.js:154`, `src/reclamation/service.js:294`). General recovery and pruning are explicitly deferred to P6. |
| R7 | PASS for P5; cumulative NOT YET | The server advertises `docker-evidence-v1` only after a successful daemon check (`src/server/server.js:87`). The official client preflights it only for Docker binding/confirmation, protocol schemas distinguish process and Docker evidence, and Commander exposes Docker component selection and confirmation. No surface invokes project or container orchestration. |

## Scope Check

- **Scope creep found:** No.
- The diff implements P5/I-4 plus one directly related test-isolation correction. It does
  not implement P6 recovery/pruning or P7 desktop Stacks controls.

## Gap Check

- **Unaddressed in-scope AC:** None for AC3 or the Docker-signal portion of AC6.
- Native macOS Docker Desktop and its Linux Engine were exercised end to end. A separate
  native Linux-host listener smoke was not available in this workspace and remains a
  portability concern rather than a contract gap.

## Contradiction Check

- **Contradictions found:** None.
- Stored container IDs remain lookup/context data, not sufficient authority. Fresh
  Docker and listener evidence is mandatory for confirmation and fresh Docker evidence
  is mandatory before returning an actionable container ID.
- Portreeve never starts, stops, or health-checks project containers.

## Concerns

- Inventory discovers an exact published host port by inspecting all running containers.
  This is conservative and correct, but global inventory cost grows with both listener
  ports and running containers.
- Docker capability advertisement is a startup snapshot. Installing Docker or changing
  daemon availability requires a Portreeve restart before health advertisement changes;
  confirmation still rechecks availability at mutation time.
- Native Linux host `lsof` presentation has not been manually exercised in this PR,
  though the adapter contract is platform-neutral and the live Docker daemon was Linux.
