# Interview - tb-portreeve-apple-trust

**Feature start:** 2026-08-29
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

## D1 - Establish the governed restart and provenance boundary

**Question:** What authority should the archived Apple-trust lifecycle have in
this fresh GateReeve-governed feature, and what Git history may enter the new
topic branch?

**Answer:** Start `tb-portreeve-apple-trust` from clean `origin/main`. Use
commit `eaa5965541bd0fdfb58f0914d5d435b640ab9241` on
`tb-portreeve-apple-trust-legacy-reference` as historical reference,
especially its interview, design, spec, and decisions documents. Do not treat
historical approvals as GateReeve gate events; re-record every required
approval in the new governed lifecycle. Never merge or rebase a
`development*` branch into this topic branch.

**Decision:** The new feature is a governed restart, not an adoption or
reconstruction of legacy protocol history. Historical artifacts may inform the
fresh interview and later synthesis, but only new GateReeve events can pass
gates. Git source is `origin/main` at
`9c126fb4074072fb1a74039313072256c89d7f72`; the reference commit is read-only
context and its parent is that same source SHA. The topic branch must never
receive a merge or rebase from any `development*` branch.

**Classification:** Meta/tooling, governance, and provenance decision.

## Historical proposals to pressure-test

The legacy interview proposes the following feature decisions. These are
reference inputs, not current GateReeve approvals or independently recorded
answers in this interview:

- Establish the common Reeve contract first, implement PortReeve's harder
  trust path, then retrofit GateReeve separately.
- Keep preview channel and Apple trust orthogonal: unsigned preview by default,
  explicit trusted preview, trusted stable required.
- Use a PortReeve-specific notarization key while reusing the team Developer
  ID Application certificate.
- Separate `release-trust` from `release-publication` credentials and human
  authorization.
- Prefer a hosted normal publication path with an exact-record local recovery
  path.
- Make signed macOS CLI bytes authoritative across standalone, Homebrew, and
  Desktop surfaces.
- Produce both trusted architectures in one protected producer, then require
  independent native ARM64 and Intel verification.
- Embed each pre-signed CLI unchanged and fail closed if Apple rejects that
  nested-code shape.
- Require Gatekeeper acceptance for both the DMG and mounted application.
- Stop this feature at a publication-ready, nonpublishing rehearsal plus one
  manual direct-install check.
- Never reuse a materially changed live rehearsal version.
- Introduce release-record schema version 2 while preserving truthful schema
  version 1 inspection.
- Restrict real Apple credentials and live rehearsal to reviewed code on
  `main`.
- Keep PortReeve and GateReeve release implementations repository-local while
  aligning contracts and conformance fixtures.

## D2 - Keep live Apple trust main-only and publication out of scope

**Question:** Should the historical boundary remain: real Apple credentials
are usable only from reviewed code on `main`, so the trusted rehearsal occurs
after implementation reaches `main` through governed delivery slices, while
public publication remains outside this feature?

**Answer:** Yes.

**Decision:** Preserve the main-only `release-trust` boundary. Feature branches
may verify contracts, packaging, failure behavior, workflow structure, staging,
and cleanup without real credentials. A protected nonpublishing rehearsal may
run only after reviewed implementation reaches `main`; evidence-backed defects
return through fresh governed delivery slices. Completing this feature requires
the trusted rehearsal and its acceptance evidence but grants no authority to
publish its packet publicly.

**Classification:** Feature scope, credential exposure, delivery sequencing,
and public-mutation authority decision.

## D3 - Embed the authoritative CLI as canonical nested code

**Question:** Should PortReeve replace the historical proposal to place the
pre-signed CLI under `Contents/Resources` with a standard nested-code layout,
while retaining one authoritative signed byte identity across standalone,
Homebrew, and Desktop distribution?

**Answer:** Yes.

**Decision:** Sign each architecture-specific macOS CLI once before application
signing, then copy those exact bytes into a flat `Contents/Helpers` location in
the matching Desktop application. Exclude only that already-signed helper from
Electron's child-signing pass, sign the enclosing application after all nested
code is ready, and require deep strict signature verification plus final
mounted-DMG byte equality. Do not use `Contents/Resources` for the Mach-O CLI,
do not re-sign the embedded copy, and do not create separate standalone and
Desktop CLI identities. The protected rehearsal remains authoritative for
Apple acceptance of the complete bundle and distribution.

**Classification:** Artifact authority, macOS bundle topology, signing order,
and fail-closed trust decision.

## D4 - Retrofit GateReeve only after PortReeve proves the pattern

**Question:** Should the release-trust pattern proven by this PortReeve feature
eventually be folded back into GateReeve so both products share the same kind of
trust lifecycle?

**Answer:** Yes; GateReeve was the intended product.

**Decision:** PortReeve proves the harder Apple-trust contract first. A later,
separately governed GateReeve feature adopts the proven contract for artifact
authority, standard bundle topology, inside-out signing, structured trust
evidence, separated trust and publication authorization, nonpublishing
rehearsal, and cross-project conformance. It does not copy PortReeve's
architecture-specific CLI/Desktop graph into GateReeve, rewrite GateReeve's
published history, or add GateReeve repository changes to this feature.

**Classification:** Cross-project sequencing, future scope, and conformance
decision.

## D5 - Retain native DMGs with one protected producer and two verifiers

**Question:** Should PortReeve adopt GateReeve's universal DMG, or retain its
architecture-specific artifacts while matching GateReeve's trust-job topology?

**Answer:** Retain separate PortReeve DMGs. Use one protected producer for both
architectures and require separate native ARM64 and Intel verification jobs.

**Decision:** PortReeve continues to publish distinct ARM64 and x64 macOS CLI,
application, and DMG identities. One protected macOS Apple Silicon job receives
Apple credentials and produces both trusted architecture-specific bundles,
minimizing credential exposure and matching GateReeve's single-producer trust
boundary. Independent ARM64 and Intel jobs must then inspect and execute their
matching exact signed CLI, application, and DMG before aggregation. Common
Reeve conformance concerns trust, evidence, approval, publication, and recovery
semantics; it does not require identical artifact counts. Homebrew selects the
native PortReeve artifact automatically, and direct downloads must label the
architectures clearly.

**Classification:** Artifact topology, credential exposure, native authority,
distribution UX, and cross-project conformance decision.

## D6 - Separate trust creation from publication authority

**Question:** Should PortReeve establish a dedicated `release-trust`
environment for Apple credentials, despite temporarily differing from
GateReeve's current use of `release-publication` for its nonpublishing trust
job?

**Answer:** Yes.

**Decision:** PortReeve uses two protected credential domains.
`release-trust` contains only Apple signing and notarization configuration and
authorizes creation of nonpublic trusted bytes. `release-publication` contains
only publication authority and authorizes deterministic public mutation from a
sealed packet. A trust job must not receive the PortReeve publication token,
and a publication job must not receive Apple private material. The future
GateReeve retrofit should adopt this same split so the temporary configuration
difference converges on one common Reeve contract.

**Classification:** Security boundary, least privilege, human authorization,
and future cross-project convergence decision.

## D7 - Isolate PortReeve notarization authority

**Question:** Should PortReeve reuse GateReeve's App Store Connect notarization
key, or use a product-specific key while retaining the team-wide Developer ID
Application certificate?

**Answer:** Use a product-specific PortReeve notarization key.

**Decision:** Reuse the existing Developer ID Application certificate for the
Apple developer team, but create a separate least-privilege App Store Connect
team key named `PortReeve Notarization`. PortReeve receives independently named
CI variables, secrets, recovery metadata, and rotation instructions. Its notary
key can be revoked or replaced without coupling GateReeve's notarization path.
Private material and recovery contents never enter repository files, workflow
artifacts, logs, or conversation records.

**Classification:** Credential custody, product isolation, rotation, and
recovery decision.

## D8 - Require Apple trust for every future public macOS release

**Question:** Should preview channel and Apple trust remain independently
selectable for public releases, or should unsigned output be limited to
internal candidates while every public preview and stable release is signed
and notarized?

**Answer:** Limit unsigned output to internal candidates. Require Apple trust
for every newly published preview and stable release.

**Decision:** Preview remains a prerelease update channel and compatibility
promise, not a weaker authenticity policy. Development, CI, and nonpublishing
candidate construction may use ad-hoc or unsigned artifacts without Apple
credentials. Public mutation must fail closed unless the macOS CLI,
application, and DMG have the required Developer ID, hardened runtime, secure
timestamp, notarization, stapling, Gatekeeper, exact-byte, and native evidence.
Existing published previews `0.1.0-preview.1` through `.4` remain immutable and
truthfully identified as unsigned; the new policy applies prospectively.

**Classification:** Public distribution policy, user trust, channel semantics,
historical immutability, and release authorization decision.

## D9 - Make hosted publication normal and local publication recovery-only

**Question:** After a trusted packet passes both native verifiers, should the
normal publication path be a separately approved hosted job that consumes the
exact sealed bytes, while the local publisher remains only a controlled
recovery path?

**Answer:** Yes.

**Decision:** A protected hosted publication job is the normal public mutation
surface. It receives no Apple private material, consumes the already sealed
release record, exact artifacts, and publication-plan digest, reruns read-only
preflights, and performs only the approved deterministic mutations. It never
rebuilds or re-signs artifacts. PortReeve retains its local exact-record
publisher for controlled continuation or recovery against the same packet and
plan, not as the ordinary operator workflow. Trust creation and publication
remain separate human approvals.

**Classification:** Publication authority, operator workflow, reproducibility,
and recovery decision.

## D10 - Require Gatekeeper acceptance for every macOS entry point

> Superseded by D17 after live preview.9 proved that macOS does not classify a
> bare command-line executable as an app for `spctl --type execute` assessment.

**Question:** Should architecture-specific release evidence require native
Gatekeeper acceptance for the signed standalone CLI, final DMG, and mounted
application rather than assessing only the DMG and app?

**Answer:** Yes.

**Decision:** Each native ARM64 and Intel verifier must bind successful
Gatekeeper assessment of all three user-delivered entry points to the exact
release and architecture: `spctl` execution assessment of the authoritative
standalone CLI, primary-signature open assessment of the final DMG, and
execution assessment of the mounted application. These checks supplement, not
replace, Developer ID identity and Team ID validation, hardened runtime, secure
timestamp, notarization acceptance, staple validation, deep strict signature
verification, exact embedded-CLI equality, and native smoke behavior. Any
missing or rejected assessment blocks aggregation and publication.

**Classification:** Apple trust evidence, direct-download safety, native
verification, and release-gate decision.

## D11 - Never reuse a materially changed live candidate version

**Question:** If a protected Apple rehearsal fails and candidate bytes must
change, should PortReeve retire that preview version and assign a fresh one even
when the failed candidate was never publicly released?

**Answer:** Yes.

**Decision:** A candidate identity becomes immutable once a live protected
Apple operation begins. Any material byte, packaging, signing, evidence, or
workflow correction requires the next unused preview version. Preserve failed,
rejected, timed-out, and superseded attempt evidence without overwriting the
original candidate. Never reuse a semantic identity for different bytes, and
never rewrite existing public or protected rehearsal history.

**Classification:** Release identity, auditability, cache safety, notarization
history, and recovery decision.

## D12 - Version the release record without rewriting history

**Question:** Should new trusted candidates use release-record schema version 2
while PortReeve retains strict read-and-inspect compatibility for historical
schema-version-1 records without inventing missing trust evidence?

**Answer:** Yes.

**Decision:** New release creation emits schema version 2 with explicit stages
and evidence for candidate qualification, unsigned-to-signed macOS CLI
transformation, canonical nested-code packaging, authoritative native
verification, Apple trust, distribution finalization, and separated
publication. Valid schema-version-1 records remain readable and inspectable as
the truthful contract under which they were created. Readers must not infer v2
passage, synthesize absent Apple evidence, mutate historical records, or permit
v1 compatibility to weaken v2 validation.

**Classification:** Versioned release contract, compatibility, evidence
integrity, and historical immutability decision.

## D13 - Keep manual direct-install verification optional

**Question:** Should feature completion require a maintainer-confirmed direct
download, DMG installation, and first launch on an available Mac in addition to
mandatory native CI verification?

**Answer:** No. Keep the manual installation check optional.

**Decision:** Native ARM64 and Intel CI verification remains mandatory and
authoritative for both supported architectures. A maintainer may additionally
download a trusted DMG and exercise the normal open, drag-to-Applications,
quarantine, and first-launch path on an available Mac; if performed, record the
architecture, release identity, DMG digest, result, and confirmation time. The
absence of this optional check does not block the protected rehearsal, feature
completion, or later publication approval.

**Classification:** Manual acceptance scope, completion criteria, and test
authority decision.

## D14 - Keep native Intel verification fail-closed

**Question:** If GitHub's native Intel macOS runner becomes unavailable, should
the coordinated release block rather than substitute Rosetta verification or
silently publish only ARM64?

**Answer:** Yes.

**Decision:** Native ARM64 and native Intel execution evidence are both
mandatory for the coordinated PortReeve macOS release. Rosetta execution on
Apple Silicon is useful supplemental evidence but cannot satisfy Intel native
authority. Missing runner capacity, incomplete evidence, or architecture
substitution blocks aggregation and publication. Removing Intel support or
permitting architecture-partial publication requires an explicit future design
amendment and corresponding release-contract change.

**Classification:** Supported architecture, native test authority, CI
availability, and fail-closed release decision.

## D15 - Recover bounded notarization attempts without changing identity

**Question:** Should PortReeve permit bounded recovery from transient Apple
notarization failures for the same immutable candidate bytes, while preserving
request continuity and consuming a new version only when bytes change?

**Answer:** Yes.

**Decision:** Notarization submission and polling use explicit time bounds and
preserve machine-readable diagnostics. When Apple creates a request ID, recovery
continues polling that request rather than submitting the bytes again. Upload
may retry only when evidence establishes that no Apple request was created.
Every request ID and outcome remains attached to the candidate, and only a
final `Accepted` result may advance it. Rejection, malformed output, exhausted
recovery, or an indeterminate request state blocks the candidate. Identical
bytes retain their version during bounded recovery; any material byte change
requires a fresh preview identity under D11.

**Classification:** External-service recovery, timeout policy, evidence
continuity, release identity, and fail-closed decision.

## D16 - Keep implementations repository-local until both paths are proven

**Question:** Should PortReeve and GateReeve keep their first trusted-release
implementations repository-local while sharing contract vocabulary,
conformance fixtures, and expected evidence, deferring shared runtime code
until both paths are proven?

**Answer:** Yes.

**Decision:** PortReeve implements and rehearses its trust path within this
repository. The later GateReeve retrofit remains self-contained in its own
repository. The projects align through common semantic contracts, equivalent
fixtures, evidence expectations, and cross-project conformance checks rather
than a new runtime dependency. Shared implementation code may be reconsidered
only after both release systems have survived real protected rehearsals and the
cost and stability of duplication are known.

**Classification:** Dependency boundary, cross-project architecture,
conformance, and sequencing decision.

## D17 - Align Gatekeeper checks with GateReeve's actual delivery surfaces

**Question:** After both preview.9 native runners reported that the exact
Developer ID-signed standalone CLI "does not seem to be an app," should
PortReeve continue requiring an app-policy `spctl` result for that bare tool?

**Answer:** No. Match GateReeve's established trust boundary.

**Decision:** Native ARM64 and Intel evidence requires Gatekeeper execution
acceptance for the mounted application and primary-signature open acceptance
for the notarized, stapled DMG. The standalone CLI instead requires the exact
Developer ID Application identity and Team ID, hardened runtime, secure
timestamp, strict signature validity, byte equality across standalone,
Homebrew, and embedded-helper surfaces, native lifecycle smoke, and successful
execution from a quarantined copy. A bare executable is not represented as a
Gatekeeper-accepted app fact, and aggregation must reject any evidence that
omits its replacement CLI checks. This supersedes D10 without changing the
separate ARM64/x64 DMG shape or weakening app and DMG Gatekeeper requirements.

**Classification:** Apple trust evidence, GateReeve alignment, command-line
distribution safety, native verification, and release-gate correction.

## Interview closing summary

### Solid

- This is a fresh GateReeve-governed lifecycle from clean `origin/main`; the
  legacy commit is reference context only and supplies no gate events.
- PortReeve retains separate ARM64 and Intel CLI, application, and DMG
  identities, produced in one protected job and verified by separate native
  ARM64 and Intel jobs.
- Each authoritative signed CLI is embedded unchanged as canonical nested code
  in a flat `Contents/Helpers` location, then sealed by the enclosing app.
- Internal candidates may be unsigned, but every future public preview and
  stable macOS release must be Developer ID signed and notarized.
- Apple trust and publication use separate protected environments and separate
  human approvals. Hosted publication is normal; the exact-record local
  publisher is recovery-only.
- PortReeve uses a product-specific notarization key while reusing the
  team-wide Developer ID Application certificate.
- Trust evidence is architecture-bound and fail-closed: the signed standalone
  CLI passes strict identity, byte-equality, native lifecycle, and quarantined
  execution checks, while the DMG and mounted app pass Gatekeeper assessment.
- New candidates use release-record schema version 2; valid version-1 records
  remain truthful read-only history.
- Candidate versions are immutable once live Apple work begins. Bounded
  recovery may continue for identical bytes, but changed bytes require a new
  preview identity.
- The protected nonpublishing rehearsal from reviewed `main` code is mandatory;
  manual direct installation is optional and public publication remains outside
  this feature.
- GateReeve later adopts the proven common contract through a separate governed
  feature, while both implementations remain repository-local initially.

### Still risky but deliberately accepted

- One Apple Silicon producer cross-packages the Intel application; native Intel
  verification remains blocking and Rosetta cannot substitute for it.
- Real Apple integration begins only after reviewed code reaches `main`, so
  live defects require fresh governed slices and may consume additional preview
  versions.
- Apple service delays can block a candidate. Recovery is bounded and may not
  fabricate, replace, or ambiguously duplicate notarization evidence.

### Unresolved implementation detail, not product ambiguity

- Exact schema-version-2 stage names and evidence object shapes must be derived
  during specification from the settled authority and ordering constraints.
- Concrete command timeouts, polling intervals, artifact staging paths, and
  Electron signing callbacks remain specification and planning details.
- The maintainer must create and securely retain the PortReeve notarization key
  and configure both protected environments before the live rehearsal; no
  credential values belong in source or workflow artifacts.

The interview is complete. The next workflow action is synthesis of a fresh
`design.md`; its approval must be recorded through GateReeve before any
specification work begins.
