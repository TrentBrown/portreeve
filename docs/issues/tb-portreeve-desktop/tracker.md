# Branch Tracker - tb-portreeve-desktop

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-07-30

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Layered lifecycle status | PASS | [#2](https://github.com/TrentBrown/portreeve/pull/2) | Strict schema fixtures, layered manager tests, compiled CLI status, and native macOS x64 supervisor/socket lifecycle pass |
| R2 | Safe lifecycle mutations | PASS | [#3](https://github.com/TrentBrown/portreeve/pull/3) | Contract and refusal evidence from PR #2 plus native lifecycle install/start/upgrade/restart/stop/uninstall/purge/reinstall on macOS ARM64/x64 and systemd-user Linux ARM64/x64 in run 30593716275 |
| R3 | Complete reset | PASS | [#2](https://github.com/TrentBrown/portreeve/pull/2) | Marker migration, adversarial filesystem, token drift, partial-result, compiled CLI, and native macOS x64 purge/reinstall evidence pass |
| R4 | Desktop integration | PASS | [#4](https://github.com/TrentBrown/portreeve/pull/4) | Packaged application invokes the exact checksum-verified CLI for lifecycle evidence and the official client for inventory through main-process adapters |
| R5 | MVP user workflows | PASS | [#5](https://github.com/TrentBrown/portreeve/pull/5) | Overview and Ports expose state-aware onboarding, lifecycle, upgrade, uninstall, selected-port evidence, and typed reset-preview workflows through fixed CLI capabilities |
| R6 | Electron security and freshness | PASS | [#4](https://github.com/TrentBrown/portreeve/pull/4), [#5](https://github.com/TrentBrown/portreeve/pull/5) | Sandboxed local renderer, strict CSP/navigation/permission denial, named main-frame IPC, reduced snapshots, serialized mutations/refresh, token confinement, stale recovery, separate desktop data, and packaged inspection pass |
| R7 | Version and update policy | NOT YET | - | Planning pending |
| R8 | Release identity and native execution | NOT YET | [#3](https://github.com/TrentBrown/portreeve/pull/3) | Four native executable targets, lifecycle matrix, checksums, npm tarball, and Homebrew installation pass; publication is deliberately deferred and P5-P8 local inputs remain provisional until first npm/GitHub publication and later desktop artifact identity evidence |

## PR Log

### PR #2 - Lifecycle and reset contracts

- **PR:** [#2](https://github.com/TrentBrown/portreeve/pull/2)
- **Status:** merged
- **Scope:** P1-P3 lifecycle contract and complete-reset prerequisite slice.
- **Evidence packet:** [pr-2](pr-2/)
- **Result:** R1 and R3 pass. R2 remains open for native systemd-user
  verification in P4; R4-R8 remain future desktop and release work.

### PR #3 - CLI release authority preparation

- **PR:** [#3](https://github.com/TrentBrown/portreeve/pull/3)
- **Status:** merged
- **Scope:** P4 release infrastructure, native matrix completion, and
  pre-publication safety.
- **Evidence packet:** [pr-3](pr-3/)
- **Result:** R2 passes with native launchd and systemd-user lifecycle
  evidence. R8 advances through four-platform executable and Homebrew
  verification but remains open until the first CLI/client publication and
  later desktop identity checks. Independent judge: PASS WITH CONCERNS; code
  review: PASS with no actionable findings.

### PR #4 - Secured read-only desktop slice

- **PR:** [#4](https://github.com/TrentBrown/portreeve/pull/4)
- **Status:** merged
- **Scope:** P5-P6 Electron boundary, provisional artifact identity, read-only
  lifecycle/inventory integration, serialized refresh, and reduced renderer.
- **Evidence packet:** [pr-4](pr-4/)
- **Result:** R4 and R6 pass for the read-only slice. The unsigned local ARM64
  package is engineering evidence only; public signing, notarization, x64
  packaging, and published CLI identity remain in P9/R8.

### PR #5 - Desktop lifecycle and reset workflows

- **PR:** [#5](https://github.com/TrentBrown/portreeve/pull/5)
- **Status:** draft
- **Scope:** P7 Overview/Ports MVP, onboarding and lifecycle orchestration,
  selected-port details, data-preserving uninstall, and typed complete reset.
- **Evidence packet:** [pr-5](pr-5/)
- **Result:** R5 passes. R2, R3, R4, and R6 retain their earlier passes with
  added desktop workflow, mutation serialization, token-confinement, and
  packaged runtime evidence. Update discovery and public release remain P8-P9.
