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
  `publish=false`. Download `distribution-<version>` after it succeeds and run
  `release:inspect` against its `release-record.json`.
- For an interrupted candidate, resume only through the exact recovery path documented
  in `docs/releasing.md`; do not rebuild or substitute bytes downstream.
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

For the complete hosted rehearsal:

```sh
gh workflow run release.yml \
  -f channel=preview \
  -f version=0.1.0-preview.1 \
  -f publish=false
```

Do not invent signing evidence for stable. Missing Developer ID, notarization, stapling,
Gatekeeper, or native evidence must remain a failure.

## Preserve the publication boundary

Do not set `publish=true`, call `release:publish`, create or move a tag, create a GitHub
Release, push the Homebrew tap, update public Desktop metadata, or publish npm unless
the user explicitly requests those public mutations after the exact plan is available.

When publication is explicitly requested:

1. Revalidate the completed record and every artifact digest.
2. Present the plan path and SHA-256 plus GitHub, tap, and update-metadata targets.
3. Obtain the user's explicit approval for that exact candidate if it has not already
   been given.
4. Use the normal `release-publication` environment or the documented direct command.
5. Never bypass `--confirm`, remote preflight, environment review, or immutable-version
   refusal.
6. Keep npm deferred; npm Trusted Publishing is independent of this pipeline.

## Report the outcome

Separate:

- source commit and release/component versions;
- completed and pending record stages;
- native evidence actually observed from evidence merely required;
- generated artifact names and digests;
- preview/stable, maturity, and Desktop trust;
- public mutations performed, or an explicit statement that none occurred;
- exact recovery or next command.

Never describe a cross-compiled file as natively verified, an unsigned preview as
trusted, a prepared candidate as published, or a partial remote publication as safely
replaceable.
