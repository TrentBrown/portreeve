# Spec Evaluation - PR #75

**Pinned diff:**
`0de186b584be0ef4318c34cba5169dc1c5a76dd1..f12b1241b9cb7f0aac609b36bc130821106766b6`

**Scope:** Slice 2, plan steps P3-P4 (`I-3`, `I-4`)

**Verdict:** PASS for this slice

## Rubric evaluation

| Criterion | Status | Evidence |
|---|---|---|
| R3 - CLI byte and bundle authority | PASS FOR SLICE | Desktop packaging now installs the final macOS CLI at flat `Contents/Helpers`, skips only that exact helper during child signing, seals the enclosing application last, and compares its bytes and Developer ID facts before packaging and after mounting the final DMG. The real x64 package and mounted DMG checks passed. Full standalone and Homebrew authority is completed by P5-P6. |
| R4 - Protected production and credential custody | PASS FOR SLICE | The workflow separates credential-free four-target qualification from one main-only `release-trust` job. The producer validates public configuration before secret decoding, has read-only repository permission and no publication credential, uses mode-restricted temporary files and an ephemeral keychain, restores the original keychain list, removes temporary state on success and failure, and uploads only one intentional output root. |
| R5 - Native Apple verification | NOT YET | Producer-side signature, notarization, staple, Gatekeeper, mounted-DMG, and byte-equality checks are implemented. Independent native ARM64 and Intel evidence remains P5 in the next slice. |
| R7 - Failure, recovery, and immutability | PASS FOR SLICE | Protected context, policy, candidate stage, artifact digest, signature identity, notarization request continuity, staple, Gatekeeper, mounted-byte equality, output create-once behavior, bounded commands, and cleanup all fail closed. Complete evidence aggregation and rehearsal remain P5-P8. |

## Acceptance-criteria coverage

- AC3 is implemented for canonical helper topology and producer-side byte
  preservation. Standalone, Homebrew, and independently collected native
  evidence remain later planned work.
- AC4 is implemented as a credential-free qualification boundary followed by
  one protected, nonpublishing producer for both macOS architectures.
- AC5 and AC7 are advanced by strict producer-side checks; independent native
  evidence, aggregation, and live rehearsal are intentionally deferred.
- AC1, AC2, AC6, and AC8 are not reinterpreted by this slice.

## Verification

The focused pinned-Bun suite passed with 62 tests, 415 expectations, and zero
failures. Typecheck, changed-file lint, formatting, diff checks, workflow-doc
validators, real x64 application packaging, deep signature verification, DMG
creation, mounting, and mounted-helper identity checks passed. The full
repository check retained five failures in unchanged launcher/MCP/CLI paths
caused by local signal timing and non-AVX Bun diagnostics; the exact exit 1 and
failure inventory are preserved in [`verification.md`](verification.md).

No acceptance criterion was weakened or treated as complete ahead of its
planned native and protected evidence.
