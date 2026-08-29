# Plan - tb-portreeve-apple-trust

**Feature:** `tb-portreeve-apple-trust`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-28
**Status:** approved 2026-08-28

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Extend the existing deterministic release engine rather than adding a parallel
Apple-only release path. Implement the trust contract from the record outward:
first establish strict schema-version dispatch and evidence contracts, then
make the signed CLI the authoritative macOS byte identity, package it as
canonical nested code, add the protected producer and native verifiers, and
finally bind distribution and publication to the resulting sealed packet.

Keep external processes behind injected or narrowly wrapped command runners so
identity parsing, Apple output handling, time bounds, failure behavior, and
cleanup can be tested without credentials. Feature branches exercise these
contracts with fixtures and failure injection. Real Developer ID and
notarization work runs only from a reviewed `main` commit in the nonpublishing
rehearsal required by R8.

Deliver the work in reviewable sequential slices. The first delivery may use
the exact feature branch; each later slice starts from the updated `origin/main`
on a fresh branch generated from the stable feature ID. Never merge or rebase
`development` or any `development-*` branch into a delivery branch. No slice
may publish a release; the final feature verification consumes a protected
rehearsal packet with public mutation disabled.

## Steps

- **P1. Release-policy and schema-version foundation.** Introduce strict
  release-record version dispatch, make schema version 2 the only new-record
  format, encode the twelve ordered stages, preserve read-only version-1
  inspection, and enforce the prospective public-preview/stable trust policy
  without rewriting historical preview records. Add positive and negative
  record, transition, policy, and inspection fixtures. **Advances:** R1, R2,
  R7.
- **P2. Apple signing and notarization contracts.** Add repository-local,
  injected command wrappers and parsers for Developer ID identity, Team ID,
  hardened runtime, secure timestamp, notarization submission/polling,
  stapling, and Gatekeeper. Model finite deadlines, request continuity,
  retry eligibility, immutable attempt history, and changed-byte version burn.
  Cover malformed output, rejection, timeout, indeterminate state, and cleanup
  through deterministic fakes. **Advances:** R3, R4, R7.
- **P3. Canonical signed-CLI packaging.** Change Desktop packaging to accept
  the authoritative signed macOS CLI, copy it unchanged to a flat
  `Contents/Helpers` entry, exclude only that helper from Electron child
  signing, and seal the enclosing application last. Verify exact identity
  before and after application signing and again after mounting the DMG; retain
  architecture-specific ARM64/x64 DMGs and Linux behavior. **Advances:** R3,
  R5, R7.
- **P4. Preliminary qualification and protected producer.** Split all
  credential-free construction and qualification ahead of `release-trust`,
  then add one main-only protected Apple Silicon producer for both macOS
  architectures. Validate expected non-secret configuration before decoding,
  preserve and restore keychain search state, isolate the certificate and
  PortReeve notary key, keep publication authority absent, stage one intentional
  output tree, and prove unconditional cleanup with workflow-source and
  failure-injection tests. **Advances:** R4, R7.
- **P5. Native trust evidence and aggregation.** Extend native ARM64 and Intel
  jobs to consume the producer's exact outputs and create one immutable,
  architecture-bound evidence document each. Parse and bind all CLI,
  application, DMG, codesign, notarization, staple, DMG/app Gatekeeper,
  CLI-quarantine execution, embedded-byte, and native-smoke facts. Make
  aggregation reject every incomplete, stale, duplicate, synthetic,
  inconsistent, or architecture-substituted matrix.
  **Advances:** R3, R5, R7.
- **P6. Exact finalization and publication separation.** Derive checksums,
  Homebrew formula/cask data, Desktop update metadata, release assets, and the
  publication plan only after authoritative trust aggregation. Harden the
  hosted `release-publication` path and local exact-record recovery so they
  consume the same sealed packet, never rebuild or re-sign, remain idempotent,
  and cannot cross the Apple/publication credential boundary. **Advances:** R1,
  R2, R6, R7.
- **P7. Operator contract and regression coverage.** Update release
  documentation, the repository-owned release skill, credential naming and
  recovery guidance, rehearsal instructions, architecture labeling, optional
  manual-install evidence, and failure recovery. Run focused record, packaging,
  workflow, native-evidence, finalization, publication, Homebrew, Desktop
  update, and documentation suites plus the repository's broad checks.
  **Advances:** R1, R3, R4, R5, R6, R7.
- **P8. Protected nonpublishing rehearsal and feature verification.** After
  reviewed implementation reaches a pinned `main`, run `release-trust` with
  publication disabled. Inspect the complete schema-version-2 packet, both
  signed CLIs and DMGs, both native evidence documents, notarization/staple,
  DMG/app Gatekeeper, and signed-CLI quarantine-execution facts, exact
  publication plan, and before/after public state.
  Record optional manual installation evidence only if performed. Route any
  defect through a fresh governed delivery slice, then run the full rubric,
  independent judge, and feature-final verification with zero public mutation.
  **Advances:** R1, R2, R3, R4, R5, R6, R7, R8.

## Delivery slices

1. **Contract foundation:** P1-P2, establishing versioned authority and
   testable Apple/recovery primitives without live credentials.
2. **Trusted artifact construction:** P3-P4, establishing canonical packaging
   and the protected producer boundary.
3. **Verification and sealed distribution:** P5-P7, establishing both native
   authorities, exact finalization, publication separation, and operator docs.
4. **Live acceptance and corrections:** P8, using reviewed `main`; any code
   correction is a new sequential slice from the then-current `origin/main`.

## Verification

- Run `lint_spec.py`, `validate_branch_docs.py`, `lint_issues.py`, and
  `lint_tracker.py` whenever their governed artifacts change.
- At each delivery boundary, execute the scoped verification matrix, spec
  evaluation, independent judge, pattern review when applicable, code review,
  decision triage, and exact pinned PR-context checks required by the workflow.
- Keep all R1-R8 tracker entries evidence-based; `NOT YET` is expected until a
  slice supplies qualifying evidence.
- **Final step:** Run full rubric evaluation and produce the completion report
  only after the protected nonpublishing rehearsal succeeds from reviewed
  `main` with both native architectures and zero public mutation.
