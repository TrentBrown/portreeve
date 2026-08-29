# Decisions - tb-portreeve-apple-trust

**Feature start:** 2026-08-28

Permanent record of decisions promoted from `scratchpad.md`.

---

## Version the release record with read-only legacy dispatch

**Confidence:** HIGH

**Blast Radius:** Release preparation, evidence aggregation, Desktop finalization, publication approval, and historical release-record readers

New records use schema version 2 and the twelve ordered stages from the approved spec. Schema version 1 remains readable through its original stage vocabulary but is rejected by all mutation paths. Public publication approval in schema v2 fails closed unless Desktop trust is developer-id-notarized; historical v1 facts are neither upgraded nor reinterpreted.

**Triggered by:** P1 requires a twelve-stage trust lifecycle while existing completed schema-v1 records must remain historically truthful

**Alternatives considered:**

- Rewrite v1 records in place - rejected because it would falsify historical evidence.
- Support one mixed stage vocabulary - rejected because ambiguous partial states would weaken validation.

**Promoted:** 2026-08-28. PR: https://github.com/TrentBrown/portreeve/pull/74.

---

## Make Apple trust recovery explicit, finite, and product-scoped

**Confidence:** HIGH

**Blast Radius:** Future protected signing and notarization workflow, credential cleanup, preview-version reuse, and Apple trust verification

PortReeve accepts only its exact Developer ID identity, Team ID, and product-specific notary key configuration. Platform commands cross an injectable timeout-bounded boundary, credentials are restored after preparation or action failure, and notarization recovery is persisted as one immutable candidate identity with a finite deadline and upload-attempt count. Once Apple returns a request ID, recovery may only poll that request; resubmission is permitted only after explicit evidence that no request was created.

**Triggered by:** P2 introduces security-sensitive credential custody and recovery behavior that is not visible from individual command invocations

**Alternatives considered:**

- Reuse a shared product credential label - rejected to preserve product separation.
- Retry submit after an ambiguous timeout - rejected because it can create duplicate Apple requests.
- Allow unbounded polling - rejected because failure must terminate predictably.

**Promoted:** 2026-08-28. PR: https://github.com/TrentBrown/portreeve/pull/74.

---

## Transform signed CLI metadata as one authority set

**Confidence:** HIGH

**Blast Radius:** Protected producer output, release record, manifest, Homebrew formula, checksums, native verification, and finalization

When the protected producer transforms either macOS CLI, it must rewrite the corresponding manifest entries, Homebrew checksums, SHA256SUMS document, and release-record metadata identities before the output is verified or uploaded. Native Apple jobs and finalization consume only this synchronized protected tree; they do not tolerate metadata that still names the unsigned predecessor.

**Triggered by:** Developer ID signing changes the macOS CLI bytes after preliminary qualification

**Alternatives considered:**
Defer metadata repair until finalization - rejected because native verification must consume a self-consistent protected output. Keep separate unsigned and signed manifests - rejected because multiple authorities would make downstream selection ambiguous. Rebuild metadata independently in each native job - rejected because read-only verifiers must not mutate the producer output.

**Promoted:** 2026-08-29. PR: https://github.com/TrentBrown/portreeve/pull/76.
