# Design - tb-portreeve-preview-release

**Feature:** `tb-portreeve-preview-release`
**Created:** 2026-08-16
**Status:** frozen at design gate
**Design gate:** approved 2026-08-16

## Problem

PortReeve can already build and verify standalone executables, a Homebrew
formula, an npm client archive, and a local Electron application. The pieces are
individually strong, but the complete release is implicit in command ordering,
GitHub job dependencies, mutable environment context, and several historical
documents. GitHub publication is also unnecessarily coupled to npm authority,
while public Desktop packaging still lacks dual-architecture distribution,
DMGs, a cask, and Apple trust.

This makes the release process difficult to explain and easy to perform
incorrectly. A maintainer cannot inspect one durable record and answer: what
source was released, which policy was selected, which exact bytes were
verified, what trust level they carry, where they were published, and what
requirements remain.

At the same time, PortReeve itself is under rapid development. Repository
visitors and Desktop users need an immediate, durable indication that the
product is alpha-level software. The first public preview will intentionally be
unsigned, so macOS installation must explain Gatekeeper's scoped Open Anyway
flow without normalizing unsafe system-wide bypasses.

## Intent

Create one deterministic release pipeline that promotes exact artifacts through
explicit stages and distinguishes product maturity, release channel, and macOS
trust. Use it to prepare a truthful unsigned alpha preview for GitHub Releases,
direct DMG download, the CLI formula, and a Desktop cask while leaving stable
publication mechanically blocked until Apple signing and notarization evidence
exists.

Make alpha status visible at the top of README and persistently in Desktop.
Give preview users complete installation and removal instructions, including
the macOS Privacy & Security steps they may encounter.

## Chosen shape

### One promotion pipeline

Release becomes a state machine shared by local commands and GitHub Actions:

```text
source pinned
  -> policy resolved
  -> native CLI artifacts built
  -> optional signing transformation
  -> authoritative digests established
  -> native and lifecycle verification passed
  -> Desktop apps embed exact macOS CLI artifacts
  -> Desktop packages and DMGs produced
  -> optional app signing/notarization/stapling
  -> formula, cask, checksums, and release metadata finalized
  -> publication plan approved by a human
  -> immutable GitHub prerelease/release and tap update published
```

Each stage validates its predecessor and writes evidence into a machine-readable
release record. Publication consumes that record and exact artifact digests; it
does not rebuild or infer from an arbitrary checkout.

Process determinism is the contract. The pipeline records all material inputs,
stage results, and artifact identities. This feature does not claim that Bun,
Electron, DMG, or archive output is bit-reproducible across independent hosts.

### Invocation and operator experience

Versioned repository scripts are the authoritative release interface. A local
preview preparation begins with one explicit command:

```sh
bun run release:prepare -- --channel preview --version 0.1.0-preview.1
```

Preparation performs all permitted build, packaging, verification, and tap
generation work, then stops before any public mutation. It writes a reviewable
release workspace:

```text
dist/releases/0.1.0-preview.1/
  artifacts/
  release-record.json
  publication-plan.md
  SHA256SUMS
  portreeve.rb
  portreeve-app.rb
```

The release record is the durable handoff between preparation and publication.
After the human publication gate, the same prepared bytes are published with a
separate command:

```sh
bun run release:publish -- \
  --record dist/releases/0.1.0-preview.1/release-record.json
```

Stable preparation uses the same entry point with `--channel stable` and a
stable version. It fails before publication unless the required real Apple
signing, notarization, stapling, and assessment evidence is present.

The repository also provides three discovery and convenience surfaces around
these scripts:

- `docs/releasing.md` is the maintained operator runbook. It explains
  prerequisites, rehearsal, preparation, evidence review, publication,
  recovery, and the preview/stable distinction.
- A project-local `.agents/skills/release-portreeve/SKILL.md` Codex skill lets a
  maintainer ask an agent, for example, "Prepare a new PortReeve preview release
  as `0.1.0-preview.1`." The skill invokes and explains the repository scripts;
  it does not duplicate release policy or gain independent publication
  authority.
- A manually dispatched GitHub Actions workflow accepts the same channel and
  version inputs:

  ```sh
  gh workflow run release.yml \
    -f channel=preview \
    -f version=0.1.0-preview.1
  ```

  Workflow YAML supplies hosted runners, artifact transport, and credentials
  while calling the same versioned scripts.

Local, skill-driven, and hosted execution therefore share one contract and one
release record. A maintainer may invoke whichever surface is convenient without
creating alternate release implementations. Preparing a release is safe to
delegate; publishing it remains an explicit human-approved action.

### Orthogonal release facts

The release record represents three independent dimensions:

| Dimension | Initial value | Future examples |
| --- | --- | --- |
| Product maturity | `alpha` | `beta`, `stable` through a later approved change |
| Channel | `preview` | `stable` |
| Desktop trust | `unsigned` | `developer-id-notarized` |

UI and documentation render these facts rather than inferring one from another.
A future Developer ID-signed preview can remain alpha, and a stable channel can
never infer trust without the required evidence.

### Preview and stable policy

Preview policy permits absent Apple credentials and unsigned macOS artifacts.
It requires:

- semantic prerelease versioning and a GitHub prerelease;
- explicit unsigned/alpha metadata;
- prominent warnings and a safe installation guide;
- all non-Apple build, digest, native execution, lifecycle, package, DMG,
  formula, cask, and install/uninstall verification;
- a personal Homebrew tap rather than official cask submission.

Stable policy is fail-closed. Desktop publication requires Developer ID signing
of the app and relevant nested code, hardened runtime, secure timestamps,
notarization, stapling, Gatekeeper assessment, and native ARM64/x64 lifecycle
evidence. Missing credentials are an error, not a reason to fall back to
preview behavior.

Tests exercise both policy paths with synthetic signing/notarization evidence,
but this feature cannot manufacture real Apple evidence.

### Build-once artifact identity

The CLI/server artifact set remains authoritative. Each target is compiled once
and assigned provenance. An optional signing stage may transform a macOS
artifact; only the post-signing digest becomes distributable identity. Native
tests, Desktop embedding, the Homebrew formula, and checksums all consume those
same bytes.

Desktop packaging runs natively for macOS ARM64 and x64. Each application
records the architecture-matched CLI filename, version, source release, and
digest. Later application signing and notarization may not silently rebuild or
replace the embedded CLI. The pipeline rechecks its identity at every boundary.

GitHub Actions may carry the artifact set through immutable workflow artifacts
or a draft GitHub Release before final publication. This refines the old
"already-published CLI" wording while preserving its core guarantee: Desktop
never rebuilds the authority.

### Distribution artifacts

GitHub Releases remain the authoritative download host.

- `PortReeve.app` is distributed in separate ARM64 and x64 DMGs. The DMG is the
  primary direct-download artifact and the input to the cask.
- A ZIP may be emitted for automation if verification cost remains low; it is
  not required for the human path.
- Standalone macOS/Linux ARM64/x64 CLI binaries remain available with checksums.
- The `TrentBrown/homebrew-portreeve` tap contains formula `portreeve` and cask
  `portreeve-app`.
- The formula installs CLI bytes but does not silently enable supervision.
- The cask installs the application but leaves supervised-service creation to
  Desktop's explicit Service workflow.

Routine uninstall preserves PortReeve state. Removing supervision, removing
the application, and deleting all data remain visibly separate operations.

### Alpha and preview experience

README begins with a visually prominent Alpha Preview callout before the normal
product introduction. It states that the system is evolving, breaking changes
remain possible, and preview downloads may be unsigned.

Desktop's global header contains an accessible Alpha Preview indicator visible
on every tab. A short explanation distinguishes product maturity from release
trust. The indicator remains even after signing until a future feature changes
the maturity policy.

The preview installation guide is linked from README, GitHub Release notes,
Homebrew caveats, and the Desktop alpha explanation. It covers:

- DMG and Homebrew installation;
- normal first launch;
- Apple's scoped System Settings -> Privacy & Security -> Open Anyway flow when
  Gatekeeper blocks the unsigned preview;
- explicit Service installation/start after Desktop opens;
- non-destructive service/application uninstall;
- separate confirmed deletion of all data.

The guide links to Apple and Homebrew primary documentation. It never suggests
disabling Gatekeeper globally, suppressing quarantine, or bypassing trust with
unbounded shell commands.

### Publication authority

Build and verification do not imply permission to publish. The pipeline emits
a final publication plan containing tag, channel, repository, tap changes,
asset names, digests, and warnings. Creating a public Git tag/release, modifying
the public tap, or replacing any public reference requires explicit human
approval.

Published version assets are immutable. Any correction receives a new preview
version. npm publishing is independently gated and cannot block a GitHub
preview; it remains disabled until trusted publishing is configured.

### Durable documentation

The repository gains `docs/releasing.md`, a maintained release-process document
generated from or validated against the executable state model. It includes the
stage graph, exact local commands, the project skill and GitHub workflow entry
points, preview/stable requirements, artifact inventory, publication gate,
failure recovery, and credential setup boundary. Code and documentation tests
prevent the pipeline and its explanation from drifting silently.

## Alternatives considered

### Wait for Apple enrollment before release work

Rejected. Signing is one stage of a much larger process. Deferring the entire
pipeline would postpone dual-architecture packaging, DMGs, cask/formula
publication, lifecycle verification, user guidance, and deterministic release
records without making future signing easier.

### Publish an unsigned stable `v0.1.0`

Rejected. The product is both unsigned and rapidly evolving. A stable tag would
misstate maturity and weaken the future trust gate. Semantic prerelease versions
and GitHub prerelease status are more truthful.

### Treat preview as synonymous with unsigned

Rejected. A signed preview is useful later, and alpha maturity is independent
of Apple trust. Separate fields prevent future copy and policy contradictions.

### Use only Homebrew

Rejected. Homebrew is an excellent developer path but not universal. Direct DMG
and standalone CLI downloads remain necessary, and Homebrew itself references
the same GitHub artifacts.

### Use ZIP instead of DMG as the primary Mac download

Rejected for the main human path. ZIP is valid and may remain an automation
artifact, but a DMG provides the conventional drag-to-Applications experience
and can also serve Homebrew Cask.

### Use a PKG installer to manage the service

Rejected. Root-capable installer scripts complicate a deliberately per-user,
explicitly managed authority. Desktop and CLI already own safer install,
uninstall, preservation, and purge semantics.

### Duplicate release logic in GitHub Actions

Rejected. Workflow YAML should arrange trusted jobs and credentials, while the
same versioned scripts and schemas define stages locally and in CI.

### Allow stable publication to skip unavailable signing stages

Rejected. Optional credentials are appropriate only for preview. Stable must
fail closed or the distinction provides no safety.

## Constraints

- The repository remains the single source for CLI, Desktop, client, release
  schemas, and distribution documentation.
- Bun remains pinned at 1.3.14 unless separately amended.
- GitHub Releases are the authoritative public artifact host.
- PortReeve supports macOS and Linux ARM64/x64 CLI/server; Desktop remains
  macOS-only and separately packaged for ARM64/x64.
- The server/CLI, Desktop, and npm client versions remain independently visible
  even when a release coordinates them.
- No stage loads project `.env` files or introduces runtime telemetry.
- No release automation may modify an existing public version's bytes.
- Preview documentation must be truthful about unsigned artifacts; stable
  documentation must not appear until its trust evidence exists.
- No real signature or notarization is claimed without Apple Developer Program
  credentials and returned Apple evidence.
- Public publication remains an explicit human gate.
- Current service lifecycle safety, preserved-data uninstall, and explicit
  purge semantics remain authoritative across all distribution channels.

## Open risks

- Electron signing involves nested frameworks and the embedded CLI. The future
  Developer ID stage must prove exact signing order and identity preservation
  rather than relying on `--deep` as a substitute for understanding the bundle.
- Native Intel macOS runner availability may change; advertised x64 artifacts
  still require native execution evidence or an explicit future scope change.
- DMG tooling can introduce nondeterministic metadata. The record must capture
  exact output digests and tool versions even if bit reproducibility is not
  achieved initially.
- A personal Homebrew tap can install an unsigned cask, but users still face
  Gatekeeper. Caveats and README instructions must not imply that Homebrew
  establishes Apple trust.
- GitHub preview publication currently shares policy dependencies with npm.
  Decoupling must preserve npm's fail-closed behavior without allowing an
  accidental npm publish.
- The existing update manifest must not advertise an unsigned preview as a
  stable upgrade. Channel, maturity, trust, and download selection need a
  versioned contract.
- Real public release and tap mutation will require final human authorization
  even after every technical gate passes.

## Changes

Append approved design amendments here. Do not remove or weaken the frozen
design.
