# Interview - tb-portreeve-apple-trust

**Feature start:** 2026-08-28
**Status:** complete

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - Establish the convergence sequence

**Question:** Should the common Reeve release pattern be established by
retrofitting GateReeve first, implementing PortReeve first, or changing both
simultaneously?

**Answer:** Define the shared contract first, implement and rehearse the harder
PortReeve trust path while GateReeve remains the proven reference, then retrofit
GateReeve for future releases and add cross-project conformance checks.

**Decision:** Use the sequence `shared design -> PortReeve implementation ->
protected nonpublishing rehearsal -> GateReeve retrofit -> cross-project
conformance`. GateReeve's published history remains immutable, and the projects
may retain different artifact topology while conforming on byte authority,
evidence, approval, publication, and recovery.

**Classification:** Feature design and cross-repository sequencing decision.

## D2 - Keep preview channel and Apple trust orthogonal

**Question:** Should PortReeve retain unsigned previews by default while
allowing explicitly requested Apple-trusted previews for rehearsals and
requiring Apple trust for stable releases, or should every future preview be
signed?

**Answer:** Confirmed: retain unsigned previews by default, permit an explicit
Apple-trusted preview, and require Apple trust for stable releases.

**Decision:** Do not add an RC channel merely to exercise Apple trust. Preserve
the existing `preview` and `stable` channels, make the protected trust path an
explicit independent choice for preview, and keep stable fail-closed on
`developer-id-notarized`. Existing unsigned preview releases remain truthful
and unchanged.

**Classification:** Product policy and release-contract decision.

## D3 - Isolate PortReeve notarization credentials

**Question:** Should PortReeve reuse GateReeve's existing App Store Connect
team notarization key or receive a separate product-named team key while
reusing the team-wide Developer ID Application certificate?

**Answer:** Define a separate notarization key for PortReeve.

**Decision:** Reuse the existing `Developer ID Application: Trent Brown
(PMWYD5A82A)` certificate and create a separate least-privilege App Store
Connect team key named `PortReeve Notarization`. Give PortReeve-specific CI
variables and secrets their own names and recovery metadata so the notary key
can be rotated or revoked independently from GateReeve.

**Classification:** Security, credential-custody, and operational decision.

## D4 - Separate trust and publication environments

**Question:** Should Apple credentials share PortReeve's existing protected
`release-publication` environment with the release token, or should signing use
a distinct protected environment?

**Answer:** Confirmed: create a separate protected environment named
`release-trust`.

**Decision:** `release-trust` contains only the PortReeve Developer ID and
notarization variables/secrets and gates nonpublishing trusted-byte creation.
`release-publication` contains only publication authority. A signing job must
not receive `PORTREEVE_RELEASE_TOKEN`, and a publication job must not receive
Apple private material. The later GateReeve retrofit should adopt the same
credential-domain split.

**Classification:** Security-boundary and CI-authorization decision.

## D5 - Prioritize release operability over avoiding GitHub secrets

**Question:** Should the common publication design optimize primarily for
keeping publication credentials out of GitHub, or for convenient, safe, and
flexible operation?

**Answer:** Prioritize convenience, safety, and flexibility over concerns about
storing appropriately protected secrets in GitHub.

**Decision:** Treat protected GitHub environment secrets as an acceptable
mechanism. Evaluate the normal publication path by its end-to-end usability,
approval boundaries, audit trail, recovery behavior, and optional escape
hatches rather than by minimizing the number of CI-held credentials.

**Classification:** Maintainer-priority and operational-design clarification.

## D6 - Use hosted publication with a local recovery path

**Question:** Should both projects normally publish from an environment-gated
hosted job, while retaining their exact-record local publisher for controlled
recovery?

**Answer:** Yes.

**Decision:** Standardize both projects on a two-boundary hosted flow:
`release-trust` authorizes nonpublishing creation of trusted bytes, and
`release-publication` separately authorizes deterministic public mutation from
the sealed packet. PortReeve retains its hosted publisher; GateReeve later gains
an equivalent publisher and narrowly scoped publication token. Preserve the
local exact-record command as a documented recovery mechanism, not the normal
operator path.

**Classification:** Publication-authority, operability, and recovery decision.

## D7 - Promote signed macOS CLIs as authoritative artifacts

**Question:** Should Developer ID-signed macOS CLI binaries become the
authoritative PortReeve macOS artifacts for every distribution surface, or
should signing apply only to the copies embedded in Desktop?

**Answer:** Yes: use the signed macOS CLIs everywhere.

**Decision:** Treat signing as a recorded transformation from each prepared
macOS CLI identity to a new authoritative signed identity. Publish those exact
ARM64/x64 bytes as standalone downloads, install them through the Homebrew
formula, and embed them unchanged in the matching Desktop application. Native
verification and every downstream checksum bind the signed outputs. Linux
artifacts remain unchanged.

**Classification:** Artifact-authority, provenance, and distribution decision.

## D8 - Produce both trusted architectures in one protected job

**Question:** Should one protected macOS job create both signed CLI artifacts
and both architecture-specific trusted DMGs, followed by separate native ARM64
and Intel verification jobs?

**Answer:** Yes.

**Decision:** Use one `release-trust` job with one ephemeral keychain and one
environment approval to sign the ARM64/x64 CLIs, package and sign their matching
applications and DMGs, notarize and staple both DMGs, and stage one intentional
trusted artifact bundle. Run independent downstream ARM64 and Intel jobs against
their exact matching signed CLI/app/DMG outputs before aggregating trust
evidence. The producer may cross-package, but it may not claim native execution
for the non-native architecture.

**Classification:** CI topology, credential exposure, and verification decision.

## D9 - Embed each pre-signed CLI without re-signing it

**Question:** Should Desktop embed each authoritative pre-signed macOS CLI
unchanged, exclude only that known resource from Electron's recursive signing
pass, and fail closed if Apple does not accept the resulting nested-code shape?

**Answer:** Yes.

**Decision:** Sign each macOS CLI exactly once, record its resulting identity
and digest, embed those exact bytes in the matching application, and configure
application signing not to mutate that resource. Recheck byte equality after
application signing and after mounting the final DMG. A protected live
notarization rehearsal must prove Apple accepts the bundle. Rejection requires
a design amendment; the workflow may not silently re-sign the embedded copy or
substitute a different standalone artifact.

**Classification:** Nested-code signing, exact-byte, and fail-closed decision.

## D10 - Require Gatekeeper acceptance for both DMG and application

**Question:** Must every trusted architecture record Gatekeeper acceptance for
both the final DMG container and the mounted application?

**Answer:** Yes.

**Decision:** Require successful `spctl --type open --context
context:primary-signature` assessment of each final DMG and successful `spctl
--type execute` assessment of its mounted application. Bind both results to the
architecture-specific trusted evidence alongside codesign verification,
notarization acceptance, staple validation, embedded-CLI equality, and native
smoke results.

**Classification:** Apple trust evidence and release-gate decision.

## D11 - Stop at a publication-ready nonpublishing rehearsal

**Question:** Should this feature's Definition of Done include actual public
publication, or stop after a successful protected signed-preview rehearsal and
an inspectable publication-ready packet?

**Answer:** Stop before public publication.

**Decision:** Complete this feature only after repository implementation,
automated verification, protected Apple signing/notarization, independent
native ARM64/x64 verification, and inspection of a sealed publication-ready
signed-preview packet succeed. Creating a public tag, GitHub Release, Homebrew
or update-manifest change remains a later explicit request bound to that exact
packet and plan.

**Classification:** Feature-scope and public-mutation authority decision.

## D12 - Never reuse a live rehearsal version

**Question:** May a failed or unpublished protected Apple rehearsal reuse its
preview version after candidate bytes change?

**Answer:** No; preview numbers may be burned.

**Decision:** Assign every materially changed live Apple candidate a fresh
preview version. Preserve failed or superseded rehearsal evidence without
replacing its bytes or reusing its semantic identity. Existing public previews
`0.1.0-preview.1` through `.4` remain immutable, and the first live trust
candidate begins at a later unused preview identifier.

**Classification:** Release identity, audit-history, and recovery decision.

## D13 - Version the release-record contract without rewriting history

**Question:** Should new Apple-trust stages use release-record schema version 2
while retaining read and inspection compatibility with existing version-1
preview records?

**Answer:** Yes.

**Decision:** Create new candidates with schema version 2 and add explicit
candidate qualification, signed-artifact transformation, authoritative native
verification, Desktop trust, and publication evidence as required by the final
design. Continue to parse and inspect valid schema-v1 records for historical
and recovery purposes. Never rewrite published preview records or synthesize
v2 evidence for them.

**Classification:** Versioned API-contract and historical-compatibility decision.

## D14 - Restrict real Apple credentials to main

**Question:** Should the `release-trust` environment accept deployments only
from `main`, requiring reviewed implementation to merge before a real Apple
rehearsal?

**Answer:** Yes.

**Decision:** Permit protected Apple credential access only to workflow code
running from `main`. Feature branches must pass synthetic contract, packaging,
workflow-source, and cleanup tests without secrets. After reviewed code merges,
run the protected nonpublishing rehearsal from the pinned `main` commit. Fix
evidence-backed live defects through fresh branches and PRs, then consume a new
preview version on the next protected attempt.

**Classification:** Protected-branch, credential-exposure, and delivery decision.

## D15 - Keep release implementations repository-local initially

**Question:** Should the first GateReeve/PortReeve convergence share a runtime
release package, or align through common contracts and conformance fixtures
while retaining self-contained repository implementations?

**Answer:** Keep the implementations repository-local initially.

**Decision:** Define matching authority, evidence, approval, publication, and
recovery semantics and verify them with equivalent fixtures and contract tests,
but do not make either product's release depend on code published by the other
or on a new shared package. Reconsider extraction only after both trusted paths
are stable and repeated duplication costs are known.

**Classification:** Cross-project architecture and dependency decision.

## D16 - Require a manual direct-installation check

**Question:** Should feature completion require the maintainer to download the
successful signed-preview packet and manually exercise the normal DMG install
and first-launch path on an available Mac, in addition to automated ARM64 and
Intel verification?

**Answer:** Yes.

**Decision:** Require one maintainer-confirmed direct installation and first
launch from the downloaded signed-preview DMG on the maintainer's available Mac
architecture. Record the architecture, packet identity, DMG digest, outcome,
and confirmation time as non-secret evidence. Native CI remains authoritative
for both ARM64 and Intel architecture coverage; the manual check validates the
human download, drag-to-Applications, and first-launch experience.

**Classification:** Manual acceptance and end-user installation decision.

## Interview closing summary

### Solid

- The shared Reeve release pattern is defined by exact-byte authority,
  structured evidence, separate trust/publication approvals, immutable public
  history, and idempotent recovery; artifact count and architecture remain
  product-specific.
- PortReeve is implemented and rehearsed first while GateReeve remains the
  proven reference. GateReeve convergence follows as a separate future feature.
- Preview and trust remain orthogonal: unsigned preview is the default,
  explicitly trusted preview is available, and stable is fail-closed on real
  Apple trust.
- Apple and publication credentials occupy separate protected environments.
  Hosted publication is normal; the local exact-record publisher remains a
  recovery path.
- One protected producer signs both macOS CLIs, makes them authoritative across
  standalone/Homebrew/Desktop surfaces, embeds them unchanged, builds both
  trusted DMGs, and is followed by independent native ARM64/Intel verification.
- Trust evidence covers Developer ID identity and Team ID, hardened runtime,
  secure timestamps, two accepted notarizations, staple validation, DMG and app
  Gatekeeper acceptance, exact embedded-CLI equality, and native smoke results.
- The feature ends at a publication-ready nonpublishing signed-preview packet
  plus a maintainer direct-install check. Public mutation requires a later
  exact-plan approval.

### Still risky but deliberately accepted

- Apple's live notarization service must prove that the pre-signed CLI can be
  excluded from the enclosing Electron signing pass without invalidating nested
  code acceptance.
- A single protected Apple Silicon producer is expected to cross-package the
  Intel application; the Intel runner must independently reject any packaging
  or runtime defect.
- Real credential testing occurs only after reviewed workflow code reaches
  `main`, so live defects require additional branch/PR slices and consume new
  preview identities.

### Unresolved implementation detail, not product ambiguity

- The exact schema-v2 stage names and evidence object shapes must be derived
  from these decisions during spec and plan work while preserving valid v1
  inspection.
- The bounded timeout/retry policy for two sequential notarization submissions
  and the exact trusted artifact staging layout remain to be specified and
  tested.
- The separate `PortReeve Notarization` key and both protected GitHub
  environments must be configured by the maintainer before the live rehearsal;
  no credential values belong in repository files, workflow artifacts, or chat.

The interview is complete. No design question remains that should be delegated
to implementation without an explicit fail-closed contract.
