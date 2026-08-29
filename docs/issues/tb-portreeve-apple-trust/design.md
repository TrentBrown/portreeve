# Design - tb-portreeve-apple-trust

**Status:** approved 2026-08-28

## Problem

PortReeve has a deterministic release engine for four native CLI targets,
architecture-specific macOS Desktop DMGs, Homebrew formula and cask metadata,
Desktop update metadata, exact publication plans, and recoverable publication.
Its existing public previews are intentionally unsigned, while stable policy
already declares Developer ID notarization as mandatory. The engine does not
yet create or validate the real Apple trust evidence needed to satisfy that
policy or provide a normal trusted installation experience.

The macOS path is harder than signing an Electron application alone. PortReeve
publishes architecture-specific macOS CLIs as standalone downloads and
Homebrew inputs, and embeds the matching executable in each Desktop app.
Developer ID signing changes Mach-O bytes. If packaging signs, replaces, or
relocates that nested CLI without recording the transformation, the standalone,
Homebrew, Desktop, release-record, and native-verification identities diverge.

The current app places the CLI beneath `Contents/Resources` and excludes it
from Electron's signing pass. A Mach-O helper is executable nested code, not a
resource. PortReeve needs a standard bundle topology and inside-out signing
order that preserve one authoritative signed CLI identity across every
distribution surface.

GateReeve proves that the broader trust lifecycle works: protected Developer
ID signing and notarization, ephemeral credential custody, native ARM64 and
Intel verification, immutable release evidence, and nonpublishing rehearsal.
GateReeve uses one universal DMG, while PortReeve's embedded native CLI makes
separate architecture-specific artifacts the clearer product shape. The two
projects need common trust semantics without forcing identical artifact counts
or prematurely sharing runtime implementation code.

## Intent

Complete PortReeve's fail-closed Apple release-trust path:

```text
pinned source
  -> unprotected candidate construction and qualification
  -> protected creation of authoritative signed bytes
  -> independent native ARM64 and Intel verification
  -> sealed release record and publication-plan digest
  -> separately approved hosted publication
  -> idempotent per-surface recovery receipts
```

For every future public preview or stable release, PortReeve must produce
Developer ID-signed ARM64 and x64 macOS CLI artifacts, matching signed and
notarized architecture-specific Desktop DMGs, complete Apple and native
evidence, and distribution metadata derived only from the final bytes.
Internal and nonpublishing candidates may remain ad-hoc signed or unsigned.

This feature ends after reviewed implementation reaches `main` and a protected,
nonpublishing rehearsal produces a complete publication-ready trusted-preview
packet. It does not authorize or perform public publication. A later,
separately governed GateReeve feature adopts the proven common contract and
credential separation without rewriting GateReeve history or copying
PortReeve's artifact topology.

## Chosen shape

### Common trust contract with product-specific artifacts

PortReeve retains distinct ARM64 and x64 CLI, application, and DMG identities.
Homebrew selects the matching architecture automatically, while direct
downloads label Apple silicon and Intel artifacts explicitly. A universal
PortReeve DMG is not required merely because GateReeve uses one; conformance is
defined by byte authority, evidence, approval, publication, immutability, and
recovery rather than artifact count.

One protected macOS Apple Silicon producer creates both trusted architecture
bundles with one credential exposure and one environment approval. It may
cross-package the Intel application but may not claim Intel runtime authority.
Independent ARM64 and Intel jobs execute and inspect their matching exact
outputs before an unprotected aggregator may advance the shared release
record. Native Intel evidence is mandatory; Rosetta is supplemental only and
cannot substitute for an Intel runner. Loss of native Intel capacity blocks the
coordinated release unless a future design amendment changes supported scope.

### Public channel and Apple trust policy

Preview and stable remain separate update channels and compatibility promises.
A preview version remains a prerelease even when Apple-trusted. Trust is no
longer optional for public macOS distribution:

- Development, CI, and nonpublishing candidates may use unsigned or ad-hoc
  signed artifacts without Apple credentials.
- Every newly published preview must be Developer ID signed and notarized.
- Every stable release must be Developer ID signed and notarized.
- Existing public previews `0.1.0-preview.1` through `.4` remain immutable and
  truthfully identified as unsigned history.

Public mutation fails closed unless the complete trusted packet and current
native evidence exist.

### Release-record schema version 2

New candidates use release-record schema version 2. Its ordered lifecycle must
distinguish source and policy resolution, preliminary native construction and
qualification, explicit macOS CLI signing transformations, canonical Desktop
packaging, authoritative native verification, Apple trust verification,
distribution finalization, exact publication approval, and per-surface
publication completion.

Every transition validates its predecessor and the exact recorded bytes.
Parallel jobs emit create-once evidence and never mutate the shared record
concurrently; one aggregator performs each shared advancement. Exact stage
names and evidence object schemas belong in the specification, but they may not
collapse these authority boundaries.

Valid schema-version-1 records remain readable and inspectable under their
original contract. Readers must not rewrite them, infer version-2 passage,
synthesize absent Apple evidence, or weaken version-2 validation for backward
compatibility.

### Candidate qualification before credential access

Unprotected jobs build the coordinated artifact set from a pinned source and
perform every useful check that does not require Apple credentials. This
includes four-platform native CLI construction, existing lifecycle tests,
Desktop packaging contracts, signing-wrapper tests, workflow-source checks,
negative fixtures, and cleanup behavior.

Preliminary qualification rejects ordinary build, source, toolchain, and
packaging defects before a protected environment approval is requested. It is
not final authority for a trusted release because signing changes the macOS CLI
identities and the final distributable bytes require fresh native verification.

### Canonical nested CLI and inside-out signing

For each macOS architecture, the protected producer records the unsigned CLI
identity and signs it once with the expected Developer ID Application identity,
hardened runtime, and a secure timestamp. The resulting signed bytes become the
only authoritative macOS CLI identity for that architecture.

Desktop packaging copies those exact bytes into a flat
`PortReeve.app/Contents/Helpers` location. It does not place the Mach-O helper
under `Contents/Resources`, does not re-sign the embedded copy, and does not
create a separate Desktop-only CLI identity. Electron's child-signing pass may
skip only this already-signed known helper; it signs the remaining nested code
inside-out and seals the enclosing application last.

The workflow verifies byte, size, digest, version, architecture, Developer ID,
Team ID, hardened-runtime, and secure-timestamp equality after application
signing and again after mounting the final DMG. The same authoritative signed
CLI bytes are published standalone, selected by Homebrew, embedded in Desktop,
and referenced by checksums, update metadata, evidence, and publication plans.
Linux artifacts are unchanged.

### Protected trusted-artifact production

The main-only `release-trust` environment receives only PortReeve Apple
configuration. Its protected producer:

1. validates expected identity, Team ID, notary Key ID, and Issuer ID before
   decoding private material;
2. captures the runner's existing keychain search list;
3. creates and unlocks an ephemeral keychain;
4. imports the password-protected Developer ID Application identity;
5. retains the original keychain search list behind the ephemeral keychain;
6. decodes the PortReeve notary team key into a mode-restricted temporary file;
7. signs both macOS CLIs and records their input and output identities;
8. packages and signs the matching ARM64 and Intel applications using the
   canonical helper layout;
9. creates and Developer ID-signs both architecture-specific DMGs;
10. submits each DMG to Apple under bounded, evidence-preserving control;
11. requires accepted notarization, staples and validates each ticket, and
    performs producer-side structural checks;
12. stages only intentional trusted artifacts and non-secret evidence beneath
    one explicit upload root; and
13. unconditionally restores the original keychain search list and removes all
    temporary credential material.

The producer has no publication authority. Machine-readable tool output goes
to dedicated files, and logs and uploaded artifacts contain no credential
values or private material.

### Bounded notarization recovery

Notarization submission and polling have explicit time bounds. When Apple has
created a request ID, recovery continues polling that request rather than
submitting the candidate again. Upload may retry only when evidence establishes
that no Apple request was created. Every request ID, diagnostic outcome, and
recovery action remains bound to the immutable candidate.

Only a final `Accepted` result may advance the candidate. Rejection, malformed
output, exhausted recovery, or an indeterminate request state blocks it.
Identical bytes retain their version during bounded recovery; any material byte
or packaging change consumes the next unused preview identity.

### Complete native trust evidence

The protected producer uploads one intentional bundle containing both signed
standalone CLIs, both DMGs, necessary release state, and non-secret producer
evidence. Matching native ARM64 and Intel jobs independently download their
exact inputs and emit one create-once evidence document per architecture.

Each native evidence document binds at least:

- release identity, source repository, pinned commit, policy, and architecture;
- unsigned predecessor and authoritative signed CLI identities;
- application and DMG filenames, byte counts, and SHA-256 digests;
- full Developer ID Application identity and Team ID;
- hardened runtime and secure timestamp facts;
- notarization request ID and final `Accepted` status;
- staple validation and deep strict signature verification;
- exact embedded-CLI equality;
- strict signature and quarantined native execution of the standalone CLI;
- Gatekeeper primary-signature open acceptance of the DMG;
- Gatekeeper execution acceptance of the mounted application; and
- native standalone CLI, application launch, and lifecycle smoke results.

Aggregation requires exactly one current ARM64 document and one current Intel
document. Missing, malformed, stale, duplicate, synthetic, cross-architecture,
or inconsistent evidence blocks the candidate. Command exit status alone is
insufficient; stable non-secret facts must be parsed and validated.

### Separate trust and publication authorization

PortReeve uses two protected credential domains:

- `release-trust` contains only Apple signing and notarization configuration
  and authorizes creation of nonpublic trusted bytes.
- `release-publication` contains only publication authority and authorizes
  deterministic public mutation from an already sealed packet.

A trust job never receives the PortReeve publication token. A publication job
never receives Apple private material. Each environment has its own explicit
human approval, and approval of one does not imply approval of the other.

PortReeve reuses the team-wide Developer ID Application certificate but uses a
separate least-privilege App Store Connect team key named
`PortReeve Notarization`, with independently named CI configuration, recovery
metadata, rotation, and revocation. No Apple Account password, two-factor code,
private key material, or unencrypted recovery file enters source, logs,
artifacts, or conversation records.

### Hosted publication and exact-record recovery

The normal publisher is a protected hosted job. It consumes the sealed release
record, exact trusted artifacts, and approved publication-plan digest; reruns
all read-only preflights; and performs only the deterministic public mutations
described by that plan. It does not rebuild or re-sign artifacts and does not
receive Apple credentials.

The local exact-record publisher remains available for controlled continuation
or recovery against the same packet and plan. It is not the normal operator
path and cannot weaken evidence or approval requirements.

This feature exercises the complete preparation path with public mutation
disabled. A later publication requires a new explicit request and approval for
the exact packet and plan.

### Main-only rehearsal and immutable candidate identities

Real Apple credentials are available only to reviewed workflow code running
from `main`. Feature branches verify contracts, failure paths, packaging,
workflow structure, and cleanup synthetically. After implementation merges,
the protected nonpublishing rehearsal runs from a pinned `main` commit.
Evidence-backed defects return through fresh governed delivery slices before a
new protected attempt.

A candidate identity becomes immutable when live protected Apple work begins.
Failed, rejected, timed-out, and superseded attempts remain durable audit
evidence. Bounded recovery may continue for identical bytes, but any material
change requires the next unused preview version. Existing public and protected
attempt history is never replaced.

Feature completion requires one successful protected packet with both native
evidence documents, a complete schema-version-2 record, read-only inspection of
every recorded byte and publication action, and proof of zero public mutation.
A maintainer direct-download, drag-to-Applications, quarantine, and first-launch
check is optional. If performed, its architecture, release identity, DMG
digest, result, and confirmation time are recorded; its absence does not block
completion.

### GateReeve convergence follows separately

After PortReeve proves the pattern, a separate governed GateReeve feature
adopts the common trust and publication contract, including distinct
`release-trust` and `release-publication` environments. GateReeve retains its
universal DMG and product-specific release surfaces. Neither project rewrites
published history.

Both implementations remain repository-local initially. Shared vocabulary,
equivalent fixtures, evidence expectations, and cross-project conformance tests
establish consistency without a runtime dependency. Shared code may be
considered only after both protected paths are proven and repeated duplication
costs are known.

## Alternatives considered

### Treat the legacy approval as current passage

Rejected. GateReeve deliberately does not reconstruct or adopt legacy gate
history. The legacy commit is reference context only; this lifecycle records
fresh interview, design, specification, and plan passage.

### Make PortReeve universal to match GateReeve's DMG

Rejected. Separate native downloads are standard for large developer tools,
Homebrew selects them automatically, and PortReeve's embedded native CLI makes
architecture-specific byte authority simpler. Common trust semantics do not
require identical artifact topology.

### Use one credentialed producer per architecture

Rejected. It doubles protected credential exposure and coordination without
improving native authority. One producer creates both bundles; separate native
runners remain the blocking architecture authorities.

### Keep the signed CLI under `Contents/Resources`

Rejected. A Mach-O helper is nested executable code. `Contents/Helpers` is the
canonical flat code location and lets the outer app seal an already-signed
helper without treating it as an ordinary resource.

### Re-sign the embedded CLI or allow two identities

Rejected. Re-signing changes bytes and severs exact standalone, Homebrew, and
Desktop identity. The workflow signs once, embeds unchanged, and fails closed
on any mismatch.

### Publish unsigned previews after trust infrastructure exists

Rejected prospectively. Internal candidates may remain unsigned, but public
preview users should receive the same developer identity and notarization
assurance as stable users. Historical unsigned previews remain truthful and
immutable.

### Share GateReeve's notarization key

Rejected. A product-specific key isolates rotation, revocation, recovery, and
audit history while the team-wide Developer ID Application certificate remains
shared.

### Store trust and publication credentials together

Rejected. Signing and publication are distinct human authorities. Combining
them grants every approved job a broader credential domain than it needs.

### Use local publication as the normal path

Rejected. Hosted publication supplies protected approval, clean-runner logs,
and convenient deterministic continuation. The local publisher is more useful
as an exact-record recovery path.

### Substitute Rosetta or publish ARM64-only when Intel CI is unavailable

Rejected under the current product scope. PortReeve claims native ARM64 and
Intel support, so both native authorities must pass. A support change requires
an explicit design amendment.

### Require a maintainer manual installation check

Rejected as a completion gate. Native CI is mandatory for both architectures.
Manual installation remains useful optional evidence but cannot assume access
to additional physical machines.

### Publish as part of this feature

Rejected. Implementation authority and a successful nonpublishing rehearsal do
not grant public mutation authority. Publication remains a later exact-plan
decision.

### Introduce a shared Reeve release runtime now

Rejected. It would couple two release systems before the harder PortReeve path
has survived a protected rehearsal. Contract and fixture conformance are
sufficient initially.

## Constraints

- The new topic branch begins at clean `origin/main` commit
  `9c126fb4074072fb1a74039313072256c89d7f72`.
- No `development*` branch may be merged or rebased into this topic branch or
  any later delivery branch for the feature.
- PortReeve's existing deterministic release engine remains stage and byte
  authority; no parallel signing-only release state machine is added.
- Four native CLI targets, separate ARM64/x64 Desktop artifacts, independent
  update channels, and recoverable publication remain supported.
- GitHub Releases remain the authoritative public byte host.
- Every future public macOS preview and stable release requires real Developer
  ID, hardened runtime, secure timestamp, notarization, stapling, Gatekeeper,
  exact-byte, and native evidence.
- `release-trust` is main-only, human-reviewed, nonpublishing, and receives no
  publication authority.
- `release-publication` is separately human-reviewed and receives no Apple
  private material.
- Credentials and recovery contents never appear in repository files, logs,
  workflow artifacts, evidence, or conversation records.
- Ephemeral keychain state and credential files are restored or deleted in an
  unconditional cleanup path.
- Machine-readable outputs use dedicated files, and uploaded trusted artifacts
  live beneath one intentional staging root.
- Native ARM64 and Intel verification are both blocking; Rosetta is not a
  replacement for native Intel evidence.
- A materially changed live candidate never reuses a version.
- Existing schema-version-1 and published preview history remain immutable and
  inspectable.
- Public publication is outside this feature and requires later approval of an
  exact sealed packet and plan.
- GateReeve repository changes are outside this feature.

## Open risks

- Electron signing must accept an already-signed flat helper skipped by its
  child-signing pass while the final app passes deep strict verification,
  notarization, and Gatekeeper. The protected rehearsal is authoritative;
  rejection requires a design amendment rather than a fallback to resource
  placement or re-signing.
- Cross-packaging may produce an Intel application that is structurally valid
  but fails on real Intel hardware. Native Intel verification remains blocking.
- Apple service outages or indeterminate submission state may exhaust bounded
  recovery and burn delivery time even when candidate bytes are sound.
- Schema-version-2 compatibility work could accidentally accept reordered
  stages or fabricate historical facts. Version dispatch and negative fixtures
  must remain strict.
- Artifact transport can normalize executable modes or paths. Explicit mode
  restoration, digest checks, and one intentional upload root must prove final
  identity.
- Main-only credentials mean real integration defects appear after reviewed
  code reaches `main`; fixes require new governed slices and may consume new
  preview versions.
- Native Intel hosted-runner availability may change. The current design blocks
  rather than weakens architecture evidence.
- The maintainer must create, retain, configure, and periodically rotate the
  PortReeve notary key and Developer ID recovery material before live rehearsal.

## Changes

Append approved design amendments here. Do not remove or weaken the frozen
design.
