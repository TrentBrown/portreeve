# Spec - tb-portreeve-release-versioning

**Feature:** `tb-portreeve-release-versioning`
**Created:** 2026-08-18

## Summary

Future releases use the coordinated semantic release version as the observable
identity of every distributed PortReeve component, allowing Homebrew and Desktop
to detect successive previews of the same base version.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1. Coordinated CLI identity.** Preparing `0.1.0-preview.4` from a
  `0.1.0` source produces native artifacts named with `0.1.0-preview.4`, and
  each executable reports `0.1.0-preview.4` from `--version`.
- **AC2. Coordinated package and Homebrew identity.** The packed JavaScript
  client, release manifest, release record, formula, and cask all identify the
  release as `0.1.0-preview.4`; Homebrew orders preview.4 after preview.3 and
  before stable `0.1.0`.
- **AC3. Coordinated Desktop identity.** The Desktop DMG, packaged runtime
  metadata, update manifest, and update comparison use `0.1.0-preview.4` even
  if the Apple bundle's numeric version remains `0.1.0`.
- **AC4. Source compatibility guard.** Preparation refuses a coordinated
  version whose semantic core differs from the checked-in server, client, or
  Desktop base version, and continues enforcing preview/stable policy.
- **AC5. Release safety and regression coverage.** Focused release, Desktop,
  Homebrew smoke, and full repository checks pass without changing publication
  gates or mutating preview.3.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | CLI artifacts carry coordinated version | Native names and `--version` use the requested prerelease | Any native output retains only the base version | Focused build/runtime tests |
| R2 | Client and Homebrew carry coordinated version | Tarball, formula, and cask use the requested prerelease and order correctly | Any uses only the base version or cannot upgrade | Metadata tests and Homebrew smoke fixture |
| R3 | Desktop carries coordinated release identity | DMG/runtime/update surfaces use the prerelease while bundle numeric version remains valid | Desktop update comparison remains blind to preview increments | Desktop packaging/update tests |
| R4 | Mismatched source/release cores fail closed | Preparation rejects a different semantic core | A `0.2.0-preview.1` release builds from `0.1.0` sources | Unit tests for version validation |
| R5 | Existing release guarantees remain intact | Full check and focused release suites pass; no publication occurs | Regression, weakened gate, or public mutation | Verification transcript and clean diff |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
