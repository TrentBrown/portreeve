# Spec Evaluation - PR #76

**Pinned diff:**
`d54fdc0056109a5b0e8442da74332f593f9fe5ed..5d89cb14a6064cd65a07a489690be2d86568e02e`

**Scope:** Slice 3, plan steps P5-P7 (`I-5`, `I-6`, `I-7`)

**Verdict:** PASS for this slice

## Rubric evaluation

| Criterion | Status | Evidence |
|---|---|---|
| R1 - Public-channel trust policy | PASS | Public preview and stable paths require trusted Apple output, the unsigned internal path remains distinct, and preview `.1` through `.4` remain immutable unsigned history. |
| R2 - Schema lifecycle and compatibility | PASS | The schema-v2 record advances through exact predecessor-bound trust stages while schema-v1 remains read-only historical dispatch. |
| R3 - CLI byte and bundle authority | PASS FOR SLICE; OVERALL NOT YET | The producer synchronizes signed CLI identities across the release record, manifest, formula, and checksums; native verification proves the same helper and mounted application seal; finalization uses those identities. Live protected byte evidence remains P8. |
| R4 - Protected production and credential custody | PASS FOR SLICE; OVERALL NOT YET | Workflow source isolates one main-only protected Apple producer from credential-free native verifiers and a separate publisher. Live protected execution and cleanup evidence remain P8. |
| R5 - Native Apple verification | PASS FOR SLICE; OVERALL NOT YET | Strict ARM64 and Intel collectors and exact two-document aggregation are implemented with negative fixtures for stale, duplicate, translated, synthetic, cross-bound, and incomplete evidence. Current hosted documents remain P8. |
| R6 - Finalization and publication separation | PASS | Trusted finalization consumes only the synchronized protected tree and aggregated evidence, seals the publication plan digest, and the separately approved publisher rechecks rather than rebuilds or re-signs. |
| R7 - Failure, recovery, and immutability | PASS | Transformation, evidence, finalization, plan-digest, and publication preflight failures stop at their dependent boundaries; create-once evidence and exact identities prevent silent replacement. |
| R8 - Protected nonpublishing rehearsal | NOT YET / OUT OF SCOPE | The live `main`, `publish=false` rehearsal is exclusively P8 and the final feature slice. |

## Acceptance-criteria coverage

- AC1 and AC2 remain satisfied and are preserved by the trusted and unsigned
  workflow branches.
- AC3 is implemented end to end in source: signed CLI identities become the
  only downstream metadata authority and must match standalone, application,
  and mounted-DMG helper bytes. Live protected proof remains P8.
- AC4 is implemented in source with disjoint protected, verification, and
  publication authorities. Live protected execution remains P8.
- AC5 is implemented through architecture-native collectors and strict
  aggregation. The resulting hosted documents remain P8 evidence.
- AC6 is complete in source and tests: final bytes drive distribution metadata,
  the plan digest is sealed, and the publisher cannot rebuild or infer trust
  approval as publication approval.
- AC7 failure boundaries are covered by positive and negative tests, including
  the corrected executable-only hardened-runtime rule.
- AC8 is deliberately deferred. This slice performs no public mutation and
  claims no live Apple result.

## Verification

The corrected pinned source passes typecheck, diff hygiene, workflow document
validation, and 64 focused tests with 495 expectations. The repository-wide
check retained exit 1 with 567 passes and five failures in unchanged local
launcher/MCP/CLI paths; the exact inventory is preserved in
[`verification.md`](verification.md).

No criterion was weakened, no historical evidence was treated as a new gate
event, and no live Apple fact was inferred from source inspection or fixtures.
