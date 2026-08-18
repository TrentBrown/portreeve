# Design - tb-portreeve-release-versioning

**Feature:** `tb-portreeve-release-versioning`
**Created:** 2026-08-18
**Status:** approved

## Problem

PortReeve currently records `0.1.0-preview.N` as the GitHub release identity but
builds and publishes components identified as `0.1.0`. Homebrew compares the
component version, so it cannot discover a later preview of the same base
version. Desktop update comparison has the same blind spot.

## Chosen model

The operator-supplied coordinated semantic release version is authoritative for
every distributed PortReeve surface:

- compiled CLI behavior and native artifact filenames;
- packed JavaScript client metadata and runtime client identity;
- release record component versions and manifest versions;
- Homebrew formula and cask versions;
- Desktop DMG filenames, packaged PortReeve release identity, update metadata,
  and update comparison.

Checked-in package files retain a base development version. Release building
validates that the coordinated version's semantic core equals that base version,
then injects the coordinated version into immutable release outputs. This keeps
release invocation deterministic and avoids a manual multi-file version-bump
precondition.

The macOS `CFBundleShortVersionString` may remain the numeric base version because
Apple defines that field independently from semantic prerelease identity. A
packaged PortReeve metadata field carries the coordinated version, and Desktop
uses it instead of `app.getVersion()` for product identity and update checks.

## Invariants

1. All release-record component versions equal the coordinated release version.
2. Every native executable reports the coordinated version through `--version`.
3. Formula and cask versions equal the coordinated version.
4. The packed client package and exported client version equal the coordinated
   version.
5. The packaged Desktop reports and compares the coordinated version even when
   its Apple bundle version remains numeric.
6. A stable release has no prerelease suffix; a preview release has one; both
   must share their semantic core with source component versions.
7. Existing public releases and assets are never rewritten.

## Rejected alternatives

- **Homebrew-only revision bumps:** fixes one installer while leaving CLI,
  Desktop updates, records, and client identity inconsistent.
- **Manual edits to all package files before release:** introduces an operator
  ceremony and dirty-checkout problems into an otherwise deterministic pipeline.
- **Treat preview.3 as a one-time exception:** repeats the defect at preview.4.

## Approval record

Approved by the user on 2026-08-18 through the instruction to correct the
recurring preview-version problem immediately.
