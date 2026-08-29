# Judge Evaluation - PR #80

**Pinned diff:** `2042850b8f8573e6b1b77c4c41ead68677cebae9..181028b2a0e8d2bfc75b70799dea9440b7b958c8`
**Scope:** Slice 11 (`I-12`), P2/P4/P7/P8
**Verdict:** PASS

## Rubric Evaluation

| # | Criterion | Result | Evidence |
|---|---|---|---|
| R3 | CLI byte and bundle authority | PASS | `scripts/produce-apple-trusted-artifacts.js:459` stages from the qualified artifact tree, overlays signed executables and DMGs, and invokes one rewrite at line 503; predecessor and signed identities remain fail-closed at lines 490-507. |
| R4 | Protected production and credential custody | PASS | The protected-context check consumes `GITHUB_RUN_ATTEMPT` before credential scope entry (`scripts/produce-apple-trusted-artifacts.js:81-110`) and rejects attempts other than `1` at lines 597-600. Producer evidence still records `publicationAuthority: false` at line 405. |
| R6 | Finalization and publication separation | PASS | The producer verifies and durably writes the synchronized trusted record before removing recovery candidates (`scripts/produce-apple-trusted-artifacts.js:351-416`) and acquires no publication authority. |
| R7 | Failure, recovery, and immutability | PASS | Candidate deletion moved after durable producer evidence at line 416, while failures retain nonempty recovery output at lines 423-429. Tests cover rerun rejection (`test/release/apple-trust-producer.test.js:44-65`) and real staging orchestration (`test/release/apple-trust-producer.test.js:229-359`). |
| R8 | Protected nonpublishing rehearsal | PASS WITH CONCERNS | The change is ready for the next nonpublishing attempt and the runbook forbids reconstructed reruns (`docs/releasing.md:326-338`), but this slice cannot supply preview.9 hosted evidence before it lands on reviewed `main`. Feature-level R8 correctly remains `NOT YET`. |

## Scope Check

- **Scope creep found:** No
- **Details:** The diff changes only producer finalization/recovery admission,
  its tests, operator guidance, and cumulative lifecycle evidence. It does not
  change installer topology, credentials, publication permissions, public
  state, or GateReeve.

## Gap Check

- **Unaddressed AC:** No slice-level gap. AC8's complete two-architecture
  packet and zero-public-mutation proof remain deliberately assigned to the
  next feature-final slice after merge.

## Contradiction Check

- **Contradictions found:** None. One predecessor-to-signed rewrite preserves
  the approved single-authority contract; next-version dispatch preserves the
  approved exact-byte request recovery model instead of replacing it.

## Concerns

The source-order assertion for candidate deletion is narrower than a fully
injected post-notary failure test, but it complements the real staging
integration test and the existing producer recovery tests. This is not a
blocking gap for the correction slice. Live proof remains mandatory and is not
claimed here.
