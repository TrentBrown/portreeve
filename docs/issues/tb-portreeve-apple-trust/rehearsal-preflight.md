# Protected Rehearsal Attempt

**Checked:** 2026-08-30T00:18:39Z
**First attempted release:** `0.1.0-preview.5`
**Second attempted release:** `0.1.0-preview.6`
**Third attempted release:** `0.1.0-preview.7`
**Fourth attempted release:** `0.1.0-preview.8`
**Successful release:** `0.1.0-preview.10`
**Required dispatch:** `channel=preview`, `trust=true`, `publish=false`
**Latest pinned source:** `1da97cb2a1983fe416f6abab763e6b4b06222c9f` on `main`
**Runs:** [preview.5](https://github.com/TrentBrown/portreeve/actions/runs/33267482516), [preview.6](https://github.com/TrentBrown/portreeve/actions/runs/33269593936), [preview.7](https://github.com/TrentBrown/portreeve/actions/runs/33272715923), [preview.8](https://github.com/TrentBrown/portreeve/actions/runs/33276106920), [preview.9](https://github.com/TrentBrown/portreeve/actions/runs/33279682396), [preview.10](https://github.com/TrentBrown/portreeve/actions/runs/33281790384)
**Status:** PREVIEW.10 PASSED; FEATURE-FINAL EVALUATION IN PROGRESS

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

## Preview.8 outcome

Run [33276106920](https://github.com/TrentBrown/portreeve/actions/runs/33276106920)
used reviewed `main` commit
`2042850b8f8573e6b1b77c4c41ead68677cebae9`, `trust=true`, and
`publish=false`. Attempt 1 and GitHub rerun attempt 2 each passed preparation,
all four native CLI jobs, qualification, protected approval, signing, both
architecture-specific DMGs, and Apple acceptance for both architectures.

The accepted requests were:

- attempt 1 ARM64 `63a299ac-cb95-42ce-ac9b-7b5e39ec3f20`, candidate SHA-256
  `7e00be8915b1cd15c07a0ec8af583a9dc21f52467ef6f24b4b54723c981e6822`;
- attempt 1 x64 `361fc2e2-923a-429e-b242-a92ef0f1c159`, candidate SHA-256
  `8e6ecaeefb7b6c2b608c1763b7d94069e5f471ccf4e6dba48d929058986d144c`;
- attempt 2 ARM64 `90c075d3-12ef-44d6-8e15-f4ffdf8dfad6`, candidate SHA-256
  `c7ba008652e341c0eb915100202655520d0c792350c80359c669523c665c731b`;
- attempt 2 x64 `63207094-b916-49bd-93e4-bef278eb12e0`, candidate SHA-256
  `6c9c96cd13d076463f6d11b44991691f2c18e4393561a2812d0facac12bbe4ad`.

Both attempts then failed with `Trusted manifest predecessor identity is
invalid.` The producer had copied an already rewritten signed manifest over
the output and then invoked the authoritative rewrite, whose fail-closed input
contract correctly required predecessor identities. It also deleted the
request-bound candidate DMGs before that later step, so recovery artifacts
`trusted-recovery-0.1.0-preview.8-1` and
`trusted-recovery-0.1.0-preview.8-2` contain sanitized histories but not the
candidate bytes. `.8` is burned.

Read-only after-state checks found no `.8` tag or release and confirmed the
unchanged baseline: PortReeve `main`
`2042850b8f8573e6b1b77c4c41ead68677cebae9`, Desktop update blob
`95374af5de460b0865aaab2a7732db8e1bdd5203`, Homebrew `main`
`23be9c4a5897807bb29a64076d1c84a3bcff2ea5`, formula blob
`759d2635fd84ab7ce2969c7ca51edad09ece3228`, and cask blob
`fadae00919d8bc43fe7a7dcd9973b2c9b10d7541`.

GateReeve abandoned final slice 10, approved and validated
`chg-post-notary-finalization-atomicity`, and started intermediate slice 11 on
`tb-portreeve-apple-trust-11-post-notary-finalization`. The correction stages
one predecessor metadata set, performs one authoritative rewrite, retains
request-bound candidates until durable producer evidence, and rejects
`GITHUB_RUN_ATTEMPT > 1` before credential activation. GitHub **Re-run jobs**
must not be used after protected trust begins. After this correction is
reviewed and merged, the next nonpublishing rehearsal must dispatch the unused
`0.1.0-preview.9` identity from reviewed `main`.

## Preview.9 outcome

Run [33279682396](https://github.com/TrentBrown/portreeve/actions/runs/33279682396)
used reviewed `main` commit
`bfa64a9d930154ce0509c67b23a81ee1aa601221`, `trust=true`, and
`publish=false`. Preparation, all four preliminary native jobs,
qualification, protected approval, signing, notarization, stapling, and atomic
trusted staging passed for both separate architecture-specific sets. Apple
accepted ARM64 request `9757340b-aa28-4af7-980a-0fc41c520ae6` and x64 request
`3bb773dd-b6ea-4944-af47-d4acd83317f0`. Trusted artifact `9722728731`
preserves the exact producer output and sanitized request histories.

Both independent native jobs then failed at the first standalone-CLI
`spctl --assess --type execute` call. ARM64 job `99173799416` and x64 job
`99173799405` each received exit 3 and "the code is valid but does not seem to
be an app." Downloaded producer bytes reproduce that result for both CLIs,
while both DMGs return exit zero with `source=Notarized Developer ID`. The
mounted ARM64 application passes deep strict signature verification and
Gatekeeper execution assessment; its embedded helper SHA-256 exactly matches
the standalone CLI; a quarantined copy of the signed CLI executes and reports
`0.1.0-preview.9`.

This is a trust-surface specification error, not an Apple credential,
notarization, signature, or installer failure. GateReeve assesses Gatekeeper on
its app and DMG and validates executable code through signing and runtime
checks. GateReeve change `chg-cli-gatekeeper-surface-alignment` therefore
supersedes interview decision D10: PortReeve retains DMG/app Gatekeeper checks
and replaces the invalid bare-CLI app assessment with exact signing identity,
hardened runtime, secure timestamp, byte equality, native lifecycle smoke, and
quarantined execution. Production code remains unchanged until the corrected
spec and plan are reauthorized.

Read-only after-state checks found no `.9` tag or release; the latest public
release remains `.4`; Desktop update blob
`95374af5de460b0865aaab2a7732db8e1bdd5203`, Homebrew `main`
`23be9c4a5897807bb29a64076d1c84a3bcff2ea5`, formula blob
`759d2635fd84ab7ce2969c7ca51edad09ece3228`, and cask blob
`fadae00919d8bc43fe7a7dcd9973b2c9b10d7541` remain unchanged. Publication and
all dependent jobs were skipped. Preview.9 is consumed evidence and must not be
reused; the next protected attempt uses preview.10 only after the correction
lands on reviewed `main`.

## Preview.10 outcome

PR #81 merged the governed trust-surface correction to reviewed `main` as
`1da97cb2a1983fe416f6abab763e6b4b06222c9f`. Run
[33281790384](https://github.com/TrentBrown/portreeve/actions/runs/33281790384)
then used that exact source with `channel=preview`, `trust=true`, and
`publish=false`.

The complete hosted matrix passed: preparation, all four preliminary native
jobs, credential-free qualification, the protected producer, independent
native ARM64 and Intel Apple trust verification, and trusted distribution
finalization. Apple accepted ARM64 request
`f9666ed3-036e-4893-8e7f-72527f3538fe` and x64 request
`8802be2d-776b-4726-bbad-e450170eca54`. Both exact DMGs are signed, notarized,
stapled, Gatekeeper-accepted, and paired with applications and signed CLIs that
passed every required current native check. The sealed publication-plan digest
is `ac75019cd5addd954d8611142d6419fc96b0e1b5952fa030f2b23ca7408fee9d`.

The downloaded 13-artifact record passed `release:inspect`. The disposable
Homebrew smoke stopped safely before changing this machine because formula and
cask `0.1.0-preview.4` are already installed; they were preserved. The
physical-machine/cross-architecture installation check remains optional.

The `publish` job was skipped. Read-only after-state checks found no preview.10
tag or release and confirmed unchanged Desktop update, Homebrew `main`, formula,
and cask authorities. The full exact-byte and zero-public-mutation record is in
[`preview-10-acceptance.md`](preview-10-acceptance.md).
