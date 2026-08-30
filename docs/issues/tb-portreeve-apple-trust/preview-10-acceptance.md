# Preview.10 Acceptance - tb-portreeve-apple-trust

**Checked:** 2026-08-30
**Release:** `0.1.0-preview.10`
**Run:** [33281790384](https://github.com/TrentBrown/portreeve/actions/runs/33281790384)
**Source:** reviewed `main` commit `1da97cb2a1983fe416f6abab763e6b4b06222c9f`
**Inputs:** `channel=preview`, `trust=true`, `publish=false`
**Verdict:** PASS - complete trusted packet; no public mutation

## Hosted workflow

The run completed successfully from the exact reviewed `main` source. The
preparation job, all four preliminary native jobs, credential-free
qualification, protected `release-trust` producer, independent native ARM64
and Intel Apple verification, and trusted-distribution finalization all
passed. The `publish` job was skipped as required.

| Job | Job ID | Result |
|---|---:|---|
| prepare | 99178065130 | PASS |
| native evidence - Linux x64 | 99178218068 | PASS |
| native evidence - macOS x64 | 99178218072 | PASS |
| native evidence - macOS ARM64 | 99178218095 | PASS |
| native evidence - Linux ARM64 | 99178218096 | PASS |
| qualify-trust | 99178333353 | PASS |
| release-trust | 99178393419 | PASS |
| Apple trust evidence - macOS x64 | 99181031659 | PASS |
| Apple trust evidence - macOS ARM64 | 99181031696 | PASS |
| finalize-trusted-distribution | 99181184622 | PASS |
| publish | 99181252598 | SKIPPED |

The finalized `distribution-0.1.0-preview.10` artifact is GitHub artifact
`9723538117` and contains a schema-version-2 record at
`distribution-finalized`, with 13 recorded artifacts and
`publication.state=unpublished`. Its policy is `alpha`, `preview`, and
`developer-id-notarized`.

## Apple authority and exact artifacts

Both current native Apple documents require and report the exact identity
`Developer ID Application: Trent Brown (PMWYD5A82A)` and Team ID
`PMWYD5A82A`. Each reports hardened runtime and secure timestamp for the CLI
and application, strict signatures, exact embedded-CLI equality, native CLI
and lifecycle smoke, quarantined CLI execution, application smoke, accepted
Gatekeeper assessments for the mounted app and DMG, and a stapled and
validated notarization ticket.

| Architecture | Signed CLI bytes / SHA-256 | DMG bytes / SHA-256 | Apple request | Native verification |
|---|---|---|---|---|
| ARM64 | `64537728` / `e9915a8d71178bec1b90da3cf6a772e1d150ba48050d80b0105873182e9c217f` | `170178882` / `31ede1d5059bd5ca750810c666e58dfb436623e3762eef7773d713048d23fc90` | `f9666ed3-036e-4893-8e7f-72527f3538fe` - Accepted | `2026-08-30T00:17:16.615Z` on ARM64 |
| x64 | `70245616` / `ca5863c97d0c7b237a913ab1705a893404fa5012c731b5ed30a55b62eab741a8` | `177609992` / `b74a8d2af4e5c026a083dd5e1bac15b8a31d009658911245b14a9084b5f67b62` | `8802be2d-776b-4726-bbad-e450170eca54` - Accepted | `2026-08-30T00:17:53.694Z` on x64 |

The producer evidence explicitly records `publicationAuthority=false`. The
sealed `publication-plan.md` SHA-256 is
`ac75019cd5addd954d8611142d6419fc96b0e1b5952fa030f2b23ca7408fee9d`,
which exactly matches `publication-plan.sha256`.

## Independent candidate inspection

The downloaded distribution passed the repository-owned inspector under the
pinned Bun 1.3.14 toolchain:

```text
Verified portreeve-v0.1.0-preview.10 from 1da97cb2a1983fe416f6abab763e6b4b06222c9f: 13 artifacts, 4 native targets, 2 Desktop DMGs; no public mutation performed.
```

The disposable Homebrew smoke command was also invoked through the pinned
toolchain. It stopped before mutation with
`Refusing to replace an existing Homebrew PortReeve formula.` because this
machine already has formula and cask `0.1.0-preview.4`. The safety refusal was
preserved: the installed application, services, and data were not replaced or
removed. This local convenience check is not native trust authority and is not
a release failure; the exact generated formula/cask identities remain covered
by record inspection and the hosted native matrix. A separate physical-machine
or cross-architecture installation is optional by the approved spec.

## Zero-public-mutation proof

Read-only after-state checks found:

| Surface | After state |
|---|---|
| PortReeve `main` | `1da97cb2a1983fe416f6abab763e6b4b06222c9f`, the dispatch source |
| Git tag `v0.1.0-preview.10` | absent |
| GitHub Release `v0.1.0-preview.10` | absent; latest public preview remains `.4` |
| PortReeve Desktop update blob | `95374af5de460b0865aaab2a7732db8e1bdd5203` |
| Homebrew repository `main` | `23be9c4a5897807bb29a64076d1c84a3bcff2ea5` |
| Homebrew formula blob | `759d2635fd84ab7ce2969c7ca51edad09ece3228` |
| Homebrew cask blob | `fadae00919d8bc43fe7a7dcd9973b2c9b10d7541` |

No tag, release, Homebrew change, Desktop-update change, npm publication, or
other public mutation was authorized or performed.
