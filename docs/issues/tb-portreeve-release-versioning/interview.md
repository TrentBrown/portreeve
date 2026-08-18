# Interview - tb-portreeve-release-versioning

**Feature start:** 2026-08-18
**Status:** complete

## Trigger

Publishing `0.1.0-preview.3` exposed that the public release identity and every
installed component still reported `0.1.0`. Homebrew therefore treated an
installed preview.2 as current after the tap moved to preview.3.

## Settled intent

- The defect is recurring for every preview sharing the same base version, not
  a one-time repair for the current sole user.
- The coordinated semantic release version supplied to release preparation is
  the installed identity of the CLI, JavaScript client, Desktop release, formula,
  and cask.
- Homebrew must order successive previews and the eventual stable version as
  `preview.2 < preview.3 < preview.4 < 0.1.0`.
- Development checkouts may retain the base source version (`0.1.0`). Release
  preparation must inject the coordinated identity deterministically rather
  than requiring an operator to edit several package files before every run.
- macOS bundle metadata that is constrained to numeric versions may retain the
  base version. PortReeve's own packaged runtime identity and update comparison
  must still use the coordinated prerelease version.
- Published preview.3 remains immutable. The correction applies to future
  releases beginning with preview.4.

## Boundaries

- Do not republish or alter preview.3.
- Do not add npm publication; the packed client remains release evidence only.
- Preserve the build-once evidence and protected publication model.
- Reject a coordinated release whose semantic core does not match the checked-in
  base component version.

## Approval

The user approved correcting this immediately after the release audit explained
the recurring behavior and recommended one coordinated version across distributed
surfaces.
