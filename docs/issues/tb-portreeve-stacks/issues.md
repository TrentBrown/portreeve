# Issues - tb-portreeve-stacks

**Feature:** `tb-portreeve-stacks` **Spec:** [`spec.md`](spec.md) **Plan:**
[`plan.md`](plan.md) **Created:** 2026-08-06

Operational task breakdown derived from the plan.

## I-1 - Establish canonical identities and stack definitions

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P1, P2
- **Rubric criteria:** R1, R5, R7
- **Depends on:** none
- **PR:** [#7](https://github.com/TrentBrown/portreeve/pull/7)

Migrate service identities without data loss, add strict version-1 definition
normalization and content-addressed revisions, persist stack registration, and expose
compatible apply and inspection contracts through the server, client, CLI, inventory,
and desktop port model.

**Started 2026-08-06.** The exact feature branch carries the first delivery slice after
design, specification, and plan approval.

**In review 2026-08-06.** R1 and R5 pass. The definition-registration portion of R7 is
complete and independently capability-gated; the full criterion remains open for I-2 and
I-3. The broad suite's one lifecycle-status failure reproduces at the base SHA and
awaits human acknowledgment in the PR boundary.

**Merged 2026-08-06.** PR #7 merged to `main` as `13db683`; the documented base-only
lifecycle test condition was accepted through human review and merge.

## I-2 - Implement generations and process-backed activations

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P3
- **Rubric criteria:** R2, R7
- **Depends on:** I-1
- **PR:** [#8](https://github.com/TrentBrown/portreeve/pull/8)

Add complete immutable allocation generations, exclusive activation attempts, atomic
batch leases, process-backed endpoint confirmation, required/optional outcomes, and the
corresponding protocol, client, CLI, and history surfaces.

**Started 2026-08-06.** Sequential delivery branch `tb-portreeve-stacks-02-activations`
begins from merged `main` at `13db683`.

**In review 2026-08-06.** Draft PR #8 contains P3's immutable generations,
process-backed activations, atomic batch leases, public coordination surfaces, and
focused verification. R2 is implemented for the process-backed scope; R7 advances
through the complete `stack-activations-v1` surface and remains open for P4-P7.

**Merged 2026-08-06.** PR #8 merged to `main` as `ca7b552`; its process-backed
activation contract and documented installed-launchd baseline were accepted through
human review and merge.

## I-3 - Deliver dependency resolution and sandbox discovery

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P4
- **Rubric criteria:** R4, R7
- **Depends on:** I-2
- **PR:** [#9](https://github.com/TrentBrown/portreeve/pull/9)

Resolve scoped dependency aliases and host/Docker/sandbox address views from one
generation, generate redacted activation-scoped discovery documents, and add the
JavaScript snapshot reader and stale-plan safeguards.

**Started 2026-08-06.** Sequential delivery branch `tb-portreeve-stacks-03-discovery`
begins from merged `main` at `ca7b552`.

**In review 2026-08-06.** Draft PR #9 contains P4's scoped dependency resolution,
separate host and Docker-network facts, redacted launcher-rendered sandbox documents,
strict stale-aware JavaScript reading, atomic file publication, and matching protocol,
client, CLI, and documentation surfaces.

**Merged 2026-08-06.** PR #9 merged to `main` as `f16addf`; its scoped discovery
contract, redaction boundary, and documented installed-launchd baseline were accepted
through human review and merge.

## I-4 - Add Docker evidence and mixed activations

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P5
- **Rubric criteria:** R3, R6
- **Depends on:** I-2
- **PR:** [#10](https://github.com/TrentBrown/portreeve/pull/10)

Implement the trusted Docker CLI adapter, activation labels and fresh inspect
verification, mixed process/container confirmation, capability degradation, and
unconditional refusal to signal Docker-managed host listeners.

**Started 2026-08-06.** Sequential delivery branch
`tb-portreeve-stacks-04-docker-evidence` begins from merged `main` at `f16addf`.

**Implementation complete 2026-08-06.** PR #10 adds dynamic Docker capability
advertisement, per-component mixed activation bindings, exact label and publication
evidence, schema-v5 Docker run persistence, Docker-managed inventory, launcher-only
reclamation results, official client and CLI surfaces, and a real Docker Desktop
end-to-end activation smoke.

**Merged 2026-08-06.** PR #10 merged to `main` as `655f1ac`; its Docker evidence,
mixed-activation safety, and real Docker Desktop verification were accepted through
human review and merge.

## I-5 - Complete activation recovery and safe stack pruning

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P6
- **Rubric criteria:** R6
- **Depends on:** I-2, I-4
- **PR:** [#11](https://github.com/TrentBrown/portreeve/pull/11)

Reconcile launcher loss and surviving providers from fresh evidence, implement
evidence-gated activation ending, and add missing-worktree stack pruning with preview,
consent, revalidation, no-reclamation, and history retention.

**Started 2026-08-06.** Sequential delivery branch
`tb-portreeve-stacks-05-recovery-pruning` begins from merged `main` at `655f1ac`.

**Implementation complete 2026-08-06.** The slice adds schema-v6 lost activation
recovery, fresh process and Docker provider reconciliation, evidence-gated ending,
previewed and consent-gated missing-worktree stack pruning, execution-time
revalidation, atomic coordination and claim deletion, retained history, and matching
protocol, official client, CLI, migration, documentation, and compiled-runtime coverage.
The pinned Bun 1.3.14 gate passes all 214 tests with 865 assertions.

**In review 2026-08-06.** Draft PR #11 completes P6 recovery and safe pruning. R6 now
passes across fresh process and Docker reconciliation, signal-free Docker handling,
consent modes, execution-time revalidation, and retained history. R7 now passes across
the complete capability-gated protocol, official client, CLI, compiled runtime, and
documentation contract; the separate desktop experience remains I-6/P7 and R8.

**Merged 2026-08-06.** PR #11 merged to `main` as `3ecd8a5`; its activation
recovery, evidence-gated ending, and safe stack-pruning contract were accepted through
human review and merge.

## I-6 - Add the desktop Stacks experience and failure details

- **Status:** closed
- **Estimate:** 3d
- **Plan steps:** P7
- **Rubric criteria:** R8
- **Depends on:** I-1, I-2, I-3, I-4, I-5
- **PR:** [#12](https://github.com/TrentBrown/portreeve/pull/12)

Build the approved desktop inspection and safe coordination workflows across the
main/preload/renderer boundary, preserve serialized fresh evidence, and surface
actionable lifecycle and stack errors without granting orchestration authority.

**Started 2026-08-06.** Sequential delivery branch
`tb-portreeve-stacks-06-desktop-stacks` begins from merged `main` at `3ecd8a5`.

**In review 2026-08-06.** Draft PR #12 adds the desktop Stacks inspection and safe
coordination experience, actionable lifecycle and stack failures, a read-only aggregate
stack-status contract for trusted inspection surfaces, and packaged macOS verification.
The desktop remains a Portreeve coordinator rather than a project process or container
orchestrator.

**Merged 2026-08-07.** PR #12 merged to `main` as `0fc3865` after the complete
desktop, protocol, client, CLI, package, and boundary gates passed.

## I-7 - Complete integrated verification and feature evidence

- **Status:** in-review
- **Estimate:** 2d
- **Plan steps:** P8
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-3, I-5, I-6
- **PR:** [#13](https://github.com/TrentBrown/portreeve/pull/13)

Finish public documentation and representative examples, run mixed-stack and legacy
end-to-end matrices on supported native environments and the packaged desktop, execute
every workflow gate, and preserve the feature-final evidence and completion report.

**Started 2026-08-07.** Final sequential delivery branch
`tb-portreeve-stacks-07-feature-final` begins from merged `main` at `0fc3865`.

**Implementation complete 2026-08-07.** PR #13 adds public desktop and representative
mixed-stack launcher guides plus a disposable assembled process/Docker lifecycle gate.
The first Linux run exposed that Docker Engine kernel-NAT publication has no userspace
listener; binding-appropriate Docker inspection replaced that false portability
assumption. The corrected matrix passes on Linux x64/ARM64 and macOS x64/ARM64, and the
packaged macOS ARM64 desktop launches with healthy service and Stacks evidence.

**In review 2026-08-07.** The feature-final boundary evaluates every AC and R1-R8 as
PASS at source `16b5395`, with no code-review findings or known unrelated failures.
The cumulative feature record is fully tracked and requires no retention decision.
