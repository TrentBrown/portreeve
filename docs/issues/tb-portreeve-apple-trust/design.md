# Design - tb-portreeve-apple-trust

**Status:** approved (gate passed 2026-08-28)

## Problem

PortReeve already has a deterministic, script-owned release engine for four
native CLI targets, two architecture-specific macOS Desktop DMGs, Homebrew
formula and cask metadata, Desktop update metadata, exact publication plans,
and recoverable cross-repository publication. Its preview path is intentionally
unsigned, and its stable policy already declares `developer-id-notarized` as a
requirement. The engine does not yet create or validate the real Apple evidence
needed to satisfy that policy.

The missing path is more involved than signing an Electron application. Each
PortReeve app embeds the matching macOS CLI artifact, and the same CLI is also
published as a standalone download and installed by Homebrew. Codesigning
changes Mach-O bytes. If app packaging silently signs or replaces an embedded
CLI, the standalone artifact, Homebrew artifact, release record, and Desktop
attestation diverge. If the release record continues treating the pre-signing
digest as authoritative, native verification no longer proves the bytes users
receive.

GateReeve now has a proven Developer ID, notarization, stapling, Gatekeeper,
ephemeral-keychain, native-verification, and immutable-publication path. Its
implementation cannot be copied wholesale because it produces one universal
DMG and coordinates fewer artifact surfaces. PortReeve needs the same release
trust pattern while preserving its stronger artifact and lifecycle invariants.

The two projects also currently differ in environment naming and publication
execution. Without an explicit common pattern, their release systems will
continue to drift even if both eventually produce Apple-trusted applications.

## Intent

Complete PortReeve's fail-closed Apple trust path and use it to establish the
common Reeve release pattern:

```text
pinned source
  -> unprotected candidate construction and qualification
  -> protected creation of authoritative trusted bytes
  -> independent native verification of those exact bytes
  -> sealed release record and publication-plan digest
  -> separately approved hosted publication
  -> idempotent per-surface recovery receipts
```

For PortReeve, a trusted candidate must contain Developer ID-signed ARM64 and
x64 macOS CLI artifacts, separate signed and notarized ARM64/x64 Desktop DMGs,
complete Apple and native evidence, and distribution metadata derived only from
the resulting authoritative bytes. Unsigned preview behavior remains available
and truthful. Stable remains mechanically unavailable without the real trust
path.

This feature ends after a successful protected, nonpublishing signed-preview
rehearsal, inspection of its publication-ready packet, and one maintainer
direct-install check. It does not authorize or perform public publication.

GateReeve remains unchanged while PortReeve proves the harder model. A later
GateReeve feature will align its contracts and hosted publication boundary
without rewriting published history or forcing PortReeve's artifact topology
onto GateReeve.

## Chosen shape

### Common pattern, product-specific artifact graph

The projects conform on source pinning, byte authority, structured trust
evidence, credential boundaries, approval, publication, immutability, and
recovery. They do not need identical numbers or architectures of artifacts.

GateReeve retains one universal application and DMG because it has no embedded
architecture-specific CLI. PortReeve retains separate ARM64 and x64
applications and DMGs because each embeds its matching native CLI. Release
implementations remain repository-local during the first convergence;
equivalent contract fixtures and tests establish conformance without creating a
shared runtime release dependency.

### Orthogonal channel and trust policy

PortReeve keeps the existing `preview` and `stable` channels. No new RC channel
is introduced solely for Apple testing.

- Preview remains unsigned by default.
- An explicit Apple-trust option may produce a
  `developer-id-notarized` preview for protected rehearsal or later approved
  publication.
- Stable always requires `developer-id-notarized` and has no unsigned fallback.
- Product maturity, release channel, and Desktop trust remain independent
  recorded facts.

Existing published previews remain valid unsigned schema-version-1 history.
They are never relabeled or rewritten.

### Release-record schema version 2

New candidates use release-record schema version 2. The logical state graph
must distinguish:

1. source and policy resolution;
2. construction and digesting of candidate artifacts;
3. preliminary native qualification;
4. any explicit macOS signing transformations;
5. production of architecture-specific Desktop artifacts;
6. authoritative native verification of the final distributable bytes;
7. Desktop Apple-trust verification;
8. distribution finalization and exact-plan sealing;
9. publication approval and per-surface completion.

The spec will define exact stage names and evidence shapes. Every transition
validates its predecessor and exact recorded bytes. One aggregator advances a
shared record after parallel evidence jobs; matrix jobs never mutate the record
concurrently.

Readers and inspectors retain compatibility with valid schema-version-1
records. They must not infer missing v2 stages, synthesize Apple evidence, or
rewrite historical records. New release creation emits only v2.

### Candidate qualification before credential access

The unprotected portion of the hosted workflow builds the coordinated artifact
set from a pinned source commit and performs all useful checks that do not need
Apple credentials. It includes the existing four-platform native CLI and
lifecycle qualification and enough Desktop packaging checks to reject source,
toolchain, or packaging defects before a protected job is requested.

Preliminary success is candidate qualification, not final authority for a
trusted release. Signing changes the macOS CLI identities, and the final signed
outputs must be verified again.

### One protected trusted-artifact producer

One macOS Apple Silicon job enters the protected `release-trust` environment.
It has repository `contents: read`, performs no public mutation, and receives
only PortReeve Apple variables and secrets.

The job:

1. validates the expected Developer ID identity, Team ID, notary Key ID, and
   Issuer ID before decoding private material;
2. captures the runner's existing user keychain search list;
3. creates and unlocks an ephemeral keychain;
4. imports the password-protected Developer ID Application identity;
5. prepends the ephemeral keychain while retaining the original search list;
6. decodes the PortReeve notary team key into a mode-restricted temporary file;
7. signs both macOS CLI candidates with hardened runtime and secure timestamps;
8. records each predecessor and signed output identity;
9. packages each architecture-specific application around its exact matching
   signed CLI;
10. signs the remaining nested code and application without re-signing the
    embedded CLI;
11. creates and Developer ID-signs both architecture-specific DMGs;
12. submits each DMG independently to `notarytool` and requires `Accepted`;
13. staples and validates each ticket;
14. performs producer-side structural and signature checks;
15. copies the two trusted DMGs, both signed standalone CLIs, trust evidence,
    and required release state beneath one intentional staging root; and
16. restores the original keychain search list and removes the keychain and all
    credential files in an unconditional cleanup step.

Machine-readable package and notarization results are written to dedicated
files. Third-party progress output is never parsed as JSON. Artifact upload
does not depend on GitHub's least-common-ancestor path normalization.

The producer may cross-package the Intel application, but it may not claim
native Intel execution. Both notarization submissions use bounded execution and
fail closed on timeout, malformed output, rejection, or an identity mismatch.

### Authoritative signed macOS CLI transformation

Each macOS CLI is signed once. The release record binds:

- the pre-signing filename, byte count, and SHA-256;
- the post-signing filename, byte count, and SHA-256;
- operating system and architecture;
- full Developer ID Application identity and Team ID;
- hardened runtime and secure timestamp facts; and
- the transformation's source release and pinned commit.

The post-signing ARM64/x64 CLIs replace their unsigned predecessors as the only
authoritative macOS CLI artifacts. The exact signed bytes are:

- offered as standalone GitHub assets;
- selected by the Homebrew formula;
- embedded in their matching Desktop applications; and
- used by final checksums, native evidence, and publication metadata.

Linux ARM64/x64 artifacts are not transformed and retain their established
identities.

### Exact embedded-CLI invariant

Desktop packaging copies the already-signed matching CLI into the application.
Electron signing excludes only that exact, known resource from its recursive
signing pass. Application signing seals the resource without changing it.

The workflow compares the embedded file to the authoritative signed standalone
CLI after application signing and again after mounting the final DMG. Any byte,
size, digest, version, or architecture mismatch fails the candidate.

The protected rehearsal is the acceptance test for Apple's treatment of this
nested-code shape. If Apple rejects it, implementation stops and the design is
amended. The workflow may not silently re-sign the embedded copy, publish two
different macOS CLI identities, or preserve an obsolete unsigned digest.

### Independent native trusted verification

After the protected producer uploads one trusted bundle, matching macOS ARM64
and Intel jobs independently download and verify their exact outputs. Each job
must:

- execute and smoke the authoritative signed standalone CLI;
- verify CLI Developer ID identity, Team ID, hardened runtime, and secure
  timestamp;
- verify the DMG signature and exact recorded digest;
- validate the stapled ticket;
- require Gatekeeper acceptance of the DMG with `spctl --type open --context
  context:primary-signature`;
- mount the DMG and require Gatekeeper acceptance of the application with
  `spctl --type execute`;
- verify the application and relevant nested signatures;
- confirm embedded-CLI equality with the signed standalone artifact; and
- launch the application and complete the architecture-specific smoke checks.

Each job emits one create-once, schema-versioned evidence document bound to the
release ID, source commit, architecture, artifact identities, Apple facts,
runner identity, checks, and verification time. An unprotected aggregator
requires exactly ARM64 and x64 evidence, rejects duplicates or cross-architecture
substitution, and advances the release record once.

### Fail-closed trust evidence

For each architecture, final trust evidence binds at least:

- release identity, source repository, pinned commit, channel, maturity, and
  trust policy;
- signed standalone CLI predecessor and resulting identities;
- Desktop application and DMG filename, byte count, and SHA-256;
- exact embedded-CLI equality;
- full Developer ID Application identity and Team ID;
- hardened runtime and secure timestamp facts;
- notarization request ID and `Accepted` status;
- staple validation;
- DMG Gatekeeper acceptance;
- mounted-application Gatekeeper acceptance;
- native runner operating system and architecture; and
- standalone CLI, application launch, and lifecycle smoke results.

Evidence is rejected if missing, synthetic, stale, malformed, duplicated,
cross-architecture, or inconsistent with protected configuration. Command exit
status alone is insufficient; stable non-secret facts are parsed and validated.

### Credential custody and protected environments

PortReeve reuses the team-wide Developer ID Application certificate:

```text
Developer ID Application: Trent Brown (PMWYD5A82A)
```

The maintainer creates a separate least-privilege App Store Connect team key
named `PortReeve Notarization`. It has independent recovery and revocation
metadata from GateReeve's key.

The main-only `release-trust` environment contains only:

```text
PORTREEVE_APPLE_TEAM_ID
PORTREEVE_DEVELOPER_IDENTITY
PORTREEVE_NOTARY_KEY_ID
PORTREEVE_NOTARY_ISSUER_ID
PORTREEVE_DEVELOPER_ID_P12_BASE64
PORTREEVE_DEVELOPER_ID_P12_PASSWORD
PORTREEVE_NOTARY_KEY_P8_BASE64
```

The first four values are non-secret variables; the final three are secrets.
The environment requires human review and accepts deployments only from
`main`. Apple Account passwords, two-factor codes, private key material, and
unencrypted recovery files never enter source, logs, artifacts, or chat.

The separate `release-publication` environment contains only publication
authority, including the narrowly scoped `PORTREEVE_RELEASE_TOKEN`. Trust jobs
cannot access it. Publication jobs cannot access Apple private material.

### Hosted publication remains the normal path

The hosted workflow remains the normal publication surface. A trusted run has
two distinct human boundaries:

1. `release-trust` approval authorizes only creation of nonpublic trusted bytes;
2. after the sealed packet and exact plan are inspectable,
   `release-publication` approval authorizes deterministic public mutation.

The publication job consumes the sealed record and exact bytes, reruns all
read-only preflights, and uses existing idempotent adapters and receipts. It
never rebuilds or receives Apple credentials. The local `release:publish`
command remains supported as a controlled recovery path against the same exact
record and plan.

This feature exercises preparation with public mutation disabled. Later
publication requires a new explicit maintainer request for the exact packet.

### Main-only live rehearsal and immutable candidate versions

Feature branches test contracts, negative paths, signing wrappers, packaging,
workflow structure, staging, and cleanup without real credentials. Real Apple
credentials are available only after reviewed implementation reaches `main`.

The protected rehearsal uses a fresh unused preview version and publication
disabled. Every materially changed live candidate consumes a new preview
version even if the prior attempt was never public. Failed candidates remain
audit evidence and are not replaced. Fixes travel through fresh delivery
branches and reviewed PRs before another main-only attempt.

Feature completion requires:

- one successful trusted hosted packet with both authoritative native evidence
  documents and a complete schema-v2 release record;
- read-only inspection of every recorded byte and the exact publication plan;
- no public mutation; and
- one maintainer-confirmed download, normal DMG installation, and first launch
  on the maintainer's available Mac architecture, recorded with packet identity,
  architecture, DMG digest, result, and confirmation time.

Automated CI remains responsible for both ARM64 and Intel coverage; the manual
check validates the human installation path rather than substituting for the
native matrix.

### GateReeve convergence follows separately

After PortReeve's trusted path is stable, a separate GateReeve feature will:

- split Apple trust and publication into `release-trust` and
  `release-publication` environments;
- add environment-gated hosted publication with a narrowly scoped GateReeve
  token while retaining local recovery;
- align record vocabulary and conformance fixtures without rewriting the
  published RC history;
- bring future Cask publication into its coordinated release record; and
- retain GateReeve's universal DMG and Plugin-specific release surfaces.

No GateReeve repository mutation is part of this PortReeve feature.

## Alternatives considered

### Retrofit GateReeve before PortReeve

Rejected. GateReeve already has a working trusted release path and is the safer
reference. PortReeve contains the harder signed-CLI and dual-DMG problem; it
should prove the common contract before a working system is migrated.

### Copy GateReeve's compact release implementation into PortReeve

Rejected. It would weaken PortReeve's four-target evidence, exact standalone and
embedded CLI identity, staged state machine, integrated Homebrew/update
publication, and independent policy dimensions.

### Force identical artifact topology

Rejected. Splitting GateReeve adds redundant downloads, while making PortReeve
universal requires a universal embedded CLI or runtime architecture selection.
Conformance concerns artifact authority and release behavior, not artifact
count.

### Sign every preview automatically

Rejected. Unsigned previews are an intentional low-friction policy and existing
history is truthful. Explicit trusted previews provide rehearsal and optional
distribution without coupling channel to trust.

### Add a distinct RC channel to PortReeve

Rejected. Preview and trust are already modeled independently. A new channel
would expand update and version policy without solving a missing capability.

### Reuse GateReeve's notarization team key

Rejected. It is technically valid but couples product-level rotation and
revocation. A separate PortReeve team key is inexpensive and operationally
clearer.

### Store Apple and publication credentials in one environment

Rejected. Jobs approved for signing or publication would share an unnecessarily
broad credential domain and ambiguous environment semantics.

### Keep standalone macOS CLIs unsigned

Rejected. It would create two authoritative identities for nominally the same
release artifact and break exact equality among standalone, Homebrew, and
Desktop surfaces.

### Re-sign the embedded CLI during app packaging

Rejected. Secure timestamps would change the embedded bytes and silently sever
their identity from standalone and Homebrew artifacts. Apple acceptance must be
proven for one pre-signed, unchanged nested CLI.

### Use one protected job per architecture

Rejected initially. It expands credential exposure and protected-job
coordination. One producer can sign and package both targets; separate native
jobs provide the required architecture authority.

### Use local publication as the normal path

Rejected. It avoids a CI publication secret but loses hosted logs, clean-runner
execution, and convenient continuation. Protected GitHub secrets are acceptable
for this project; the local publisher is more valuable as a recovery path.

### Publish as part of this feature

Rejected. Implementation authority and a successful nonpublishing rehearsal do
not grant public mutation authority. Publication remains a later exact-plan
decision.

### Introduce a shared release runtime package now

Rejected. It would create cross-project availability and version-skew risk
before the common contracts have stabilized. Equivalent repository-local
implementations and conformance fixtures are sufficient initially.

## Constraints

- PortReeve's existing deterministic release engine remains the stage and byte
  authority; no parallel signing-only release workflow or state model is added.
- Four native CLI targets, separate ARM64/x64 Desktop artifacts, exact
  embedded-CLI identity, independent update channels, and recoverable
  cross-repository publication remain intact.
- GitHub Releases remain the authoritative public byte host.
- Stable remains fail-closed on real Developer ID, hardened runtime, secure
  timestamp, notarization, stapling, Gatekeeper, and native evidence.
- `release-trust` is main-only, human-reviewed, and nonpublishing.
- `release-publication` is separately human-reviewed and receives no Apple
  private material.
- The existing Developer ID Application certificate may be reused; the notary
  team key is PortReeve-specific.
- Credentials and private key contents never appear in repository files, logs,
  workflow artifacts, evidence, or conversational records.
- Ephemeral runner state and credentials are restored or deleted in an
  unconditional cleanup path.
- Machine-readable outputs use dedicated files, and trusted artifacts are
  staged beneath one explicit upload root.
- No public or live rehearsal version is replaced or reused after its bytes
  materially change.
- Existing schema-v1 and published preview history remain immutable and
  inspectable.
- Public publication is outside this feature and requires later exact-plan
  approval.
- GateReeve changes are outside this repository feature and occur only after
  PortReeve's trusted rehearsal succeeds.

## Open risks

- Apple may reject a pre-signed embedded CLI excluded from the enclosing
  Electron signing pass. The protected rehearsal is authoritative; rejection
  requires a design amendment.
- Electron cross-packaging or native modules may make an Intel application
  produced on Apple Silicon invalid. Native Intel verification must remain
  blocking.
- Two sequential notarization submissions may approach hosted-runner timeouts
  or encounter transient Apple service failures. Bounded retry and diagnostic
  evidence must not weaken acceptance requirements.
- Schema-v2 compatibility work could accidentally make v1 validation too
  permissive or fabricate absent facts. Version dispatch and negative fixtures
  must keep the contracts isolated.
- GitHub artifact transport can normalize modes or paths. Explicit executable
  restoration, digest checks, and one staged upload root must prove the final
  identity.
- GitHub-hosted Intel macOS runner availability may change. PortReeve cannot
  advertise x64 trust without native x64 evidence unless the product scope is
  explicitly amended later.
- Main-only credential access means the first real integration failures appear
  after an implementation slice merges. Sequential PRs and burned preview
  identifiers are an accepted cost of protecting credentials.
- The maintainer must create, securely retain, configure, and periodically
  rotate the PortReeve team notary key and Developer ID recovery material.

## Changes

Append approved design amendments here. Do not remove or weaken the frozen
design.
