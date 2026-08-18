# Decision Scratchpad - tb-portreeve-release-versioning

**Feature start:** 2026-08-18

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Inject release identity without mutating source package versions

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** native builds, client packing, Desktop packaging, records,
Homebrew metadata, and update checks

Keep checked-in package versions as the development base and inject the
operator-approved coordinated version into immutable release outputs. Validate
that their semantic cores match before building.

**Triggered by:** preview.2 and preview.3 both appearing to Homebrew as `0.1.0`

**Alternatives considered:**
- Homebrew revision only - leaves every other distributed identity inconsistent.
- Edit all package versions before release - adds manual ceremony and conflicts
  with the clean-source release precondition.

## [2] Preserve numeric Apple bundle version separately

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** macOS packaging and Desktop update identity

Keep the source base version in `CFBundleShortVersionString`, but embed the
coordinated semantic release version in PortReeve package metadata and use it
for product reporting and update comparisons.

**Triggered by:** Apple bundle version constraints do not model semantic
prerelease identifiers cleanly.

**Alternatives considered:**
- Put the prerelease string directly in the Apple bundle version - avoid because
  stable signing/notarization will require Apple-conformant numeric metadata.
