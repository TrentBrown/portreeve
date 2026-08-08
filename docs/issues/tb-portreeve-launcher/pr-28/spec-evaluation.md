# Spec Evaluation - PR #28

**Pinned diff:**
`3c5ce33d983a3e0b2d139642b5005f6bccc4bebf..34f2a16a4711a96c070f4304010fea7d55fb5536`

**Slice:** P4 / I-4 finite command-only launcher execution

**Result:** PASS for the P4 slice. The cumulative feature criteria remain `NOT YET`
because CLI, attached and verified execution, Desktop integration, and final release
verification are deliberately assigned to later approved plan steps.

## Acceptance-criterion evaluation

| AC | Slice result | Evidence |
| --- | --- | --- |
| AC1 | ADVANCES | The engine accepts an immutable normalized launcher snapshot and checks exact-revision trust before evidence collection or command execution. CLI/Desktop loading and conflict UX remain later work. |
| AC2 | ADVANCES | Current endpoint values resolve immediately before execution; ambient reserved values are scrubbed and the exact resolved values win. Existing P3 services remain the source of generation facts. |
| AC3 | PASS FOR P4 | Finite Start, every evidence gate, explicit partial repair, project-command-only Stop, advisory Status, custom Restart, missing-Restart composition, fresh revalidation, structured outcomes, and configured timeouts are implemented and tested. |
| AC4 | NOT IN SCOPE | Attached Start is explicitly refused until P6. The underlying exact-group session primitive is reusable there. |
| AC5 | NOT IN SCOPE | Verified-activation execution is explicitly refused until P6; P3 verified evidence remains unchanged. |
| AC6 | ADVANCES | The shared engine acquires, renews, and completes daemon sessions, aborts on renewal loss, serializes renewal before completion, and sends only safe completion metadata. CLI/Desktop entry points remain P5/P7. |
| AC7 | ADVANCES | Structured step, exit/signal, timeout/cancellation, bounded current-session output, before/after evidence, and safe failure details are available to later UI work. No renderer change is claimed. |
| AC8 | PASS FOR P4 PORTION | macOS POSIX execution and local degraded policy are tested. Start/Restart require the daemon; cached Status and explicitly confirmed cached Stop remain uncoordinated. Linux compiled CLI verification remains P5/P9. |

## Rubric evaluation

| # | Result | Evidence |
| --- | --- | --- |
| R3 | ADVANCES, remains NOT YET | The complete command-only shared-engine state table and finite lifecycle pass unit and socket integration tests. CLI/Desktop parity is not yet delivered. |
| R6 | ADVANCES, remains NOT YET | Renewable daemon admission wraps the immutable snapshot and exact generation. Renewal loss and in-flight renewal/completion races have explicit tests. Surface integration remains. |
| R7 | ADVANCES, remains NOT YET | Current-session output and structured failures exist, but the Desktop presentation and earlier generic lifecycle-error UI remain P7-P8. |
| R8 | ADVANCES, remains NOT YET | Degraded policy and macOS process behavior pass. Linux and final uninstall/reset regression coverage remain later slices. |

## Definition-of-Done matrix

- Build/typecheck: PASS.
- Lint/format: PASS.
- Unit: PASS, 36 focused launcher tests and 120 assertions.
- Integration/runtime: PASS through a real private Unix socket, SQLite registry,
  official client, allocated environment, and real login shell.
- E2E/browser: N/A for a shared-engine-only slice.
- Full regression: PASS across host-isolated runs; all 350 unique tests pass.

No in-scope acceptance criterion fails. No cumulative rubric criterion is prematurely
marked complete.
