# Decision Scratchpad - tb-portreeve-preview-release

**Feature start:** 2026-08-16

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Use one ordered release record as the stage authority

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Release scripts, hosted workflow, artifact verification, Desktop packaging, and publication tooling

Adopt release-record schema version 1 with orthogonal release identity, component versions, maturity, channel, trust, ordered stage evidence, artifact digests, and publication state. Persist it atomically and require every later stage to validate the recorded ordered prefix and exact artifact identity.

**Triggered by:** The first implementation slice needed a durable contract that could reject skipped stages and altered artifact bytes

**Alternatives considered:**
Keep extending manifest.json - rejected because the legacy build manifest has no transition or publication authority. Infer state from files in dist - rejected because presence does not prove provenance or verification.

## [2] Separate coordinated release tags from component versions

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** GitHub tag URLs, Homebrew formula rendering, artifact filenames, and release metadata

Treat releaseVersion as the coordinated publication identity while server, Desktop, and client retain independent versions. Homebrew artifact filenames and installed version use the server version, while download URLs use the coordinated GitHub release tag.

**Triggered by:** Preview tag 0.1.0-preview.1 may coordinate server, Desktop, and client components that each still report version 0.1.0

**Alternatives considered:**
Force every component version to equal the release tag - rejected because the approved design keeps component versions independently visible. Reuse the server version as the GitHub tag - rejected because it cannot represent successive coordinated previews without changing component identity.

## [3] Transport immutable native evidence fragments and aggregate once

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Native verification commands, CI artifact transport, release-record validation, and the hosted matrix

Each native runner consumes the promoted artifact set and emits an independent
schema-versioned verification fragment bound to the release ID, source commit,
target, and exact executable digest. A single aggregator validates the complete
four-target matrix, orders it deterministically, and advances the release record
once without rebuilding or allowing concurrent runners to mutate shared state.

**Triggered by:** P3 requires macOS/Linux ARM64/x64 evidence to survive runner transport while preserving exact build-once bytes

**Alternatives considered:**
Let each native runner update the release record - rejected because concurrent
artifact jobs would race and produce order-dependent state. Rebuild on every
runner - rejected because verification would no longer apply to the promoted
bytes. Record only CI job success - rejected because it would not bind evidence
to the source and artifact identities.

## [4] Package each Desktop architecture around one explicit promoted CLI

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Desktop packaging, DMG assets, release stages, Homebrew cask, and hosted macOS jobs

Make Desktop packaging accept the prepared release artifact directory and
target architecture explicitly. Embed and attest the exact matching CLI digest,
inspect the app before and after mounting its conventional architecture-specific
DMG, and join both package results before advancing distribution state. The cask
installs only the application and explains that supervised service uninstall and
data purge remain separate explicit operations.

**Triggered by:** P4-P5 require reproducible direct-download and Homebrew Desktop artifacts without transferring service or data lifecycle authority to the application installer

**Alternatives considered:**
Let Desktop packaging discover `dist/release` implicitly - rejected because
hosted transport needs an explicit promoted input. Put both architectures in a
universal app - rejected because the embedded CLI is architecture-specific and
the design calls for separately verifiable native packages. Let cask removal
purge service data - rejected because supervision and user data have independent
safety boundaries.
