---
name: release-portreeve
description:
  Prepare, rehearse, inspect, explain, or publish a PortReeve release through the
  repository-owned release record and scripts. Use when a maintainer asks to make a
  preview or stable release, run the hosted release matrix, inspect release evidence or
  a publication plan, recover an interrupted release, or explain how to invoke
  PortReeve's release pipeline.
---

# Release PortReeve

Use PortReeve's versioned scripts as the only release implementation. Keep preparation
safe to delegate and keep public mutation behind the repository's explicit publication
gate.

## Establish authority

1. Resolve the repository root with `git rev-parse --show-toplevel` and work there.
2. Read `docs/releasing.md` completely before taking release action.
3. Inspect the current branch, full source commit, `git status --short`, component
   versions, existing release workspace, and any relevant GitHub workflow run.
4. Refuse release preparation from a dirty checkout. Preserve unrelated user work.
5. Treat `release-record.json` as stage authority; never infer completion from filenames
   or hand-edit missing evidence.

## Choose the operation

- For a local engine check, run `release:prepare`. Explain that one host stops before
  the complete native matrix.
- For a complete candidate or rehearsal, use the manual GitHub workflow with
  `trust=true` and `publish=false`. Approval of `release-trust` authorizes only the
  nonpublic Apple producer. Download `distribution-<version>` after it succeeds and run
  `release:inspect` against its `release-record.json`, followed by the disposable
  `release:homebrew-smoke` formula/cask installation check on macOS.
- For an interrupted candidate, resume only through the exact recovery path documented
  in `docs/releasing.md`; do not rebuild or substitute bytes downstream.
- Never use GitHub Actions **Re-run jobs** after protected production has begun.
  Preserve the recovery artifact and use the next unused preview version unless the
  documented exact-byte recovery path applies.
- For a request to publish, first identify the exact finalized record and show the exact
  `publication-plan.md`, its digest, all target repositories, and all public mutations.
  A general request to prepare, release-check, or rehearse is not publication authority.

## Prepare safely

Verify the pinned toolchain and repository before preparation:

```sh
bun install --frozen-lockfile
bun run check
```

Use an explicit channel and coordinated semantic version:

```sh
bun run release:prepare -- \
  --channel preview \
  --version 0.1.0-preview.1
```

The requested version is the installed identity of every release output. Preview builds
inject the full prerelease into the CLI, client package, Desktop metadata, formula, and
cask while leaving checked-in package files at the matching semantic core. Never edit
multiple package files as an operator precondition or accept a formula/cask that drops
the prerelease suffix.

For the complete hosted rehearsal:

```sh
gh workflow run release.yml \
  -f channel=preview \
  -f version=0.1.0-preview.1 \
  -f trust=true \
  -f publish=false
```

After downloading the finalized distribution on macOS, keep normalized file modes out of
the release workspace and smoke both Homebrew artifacts through disposable copies:

```sh
bun run release:homebrew-smoke -- \
  --record distribution-0.1.0-preview.1/release-record.json
```

Use the package script, not `bun scripts/smoke-homebrew-candidate.js`, so the pinned
toolchain check runs first. The smoke must not replace an existing formula, cask, or
temporary tap, and must clean up without changing supervision or PortReeve data.

Do not invent signing evidence for stable. Missing Developer ID, notarization, stapling,
Gatekeeper, or native evidence must remain a failure.

Require the protected producer plus one current native ARM64 and one current native
Intel Apple trust document for every new public preview as well as stable. A personal
manual-install check on another architecture is optional; hosted native evidence is not.
Historical previews through `0.1.0-preview.4` remain immutable unsigned history.

## Preserve the publication boundary

Do not set `publish=true`, call `release:publish`, create or move a tag, create a GitHub
Release, create or merge a Homebrew/desktop-metadata PR, or publish npm unless the user
explicitly requests those public mutations after the exact plan is available.

When publication is explicitly requested:

1. Revalidate the completed record and every artifact digest.
2. Require `publication-plan.sha256` to match the exact plan, then present the plan path
   and SHA-256 plus GitHub, tap, and update-metadata targets.
3. Obtain the user's explicit approval for that exact candidate if it has not already
   been given.
4. Use the normal `release-publication` environment or the documented direct command.
5. Never bypass `--confirm`, remote preflight, environment review, or immutable-version
   refusal.
6. Expect GitHub Release publication first, followed by deterministic merge-commit PRs
   for the tap and Desktop update metadata. Never write directly to destination `main`.
7. If checks or independent review block a generated PR, report its exact URL, leave it
   unchanged, and retry the same approved record after normal repository policy is met.
8. On retry, verify and reuse exact open or merged PR state; never force-push, retarget,
   add unrelated files, bypass protection, or invent PR provenance for legacy evidence.
9. Keep npm deferred; npm Trusted Publishing is independent of this pipeline.

## Report the outcome

Separate:

- source commit and release/component versions;
- completed and pending record stages;
- native evidence actually observed from evidence merely required;
- generated artifact names and digests;
- preview/stable, maturity, and Desktop trust;
- public mutations performed, or an explicit statement that none occurred;
- protected trust approval and publication approval as separate facts;
- generated Homebrew and Desktop PR URLs plus verified merge commits when published;
- exact recovery or next command.

Never describe a cross-compiled file as natively verified, an unsigned preview as
trusted, a prepared candidate as published, or a partial remote publication as safely
replaceable.
