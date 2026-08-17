# Decisions - tb-portreeve-pr-publication

**Feature start:** 2026-08-17

Permanent record of decisions promoted from `scratchpad.md`.

---

## Use PRs as publication transport rather than direct-main mutation

**Confidence:** HIGH

**Blast Radius:** GitHub Release publication orchestration, Homebrew tap repository,
PortReeve Desktop update metadata, hosted credentials, and recovery documentation.

Keep the immutable GitHub Release adapter, but replace both mutable repository updates
with deterministic short-lived branches and merge-commit PRs. The protected environment
approval remains the single normal human authorization.

**Triggered by:** The first public release created its GitHub Release and then failed
because the Homebrew adapter's ordinary Git push was unauthenticated; controlled
recovery also exposed the mismatch with normal protected-branch work.

**Alternatives considered:**
- Configure Git credentials and keep direct pushes - fixes the symptom while retaining
  inconsistent and less auditable main-branch mutation.
- Add permanent release or production branches - duplicates tags and environments for a
  downloadable product.

**Promoted:** 2026-08-17. PR: #65 https://github.com/TrentBrown/portreeve/pull/65.

---

## Use one GitHub API authentication path without branch-rule bypass

**Confidence:** HIGH

**Blast Radius:** Fine-grained token permissions, GitHub Actions publish job, adapter
command execution, and branch-protection behavior in two repositories.

Use the GitHub API for refs, exact file commits, PR creation, merge observation, merge
commits, and verification. Automatically merge only when normal repository policy
allows it; otherwise leave the PR intact and return its URL for external review.

**Triggered by:** The existing workflow supplied `GH_TOKEN` to `gh` but silently relied
on an unrelated ordinary-Git credential path for one adapter.

**Alternatives considered:**
- Run `gh auth setup-git` - retains two authentication paths and direct-main behavior.
- Grant administrative bypass authority - weakens the intended protection boundary.

**Promoted:** 2026-08-17. PR: #65 https://github.com/TrentBrown/portreeve/pull/65.

---

## Extend evidence without fabricating history

**Confidence:** HIGH

**Blast Radius:** Release-record validation, published-stage evidence,
`publication-complete.json`, inspection tests, and recovery of older records.

Require both PR URLs and merge commits for releases approved under the new PR transport,
while continuing to inspect the already-completed first-preview record without adding
PR identities it never had. A legacy partial approval must fail with an explicit
recovery boundary rather than silently changing its approved plan.

**Triggered by:** The audit model now depends on PR transport, but the first public
preview was recovered manually and its completion evidence predates those fields.

**Alternatives considered:**
- Rewrite first-preview evidence - would falsify history.
- Make PR evidence optional for every future release - weakens the new terminal
  invariant.

**Promoted:** 2026-08-17. PR: #65 https://github.com/TrentBrown/portreeve/pull/65.
