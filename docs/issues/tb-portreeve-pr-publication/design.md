# Design - tb-portreeve-pr-publication

**Status:** approved (gate passed 2026-08-17)

## Problem

PortReeve's first public preview proved the immutable artifact and release-record model,
but the hosted publisher stopped after creating the GitHub Release. The Homebrew adapter
cloned its repository and ran an unauthenticated ordinary `git push`, while Desktop
update metadata used GitHub's contents API to commit directly to `main`. The two
mutation paths were inconsistent with each other and with protected-branch development.

Adding Git credential setup would fix the immediate hosted error while retaining
direct-main publication and different authentication models. That would leave future
releases dependent on branch-policy exceptions and make repository mutations less
visible than ordinary project work.

## Intent

Publish the exact approved PortReeve candidate through auditable, deterministic PRs
without adding another normal human approval, changing the build-once evidence model,
or introducing permanent environment branches. A partial publication must remain safe
to retry, and the release must not be recorded as published until GitHub assets,
Homebrew references, and Desktop update metadata all match the approved plan.

## Chosen shape

### Branch and release model

- `main` remains the sole permanent integration branch.
- The released source is a pinned commit normally reachable from `main`.
- The immutable release tag points to that source commit.
- Hosted `publish=false` rehearsal remains the staging equivalent.
- The `release-publication` environment remains the human publication gate.
- Repository updates use short-lived deterministic `tb-*` branches and merge-commit
  PRs. These branches never become release sources and are deleted after verification.

### Publication sequence

After revalidating the release record, every artifact, the committed plan bytes, its
digest, remote preflights, confirmation, and approver identity:

1. Create or verify the immutable GitHub Release and exact asset inventory.
2. Create or recover the Homebrew publication branch based on the tap's current
   `main`; write only `Formula/portreeve.rb` and `Casks/portreeve-app.rb` from the
   candidate; verify the exact diff; create or recover its PR; merge with a merge
   commit when permitted; and verify both files on `main`.
3. Create or recover the source-repository publication branch based on current `main`;
   write only `distribution/desktop-update.json`; verify the exact diff; create or
   recover its PR; merge with a merge commit when permitted; and verify the file on
   `main`.
4. Delete merged publication branches, record both PR URLs and verified merge commits,
   advance the release record to `published`, and create `publication-complete.json`.

GitHub API operations, invoked through the existing command adapter boundary, own ref,
file, PR, merge, and verification behavior. The hosted workflow supplies only the
fine-grained token and environment authority.

### Deterministic identity and exactness

Publication branch names derive from the coordinated release version and remain stable
across retries. PR titles and bodies identify the release, source commit, plan digest,
and exact generated-file checksums.

Before mutation, the adapter captures the destination branch identity and validates
the current file state. Every created branch, commit, and PR is constrained to the
declared destination and file allowlist. On recovery:

- an absent branch or PR may be created;
- an exact open PR may be reused and merged;
- an exact merged PR may be verified on `main` and reused;
- temporarily unknown mergeability or unmet required review stops with the PR URL;
- any unexpected commit ancestry, changed file, additional diff path, mismatched PR,
  conflicting destination bytes, tag, or release asset fails closed;
- no adapter force-pushes, replaces public assets, or edits approved candidate bytes.

### Approval and merge policy

The single normal human authorization remains approval of the exact publication plan
through the protected GitHub environment. Generated repository PRs are transport and
audit records, not duplicate approval gates. The publisher attempts a merge commit only
after GitHub reports the PR mergeable and required checks are satisfied.

If repository rules require an independent reviewer, the publisher leaves the exact PR
open and reports a recoverable failure containing its URL. After review and merge, the
same release record may be retried; it verifies the merged bytes and continues. It does
not manufacture approval, weaken branch rules, or use an administrative bypass.

### Publication state and evidence

Cross-repository mutation remains deliberately non-transactional. The release record
stays `publication-approved` until every surface is verified. Publication evidence is
extended to retain:

- GitHub Release URL and tag;
- Homebrew PR URL and merge commit;
- Desktop-update PR URL and merge commit;
- publication timestamp and exact plan digest.

Tests cover fresh publication, no-op recovery, open-PR recovery, already-merged
recovery, partial publication, conflicting branch/PR/destination state, failed checks,
required external review, branch cleanup, and unchanged immutable-release refusal.

### Operator and repository surfaces

The hosted publication job gains only the pull-request authority required by this
model. The fine-grained `PORTREEVE_RELEASE_TOKEN` remains scoped to the source and tap
repositories. Repository-owned scripts continue to implement policy; workflow YAML
continues to supply runners, transport, credentials, and the environment gate.

The operator runbook and `release-portreeve` skill explain the PR sequence, expected
permissions, retry behavior, and external-review fallback. npm Trusted Publishing,
Developer ID signing, notarization, and broader branching changes remain independent.

## Alternatives considered

### Configure Git authentication and retain direct pushes

Rejected as the primary design. `gh auth setup-git` would repair the observed failure
but preserve direct-main writes, inconsistent Git/API adapters, and a hosted exception
to normal protected-branch work.

### Add permanent development, staging, or production branches

Rejected. PortReeve publishes immutable downloadable software rather than deploying
three hosted environments. Rehearsal, environment approval, channels, and immutable
tags already express those lifecycle states more precisely.

### Require manual approval of every generated PR

Rejected as the default because it duplicates the plan-digest environment approval.
Independent review remains an honored repository-policy fallback rather than a second
PortReeve release requirement.

### Create PRs but require the operator to resume publication manually every time

Rejected as unnecessary friction when checks and branch rules permit an automatic merge.
The retry path remains available whenever automation cannot merge safely.

### Use one cross-repository release branch

Rejected because Git branches are repository-local and the two updates have different
destination histories. Coordinated version, plan digest, PR descriptions, and release
record provide the cross-repository identity.

## Constraints

- Existing public GitHub assets are immutable and must be byte-verified on retry.
- Publication never rebuilds, normalizes, or substitutes candidate artifacts.
- A source file update merged after tagging does not change the tag's source commit.
- No force-push, branch-rule bypass, self-approval workaround, or direct-main fallback.
- Merge commits are used for generated publication PRs.
- `main` is the only permanent integration branch; `development` branches remain
  one-way sinks under the personal policy and are not introduced here.
- The initial implementation targets GitHub repositories and the existing fine-grained
  token; it does not introduce a provider-neutral PR abstraction.
- npm, Apple signing, notarization, and stable-channel enablement are out of scope.

## Open risks

- GitHub can briefly report mergeability as unknown; polling must be bounded and
  recoverable rather than interpreted as a conflict.
- Required-check state and independent-review requirements vary by repository. Errors
  must name the exact PR and required operator action without weakening policy.
- Deleting a merged branch can fail after all public content is correct. Recovery must
  distinguish cleanup from content publication without falsely replacing state.
- The first preview's completion record predates PR URL fields. Schema evolution must
  accept the supported recovery inputs deliberately and avoid rewriting historical
  public artifacts.

## Changes

Append approved amendments here. Do not remove or weaken the frozen design.
