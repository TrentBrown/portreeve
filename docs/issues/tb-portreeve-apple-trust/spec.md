# Spec - tb-portreeve-apple-trust

**Feature:** `tb-portreeve-apple-trust`
**Created:** 2026-08-28
**Status:** validated 2026-08-28

## Summary

PortReeve must add a fail-closed Apple release-trust path without weakening its
existing build-once release authority. Every future public preview and stable
macOS release must use authoritative Developer ID-signed ARM64 and x64 CLI
bytes, matching signed and notarized architecture-specific Desktop DMGs,
complete native evidence, and distribution metadata derived only from those
final bytes.

Internal and nonpublishing candidates may remain unsigned or ad-hoc signed.
Apple credentials and publication authority remain in separate protected
environments with separate approvals. This feature ends with a protected,
nonpublishing trusted-preview rehearsal from reviewed `main`; it neither
authorizes nor performs public publication. A later separately governed
GateReeve feature may adopt the common trust contract while retaining
GateReeve's universal DMG.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** Public-channel trust policy. Development, CI, and nonpublishing
  candidates may be unsigned or ad-hoc signed, but every newly published
  preview and stable macOS release requires `developer-id-notarized` trust.
  Preview and stable remain distinct update channels and compatibility
  promises. Existing public previews `0.1.0-preview.1` through `.4` remain
  immutable and inspectable as unsigned history, and no new public path may
  silently fall back to unsigned output.
- **AC2.** Versioned release lifecycle. Every new candidate uses release-record
  schema version 2 and can advance only in order through `source-pinned`,
  `policy-resolved`, `native-cli-built`, `artifact-digests-established`,
  `candidate-qualified`, `macos-cli-authority-established`,
  `desktop-packaged`, `authoritative-native-verified`,
  `desktop-trust-verified`, `distribution-finalized`,
  `publication-approved`, and `published`. Each transition verifies its
  predecessor and exact recorded evidence. Valid schema-version-1 records
  remain readable and inspectable under their original contract without
  rewriting them, synthesizing version-2 evidence, or loosening version-2
  validation.
- **AC3.** One authoritative macOS CLI identity. For each architecture, the
  trusted path records the unsigned CLI identity and its single transformation
  into a Developer ID-signed, hardened-runtime, securely timestamped CLI. The
  signed bytes are identical in the standalone download, Homebrew input, and
  the matching application's flat `Contents/Helpers` entry after application
  signing and after mounting the final DMG. The helper is not placed under
  `Contents/Resources`, is not re-signed as a child or Desktop-only copy, and
  the final enclosing application passes deep strict signature verification.
  Linux artifacts retain their established identities and behavior.
- **AC4.** Protected trusted-artifact production. A main-only,
  human-approved `release-trust` job uses the expected Developer ID Application
  identity and Team ID plus the product-specific `PortReeve Notarization` team
  key to produce both signed CLIs and both signed, notarized, stapled DMGs in
  one protected Apple Silicon job. It validates non-secret configuration before
  decoding private material, preserves the runner's existing keychain search
  list, places credentials only in mode-restricted temporary files and an
  ephemeral keychain, stages only intentional non-secret output beneath one
  upload root, has no publication credential or write authority, and restores
  or removes all temporary credential state on every success and failure path.
- **AC5.** Complete native trust evidence. Independent native ARM64 and Intel
  jobs execute and inspect their matching exact outputs and create exactly one
  immutable evidence document per architecture. Each document binds release,
  source commit, policy, architecture, unsigned and signed CLI identities, DMG
  and application identities, full Developer ID and Team ID facts, hardened
  runtime, secure timestamp, accepted notarization request, staple validation,
  deep strict signature verification, embedded-CLI equality, native CLI and
  application smoke results, successful quarantined execution of the signed
  standalone CLI, and successful Gatekeeper assessments for the DMG's
  primary-signature open policy and the mounted application. Aggregation
  rejects missing, malformed, stale, duplicate,
  synthetic, inconsistent, or cross-architecture evidence. Rosetta evidence
  may be supplemental but cannot replace native Intel evidence.
- **AC6.** Exact finalization and separated publication. Checksums, Homebrew
  formula and cask data, Desktop update metadata, release assets, and the sealed
  publication-plan digest refer only to final authoritative bytes. The normal
  publisher is a separately human-approved hosted `release-publication` job
  that receives publication authority but no Apple private material, rechecks
  the exact packet and plan, and neither rebuilds nor re-signs artifacts. The
  local exact-record publisher can continue or recover the same idempotent plan
  but cannot weaken evidence or approval requirements. A trust approval never
  implies publication approval.
- **AC7.** Fail-closed immutable recovery. Identity, Team ID, runtime, timestamp,
  topology, byte, architecture, notarization, staple, Gatekeeper, native smoke,
  evidence, staging, cleanup, or publication-preflight failure stops the
  candidate before the dependent transition or public mutation. Notarization
  submission and polling have explicit finite deadlines and preserve every
  machine-readable request ID, status, diagnostic, and recovery action. An
  existing request is polled rather than resubmitted; upload retries only when
  evidence proves Apple created no request. Only `Accepted` advances. Bounded
  recovery of identical bytes retains the version, while any material byte or
  packaging change consumes the next unused preview version; failed and
  superseded attempts remain durable history.
- **AC8.** Nonpublishing live acceptance. From reviewed code pinned on `main`,
  a protected trusted-preview rehearsal produces a complete schema-version-2,
  publication-ready packet containing both architecture-specific trusted CLIs
  and DMGs, exactly one current native evidence document for each architecture,
  a sealed publication plan, and proof that no public release, Homebrew,
  Desktop-update, tag, or other publication surface changed. A maintainer
  direct-download, drag-to-Applications, quarantine, and first-launch check is
  optional; if performed, its architecture, release identity, DMG digest,
  outcome, and confirmation time are recorded, and its absence cannot block
  acceptance.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Public-channel trust policy | Internal candidates may be untrusted, every new public preview and stable macOS release requires Apple trust, and previews `.1` through `.4` remain truthful immutable unsigned history. | Any new public unsigned fallback exists, channel and trust are conflated, or historical preview facts are rewritten. | Policy unit tests, workflow-path tests, legacy release inspection, and representative schema-version-2 records. |
| R2 | Schema lifecycle and compatibility | New records enforce all twelve ordered stages and strict evidence binding, while valid version-1 records remain read-only inspectable under version dispatch. | A stage can be skipped or reordered, evidence can be fabricated or detached, new records use version 1, or version-1 history is rejected or upgraded in place. | State-machine tests, negative transition fixtures, version-1 fixtures, version-2 fixtures, and candidate inspection output. |
| R3 | CLI byte and bundle authority | Each signed macOS CLI is identical across standalone, Homebrew, `Contents/Helpers`, and mounted-DMG surfaces; the application seals it without re-signing and Linux remains unchanged. | Any surface uses unsigned, relocated, re-signed, or differing bytes; the helper remains in `Contents/Resources`; deep strict verification fails; or Linux identity changes. | Transformation records, SHA-256 and byte comparisons, codesign facts, package-contract tests, mounted-DMG inspection, and Linux regression tests. |
| R4 | Protected production and credential custody | One main-only protected producer creates both trusted architecture sets using validated product-specific configuration, no publication authority, one intentional upload root, and unconditional keychain and file cleanup. | Configuration is not validated, credential material can escape, output staging is broad, cleanup can be skipped, publication authority is present, or trusted work runs from an unreviewed ref. | Workflow-source assertions, signing-wrapper tests with fakes, failure-injection cleanup tests, artifact manifest inspection, and protected producer evidence. |
| R5 | Native Apple verification | Exactly one current native ARM64 and one current native Intel document contain every required identity, Apple, DMG/app Gatekeeper, CLI quarantine-execution, byte-equality, and smoke fact and pass strict aggregation. | Any architecture or required fact is absent, Rosetta substitutes for Intel, evidence is mutable, stale, duplicate, synthetic, cross-bound, or inconsistent, or an exit status is accepted without its required parsed facts. | Native evidence documents, evidence-schema tests, aggregation positive and negative fixtures, exact command records, and hosted runner results. |
| R6 | Finalization and publication separation | Every distribution surface and plan binds final bytes; hosted and local publishers consume the same sealed plan idempotently; trust and publication credentials and approvals remain disjoint. | Metadata is stale, publication rebuilds or re-signs, a trust job can publish, a publication job receives Apple material, approval is inferred across environments, or recovery changes the plan. | Final packet inspection, digest comparisons, permission and secret-name workflow tests, publication-adapter tests, and repeated/partial recovery tests. |
| R7 | Failure, notarization recovery, and version immutability | Every AC7 defect blocks at the correct boundary; bounded recovery preserves request continuity and identical-byte identity; changed bytes require a new version; all attempts remain inspectable. | A defective or indeterminate candidate advances, a known request is resubmitted, retries are unbounded, evidence is overwritten, changed bytes reuse a version, or a failed attempt disappears. | Fake-clock timeout tests, Apple-output fixtures, failure-injection tests, release-history inspection, version-burn tests, and negative publication preflights. |
| R8 | Protected nonpublishing rehearsal | A pinned-main run produces the complete two-architecture trusted packet and current evidence with an exact zero-public-mutation comparison; optional manual-install evidence is recorded correctly when supplied and is not required. | The packet or either native authority is incomplete, code is not pinned to reviewed `main`, any public state changes, inspection cannot bind every byte and planned action, or missing optional manual evidence blocks completion. | Hosted run URL and logs, sealed packet and inspection report, before/after public-state evidence, release-record history, and optional maintainer confirmation. |

## Out of scope

- Publishing the rehearsal packet or any other public release.
- Changing GateReeve's repository, universal-DMG topology, or release history.
- Replacing the team-wide Developer ID Application certificate.
- Removing native Intel support or accepting Rosetta as Intel authority.
- Introducing a shared runtime dependency between PortReeve and GateReeve.

## Changes

Append spec amendments here. Do not remove or weaken approved criteria.
