# Code Review - PR 38

**Scope:** slice
**Base:** `5d6319ee68efc651465e31064bfa6c7d7edbed72`
**Head:** `cda478965f4dd9b21798e2bcf839effd51b91faf`

## Findings

No actionable findings.

The first review pass found three bounded-execution defects before final
evaluation: an unreferenced intentional wait could let Node exit early; lock
release could wait on a connected peer; and `execFile` timeout could wait on a
child that ignored SIGTERM. Commits `e8804bd` and `6fd7e9a` fixed those
issues with dedicated runtime tests. Commit `cda4789` then removed the
remaining duplicate readiness-budget literal.

## Contract and scope review

- `LifecycleService` acquires one cross-process lease before before-evidence
  and retains it through mutation, rollback, timeout recovery, and
  after-evidence.
- A competing mutation receives canonical `lifecycle_busy` evidence promptly;
  status and purge preview never acquire the mutation lock.
- The listener connection is live ownership evidence. PID, UID, operation, and
  timestamps are diagnostic metadata and do not grant authority.
- Native commands, socket probes, readiness waits, read operations, overall
  mutations, and recovery observations are finite and share one policy source.
- Timeout after possible mutation returns fresh evidence and `partial` or
  `failed`, never adapter-level cancellation.
- Complete purge cannot remove the active lock because its runtime path is
  rejected inside the application home and defaults to the per-user runtime
  directory.
- CLI exit-code bands remain presentation policy: `lifecycle_busy` maps to
  conflict and `lifecycle_timeout` maps to internal.
- The official JavaScript client remains protocol-only and gains only optional
  AbortSignal parameters for health and protected stop requests.

## Residual risks and test gaps

- Real Linux systemd-user and complete real macOS lifecycle mutation evidence
  remain I-6/P7.
- Packaged Electron Node execution and Desktop close/interruption recovery
  remain I-4 through I-6.
- Unix pathname stale cleanup cannot provide a filesystem compare-and-unlink
  primitive; the implementation fails closed on unsafe evidence and has
  repeated real multi-process contention coverage.
- If fresh recovery evidence itself cannot be obtained within its independent
  bounded deadline, the service rejects rather than inventing after-evidence.
  Real manager probes receive abort signals; final interruption tests remain
  responsible for exercising this host-level edge.

None is a regression or an in-scope blocker for I-2.
