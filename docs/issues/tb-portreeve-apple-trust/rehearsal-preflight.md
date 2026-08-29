# Protected Rehearsal Attempt

**Checked:** 2026-08-29T21:01:52Z
**First attempted release:** `0.1.0-preview.5`
**Second attempted release:** `0.1.0-preview.6`
**Third attempted release:** `0.1.0-preview.7`
**Next planned release:** `0.1.0-preview.8`
**Required dispatch:** `channel=preview`, `trust=true`, `publish=false`
**Latest pinned source:** `2042850b8f8573e6b1b77c4c41ead68677cebae9` on `main`
**Runs:** [preview.5](https://github.com/TrentBrown/portreeve/actions/runs/33267482516), [preview.6](https://github.com/TrentBrown/portreeve/actions/runs/33269593936), [preview.7](https://github.com/TrentBrown/portreeve/actions/runs/33272715923)
**Status:** READY FOR CORRECTED PREVIEW.8 NONPUBLISHING REHEARSAL

## Passed checks

- GitHub authentication is active for `TrentBrown` with repository and workflow
  access.
- `.github/workflows/release.yml` is active as workflow ID `323987239`.
- Remote `main` is the exact reviewed PR #79 merge commit
  `2042850b8f8573e6b1b77c4c41ead68677cebae9`.
- The latest public release remains `v0.1.0-preview.4`.
- No release or Git tag exists for `v0.1.0-preview.5`.
- The local login keychain contains one valid expected signing identity:
  `Developer ID Application: Trent Brown (PMWYD5A82A)`.
- The existing `release-publication` environment remains protected by required
  human review. It was not entered or changed.

## Public-state baseline

| Surface | Before-state authority |
|---|---|
| PortReeve `main` | `2042850b8f8573e6b1b77c4c41ead68677cebae9` |
| GitHub Releases | latest `v0.1.0-preview.4`; `.5`, `.6`, `.7`, and `.8` absent |
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

## Corrected attempt outcome - `0.1.0-preview.6`

PR #77 merged to `main` as
`0a28b89c23ddd553467eae0fe8bb89a84ac78ddc`. Hosted run
[33269593936](https://github.com/TrentBrown/portreeve/actions/runs/33269593936)
then repeated the nonpublishing protected rehearsal with `trust=true` and
`publish=false`.

- `prepare`, all four native CLI evidence jobs, and `qualify-trust` passed.
- The protected reviewer approved only `release-trust`; publication remained
  disabled and `release-publication` was never entered.
- Apple accepted notarization request
  `237759d8-5496-404a-ad71-4e9304591973` for the ARM64 signed DMG.
- Failure recovery uploaded `trusted-recovery-0.1.0-preview.6-1`, containing
  the exact pre-staple DMG and sanitized request history. Its recorded and
  observed SHA-256 both equal
  `f647f01868e116e73940e421202d7d680751141d2b5b69823c30f6a2574ffb1b`.
- Local assessment of those preserved bytes produced the real `spctl` shape
  `<path>: accepted`, `source=Notarized Developer ID`, and
  `origin=Developer ID Application: Trent Brown (PMWYD5A82A)`.
- `parseGatekeeperFacts` required a bare `accepted` line and rejected the
  valid assessment before the x64 trusted set was produced. Downstream native
  Apple evidence and finalization were therefore skipped.

GateReeve recorded and validated
`chg-gatekeeper-path-prefixed-acceptance`, abandoned final slice 6, and started
intermediate `slice-07-gatekeeper-parser` on branch
`tb-portreeve-apple-trust-07-gatekeeper-parser`. The correction accepts only
the bare or real path-prefixed acceptance status while continuing to require
exit code zero, `Notarized Developer ID`, and the exact signing origin. The
next hosted rehearsal must use the unused `.7` identity after this change
lands on reviewed `main`. No `development*` branch was merged or rebased.

## Preview.7 readiness

PR #78 merged the governed Gatekeeper parser correction to `main` as
`de43dae24f2629748b1c1a3376c478e183e0ec33`. GateReeve recorded the reviewed
merge and started feature-final `slice-08-live-acceptance` from that exact
commit. The next dispatch is `channel=preview`, version
`0.1.0-preview.7`, `trust=true`, and `publish=false`. It retains separate
ARM64 and x64 DMGs and enters only the protected `release-trust` environment;
it cannot enter `release-publication` or mutate a public surface.

## Preview.7 outcome

Run [33272715923](https://github.com/TrentBrown/portreeve/actions/runs/33272715923)
used reviewed `main` commit
`de43dae24f2629748b1c1a3376c478e183e0ec33`, `trust=true`, and
`publish=false`. Preparation, all four native CLI jobs, qualification, and the
human-approved `release-trust` entry passed. Apple accepted request
`2e9f8382-58d1-4d8e-a2d6-5ad32d6ce4aa` for the exact preserved ARM64 DMG at
SHA-256 `02e11e0bec065bff8dc9d546cbf44316b29b784dc7793f5d121d5debd6890a3b`.

The exact producer command and an independent local replay both returned exit
zero, `<path>: accepted`, and `source=Notarized Developer ID`, with no
`origin=` display line. The parser still required that optional line even
though the producer separately required exact Developer ID and Team ID facts
from `codesign`. GateReeve preserved recovery artifact
`trusted-recovery-0.1.0-preview.7-1`, abandoned final slice 8, validated
`chg-gatekeeper-optional-origin-display`, and started intermediate slice 9.

After the failed run, the latest public release remained
`v0.1.0-preview.4`; `.7` had no release or tag; Desktop update blob
`95374af5de460b0865aaab2a7732db8e1bdd5203`, Homebrew `main`
`23be9c4a5897807bb29a64076d1c84a3bcff2ea5`, formula blob
`759d2635fd84ab7ce2969c7ca51edad09ece3228`, and cask blob
`fadae00919d8bc43fe7a7dcd9973b2c9b10d7541` were unchanged. Publication and
all dependent jobs were skipped.

## Preview.8 readiness

PR #79 merged the governed optional-origin correction to `main` as
`2042850b8f8573e6b1b77c4c41ead68677cebae9`. GateReeve recorded the reviewed
merge and started feature-final `slice-10-live-acceptance` from that exact
commit. The next dispatch is `channel=preview`, version
`0.1.0-preview.8`, `trust=true`, and `publish=false`. It retains separate
ARM64 and x64 DMGs, requires the independently configured `release-trust`
approval, and cannot enter `release-publication` or mutate any public surface.
The correction accepts an omitted Gatekeeper `origin=` display line only while
exact Developer ID identity, Team ID, hardened runtime, and secure timestamp
remain mandatory through independent `codesign` evidence.
