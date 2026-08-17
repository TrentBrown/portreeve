# Plan - tb-portreeve-pr-publication

**Feature:** `tb-portreeve-pr-publication`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-17

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Introduce one GitHub repository-PR publication primitive behind the existing
publication-adapter boundary, prove its remote-state machine with deterministic fake
command responses, then route both mutable repository publications through it. Keep
GitHub Release publication first and immutable. Extend terminal evidence only after the
PR state machine is integrated, then align hosted permissions, operator documentation,
and the project-local release skill. Deliver in small sequential PRs so the reusable
remote-state logic is reviewable before it controls a real release.

## Steps

- **P1.** Define deterministic publication branch/PR identity, exact file allowlists,
  GitHub API response parsing, branch ancestry and diff validation, bounded mergeability
  observation, merge-commit enforcement, destination-byte verification, and cleanup as
  a shared repository PR adapter. Test fresh, open, merged, blocked, transient, and
  conflicting states without network mutation. **Advances:** R2, R3.
- **P2.** Replace the Homebrew clone/commit/push adapter and Desktop direct contents-API
  adapter with repository-specific configurations of the shared PR adapter. Preserve
  GitHub Release-first ordering, exact preflights, plan confirmation, and candidate-byte
  immutability. **Advances:** R1, R2.
- **P3.** Make the publication orchestrator recover across every partial ordering:
  existing immutable release, exact open PR, exact merged PR, one completed repository,
  failed checks, required external review, and cleanup retry. Keep the record approved
  until both destination branches verify and refuse all mismatches. **Advances:** R3,
  R4.
- **P4.** Extend new terminal publication evidence and completion output with both PR
  URLs and merge commits while retaining honest inspection of the completed first
  preview. Add release-record transition, serialization, and compatibility tests.
  **Advances:** R5.
- **P5.** Update the hosted workflow to expose only the required publish-job PR/content
  authority through `PORTREEVE_RELEASE_TOKEN`, keep preparation read-only, and update
  workflow contract tests. **Advances:** R6.
- **P6.** Update publication plan wording, `docs/releasing.md`, credential/recovery
  guidance, and `.agents/skills/release-portreeve/SKILL.md` to describe exact generated
  PRs, automatic merge, independent-review fallback, retry, and scope exclusions.
  **Advances:** R7.
- **P7.** Run focused release tests, the complete repository check, spec evaluation,
  independent judge, decision triage, code review, pattern review when applicable, and
  deterministic PR-boundary evidence for every slice and the assembled feature.
  **Advances:** R1, R2, R3, R4, R5, R6, R7.

## Verification

- Shared adapter unit matrix: deterministic refs, exact files/diffs, mergeability,
  review/check restrictions, merge commits, destination verification, and cleanup.
- Publication integration matrix: fresh, no-op, open, merged, partial, and conflicting
  remote states with persisted release-record assertions.
- Workflow/documentation contracts: permissions, environment gate, plan text, runbook,
  skill, and no mutation from preparation.
- Compatibility fixtures: completed first-preview evidence remains inspectable and new
  completion evidence requires both PR identities.
- **Final step:** Run full rubric evaluation and produce the completion report.
