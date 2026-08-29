# Code Review - PR #81

**Pinned diff:** `bfa64a9d930154ce0509c67b23a81ee1aa601221..8957c037b6a8e0c71e3e8ef34108bd0cfc93b548`
**Verdict:** PASS

## Findings

No findings.

The collector no longer asks `spctl` to classify a bare CLI as an application.
It still verifies the exact protected producer identities before inspection,
retains CLI codesign and hardened-runtime authority, applies Gatekeeper to the
DMG and mounted app, and requires an exact quarantined-copy execution result
before create-once evidence is written. The temporary directory is private,
the copied executable receives only the required mode, every external command
uses the existing five-minute bound, and cleanup runs from `finally`.

Tests cover the evidence schema, absence of CLI Gatekeeper data, quarantine
attribute round trip, successful exact-version execution, and wrong-version
failure. The approved spec, design, plan, decision, release guidance, issue,
and tracker consistently describe the corrected boundary.

## Residual risks and test gaps

- Exact native ARM64 and x64 execution with Developer ID credentials is
  intentionally deferred to preview.10 from reviewed `main`.
- The local preview.9 diagnostic isolated native lifecycle verification after
  a launchd timeout; it is supporting diagnosis, not the final hosted evidence.
- No browser, application UI, database, API, or cross-repository runtime
  contract changed in this slice.
