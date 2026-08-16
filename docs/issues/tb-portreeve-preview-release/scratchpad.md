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
