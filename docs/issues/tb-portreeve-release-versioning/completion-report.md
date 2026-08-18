# Completion Report - Coordinated Preview Release Identity

**Status:** Complete and awaiting human review in PR
[#72](https://github.com/TrentBrown/portreeve/pull/72)

## Outcome

PortReeve now treats an operator-supplied release version such as
`0.1.0-preview.4` as the observable identity of every distributed component. CLI
binaries, the client archive, records and manifests, Homebrew metadata, Desktop
metadata and update comparison, and release filenames agree on that identity.

Checked-in packages remain at their base development version. The release engine
requires the requested version to share that semantic core and injects the full version
only into immutable outputs. Apple bundle metadata remains numeric while PortReeve's
own packaged metadata retains the prerelease.

## Acceptance and Rubric

All acceptance criteria AC1-AC5 and rubric criteria R1-R5 pass. The complete evidence
packet is [`pr-72/boundary.json`](pr-72/boundary.json).

## Verification Summary

- Full repository gate: 550 tests passed, 0 failed; typecheck, lint, formatting, and
  generated documentation passed.
- Real preview.4 candidate: all four native formats built; the macOS ARM64 executable
  reported preview.4 and passed native server smoke.
- Desktop: ARM64 package and launch smoke reported preview.4 while Apple's short version
  remained 0.1.0.
- Homebrew: the generated formula and cask retain preview.4, and Homebrew orders it after
  preview.3 and before stable 0.1.0.
- Publication: not performed; preview.3 and public distribution state remain untouched.

## Retention

The feature-final workflow check reports `tracked`: every feature-record file is retained
in Git, and no human retention exception is required.

## Remaining Human Action

Review and merge PR #72. A later, separately authorized preview release will provide the
first public end-to-end exercise of the corrected identity.
