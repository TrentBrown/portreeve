# Decisions - tb-portreeve-preview-release

**Feature start:** 2026-08-16

Permanent record of decisions promoted from `scratchpad.md`.

---

## Use one ordered release record as the stage authority

**Confidence:** HIGH

**Blast Radius:** Release scripts, hosted workflow, artifact verification, Desktop packaging, and publication tooling

Adopt release-record schema version 1 with orthogonal release identity, component versions, maturity, channel, trust, ordered stage evidence, artifact digests, and publication state. Persist it atomically and require every later stage to validate the recorded ordered prefix and exact artifact identity.

**Triggered by:** The first implementation slice needed a durable contract that could reject skipped stages and altered artifact bytes

**Alternatives considered:**
Keep extending manifest.json - rejected because the legacy build manifest has no transition or publication authority. Infer state from files in dist - rejected because presence does not prove provenance or verification.

**Promoted:** 2026-08-16. PR: #57.

---

## Separate coordinated release tags from component versions

**Confidence:** HIGH

**Blast Radius:** GitHub tag URLs, Homebrew formula rendering, artifact filenames, and release metadata

Treat releaseVersion as the coordinated publication identity while server, Desktop, and client retain independent versions. Homebrew artifact filenames and installed version use the server version, while download URLs use the coordinated GitHub release tag.

**Triggered by:** Preview tag 0.1.0-preview.1 may coordinate server, Desktop, and client components that each still report version 0.1.0

**Alternatives considered:**
Force every component version to equal the release tag - rejected because the approved design keeps component versions independently visible. Reuse the server version as the GitHub tag - rejected because it cannot represent successive coordinated previews without changing component identity.

**Promoted:** 2026-08-16. PR: #57.

---

## Transport immutable native evidence fragments and aggregate once

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

**Promoted:** 2026-08-16. PR: #58.
