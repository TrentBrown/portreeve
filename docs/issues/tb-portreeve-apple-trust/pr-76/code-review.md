# Code Review - PR #76

**Pinned diff:**
`d54fdc0056109a5b0e8442da74332f593f9fe5ed..5d89cb14a6064cd65a07a489690be2d86568e02e`

**Verdict:** PASS

## Findings

No actionable findings remain at the corrected pinned source.

The first review found one actionable issue: the evidence validator required
hardened runtime on a signed DMG even though that flag is an executable-code
requirement and the producer intentionally records it as false for the DMG.
That boundary attempt entered remediation. Commit
`5d89cb14a6064cd65a07a489690be2d86568e02e` corrects the scope and adds a
regression test that still rejects an application without hardened runtime.

## Review evidence

- The producer rewrites every transformed macOS CLI identity in the manifest,
  Homebrew formula, SHA256SUMS, and release record before verifying or
  uploading the protected tree.
- The release record accepts preliminary unsigned native verification only as
  the explicit predecessor of a recorded signed transformation; every current
  artifact must match the signed authority.
- Each native collector binds source, policy, architecture, predecessor,
  signed CLI, DMG, mounted application, seal, Developer ID facts, Gatekeeper,
  staple, notarization, and smoke outcomes into a create-once document.
- Aggregation requires exactly one current `arm64` and one current `x64`
  document and rejects Rosetta substitution and all cross-bound identities.
- Trusted finalization consumes producer evidence plus the two native documents
  and regenerates all final distribution surfaces from the authoritative bytes.
- Inspection and publication both compare the plan with its independently
  sealed SHA-256 file before any approval or adapter mutation.
- The workflow gives Apple credentials only to the main-only producer, no
  credentials or write permission to native verification, and publication
  authority only to the separately approved publisher.
- The publisher's `always()` condition tolerates the intentionally skipped
  mutually exclusive finalizer while still rejecting failures and cancellation.

## Residual risks

Actual Apple service behavior, protected-environment approval, and native
ARM64/Intel execution are deliberately deferred to P8. The final slice must
consume the hosted outputs without converting a failed rehearsal into a pass.
