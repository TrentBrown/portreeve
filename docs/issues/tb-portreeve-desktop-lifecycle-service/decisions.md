# Decisions - tb-portreeve-desktop-lifecycle-service

**Feature start:** 2026-08-10

Permanent record of decisions promoted from `scratchpad.md`.

---

## Keep CLI exit codes outside the lifecycle service

**Confidence:** HIGH

**Blast Radius:** Internal lifecycle result contract, CLI lifecycle commands, and adapter parity tests

The shared lifecycle service returns only canonical lifecycle evidence: operation, outcome, changed state, timing, before and after status, and a stable structured error. It classifies refused outcomes from stable domain error codes but does not return a CLI exit code. The CLI adapter maps the returned stable error code to its existing exit-code bands. This keeps the service reusable by Electron without importing terminal policy while preserving the current CLI contract.

**Triggered by:** Extracting executeLifecycleMutation from the CLI into the runtime-neutral shared service

**Alternatives considered:**
Return exit codes from the shared service - rejected because it would make terminal presentation part of the canonical application contract. Preserve the old CLI executor as a wrapper - rejected because it would leave lifecycle outcome semantics in the CLI.

**Promoted:** 2026-08-10. PR: https://github.com/TrentBrown/portreeve/pull/37.

---

## Use a Unix listener lease for mutation exclusion

**Confidence:** HIGH

**Blast Radius:** Lifecycle service, runtime paths, purge safety, and cross-process tests

Represent the per-user lifecycle mutation lock as an actively listening Unix-domain socket in a private runtime directory outside the application data purge root. Atomic bind is acquisition. A successful probe connection is fresh proof of an active owner; a refused connection identifies an abandoned socket artifact, which may be removed only after socket-type and owner checks. Owner PID and operation metadata are diagnostic only. The kernel releases listener ownership when a process dies, so recovery does not depend on PID freshness.

**Triggered by:** I-2 requires atomic cross-process exclusion without treating PID identity as authority

**Alternatives considered:**
Exclusive lock file or directory - rejected because crash recovery requires a stale-age or PID authority heuristic. Third-party advisory file locking - rejected because it adds a dependency and still relies primarily on file metadata. A daemon-owned lock - rejected because lifecycle operations must work while the daemon is absent or being replaced.

**Promoted:** 2026-08-10. PR: #38.

---

## Use one overall deadline with bounded child work

**Confidence:** HIGH

**Blast Radius:** Lifecycle service, manager, native supervisors, socket health probes, command execution, and result recovery

Give each mutation a 60-second service-owned deadline, retain a 15-second maximum for each native child command and a 10-second maximum for readiness waits, and reserve a fresh 10-second recovery deadline for after-evidence. The deadline carries an AbortSignal into native commands and lifecycle socket probes; wait loops consult the same deadline. On expiry after mutation may have begun, the service waits for bounded work to settle, gathers fresh after-evidence under the recovery deadline, and returns lifecycle_timeout as failed or partial according to observed state change. Read-only status and purge preview receive finite service-owned deadlines but do not acquire the mutation lock.

**Triggered by:** I-2 must replace adapter-owned timeout races with service-owned bounded execution

**Alternatives considered:**
Adapter Promise.race - rejected because it returns while in-process mutation can continue. One timeout per adapter - rejected because CLI and Electron could disagree. An unbounded recovery probe - rejected because it would defeat the operation bound.

**Promoted:** 2026-08-10. PR: #38.

---

## Represent unchanged purge timeout as failed

**Confidence:** HIGH

**Blast Radius:** Shared purge result schema, CLI exit mapping, and Desktop lifecycle result validation

Expand the canonical purge outcome vocabulary with failed. Use failed when a purge error or lifecycle timeout leaves fresh after-evidence unchanged, partial when fresh evidence shows lifecycle state changed, and refused for policy or lifecycle-busy rejection. Preserve existing succeeded, refused, and partial meanings. The CLI maps the stable error code through its existing exit bands, and the Desktop schema accepts the result until the direct-service adapter lands.

**Triggered by:** I-2 requires every timed-out mutation to return partial or failed from fresh after-evidence

**Alternatives considered:**
Return partial for every purge timeout - rejected because it falsely claims an observed state change. Throw before returning a purge receipt - rejected because it discards canonical before and after evidence. Encode failed only in an error field while retaining partial - rejected because the outcome and evidence would disagree.

**Promoted:** 2026-08-10. PR: #38.
