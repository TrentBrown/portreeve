# Spec - tb-portreeve-apple-trust

**Feature:** `tb-portreeve-apple-trust`
**Created:** 2026-08-28
**Status:** approved and validated; archived before planning when the feature
was restarted under GateReeve governance on macOS

## Summary

PortReeve must gain a fail-closed Apple trust path that preserves its existing
multi-artifact release invariants. New trusted candidates produce authoritative
Developer ID-signed ARM64 and x64 macOS CLI artifacts, matching signed and
notarized architecture-specific Desktop DMGs, complete native verification
evidence, and a sealed publication plan derived only from the final bytes.

Preview and stable channels remain distinct from trust policy: previews remain
unsigned by default but may explicitly request Apple trust, while stable
releases always require it. Apple credentials and publication authority remain
in separate protected environments. This feature ends with a protected,
nonpublishing trusted-preview rehearsal and a maintainer direct-install check;
it does not authorize public publication.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** Channel and trust policy. Preview releases are unsigned by default
  but may explicitly request `developer-id-notarized`; stable releases always
  require `developer-id-notarized` and cannot fall back to unsigned output.
  Channel, maturity, and trust policy remain independently recorded.
- **AC2.** Versioned release lifecycle. Every new candidate uses
  release-record schema version 2 and advances in order through
  `source-pinned`, `policy-resolved`, `native-cli-built`,
  `artifact-digests-established`, `candidate-qualified`,
  `macos-cli-authority-established`, `desktop-packaged`,
  `authoritative-native-verified`, `desktop-trust-verified`,
  `distribution-finalized`, `publication-approved`, and `published`. Valid
  schema-version-1 records remain readable and inspectable without alteration
  or synthetic version-2 evidence.
- **AC3.** Authoritative macOS CLI bytes. Trusted releases record each
  unsigned-to-signed macOS CLI transformation. The resulting signed ARM64 and
  x64 CLIs are byte-for-byte identical across standalone downloads, Homebrew
  inputs, and their matching installed Desktop applications. Linux artifacts
  remain unchanged.
- **AC4.** Protected trusted-artifact production. A main-only
  `release-trust` job creates both signed CLIs and both signed and notarized
  DMGs using the expected identity `Developer ID Application: Trent Brown
  (PMWYD5A82A)` and the separate PortReeve notarization key. It has no
  publication authority, exposes no credentials through logs or artifacts,
  and restores or removes all temporary keychain and key material on success
  or failure.
- **AC5.** Complete, native trust verification. Independent ARM64 and Intel
  runners verify their exact signed CLI, DMG, mounted application,
  embedded-CLI equality, architecture, signatures, hardened runtime, secure
  timestamp, accepted notarization, staple, DMG Gatekeeper assessment,
  application Gatekeeper assessment, CLI smoke test, and application launch.
  Aggregation accepts exactly one create-once evidence document per
  architecture and rejects missing, malformed, stale, duplicate, synthetic,
  or cross-architecture evidence.
- **AC6.** Exact finalization and separated publication. Checksums, Homebrew
  metadata, Desktop update metadata, and the sealed publication plan refer
  only to final authoritative bytes. Hosted publication consumes that sealed
  packet behind `release-publication`, receives no Apple credentials, and
  remains idempotently recoverable through the local exact-record publisher.
- **AC7.** Fail-closed and immutable recovery. Identity mismatch,
  notarization rejection or timeout, malformed tool output, altered embedded
  bytes, failed Apple assessment, or missing evidence stops the candidate
  before finalization or publication. A materially changed live rehearsal uses
  a fresh preview version; existing and failed release identities are never
  overwritten.
- **AC8.** Nonpublishing live acceptance. From reviewed code on `main`, a
  protected trusted-preview rehearsal produces a complete, publication-ready
  packet for both architectures without mutating any public release surface.
  The maintainer downloads one resulting DMG and records a successful normal
  installation and first launch, including architecture, release identity,
  DMG digest, outcome, and time.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Policy selection | Unsigned preview, trusted preview, and mandatory trusted stable behave exactly as AC1 states. | Any implicit trust, unsigned stable path, or conflated policy field exists. | Policy tests and inspected records. |
| R2 | Schema lifecycle | New records use the complete ordered version-2 lifecycle and valid version-1 records remain inspectable unchanged. | A stage can be skipped or reordered, new records use version 1, or historical evidence is synthesized. | State-machine tests and version-1/version-2 fixtures. |
| R3 | CLI byte authority | Signed macOS CLI identities match standalone, Homebrew, and embedded copies; Linux is unchanged. | Any distribution surface uses different or pre-signing bytes. | Digests, transformation evidence, formula data, and mounted-DMG comparison. |
| R4 | Protected production | Both trusted architectures are produced with validated PortReeve credentials and unconditional cleanup, without publication access. | Identity or configuration is not validated, credentials escape, cleanup fails, or publication authority is present. | Workflow assertions, negative tests, and protected-job evidence. |
| R5 | Native Apple verification | Both native runners produce complete, architecture-bound evidence satisfying every AC5 check. | Any check or architecture is absent, substituted, duplicated, or unverifiable. | ARM64 and x64 evidence documents and aggregator tests. |
| R6 | Finalization and publication boundary | All generated metadata binds final bytes and hosted and local publishers consume the same sealed plan. | Metadata is stale, publication rebuilds artifacts, or credential domains overlap. | Final packet inspection, digest checks, and publication-adapter tests. |
| R7 | Failure and immutability | Every specified defect fails closed and changed live candidates require a new preview identity. | A defective candidate advances, evidence is overwritten, or a version is reused. | Negative fixtures, timeout and rejection tests, and record-history inspection. |
| R8 | Live acceptance | The main-only rehearsal and recorded manual install succeed with zero public mutation. | The rehearsal is incomplete, public state changes, or manual evidence is absent. | Hosted-run packet, publication preflight, public-state comparison, and maintainer confirmation. |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
