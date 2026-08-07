# Decision Scratchpad - tb-portreeve-desktop-stack-builder

**Feature start:** 2026-08-07

Working record of decisions made during this feature's lifetime. Append entries
across delivery branches and sessions. Triage at each PR boundary; promoted
entries are appended to `decisions.md`.

## [1] Decouple stack identity from Git worktrees

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Stack protocol and schemas, JavaScript client resolution, CLI discovery and flags, server and storage mapping, claim adoption, pruning terminology, desktop builder and view models, documentation, and integration tests

Define a stack root as the canonical real path of an arbitrary existing directory containing one independently runnable stack. Git repositories are optional and do not define stack identity. Discover the nearest ancestor portreeve.stack.json for implicit stack CLI operations, preserve explicit root or file selection, and update all public stack-facing vocabulary and behavior consistently before the initial public release. Standalone claim workspace identity remains a related but separately evaluated contract; stack endpoint claims must map to the chosen stack root without losing adoption or exclusivity invariants.

**Triggered by:** A runnable stack root may be a non-Git parent containing multiple child repositories, so Git top-level resolution selects the wrong boundary from a child repo.

**Alternatives considered:**
Keep Git worktree identity and require an arbitrary child repository as the stack anchor - rejected because it misrepresents multi-repository stacks and makes discovery and pruning depend on an unrelated repository. Keep workspaceRoot vocabulary but change only desktop selection - rejected because CLI and client calls from child repositories would remain inconsistent.

## [2] Forbid overlapping stack roots

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Stack apply validation, CLI and desktop root discovery, registered-root lookup, activation identity, pruning, protocol errors, documentation, and hierarchy tests

Allow sibling stack roots but reject any new or changed registration whose canonical stackRoot is an ancestor or descendant of another registered stackRoot. Selecting a directory inside an enclosing stack resolves to that existing root. Do not add parent-child stack activation or allocation semantics. Child Git repositories remain ordinary contents of the enclosing multi-repository stack.

**Triggered by:** Nearest-ancestor discovery raised the possibility of independently registered parent and child stacks, but the feature needs one stack spanning optional child repositories rather than hierarchy-aware stacks.

**Alternatives considered:**
Allow nested stacks and choose the nearest definition - rejected because it adds hierarchy, precedence, and simultaneous activation semantics without a demonstrated use case. Make ancestor and child stacks mutually exclusive only while active - rejected because overlapping durable definitions would still make discovery and ownership confusing.

## [3] Refuse definition changes beneath live activations

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Stack apply transaction, activation and discovery invariants, CLI and client error behavior, desktop saved-but-not-applied flow, tests, and protocol documentation

At server apply time, permit an idempotent apply of the current revision but refuse any changed revision while the exact stack has a starting, confirmed, or degraded activation. Saving the file remains independent, so desktop can report saved but not applied and retry after the activation ends. Enforce the invariant in storage/server logic so every client receives the same protection.

**Triggered by:** The desktop editor makes it easy to apply a new current revision while an activation still uses the old generation; current discovery then refuses the live generation as stale.

**Alternatives considered:**
Allow the apply and mark the live generation stale - rejected because it breaks discovery for a still-running stack. Make the desktop warn but allow CLI and client mutation - rejected because safety must not depend on one caller.

## [4] Bind desktop file authority to opaque edit capabilities

[x] **Promote**

**Confidence:** HIGH

**Blast Radius:** Desktop main-process document service, IPC schemas, preload API, and filesystem integration tests

Represent an open stack document with an opaque main-process session ID rather than a
renderer-visible path or fingerprint. A detected external change or invalid-file
replacement produces a separate, session-bound conflict capability. Overwrite succeeds
only when that capability matches and the exact evidence observed at conflict time is
still current; another external change requires another review. The main process bounds
candidate and file bytes, rejects non-regular canonical definition files, validates JSON
and the strict stack schema before writing, and performs same-directory exclusive create
or atomic replacement. These controls preserve the approved Overwrite or Cancel user
experience without widening renderer filesystem authority.

**Triggered by:** P4 turns the renderer draft into filesystem mutation and must prevent a compromised or stale renderer message from naming arbitrary paths or bypassing fresh overwrite evidence.

**Alternatives considered:**
- Send the canonical path and fingerprint to the renderer - rejected because it widens the renderer's authority and makes the overwrite check caller-controlled.
- Accept a plain `overwrite: true` flag - rejected because it can bypass the required two-step conflict review and can overwrite a second unseen external change.
- Follow symbolic links and permit unbounded local files - rejected because the editor should mutate only the fixed regular definition file at the trusted stack root.
