# PortReeve release operator runbook

This runbook is the maintained operator surface for PortReeve's deterministic release
engine. Repository scripts own release policy and state transitions. GitHub Actions
supplies native runners, artifact transport, environment approval, and credentials; it
does not implement a second release process.

No command in the preparation sections creates a public tag, GitHub Release, Homebrew
pull request, Desktop update pull request, or npm publication.

## Release state graph

```text
source pinned
  -> policy resolved
  -> native CLI built
  -> artifact digests established
  -> native CLI verified (macOS/Linux ARM64/x64)
  -> Desktop packaged (macOS ARM64/x64)
  -> Desktop trust verified
  -> distribution finalized
  -> publication approved
  -> published
```

`dist/releases/<release-version>/release-record.json` is the stage authority. Every
artifact has a workspace-relative path, byte count, SHA-256, provenance stage, and
optional platform identity. Later stages revalidate the record and exact bytes; they do
not rebuild.

## Policy dimensions

Do not collapse these independent facts:

| Dimension | Initial preview | Stable requirement |
| --- | --- | --- |
| Product maturity | `alpha` | `stable` |
| Release channel | `preview` | `stable` |
| Desktop trust | `unsigned` | `developer-id-notarized` |

A preview version must be a semantic prerelease such as `0.1.0-preview.1`. Stable uses a
semantic version without a prerelease. Stable Desktop finalization fails closed without
real Developer ID signing, hardened runtime, secure timestamps, notarization, stapling,
Gatekeeper acceptance, and native ARM64/x64 evidence. The current workflow deliberately
has no way to substitute synthetic evidence for those requirements.

## Prerequisites

All release work requires a clean checkout of the source commit to be released and the
repository-pinned Bun 1.3.14 toolchain. Run:

```sh
bun install --frozen-lockfile
bun run check
```

Local release inspection also uses Node.js 22, Git, Ruby, `lsof`, and `ps`. Native
lifecycle proof requires a non-root login session with `launchd` on macOS or a working
`systemd --user` manager on Linux. DMG creation requires macOS and `hdiutil`.

Hosted invocation requires authenticated `gh` access to
`TrentBrown/portreeve`. Preparation does not require publication credentials.

## Safe local preparation

Choose a new coordinated release version and run:

```sh
bun run release:prepare -- \
  --channel preview \
  --version 0.1.0-preview.1
```

The command creates:

```text
dist/releases/0.1.0-preview.1/
  artifacts/
  release-record.json
  publication-plan.md
```

On one machine it stops after establishing the build artifact digests. That is expected:
one host cannot honestly supply all four native CLI/lifecycle fragments and both native
Desktop fragments. Do not copy, invent, or hand-edit missing evidence. Use the hosted
workflow for a complete candidate.

An interrupted preparation may use `--resume` only while the exact source and policy
remain at the resumable boundary. Existing version workspaces are otherwise immutable;
choose a new preview number rather than replacing one.

## Safe hosted preparation

Dispatch the complete matrix without publication:

```sh
gh workflow run release.yml \
  -f channel=preview \
  -f version=0.1.0-preview.1 \
  -f publish=false
```

The workflow:

1. builds the release workspace once;
2. transports those exact bytes to macOS ARM64, macOS Intel, Linux x64, and Linux ARM64;
3. aggregates four create-once native evidence documents;
4. packages, launches, mounts, and verifies ARM64 and x64 Desktop DMGs on matching Macs;
5. aggregates the Desktop evidence and finalizes formula, cask, checksums,
   channel-aware update metadata, and the publication plan;
6. uploads `distribution-<version>` and stops.

Find the run and download the candidate:

```sh
gh run list --workflow release.yml
gh run download RUN_ID --name distribution-0.1.0-preview.1
```

Revalidate the downloaded record, every recorded byte, both matrices, and the exact
publication plan without publishing:

```sh
bun run release:inspect -- \
  --record distribution-0.1.0-preview.1/release-record.json \
  --json
```

GitHub artifact downloads normalize executable permissions. Do not change the
downloaded candidate to compensate. Exercise the generated formula and cask through a
disposable local tap instead:

```sh
bun run release:homebrew-smoke -- \
  --record distribution-0.1.0-preview.1/release-record.json
```

This command revalidates the finalized record, copies candidate artifacts into a
temporary staging directory, restores executable mode only on those disposable copies,
installs and verifies both the formula and cask, then uninstalls them and removes the
temporary tap. The cask uses a temporary application directory. It does not replace an
existing Homebrew PortReeve installation, modify the candidate, install supervision, or
delete PortReeve data.

Invoke release scripts through their `bun run` entries so `toolchain:check` rejects a
wrong Bun before release logic runs. If the shell's Bun is not the pinned native build,
use the exact pinned package without changing project dependencies:

```sh
npx --yes bun@1.3.14 run release:homebrew-smoke -- \
  --record distribution-0.1.0-preview.1/release-record.json
```

Inspect at least:

- workflow conclusions for all six native jobs;
- release source repository and full commit;
- independent component versions, maturity, channel, and Desktop trust;
- the four CLI evidence entries and both Desktop package entries;
- every artifact filename, byte count, SHA-256, and provenance stage;
- `publication-plan.md`, `SHA256SUMS`, and `SHA256SUMS-DISTRIBUTION`;
- formula/cask lifecycle caveats and `desktop-update.json` channel identity.
- temporary local formula and cask installation/uninstallation results.

## Publication environment and credentials

For every publication, use the GitHub environment named
`release-publication` with required human reviewers. Store
`PORTREEVE_RELEASE_TOKEN` as an environment secret, not a preparation-job secret. It
must be a fine-grained token scoped only to `TrentBrown/portreeve` and
`TrentBrown/homebrew-portreeve`, with **Contents: Read and write** and **Pull requests:
Read and write**. Those permissions allow it to:

- create a release and tag in `TrentBrown/portreeve`;
- create one exact generated branch and merge-commit PR for
  `distribution/desktop-update.json`;
- create one exact generated branch and merge-commit PR for
  `Formula/portreeve.rb` and `Casks/portreeve-app.rb`.

Do not grant Administration permission or a branch-protection bypass. GitHub Actions
declares `contents: write` and `pull-requests: write` only on the environment-gated
publish job; every preparation job inherits repository-level `contents: read` and has
no publication secret. The publisher uses the GitHub API for refs, generated commits,
PRs, merges, and verification. It does not require ordinary Git credentials.

Test repository access without publishing before beginning a release. npm is
not in this credential or dependency graph. Configure npm Trusted Publishing later as
an independent initiative.

## Hosted publication gate

When the operator intends to publish, dispatch with `publish=true`:

```sh
gh workflow run release.yml \
  -f channel=preview \
  -f version=0.1.0-preview.1 \
  -f publish=true
```

The build and evidence jobs still run first. The final job pauses at the
`release-publication` environment. Before approving it, download and inspect that run's
`distribution-<version>` artifact and exact publication plan. Approval applies to that
run's prepared bytes, not to a version name in the abstract.

After environment approval, `release:publish` performs every read-only remote preflight
before recording publication approval. It then creates or verifies the exact GitHub
release first. Next it creates or recovers a deterministic `tb-portreeve-release-*`
branch and PR in the Homebrew tap, followed by the equivalent PR for Desktop metadata.
Each PR names the release, source commit, plan digest, and exact generated-file
checksums. The publisher uses a merge commit only after GitHub reports the PR clean and
mergeable, verifies the destination bytes, deletes the unchanged generated branch, and
records both PR URLs and merge commits. It never invokes a build command or writes
directly to `main`.

The environment approval of the exact plan is the normal human authorization. The two
generated PRs are transport and audit records rather than duplicate approval prompts.
If repository policy still requires checks or an independent reviewer, publication
stops with the exact PR URL and leaves the PR intact. Satisfy that repository policy,
merge the exact PR if automation cannot, and rerun the same approved record; the
publisher verifies and reuses the merged result before continuing.

## Direct publication command

The direct command exists for controlled recovery or a downloaded, fully verified
candidate. It has the same gate and adapter behavior as the hosted job:

```sh
bun run release:publish -- \
  --record /absolute/path/to/release-record.json \
  --approved-by "Trent Brown" \
  --confirm
```

Without `--confirm`, it refuses before remote preflight or mutation and identifies the
plan path and digest that require review. Do not use the direct command on a record that
did not complete the native and Desktop matrices.

## Published artifact inventory

A complete unsigned preview candidate contains:

- standalone CLI/server executables for macOS ARM64/x64 and Linux ARM64/x64;
- the packed JavaScript client archive, retained as evidence while npm is deferred;
- `manifest.json`, `SHA256SUMS`, and the checksum-pinned `portreeve.rb` formula;
- separate ARM64 and x64 `PortReeve-<desktop-version>-macos-<arch>.dmg` files;
- `portreeve-app.rb`, `desktop-update.json`, and `SHA256SUMS-DISTRIBUTION`;
- the release record and exact publication plan in the retained workflow workspace.

GitHub Releases is the byte host. `TrentBrown/homebrew-portreeve` publishes formula
`portreeve` and cask `portreeve-app`. Neither installer silently starts supervision or
deletes preserved data.

## Rehearsal without public mutation

Run the focused fake-publication and policy tests:

```sh
bun test test/release/publication.test.js \
  test/release/desktop-distribution.test.js \
  test/release/release-record.test.js
```

Then dispatch hosted preparation with `publish=false`. This proves the hosted matrix and
transport without entering the publication environment. Never use a real public version
for destructive experimentation; increment the preview identifier when candidate bytes
change.

## Recovery

- **Preparation failed before native aggregation:** rerun the failed job or start a new
  preview version. Do not merge a partial matrix.
- **A native or Desktop fragment is missing:** restore the exact workflow artifact and
  rerun its native job. Do not mark the check true by hand.
- **Finalization reports changed bytes:** treat the workspace as compromised or stale;
  do not publish it.
- **Publication preflight fails:** no approval is recorded and no adapter is invoked.
  Fix access or resolve the conflicting public identity, then rerun the same exact
  candidate.
- **One remote publication succeeds and a later one fails:** the record remains
  `publication-approved`. Retry the exact record and plan. The GitHub adapter verifies
  existing asset names, sizes, and SHA-256 values; repository publication recovers the
  deterministic absent, open, or merged PR and verifies exact destination bytes.
- **A generated PR needs checks or independent review:** use the URL in the error,
  satisfy the repository's normal policy without bypass, and retry the exact approved
  record. Do not close, edit, retarget, or add files to the generated PR.
- **Generated-branch cleanup failed after merge:** retry the exact record. The publisher
  verifies the retained merge and destination bytes, then deletes the branch only if
  its head is still the generated commit.
- **A legacy partial approval predates PR transport:** do not assign it invented PR
  identities. Prepare a new candidate version. Already completed first-preview records
  remain valid historical evidence and are not rewritten.
- **A public version is wrong:** never replace its assets. Correct the source and use a
  new preview version.

## Agent-assisted entry point

Ask an agent to use the project-local `release-portreeve` skill, for example:

> Use `$release-portreeve` to prepare PortReeve `0.1.0-preview.1` and explain the
> resulting evidence.

The skill delegates to these scripts and this runbook. It may prepare, inspect, and
explain. It does not duplicate policy, invent evidence, select `publish=true`, invoke
`release:publish`, or approve a public mutation without the user's explicit publication
request and the normal gate.
