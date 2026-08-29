# Branch Tracker - tb-portreeve-apple-trust

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-28

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
|---|-------------------|--------|----|-------|
| R1 | Public-channel trust policy | PASS | #74 | P1 contract and tests complete; P6-P8 must preserve it |
| R2 | Schema lifecycle and compatibility | PASS | #74 | P1 schema-v2 lifecycle and read-only v1 dispatch complete |
| R3 | CLI byte and bundle authority | NOT YET | #74, #75, #76 | Preview.8 reached accepted Apple trust for both signed architecture-specific sets, but contradictory duplicate metadata rewriting stopped authoritative output before downstream byte proof |
| R4 | Protected production and credential custody | NOT YET | #74, #75, #76, #77, #78, #79 | Preview.8 proved both architecture-specific Apple paths; post-notary finalization atomicity and rerun rejection must land before complete protected execution |
| R5 | Native Apple verification | NOT YET | #75, #76, #78, #79 | Preview.8 completed producer-side Apple checks for both architectures, but finalization failed before current ARM64/Intel evidence documents were emitted |
| R6 | Finalization and publication separation | PASS | #76 | Final metadata consumes aggregated trust, seals the plan digest, and keeps trust/publication authority disjoint |
| R7 | Failure, recovery, and immutability | NOT YET | #74, #75, #76, #77, #78, #79 | Preview.8 retained sanitized request histories but deleted exact candidate DMGs before a later failure; slice 11 retains them until durable success and blocks GitHub reruns |
| R8 | Protected nonpublishing rehearsal | NOT YET | - | Planned for P8 / I-8 |

## PR Log

Append PR boundary entries here.

### PR #74 - Contract foundation

- **Slice:** `slice-01-contract-foundation`
- **Plan steps:** P1, P2
- **Issues:** I-1, I-2
- **Rubric in scope:** R1, R2, R3, R4, R7
- **Boundary packet:** [`pr-74/`](pr-74/)
- **Status:** Merged as `0de186b584be0ef4318c34cba5169dc1c5a76dd1`.

### PR #75 - Trusted artifact construction

- **Slice:** `slice-02-trusted-artifact-construction`
- **Plan steps:** P3, P4
- **Issues:** I-3, I-4
- **Rubric in scope:** R3, R4, R5, R7
- **Boundary packet:** [`pr-75/`](pr-75/)
- **Status:** Evaluated source
  `f12b1241b9cb7f0aac609b36bc130821106766b6`; merged as
  `d54fdc0056109a5b0e8442da74332f593f9fe5ed`.

### PR #76 - Verification and sealed distribution

- **Slice:** `slice-03-verification-sealed-distribution`
- **Plan steps:** P5, P6, P7
- **Issues:** I-5, I-6, I-7
- **Rubric in scope:** R1, R2, R3, R4, R5, R6, R7
- **Boundary packet:** [`pr-76/`](pr-76/)
- **Status:** Evaluated source
  `5d89cb14a6064cd65a07a489690be2d86568e02e`; merged as
  `4f4610f27639a09ba53692757971ea0ce7af7061`.

### PR #77 - Notarization submit recovery correction

- **Slice:** `slice-05-notarization-submit-recovery`
- **Plan steps:** P2, P8
- **Issues:** I-9
- **Rubric in scope:** R4, R7, R8
- **Boundary packet:** [`pr-77/`](pr-77/)
- **Status:** Evaluated source
  `048bee8901d13780a47ef19237c1bdf06ab4e3ed`; reviewed evidence head
  `4f92350fb3a35993601caa36bd563d500cbba1b1`; merged as
  `0a28b89c23ddd553467eae0fe8bb89a84ac78ddc`.

### PR #78 - Gatekeeper assessment parser correction

- **Slice:** `slice-07-gatekeeper-parser`
- **Plan steps:** P2, P8
- **Issues:** I-10
- **Rubric in scope:** R4, R5, R7, R8
- **Boundary packet:** [`pr-78/`](pr-78/)
- **Status:** Evaluated source
  `bc2bf1d7b33573666c749b5eeb2e12327433cbab`; reviewed evidence head
  `0ec83fd9d2ae831e2fe90f091c33360139405de2`; merged as
  `de43dae24f2629748b1c1a3376c478e183e0ec33`.

### PR #79 - Gatekeeper optional origin correction

- **Slice:** `slice-09-gatekeeper-origin`
- **Plan steps:** P2, P5, P8
- **Issues:** I-11
- **Rubric in scope:** R4, R5, R7, R8
- **Boundary packet:** [`pr-79/`](pr-79/)
- **Status:** Evaluated source
  `31da295f7359c25347b96a9d979421bed565671b`; reviewed evidence head
  `b7ff766a6d373a92b5ea2cf7db577c61f6b5058d`; merged as
  `2042850b8f8573e6b1b77c4c41ead68677cebae9`.

### PR #80 - Post-notarization finalization and recovery correction

- **Slice:** `slice-11-post-notary-finalization`
- **Plan steps:** P2, P4, P7, P8
- **Issues:** I-12
- **Rubric in scope:** R3, R4, R6, R7, R8
- **Boundary packet:** [`pr-80/`](pr-80/)
- **Status:** Draft review of pinned source
  `181028b2a0e8d2bfc75b70799dea9440b7b958c8`.

## Protected rehearsal attempt - `0.1.0-preview.5`

- **Run:** [33267482516](https://github.com/TrentBrown/portreeve/actions/runs/33267482516)
- **Source:** reviewed `main` commit
  `4f4610f27639a09ba53692757971ea0ce7af7061`
- **Outcome:** preliminary preparation, four native CLI jobs, qualification,
  and protected environment approval passed. The `release-trust` producer
  failed after Apple returned a request ID without submit status; downstream
  Apple evidence, finalization, and publication were skipped.
- **Identity:** `0.1.0-preview.5` is burned because its signed bytes and request
  ID were not preserved by the defective producer.
- **Public state:** unchanged; `.5` has no tag or release and the recorded
  PortReeve, Homebrew, formula, cask, and Desktop-update authorities still
  match the preflight baseline.

## Protected rehearsal attempt - `0.1.0-preview.6`

- **Run:** [33269593936](https://github.com/TrentBrown/portreeve/actions/runs/33269593936)
- **Source:** reviewed `main` commit
  `0a28b89c23ddd553467eae0fe8bb89a84ac78ddc`
- **Outcome:** preparation, four native CLI jobs, qualification, and protected
  approval passed. Apple accepted request
  `237759d8-5496-404a-ad71-4e9304591973` for the exact ARM64 candidate, but
  the producer rejected Gatekeeper's real path-prefixed acceptance line before
  producing the x64 trusted set.
- **Recovery:** artifact `trusted-recovery-0.1.0-preview.6-1` preserves the
  request-bound DMG at SHA-256
  `f647f01868e116e73940e421202d7d680751141d2b5b69823c30f6a2574ffb1b`
  plus sanitized history. Local `spctl` independently accepted its notarized
  Developer ID source and exact Trent Brown origin.
- **Identity:** `.6` is retained failed-attempt evidence and will not be reused;
  the next complete protected attempt must use `.7` after the correction lands.
- **Public state:** unchanged; `.6` has no tag or release, and publication was
  skipped.

## Protected rehearsal attempt - `0.1.0-preview.7`

- **Run:** [33272715923](https://github.com/TrentBrown/portreeve/actions/runs/33272715923)
- **Source:** reviewed `main` commit
  `de43dae24f2629748b1c1a3376c478e183e0ec33`
- **Outcome:** preparation, four native CLI jobs, qualification, and protected
  approval passed. Apple accepted request
  `2e9f8382-58d1-4d8e-a2d6-5ad32d6ce4aa` for the exact ARM64 candidate.
  Gatekeeper returned exit zero, a path-prefixed accepted status, and the
  notarized Developer ID source, but omitted the optional `origin=` display
  line; the parser rejected that otherwise valid assessment.
- **Recovery:** artifact `trusted-recovery-0.1.0-preview.7-1` preserves the
  request-bound DMG at SHA-256
  `02e11e0bec065bff8dc9d546cbf44316b29b784dc7793f5d121d5debd6890a3b`
  plus sanitized request history.
- **Identity:** `.7` is retained failed-attempt evidence and will not be reused;
  the next complete protected attempt must use `.8` after the correction lands.
- **Public state:** unchanged; `.7` has no tag or release, and PortReeve,
  Homebrew, formula, cask, and Desktop-update authorities match the baseline.

## Protected rehearsal attempt - `0.1.0-preview.8`

- **Run:** [33276106920](https://github.com/TrentBrown/portreeve/actions/runs/33276106920)
- **Source:** reviewed `main` commit
  `2042850b8f8573e6b1b77c4c41ead68677cebae9`
- **Outcome:** preparation, four native CLI jobs, qualification, protected
  approval, signing, both architecture-specific DMGs, and all four Apple
  notarization requests across the original run and GitHub rerun reached
  `Accepted`. Both attempts then failed deterministically while staging trusted
  metadata because an already rewritten manifest was subjected to the
  predecessor-to-signed rewrite a second time.
- **Requests:** attempt 1 ARM64
  `63a299ac-cb95-42ce-ac9b-7b5e39ec3f20`, attempt 1 x64
  `361fc2e2-923a-429e-b242-a92ef0f1c159`, attempt 2 ARM64
  `90c075d3-12ef-44d6-8e15-f4ffdf8dfad6`, and attempt 2 x64
  `63207094-b916-49bd-93e4-bef278eb12e0`.
- **Recovery:** `trusted-recovery-0.1.0-preview.8-1` and
  `trusted-recovery-0.1.0-preview.8-2` retain sanitized request histories, but
  the producer deleted the request-bound candidate DMGs before the later
  metadata failure. Those requests therefore cannot be resumed from preserved
  exact bytes.
- **Identity:** `.8` is burned and will not be reused. GitHub **Re-run jobs**
  is no longer an allowed protected recovery action; the next complete attempt
  must use `.9` after slice 11 lands on reviewed `main`.
- **Public state:** unchanged; `.8` has no tag or release, and PortReeve
  `main`, Desktop update, Homebrew `main`, formula, and cask authorities match
  the preflight baseline. Publication and all dependent jobs were skipped.

## Active Slice

### Slice 11 - Post-notarization finalization and recovery correction

- **Branch:** `tb-portreeve-apple-trust-11-post-notary-finalization`
- **Plan steps:** P2, P4, P7, P8
- **Issues:** I-12
- **Rubric in scope:** R3, R4, R6, R7, R8
- **Status:** GateReeve `PR_BOUNDARY` for draft PR #80 after validating
  `chg-post-notary-finalization-atomicity`. The correction performs one
  authoritative predecessor-to-signed rewrite, retains exact request-bound
  candidates until producer evidence is durable, and rejects
  `GITHUB_RUN_ATTEMPT > 1` before credential activation. No `development*`
  branch was merged or rebased, and publication remains out of scope.
