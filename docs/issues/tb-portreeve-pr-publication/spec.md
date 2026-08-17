# Spec - tb-portreeve-pr-publication

**Feature:** `tb-portreeve-pr-publication`
**Created:** 2026-08-17

## Summary

PortReeve publication must retain its exact-plan environment approval and immutable
GitHub Release behavior while moving the Homebrew tap and Desktop update metadata
through deterministic, merge-commit PRs. The publisher must automatically merge exact
PRs when repository policy permits, stop visibly when external review is required, and
recover idempotently from any partially completed cross-repository publication.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** Given a finalized release record, matching committed publication plan,
  `--confirm`, and a non-empty approver identity, publication creates or verifies the
  immutable GitHub Release first, then updates both the Homebrew tap and Desktop update
  metadata through pull requests; it performs no direct commit or push to either
  destination `main` branch.
- **AC2.** Each repository update uses a deterministic `tb-*` branch and a PR whose
  title/body identify the release version, pinned source commit, exact plan digest, and
  generated-file checksums. The Homebrew PR changes only `Formula/portreeve.rb` and
  `Casks/portreeve-app.rb`; the source-repository PR changes only
  `distribution/desktop-update.json`. Any unexpected branch ancestry, path, content,
  PR target, or additional diff is refused without force-push or replacement.
- **AC3.** When GitHub reports an exact generated PR mergeable with applicable checks
  and reviews satisfied, the publisher merges it using a merge commit and verifies the
  resulting destination bytes and commit identity. When policy requires independent
  review, checks fail, or mergeability remains unavailable beyond a bounded wait, the
  publisher leaves the exact PR intact and returns a recoverable failure containing its
  URL and required operator action; it never approves itself or bypasses branch rules.
- **AC4.** Retrying the same exact approved candidate safely handles absent, open, and
  already-merged publication PRs as well as a GitHub Release or one repository update
  that completed before a later failure. Exact state is reused without duplicate
  releases or PRs; conflicting tags, assets, branches, PRs, merge results, or destination
  files fail closed; the record remains `publication-approved` until every public
  surface is verified.
- **AC5.** A release advances to `published` and emits `publication-complete.json` only
  after the GitHub Release assets, Homebrew files on `main`, and Desktop update metadata
  on `main` all match the approved candidate. New publication evidence includes the
  GitHub Release URL/tag, both PR URLs, both verified merge commits, publication time,
  and exact plan digest. Existing completed first-preview evidence remains inspectable
  without being rewritten or falsely assigned PR identities.
- **AC6.** Hosted publication continues to require the `release-publication`
  environment and the fine-grained `PORTREEVE_RELEASE_TOKEN`, uses one GitHub API
  authentication path for repository refs/files/PRs/merges, and declares the minimum
  pull-request authority needed by the publish job. Preparation and `publish=false`
  rehearsal retain read-only repository permissions and perform no public mutation.
- **AC7.** Deterministic tests cover fresh publication, exact no-op retry, open-PR and
  merged-PR recovery, partial publication, transient mergeability, required external
  review, failed checks, branch cleanup recovery, and every mismatch/refusal boundary.
  The operator runbook, release plan text, project-local `release-portreeve` skill, and
  credential instructions consistently describe PR-based publication, merge commits,
  retry behavior, and the external-review fallback while keeping npm, Apple signing,
  and permanent environment branches out of scope.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Publication uses the approved sequence and never mutates destination `main` directly. | Integration tests show exact-plan validation, GitHub Release first, then two PR adapters, with no direct-main API write or Git push. | Either repository update bypasses a PR, precedes immutable release verification, or can run without exact approval. | Publication adapter call trace and focused publication tests. |
| R2 | Generated branches and PRs contain only exact declared release changes. | Tests prove deterministic `tb-*` identity, required PR metadata, allowlisted paths, exact checksums, expected base ancestry, and refusal of every extra or changed input. | A retry can force-push, accept unexpected ancestry/content/paths, target another branch, or omit plan identity. | Unit tests for repository PR adapter request/response and diff validation. |
| R3 | Safe merge and policy fallback are observable. | Tests prove merge-commit use after satisfied state, bounded handling of unknown mergeability, exact PR preservation, and actionable URL-bearing refusal for checks/review restrictions. | Publisher bypasses protection, self-approves, deletes an unmerged PR branch, spins indefinitely, or returns no recovery location. | Merge-state matrix tests and representative error assertions. |
| R4 | Partial and repeated publication is idempotent and fail-closed. | Retry tests reuse exact releases/open PRs/merged PRs and complete all partial-order cases without duplicates; all conflicting remote identities refuse while state stays approved. | Any exact retry duplicates state, replaces public bytes, loses a merged identity, or marks a partial release published. | Publication recovery integration matrix and persisted-record assertions. |
| R5 | Terminal publication evidence is complete and historically honest. | New completed records and completion documents contain plan digest, release identity, both PR URLs, both merge commits, and timestamp only after all destination bytes verify; first-preview evidence remains readable without fabricated PR data. | Terminal state lacks required new evidence, precedes destination verification, rewrites history, or attributes nonexistent PRs to the first preview. | Release-record schema/state tests and serialized completion fixtures. |
| R6 | Hosted authority is minimal and rehearsal remains non-mutating. | Workflow inspection/tests show environment-gated API publication with required contents/PR permissions only in the publish job; preparation jobs remain read-only and `publish=false` cannot enter publication. | Write or PR credentials leak into preparation, ordinary Git authentication remains required, or rehearsal can mutate public state. | Workflow/documentation contract tests and checked workflow diff. |
| R7 | Recovery and operator documentation match verified behavior. | Focused and broad suites pass; runbook, publication plan, skill, and credential guidance describe the implemented PR and fallback flows with explicit scope exclusions. | Tests omit a named recovery state, documentation describes direct-main publication, or unrelated npm/signing/branching scope is added. | Named focused tests, `bun run check`, and documentation contract tests. |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
