# Protected Rehearsal Attempt

**Checked:** 2026-08-29T15:37:10Z
**Planned release:** `0.1.0-preview.5`
**Required dispatch:** `channel=preview`, `trust=true`, `publish=false`
**Pinned source:** `4f4610f27639a09ba53692757971ea0ce7af7061` on `main`
**Run:** [33267482516](https://github.com/TrentBrown/portreeve/actions/runs/33267482516)
**Status:** FAILED IN PROTECTED PRODUCER; CORRECTION REQUIRED

## Passed checks

- GitHub authentication is active for `TrentBrown` with repository and workflow
  access.
- `.github/workflows/release.yml` is active as workflow ID `323987239`.
- Remote `main` is the exact reviewed PR #76 merge commit
  `4f4610f27639a09ba53692757971ea0ce7af7061`.
- The latest public release remains `v0.1.0-preview.4`.
- No release or Git tag exists for `v0.1.0-preview.5`.
- The local login keychain contains one valid expected signing identity:
  `Developer ID Application: Trent Brown (PMWYD5A82A)`.
- The existing `release-publication` environment remains protected by required
  human review. It was not entered or changed.

## Public-state baseline

| Surface | Before-state authority |
|---|---|
| PortReeve `main` | `4f4610f27639a09ba53692757971ea0ce7af7061` |
| GitHub Releases | latest `v0.1.0-preview.4`; `.5` absent |
| PortReeve Desktop update blob | `95374af5de460b0865aaab2a7732db8e1bdd5203` |
| Homebrew repository `main` | `23be9c4a5897807bb29a64076d1c84a3bcff2ea5` |
| Homebrew formula blob | `759d2635fd84ab7ce2969c7ca51edad09ece3228` |
| Homebrew cask blob | `fadae00919d8bc43fe7a7dcd9973b2c9b10d7541` |

The protected workflow was subsequently dispatched with `trust=true` and
`publish=false`. No tag, release, Homebrew change, Desktop-update change, or
other publication mutation was authorized.

## External configuration completed

The PortReeve repository now has a protected `release-trust` environment
restricted to `main`, with Trent Brown as required reviewer. The expected
Developer ID identity, Team ID, product-specific `PortReeve Notarization` key
metadata, P12, P12 password, and P8 were configured under independently named
PortReeve variables and secrets. The user verified the P8 with
`notarytool history` before dispatch. No secret value was written to this
record.

The protected reviewer approved only the nonpublishing `release-trust` job.
The `release-publication` environment was never entered.

## Attempt outcome

- `prepare`, all four native CLI evidence jobs, and `qualify-trust` passed.
- The protected `release-trust` job ran as job `99140564407` and reached the
  real signed-DMG notarization submission.
- Apple returned a valid request UUID but omitted `status`, which is the normal
  shape of an asynchronous successful `notarytool submit` response.
- `parseNotarytoolFacts` accepted the UUID and then failed because it required
  status before the producer's existing `notarytool info` loop could begin.
- The exact failure was `Apple notarization status must be a non-empty string.`
- Both native Apple trust jobs, trusted finalization, and publication were
  skipped. No public mutation occurred.

The defective producer did not print or persist the returned request UUID and
deleted its signed output on failure. The request therefore cannot be safely
continued from repository or workflow evidence. `0.1.0-preview.5` is burned;
the next protected attempt must use `0.1.0-preview.6` after the correction
lands on reviewed `main`.

## After-state proof

Read-only checks after the failed workflow confirmed the same authorities as
the baseline:

| Surface | After state |
|---|---|
| PortReeve `main` | `4f4610f27639a09ba53692757971ea0ce7af7061` |
| GitHub Releases | latest remains `v0.1.0-preview.4`; `.5` absent |
| PortReeve Desktop update blob | `95374af5de460b0865aaab2a7732db8e1bdd5203` |
| Homebrew repository `main` | `23be9c4a5897807bb29a64076d1c84a3bcff2ea5` |
| Homebrew formula blob | `759d2635fd84ab7ce2969c7ca51edad09ece3228` |
| Homebrew cask blob | `fadae00919d8bc43fe7a7dcd9973b2c9b10d7541` |

## Governed correction

GateReeve abandoned slice 4 and started
`slice-05-notarization-submit-recovery` on branch
`tb-portreeve-apple-trust-05-notarization-submit-recovery`. The approved
correction keeps the existing architecture-specific installer and explicit
polling design. It separates submit parsing from strict info parsing, wires the
real producer through the finite recovery state machine, retains exact signed
candidate bytes with sanitized non-secret request history, and uploads that
recovery directory only when the protected producer fails. No `development*`
branch is merged or rebased into the correction branch.
