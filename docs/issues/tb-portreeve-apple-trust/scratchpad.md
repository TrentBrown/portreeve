# Decision Scratchpad - tb-portreeve-apple-trust

**Feature start:** 2026-08-28

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Version the release record with read-only legacy dispatch

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Release preparation, evidence aggregation, Desktop finalization, publication approval, and historical release-record readers

New records use schema version 2 and the twelve ordered stages from the approved spec. Schema version 1 remains readable through its original stage vocabulary but is rejected by all mutation paths. Public publication approval in schema v2 fails closed unless Desktop trust is developer-id-notarized; historical v1 facts are neither upgraded nor reinterpreted.

**Triggered by:** P1 requires a twelve-stage trust lifecycle while existing completed schema-v1 records must remain historically truthful

**Alternatives considered:**

- Rewrite v1 records in place - rejected because it would falsify historical evidence.
- Support one mixed stage vocabulary - rejected because ambiguous partial states would weaken validation.

## [2] Make Apple trust recovery explicit, finite, and product-scoped

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Future protected signing and notarization workflow, credential cleanup, preview-version reuse, and Apple trust verification

PortReeve accepts only its exact Developer ID identity, Team ID, and product-specific notary key configuration. Platform commands cross an injectable timeout-bounded boundary, credentials are restored after preparation or action failure, and notarization recovery is persisted as one immutable candidate identity with a finite deadline and upload-attempt count. Once Apple returns a request ID, recovery may only poll that request; resubmission is permitted only after explicit evidence that no request was created.

**Triggered by:** P2 introduces security-sensitive credential custody and recovery behavior that is not visible from individual command invocations

**Alternatives considered:**

- Reuse a shared product credential label - rejected to preserve product separation.
- Retry submit after an ambiguous timeout - rejected because it can create duplicate Apple requests.
- Allow unbounded polling - rejected because failure must terminate predictably.

## [3] Transform signed CLI metadata as one authority set

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Protected producer output, release record, manifest, Homebrew formula, checksums, native verification, and finalization

When the protected producer transforms either macOS CLI, it must rewrite the corresponding manifest entries, Homebrew checksums, SHA256SUMS document, and release-record metadata identities before the output is verified or uploaded. Native Apple jobs and finalization consume only this synchronized protected tree; they do not tolerate metadata that still names the unsigned predecessor.

**Triggered by:** Developer ID signing changes the macOS CLI bytes after preliminary qualification

**Alternatives considered:**
Defer metadata repair until finalization - rejected because native verification must consume a self-consistent protected output. Keep separate unsigned and signed manifests - rejected because multiple authorities would make downstream selection ambiguous. Rebuild metadata independently in each native job - rejected because read-only verifiers must not mutate the producer output.

## [4] Persist notarization continuity at the producer boundary

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Protected Apple producer, failure artifacts, exact signed DMG retention, workflow uploads, and notarization evidence

Treat successful notarytool submit output as request creation even when status is absent, while keeping info responses strict. Drive the real producer through the existing finite recovery state machine, persist every non-secret state transition beside the exact signed DMG before and after Apple calls, and upload only that recovery directory when the protected job fails. Once a request ID exists, all continuation targets that ID; no new submission is allowed. Successful candidates retain the recovery history but move the authoritative DMG into the normal trusted artifact set.

**Triggered by:** Live run 33267482516 returned a valid Apple request ID without status, then the producer rejected the response and deleted its output

**Alternatives considered:**
- Add `notarytool --wait` - rejected because it bypasses the approved explicit polling and continuity model.
- Default missing status without recording the request lifecycle - rejected because a later failure would again erase continuity.
- Keep deleting output on failure - rejected because exact signed bytes and failed-attempt evidence would disappear.

## [5] Parse Gatekeeper's real path-prefixed assessment

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Protected producer and both native Apple trust evidence collectors

Treat either a bare 'accepted' status line or spctl's real '<assessed path>: accepted' status line as the acceptance fact. Continue to require exit code zero, source=Notarized Developer ID, and the exact PortReeve Developer ID origin. This preserves fail-closed identity checks while making the parser compatible with the platform command it invokes.

**Triggered by:** Live preview.6 run 33269593936 reached accepted Apple notarization, then rejected real spctl output whose status line was '<path>: accepted'

**Alternatives considered:**
Strip the path before parsing - rejected because the parser should validate the complete command result contract in one place. Accept any occurrence of the word accepted - rejected because unrelated diagnostic text could create a false positive. Replace Gatekeeper with notarization status alone - rejected because the approved design requires both independent facts.

## [6] Treat Gatekeeper origin as optional display metadata

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Protected producer and both native Apple trust evidence collectors

Require Gatekeeper exit zero, an exact accepted status line, and
`source=Notarized Developer ID`. If `spctl` emits `origin=`, require the exact
PortReeve Developer ID identity; if it omits that display field, retain the
successful assessment without inventing an origin. Exact Developer ID identity,
Team ID, hardened runtime, and secure timestamp remain independently mandatory
through `codesign` facts for every CLI, application, and DMG.

**Triggered by:** Live preview.7 run 33272715923 returned a valid accepted primary-signature assessment without an `origin=` line

**Alternatives considered:**

- Continue requiring `origin=` - rejected because live `spctl` can omit it from an accepted notarized assessment.
- Synthesize the expected origin when absent - rejected because evidence must not invent command output.
- Drop exact identity verification - rejected because the approved design requires independent Developer ID and Team ID authority.

## [7] Make protected producer completion atomic and single-attempt

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Protected trusted-artifact staging, release metadata authority, failed-attempt recovery, and operator workflow controls

Copy the untouched qualified artifact set once, overlay signed executables and
architecture-specific DMGs, and perform exactly one authoritative
predecessor-to-signed metadata rewrite. Retain each request-bound candidate and
its request history until the complete producer output and evidence are
durable. Reject `GITHUB_RUN_ATTEMPT > 1` before credential activation or Apple
submission; changed or repeated protected attempts use the next unused preview
version, while exact-request recovery remains bound to retained identical
bytes.

**Triggered by:** Both attempts of live preview.8 run 33276106920 reached accepted notarization for both architectures, then failed on a duplicate metadata rewrite after candidate deletion; the GitHub rerun also created new Apple requests for the same version

**Alternatives considered:**

- Rewrite the already signed manifest again - rejected because the rewrite contract intentionally requires predecessor identities and must remain fail-closed.
- Delete candidate bytes immediately after Apple acceptance - rejected because later producer failure would leave request history without the exact submitted bytes.
- Permit GitHub job reruns for convenience - rejected because a rerun reconstructs and resubmits protected artifacts instead of continuing the exact request-bound recovery record.
