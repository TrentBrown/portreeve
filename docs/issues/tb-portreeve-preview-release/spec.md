# Spec - tb-portreeve-preview-release

**Feature:** `tb-portreeve-preview-release`
**Created:** 2026-08-16
**Design gate:** approved 2026-08-16

## Summary

PortReeve gains one deterministic, script-owned release pipeline for preparing
and publishing preview or stable releases. Preparation produces an auditable
release workspace without mutating public state. Publication consumes that
workspace only after explicit human authorization; it never rebuilds or
silently replaces artifacts.

The initial deliverable supports a truthful unsigned alpha preview: four native
CLI/server executables, separate macOS ARM64 and x64 Desktop DMGs, checksums,
Homebrew formula and cask material, a machine-readable release record, a public
installation guide, and persistent alpha messaging in README and Desktop. npm
publication remains independently disabled. Stable Desktop publication is
fail-closed until real Apple signing and notarization evidence is supplied.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** **Authoritative invocation and preparation boundary.** A maintainer
  can invoke `release:prepare` with an explicit channel and version. A valid
  preview request creates `dist/releases/<version>/` containing its artifacts,
  release record, publication plan, checksums, formula, and cask, then exits
  without creating a Git tag or release, changing a tap, or publishing npm. An
  invalid channel/version combination, dirty or inconsistent source identity,
  missing predecessor evidence, or attempted stage skip fails with an
  actionable error and no public mutation.

- **AC2.** **Complete promoted artifact set.** A prepared preview contains
  checksum-verified macOS and Linux ARM64/x64 CLI/server executables, the packed
  JavaScript client, separate macOS ARM64 and x64 Desktop DMGs, and all required
  distribution metadata. Each Desktop application contains the matching
  promoted macOS CLI bytes and records their filename, version, architecture,
  source release, and digest. Native jobs execute the applicable CLI and
  lifecycle checks; Desktop packaging and smoke evidence are architecture
  specific.

- **AC3.** **Auditable release record and exact-byte promotion.** The versioned
  release record identifies source repository and commit, independent server,
  Desktop, and client versions, pinned tools, maturity, channel, trust,
  publication state, every artifact's provenance/size/digest/platform, and
  required verification results. Later stages accept only the recorded
  predecessor and exact bytes. Signing is represented as an explicit
  transformation whose output digest becomes authoritative; no stage silently
  rebuilds, substitutes, or mutates a promoted artifact.

- **AC4.** **Preview, stable, and publication safety.** Preview permits absent
  Apple credentials only when maturity is `alpha`, channel is `preview`, trust
  is `unsigned`, the semantic version is a prerelease, and the GitHub result is
  a prerelease. Stable Desktop preparation/publication fails closed unless real
  Developer ID signing, hardened runtime, timestamps, notarization, stapling,
  Gatekeeper assessment, and native ARM64/x64 evidence are recorded. The
  publish command validates the completed record, presents or consumes the
  exact publication plan, requires explicit human confirmation, refuses an
  existing public version, and publishes without rebuilding.

- **AC5.** **Hosted workflow and independent channels.** Manual GitHub Actions
  dispatch accepts the same version/channel inputs and invokes the same
  repository release engine as local execution. Workflow jobs transport the
  recorded bytes through native verification and Desktop packaging, then hold
  public GitHub Release and tap changes behind the publication gate. GitHub
  preview preparation/publication does not require npm credentials, and npm is
  neither published nor allowed to block the preview path. Update metadata
  preserves independent maturity, channel, trust, and download identity and
  never advertises an unsigned preview as a stable upgrade.

- **AC6.** **Direct download and Homebrew behavior.** The publication plan uses
  GitHub Releases as the authoritative byte host, names separate ARM64/x64 DMGs
  as the primary Desktop downloads, and emits a cross-platform `portreeve`
  formula plus macOS `portreeve-app` cask for
  `TrentBrown/homebrew-portreeve`. Generated Homebrew material refers to the
  recorded artifact digests, installs the CLI or application, and does not
  silently install/start supervision or delete PortReeve data. Formula/cask
  syntax and clean install/uninstall behavior are verified without publishing
  the tap.

- **AC7.** **Truthful alpha and unsigned-preview experience.** README begins
  with a prominent Alpha Preview notice, and Desktop displays an accessible
  Alpha Preview indicator on every tab. The text distinguishes evolving product
  maturity from macOS trust. README, release notes/caveats, and the preview
  installation guide identify unsigned downloads, explain normal DMG and
  Homebrew installation, give Apple's scoped System Settings > Privacy &
  Security > Open Anyway flow, explain explicit Service setup, and distinguish
  service removal, application removal, and confirmed data deletion. No guide
  recommends disabling Gatekeeper globally or clearing quarantine broadly.

- **AC8.** **Operator documentation and equivalent entry points.**
  `docs/releasing.md` documents prerequisites, rehearsal, prepare, evidence
  review, publish, recovery, preview/stable policy, credentials, and exact
  artifact inventory. A project-local `release-portreeve` skill can prepare a
  release by invoking the repository scripts but cannot bypass publication
  approval or duplicate policy. Direct commands, skill-driven execution, and
  manual GitHub dispatch produce and consume the same versioned release-record
  contract, and automated documentation/contract tests detect drift among
  those entry points.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
| --- | --- | --- | --- | --- |
| R1 | Deterministic preparation boundary | Valid preview preparation creates the complete versioned workspace and performs no public mutation; invalid transitions fail before mutation. | Preparation omits required outputs, infers ambiguous inputs, skips evidence, or changes a public tag, release, tap, or npm package. | CLI integration tests with temporary workspaces and fake publication adapters; release workspace inspection; negative transition tests. |
| R2 | Complete native and Desktop artifacts | Four verified CLI/server targets, client archive, two architecture-specific DMGs, formula, cask, and checksums exist; each app embeds and records the exact matching CLI bytes and passes native evidence. | A target or DMG is absent, architecture is wrong, embedded bytes differ, identity is incomplete, or native/lifecycle/package smoke evidence is missing. | Manifest/digest assertions, Mach-O/ELF inspection, packaged-ASAR/resource inspection, native matrix jobs, Desktop smoke and DMG mount tests. |
| R3 | Release record and exact-byte state machine | The versioned record contains every required identity, policy, artifact, provenance, and verification field; all transitions validate predecessor state and exact digests, including explicit signing transformations. | Material provenance/evidence is absent, a transition accepts stale or altered bytes, or a downstream stage rebuilds/substitutes artifacts silently. | Schema/unit tests, tamper/stale-stage fixtures, digest comparisons across build/verify/embed/package, and release-record snapshots. |
| R4 | Policy and publication gates | Preview is correctly marked alpha/prerelease/unsigned; stable fails without complete real Apple evidence; publication requires confirmation, rejects existing versions, and consumes prepared bytes only. | Preview masquerades as stable/trusted, stable can fall back to unsigned, publication is implicit/rebuilds, or existing public bytes can be replaced. | Policy matrix tests with synthetic evidence, stable negative tests, fake GitHub/tap publication integration tests, and immutable-version/rebuild guards. |
| R5 | One local/hosted engine with npm decoupled | Manual dispatch and local commands call the same engine and record contract; native jobs preserve artifacts; GitHub/tap publication stays gated; npm authority is absent from and cannot block preview. | Workflow duplicates policy, rebuilds artifacts downstream, publishes on ordinary preparation, requires npm credentials, or advertises preview as stable. | Workflow source assertions, CI dry run/artifact inspection, fake hosted-flow integration tests, and update-manifest tests. |
| R6 | Direct-download and Homebrew lifecycle semantics | DMG/formula/cask metadata uses recorded GitHub assets and digests; clean install/uninstall works; supervision and purge remain explicit separate actions. | Metadata points at unrecorded bytes, installation silently starts supervision, or uninstall deletes preserved data. | Ruby/cask syntax checks, local Homebrew and DMG verification, lifecycle-state assertions, and generated publication-plan inspection. |
| R7 | Alpha UX and safe installation guidance | README and every Desktop tab visibly identify Alpha Preview; all installation/removal paths and scoped Gatekeeper steps are accurate, accessible, and omit unsafe bypasses. | Alpha status is hidden, trust and maturity are conflated, required steps are missing, or unsafe Gatekeeper/quarantine advice appears. | README/document assertions, renderer/accessibility tests, packaged Desktop smoke/manual visual review, and prohibited-text tests. |
| R8 | Operator entry points and drift protection | Runbook, project skill, direct scripts, and manual workflow expose the documented common contract; the skill cannot publish without the same human gate; drift tests pass. | An entry point has different semantics, duplicates policy, bypasses approval, lacks recovery guidance, or documentation disagrees with executable behavior. | Documentation tests, skill fixture/invocation tests, command help snapshots, workflow input assertions, and release-record compatibility tests. |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
