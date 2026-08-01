# Issues - tb-portreeve-desktop

**Feature:** `tb-portreeve-desktop`
**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Created:** 2026-07-30

Operational task breakdown derived from the plan.

## I-1 - Finalize layered lifecycle and mutation contracts

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P1, P2
- **Rubric criteria:** R1, R2
- **Depends on:** none
- **PR:** [#2](https://github.com/TrentBrown/portreeve/pull/2)

Replace the unpublished lifecycle JSON contract with runtime-validated
status/mutation schemas, implement independent evidence collection, enforce the
approved version and manual-server policies, and extend CLI plus native
supervisor tests.

**Completed 2026-07-30.** Added the canonical schemas, layered collector,
common mutation result, explicit `stop-manual`, no-downgrade enforcement,
documentation, deterministic status/refusal/partial-result tests, and compiled
CLI coverage. Focused verification passed 29 tests with 158 assertions.
Release build plus native lifecycle verification passed all six release
artifacts and the complete temporary macOS x64 LaunchAgent flow. Typecheck and
lint passed. The repository-wide test run reached 110 passes; its two remaining
failures are pre-existing host conditions outside I-1: Bun's AVX warning
pollutes one child-process stderr JSON assertion, and the real reclamation
timeout races `lsof` after killing a PID.

## I-2 - Implement ownership marking and complete reset

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P3
- **Rubric criteria:** R3
- **Depends on:** I-1
- **PR:** [#2](https://github.com/TrentBrown/portreeve/pull/2)

Add validated marker initialization/migration, purge preview and execution,
evidence binding, symlink/path/ownership/live-process safeguards, structured
partial outcomes, documentation, and adversarial tests.

**Completed 2026-07-30.** Added strict marker creation/migration, canonical-root
validation, structured missing/malformed marker refusal, recursive `lstat`
evidence, manual/ambiguous/incompatible server refusal, symlink/ownership/mode
safeguards, deterministic preview tokens, changed-evidence refusal,
supervisor-aware deletion, and accurate success/refusal/partial results.
Current-source verification passed typecheck, lint, formatting, 43 focused
tests with 192 assertions, the compiled manual-stop/purge flow, all workflow
document linters, and a native macOS x64 release lifecycle covering
install/start/upgrade/restart/stop/uninstall/purge/reinstall across all six
verified release artifacts.

## I-3 - Publish the first CLI/server authority

- **Status:** blocked
- **Estimate:** 1d
- **Plan steps:** P4
- **Rubric criteria:** R1, R2, R3, R8
- **Depends on:** I-1, I-2
- **PR:** [#3](https://github.com/TrentBrown/portreeve/pull/3)

Extend and pass the release matrix, resolve the recorded repository visibility,
npm, and native Linux ARM64 prerequisites, then publish and inspect Portreeve
CLI/server `0.1.0` before desktop packaging consumes it.

**Started 2026-07-30.** PR #2 merged and the repository passed a complete
history secret scan before becoming public. Current GitHub-hosted
`ubuntu-24.04-arm` replaces the obsolete self-hosted ARM64 prerequisite.
Release policy now fails closed on missing npm authority or an already
published version. The remaining external prerequisite is an authenticated
first npm publication; after the package exists, publishing can move to
GitHub Actions OIDC trusted publishing.

**PR-boundary evidence 2026-07-30.** Release workflow run
[#30593716275](https://github.com/TrentBrown/portreeve/actions/runs/30593716275)
passed the build and native lifecycle matrix on macOS ARM64/x64 and Linux
ARM64/x64, plus real Homebrew installation on both macOS architectures.
GitHub artifact mode loss is repaired before verification, systemd supervision
now pre-creates private logs and enforces `UMask=0077`, and current
GitHub-maintained action majors run without Node 20 deprecation warnings. No
tag, GitHub Release, or npm package was created. I-3 remains in progress until
the authenticated first publication is completed and inspected.

**Deferred 2026-08-01.** Keep the npm account's hardware-key protection and
defer the one-time authenticated first publication. P4 remains open; when work
resumes, publish and inspect `0.1.0`, configure npm Trusted Publishing for
`release.yml`, and remove any bootstrap token. This blocks P9 and public
desktop distribution but not the non-shipping P5-P8 engineering slices.

## I-4 - Deliver the secured read-only desktop slice

- **Status:** closed
- **Estimate:** 2d
- **Plan steps:** P5, P6
- **Rubric criteria:** R4, R6
- **Depends on:** I-1, I-2
- **PR:** [#4](https://github.com/TrentBrown/portreeve/pull/4)

Create the Electron workspace and hardened process boundary, verify and bundle
the checksummed local CLI release candidate as an explicitly provisional
non-shipping input, integrate lifecycle status plus the workspace client
inventory, and implement serialized refresh, reduced view models, and stale
evidence. Exact published-artifact identity remains deferred to I-7.

**Started 2026-08-01.** The delivery branch begins with the approved
publication deferral recorded in scratchpad decision 4. Local release-candidate
inputs must remain explicit and checksummed; they cannot satisfy R8 or enter a
public desktop release.

**In review 2026-08-01.** PR #4 implements P5-P6 and carries the formal
verification, spec evaluation, judge, security review, and packaged runtime
evidence for the read-only slice.

**Completed 2026-08-01.** PR #4 merged to `main` at
`75c463705bb5ff96b9c4bb411789959e3e81c7ac`.

## I-5 - Complete Overview, Ports, and lifecycle workflows

- **Status:** in-review
- **Estimate:** 2d
- **Plan steps:** P7
- **Rubric criteria:** R2, R3, R5, R6
- **Depends on:** I-4
- **PR:** [#5](https://github.com/TrentBrown/portreeve/pull/5)

Build the two-view renderer and its accessible onboarding, ordinary lifecycle,
upgrade, uninstall, manual-server stop, inventory search/filter/detail, and
typed-confirmed complete-reset flows with packaged end-to-end tests.

**Started 2026-08-01.** Delivery branch
`tb-portreeve-desktop-04-lifecycle-workflows` begins from merged PR #4. The
mutation and reset authority boundary is recorded in scratchpad decision 6.
Packaged reset verification found and corrected an Electron `userData` collision
with the CLI application home; scratchpad decision 7 records the separate
desktop-data boundary.

**In review 2026-08-01.** Draft PR #5 contains the complete P7 source slice and
is undergoing the pinned verification, evaluation, judge, review, and
explain-diff boundary gates.

## I-6 - Add version and update notification behavior

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P8
- **Rubric criteria:** R7
- **Depends on:** I-4
- **PR:** -

Display independent desktop/bundled/managed/running versions and implement the
fixed, identifier-free, once-per-24-hour update check with offline-safe failure
and approved external download navigation.

## I-7 - Build and verify native desktop releases

- **Status:** open
- **Estimate:** 2d
- **Plan steps:** P9
- **Rubric criteria:** R4, R5, R6, R7, R8
- **Depends on:** I-3, I-5, I-6
- **PR:** -

Complete the standalone `0.1.0` publication and npm Trusted Publishing
transition, then produce separate macOS ARM64/x64 artifacts with hardened
runtime, Developer ID signing, notarization, exact published nested CLI
identity, release manifests, and native packaged lifecycle smokes.

## I-8 - Complete feature-final evidence

- **Status:** open
- **Estimate:** 1d
- **Plan steps:** P10
- **Rubric criteria:** R1, R2, R3, R4, R5, R6, R7, R8
- **Depends on:** I-7
- **PR:** -

Run the complete rubric and Definition of Done across standalone CLI and
desktop artifacts, complete all independent workflow gates, reconcile the
tracker and issues, and preserve the final evidence packet and completion
report.
