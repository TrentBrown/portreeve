# Protected Rehearsal Preflight

**Checked:** 2026-08-29T15:37:10Z
**Planned release:** `0.1.0-preview.5`
**Required dispatch:** `channel=preview`, `trust=true`, `publish=false`
**Pinned source:** `4f4610f27639a09ba53692757971ea0ce7af7061` on `main`
**Status:** PAUSED BEFORE DISPATCH

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

No tag, release, Homebrew change, Desktop-update change, workflow dispatch, or
other public mutation was performed during this preflight.

## Blocking check

The PortReeve repository has no GitHub environment named `release-trust`.
Repository-level Actions variables and secrets are also empty, so there is no
authorized credential source for the protected producer. Triggering the
workflow now would either create an unprotected empty environment or fail
configuration validation; neither would supply valid Apple trust evidence.

GateReeve has an older `release-publication` environment with GateReeve-named
Apple configuration, but the approved PortReeve design explicitly rejects
sharing GateReeve's notarization key. Its secret values are not readable or
transferable through GitHub and were not used.

## Required external configuration

Create a protected `release-trust` environment restricted to `main`, with
Trent Brown as a required reviewer, and configure these non-secret variables:

- `PORTREEVE_APPLE_SIGNING_IDENTITY` =
  `Developer ID Application: Trent Brown (PMWYD5A82A)`
- `PORTREEVE_APPLE_TEAM_ID` = `PMWYD5A82A`
- `PORTREEVE_APPLE_NOTARY_KEY_ID` = the new PortReeve-specific App Store
  Connect key ID
- `PORTREEVE_APPLE_NOTARY_ISSUER_ID` = the matching issuer ID
- `PORTREEVE_APPLE_NOTARY_KEY_NAME` = `PortReeve Notarization`

Configure these environment secrets without placing their values in source,
logs, or conversation text:

- `PORTREEVE_APPLE_CERTIFICATE_P12_BASE64`
- `PORTREEVE_APPLE_CERTIFICATE_PASSWORD`
- `PORTREEVE_APPLE_NOTARY_KEY_P8_BASE64`

Once the environment exists, resume GateReeve and dispatch the exact reviewed
`main` workflow with `publish=false`. The environment approval authorizes only
Apple trust production; it does not authorize publication.
