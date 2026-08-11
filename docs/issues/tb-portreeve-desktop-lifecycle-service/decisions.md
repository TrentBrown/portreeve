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
