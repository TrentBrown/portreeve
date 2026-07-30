# Branch Tracker - tb-portreeve-initial-release

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-07-28

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Local authority and persistence | PASS | [#1](https://github.com/TrentBrown/portreeve/pull/1) | macOS ARM64 and Linux ARM64 complete suites; exact macOS/Linux artifact server smokes |
| R2 | Claim and assignment semantics | PASS | [#1](https://github.com/TrentBrown/portreeve/pull/1) | Cross-platform allocation decision, real bind, concurrency, and persistence tests |
| R3 | Two-phase client workflow | PASS | [#1](https://github.com/TrentBrown/portreeve/pull/1) | Cross-platform acquire/bind/confirm/retry/release integration and unavailable-server tests |
| R4 | Inventory and ownership | PASS | [#1](https://github.com/TrentBrown/portreeve/pull/1) | macOS and Linux real `lsof`, process fingerprint, lineage, and inventory tests |
| R5 | Reclamation and eviction | PASS | [#1](https://github.com/TrentBrown/portreeve/pull/1) | macOS and Linux real SIGTERM/SIGKILL, replacement, consent, and dry-run tests |
| R6 | Client, protocol, and CLI contracts | PASS | [#1](https://github.com/TrentBrown/portreeve/pull/1) | Node 22/Bun consumers, protocol conformance, CLI/JSON/exit-code tests, and documentation checks |
| R7 | Native lifecycle and upgrade safety | PASS | [#1](https://github.com/TrentBrown/portreeve/pull/1) | Real LaunchAgent ARM64/x64-artifact and Linux ARM64 systemd-user smokes plus rollback tests |
| R8 | Administration, observability, and release | NOT YET | [#1](https://github.com/TrentBrown/portreeve/pull/1) | Version, MIT license, private remote, and npm name approved; ARM64 runner, public visibility, and npm credentials remain |

## PR Log

Append PR boundary entries here.

### PR #1 - Initial release implementation

- **PR:** [#1](https://github.com/TrentBrown/portreeve/pull/1)
- **Status:** draft
- **Scope:** Initial server, CLI, protocol client, native supervision, release
  tooling, documentation, and workflow evidence.
- **Evidence packet:** [pr-1](pr-1/)
- **Result:** R1-R7 pass. R8 remains open pending the native Linux ARM64
  release runner, public repository visibility, and verified npm publication
  credentials. No tag or package was published.
