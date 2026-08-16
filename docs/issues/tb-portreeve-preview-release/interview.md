# Interview - tb-portreeve-preview-release

**Feature start:** 2026-08-16
**Status:** concluded; design synthesis ready

This record captures the release-distribution decisions settled in the design
conversation. The user explicitly asked to proceed without further clarifying
questions because the remaining choices were sufficiently determined.

## D1 - Formalize release as an explicit pipeline

PortReeve's release process must become a named, documented state machine rather
than a collection of loosely ordered commands. One orchestration surface is the
source of truth for local preparation and GitHub Actions. Each stage consumes
declared inputs, produces declared artifacts and evidence, and refuses invalid
transitions.

The desired property is process determinism: the source commit, version,
release policy, toolchain, artifact digests, verification results, and
publication state are explicit and auditable. Byte-for-byte reproducible builds
are not silently promised.

## D2 - Separate maturity, channel, and trust

Three facts must not be conflated:

- **Product maturity:** PortReeve is currently alpha software under active
  development. Breaking behavior, file formats, and workflows remain possible.
- **Release channel:** a build is a preview or stable release.
- **Desktop trust:** a macOS artifact is unsigned or Developer ID signed and
  notarized.

A preview may eventually be signed, and alpha maturity may outlive the first
signed release. These therefore need independent manifest fields and policy
checks rather than one overloaded `prerelease` boolean.

## D3 - Preview and stable profiles

The first public distribution is an unsigned GitHub prerelease, with a semantic
prerelease version such as `0.1.0-preview.1`. Preview mode may omit Apple
credentials, signing, notarization, and stapling, but it must carry explicit
warnings in every public entry point and record the unsigned status in release
metadata.

Stable mode is fail-closed. It may not publish a macOS Desktop artifact unless
Developer ID signing, hardened-runtime verification, notarization, ticket
stapling, and Gatekeeper assessment pass for every advertised architecture.
There is no flag that silently downgrades a stable release to unsigned.

## D4 - Build once, promote exact artifacts

Each native CLI/server executable is built once for a source/version/profile
tuple. Later stages may apply the explicitly declared signing transformation,
after which the resulting digest becomes authoritative. Native verification,
Homebrew metadata, Desktop embedding, checksums, and publication all refer to
those exact promoted bytes. No downstream job recompiles or substitutes a
nominally equivalent CLI.

Desktop consumes the exact architecture-matched macOS CLI artifact and records
its source identity and digest. Packaging, application signing, DMG creation,
notarization, and publication must preserve or explicitly re-prove the embedded
CLI identity according to the signed-artifact contract.

## D5 - Machine-readable release record

The pipeline writes a durable release record that includes at least:

- schema version and release identifier;
- source repository and commit;
- product/server, Desktop, and client versions;
- product maturity (`alpha` initially);
- channel (`preview` or `stable`);
- publication state;
- Desktop trust state (`unsigned` or `developer-id-notarized`);
- pinned tool versions;
- every artifact's operating system, architecture, byte length, digest, and
  provenance stage;
- verification requirements and outcomes;
- Homebrew formula/cask identities;
- GitHub Release identity when published.

The record is append/promotion oriented. A stage cannot claim evidence that has
not been produced, and publication consumes the completed record rather than
re-deriving context from the current checkout.

## D6 - Distribution channels

GitHub Releases are the authoritative public bytes.

- macOS Desktop publishes separate ARM64 and x64 DMGs. A ZIP may be produced as
  an optional automation artifact, but the DMG is the primary direct download
  and the source for Homebrew Cask.
- macOS and Linux ARM64/x64 CLI/server executables remain direct release
  artifacts. A tar archive may be added only if it improves the direct-install
  experience without replacing the standalone binary identity.
- `TrentBrown/homebrew-portreeve` is the intended public tap. It contains a
  cross-platform `portreeve` formula and a macOS `portreeve-app` cask.
- npm remains the JavaScript client channel, but npm publication is decoupled
  from GitHub preview publication and remains deferred until trusted publishing
  is configured.
- The current Desktop remains macOS-only. Linux receives CLI/server plus
  `systemd --user` supervision, through Homebrew or direct download.

## D7 - Homebrew and lifecycle ownership

Homebrew installs software but does not silently assume PortReeve data or
service ownership.

- Formula installation places the CLI on `PATH`; the user still explicitly
  runs `portreeve install` and `portreeve start` for supervision.
- Cask installation places `PortReeve.app` in Applications; the user still uses
  Desktop's Service workflow to install and start the per-user authority.
- Normal uninstall removes application/formula material and non-destructively
  removes supervision where safe, while preserving PortReeve claims, history,
  and settings.
- Full data deletion remains a separate explicit PortReeve purge action; a
  routine Homebrew uninstall must not masquerade as purge.

The personal tap may host the unsigned preview. Submission to official
`homebrew/cask` is deferred until the app no longer requires a Gatekeeper
bypass and has sufficient release maturity.

## D8 - Alpha and unsigned-preview communication

README and Desktop must both identify PortReeve prominently as alpha software.

- README places an alpha/active-development callout at the top, before the
  normal product pitch and installation choice.
- Desktop places a persistent, accessible Alpha Preview indicator in the
  application header on every tab. It explains that behavior and data formats
  may change.
- Release notes, the download section, the preview installation guide, and the
  Homebrew cask caveat identify unsigned artifacts explicitly.
- Product maturity language is not hard-coded to signing status; a future
  signed alpha continues to say alpha without claiming it is unsigned.

## D9 - Explain Gatekeeper without unsafe shortcuts

The public preview guide gives exact, calm macOS steps:

1. Install through DMG or the personal Homebrew cask.
2. Attempt to open PortReeve normally.
3. If macOS blocks it, open System Settings, choose Privacy & Security, and use
   the scoped **Open Anyway** control for PortReeve.
4. Confirm the second launch prompt.
5. In PortReeve, use Service to install and start the supervised authority.

The guide must explain why this is necessary and link to Apple's current
instructions. It must not recommend globally disabling Gatekeeper,
`spctl --master-disable`, clearing quarantine recursively, `--no-quarantine`,
or other blanket bypasses.

Uninstallation instructions distinguish removing supervision, removing the
app, and explicitly deleting all data.

## D10 - Publication remains a human gate

Building, packaging, verification, and dry-run tap generation may proceed
autonomously. Creating a public tag/release, publishing or updating the public
Homebrew tap, or replacing a published asset remains an explicit human-approved
publication action. The pipeline previews the complete publication plan and
exact digests before that gate.

Published version assets are immutable. Corrections use a new prerelease
version; they do not replace bytes behind an existing version.

## D11 - Existing contracts to preserve or amend deliberately

- `scripts/release.js` already builds four CLI targets, the npm tarball,
  checksums, manifest, and Homebrew formula.
- `scripts/verify-release.js` already performs native, lifecycle, and Homebrew
  checks.
- `scripts/package-desktop.js` already selects the physical macOS architecture,
  verifies the embedded CLI digest, packages Electron, and runs a read-only
  application smoke.
- `.github/workflows/release.yml` already runs a four-platform native matrix but
  currently couples GitHub publication to npm authority.
- The approved Desktop design already requires direct distribution, separate
  ARM64/x64 artifacts, Developer ID signing, hardened runtime, notarization,
  stapling, and exact embedded CLI identity for stable release.

This feature formalizes and extends those foundations; it does not introduce a
parallel release implementation. The earlier phrase "already-published CLI"
is refined to "one authoritative promoted CLI artifact": a draft release or CI
artifact may carry the exact bytes before the complete GitHub Release is made
public atomically.

## D12 - Release invocation surfaces

The release engine is a versioned repository script, with two explicit phases:

```sh
bun run release:prepare -- --channel preview --version 0.1.0-preview.1
bun run release:publish -- --record \
  dist/releases/0.1.0-preview.1/release-record.json
```

Preparation writes `dist/releases/<version>/` with the exact artifacts,
checksums, formula, cask, machine-readable release record, and human-readable
publication plan. It does not publish. Publication consumes that completed
record and exact bytes only after the human publication gate.

`docs/releasing.md` documents the commands and recovery procedures. A
project-local `.agents/skills/release-portreeve/SKILL.md` Codex skill provides a
convenient natural-language entry point but delegates all authority to the
scripts. A manually dispatched GitHub Actions workflow accepts the same
channel/version inputs and calls those same scripts on hosted runners. None of
the wrappers may implement parallel release policy.

Stable releases use the same command family and fail without real Apple trust
evidence. The intended operator experience is therefore one pipeline that can
be requested through an agent, invoked directly in a terminal, or run remotely
without changing its semantics.

## D13 - Scope boundaries

In scope:

- the release state model, manifests, orchestration, verification, preview and
  stable gates;
- unsigned preview GitHub artifacts and tap/cask preparation;
- dual-architecture Desktop packaging, DMG generation, install/uninstall
  evidence, and preview documentation;
- top-of-README and persistent Desktop alpha messaging;
- decoupling preview GitHub publication from deferred npm publication;
- future signing/notarization hooks and stable fail-closed tests without real
  Apple credentials.

Deferred:

- Apple Developer Program enrollment and credential creation;
- real Developer ID signatures, Apple notarization submissions, and tickets;
- official Homebrew core/cask submission;
- Linux Desktop, Windows, App Store, PKG installer, auto-update installation,
  `.deb`, `.rpm`, MacPorts, and other distribution systems;
- changing product maturity away from alpha;
- npm trusted-publishing activation or first npm publication.

## Open questions

No question blocks design synthesis. Exact artifact filenames, the internal
release-record schema, DMG tool choice, and PR slice boundaries are
implementation/spec details constrained by the decisions above.
