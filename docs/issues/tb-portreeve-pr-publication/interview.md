# Interview - tb-portreeve-pr-publication

**Feature start:** 2026-08-17
**Status:** active

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - What failed in the first public publication?

**Question:** Is this merely a missing credential, or does the failure expose a
structural problem in the publication path?

**Answer:** The GitHub Release succeeded, then the Homebrew adapter failed because
`GH_TOKEN` authenticated `gh` but not the adapter's ordinary `git push`. Controlled
recovery also showed that committing directly to a repository's `main` branch does
not fit the normal protected-branch workflow.

**Decision:** Treat authentication as the immediate symptom and replace direct-main
repository mutations with PR-based publication. Preserve the existing immutable
GitHub Release adapter and exact-candidate recovery semantics.

## D2 - Is a special production branch the underlying solution?

**Question:** Should PortReeve adopt permanent `development`, `staging`, or
`production` branches before changing publication?

**Answer:** No. PortReeve ships immutable binaries rather than continuously deploying
three hosted environments. A protected `main`, hosted rehearsal, release environment,
and immutable tags already represent integration, staging, approval, and production.

**Decision:** Keep `main` as the only permanent integration branch. Use short-lived
`tb-*` topic and publication branches. Treat approved immutable release tags as the
production identity.

## D3 - What role do publication branches play?

**Question:** Are release-specific branches long-lived source or promotion branches?

**Answer:** No. They are short-lived, repository-local carriers for exact generated
files. The release tag continues to point to the pinned source commit; each publication
branch is based on the destination repository's current `main` and is deleted after
its PR merges.

**Decision:** Create one deterministic branch in `TrentBrown/homebrew-portreeve` for
the formula and cask, and one deterministic branch in `TrentBrown/portreeve` for
`distribution/desktop-update.json`. Never build release artifacts from these branches.

## D4 - Are publication PRs a second approval gate?

**Question:** After a maintainer approves the exact publication plan through the
`release-publication` environment, must the generated PRs receive another human
approval?

**Answer:** Normally no. The environment approval is already bound to the exact plan
digest and prepared bytes. The PRs exist for auditability, checks, merge commits, and
branch-protection compatibility.

**Decision:** Automatically merge an exact generated PR with a merge commit when
repository rules and checks permit it. If an independent review is required, preserve
the open PR and fail with its URL; a later retry verifies the human-merged result and
continues without rebuilding or changing bytes.

## D5 - How must partial publication recover?

**Question:** What happens if the GitHub Release exists and one repository PR merges,
but a later repository update cannot merge?

**Answer:** Cross-repository publication cannot be transactional. Existing public
identities must be verified rather than replaced, and incomplete state must remain
`publication-approved`.

**Decision:** On every retry, verify the immutable GitHub Release, deterministic
branches, PRs, merged files, and commit identities. Reuse exact state. Refuse any
conflicting branch, PR, diff, asset, or destination content. Advance to `published`
only when all three public surfaces match the approved plan.

## D6 - How should hosted authentication work?

**Question:** Should the workflow teach ordinary Git to consume `GH_TOKEN`, or use one
GitHub API authentication path for all repository publication?

**Answer:** Prefer the GitHub API path. It avoids hidden Git credential configuration
and can create refs, write exact files, create PRs, inspect checks, merge, and verify
content through the same fine-grained token.

**Decision:** Implement repository publication through `gh api`-backed adapters. Add
the minimum pull-request permission to the publication token and hosted job; keep npm
and signing outside this feature.

## D7 - What evidence should survive publication?

**Question:** Are final file commits sufficient, or should the release record expose
the PR transport as well?

**Answer:** PRs are now part of the safety and audit model. Operators should be able to
trace the plan to both PRs and their merge commits.

**Decision:** Record the Homebrew and Desktop-update PR URLs and verified merge commit
identities in publication completion evidence. Update the plan, runbook, project-local
release skill, and deterministic tests together.

## Interview close

The chosen direction is internally consistent: one human approval remains bound to the
exact plan; GitHub Releases continues to host immutable bytes; two short-lived PRs
transport mutable repository references; and retryable verification handles partial
cross-repository completion. The remaining risks are implementation details to test,
not unresolved product choices: GitHub mergeability can be temporarily unknown,
repository rules may require an external reviewer, and branch cleanup may need retry.

**Status:** concluded; ready for design synthesis.
