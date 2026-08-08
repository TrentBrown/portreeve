# Decisions - tb-portreeve-desktop-stack-builder

**Feature start:** 2026-08-07

Permanent record of decisions promoted from `scratchpad.md`.

---

## Decouple stack identity from Git worktrees

**Confidence:** HIGH

**Blast Radius:** Stack protocol and schemas, JavaScript client resolution, CLI discovery and flags, server and storage mapping, claim adoption, pruning terminology, desktop builder and view models, documentation, and integration tests

Define a stack root as the canonical real path of an arbitrary existing directory containing one independently runnable stack. Git repositories are optional and do not define stack identity. Discover the nearest ancestor portreeve.stack.json for implicit stack CLI operations, preserve explicit root or file selection, and update all public stack-facing vocabulary and behavior consistently before the initial public release. Standalone claim workspace identity remains a related but separately evaluated contract; stack endpoint claims must map to the chosen stack root without losing adoption or exclusivity invariants.

**Triggered by:** A runnable stack root may be a non-Git parent containing multiple child repositories, so Git top-level resolution selects the wrong boundary from a child repo.

**Alternatives considered:**
Keep Git worktree identity and require an arbitrary child repository as the stack anchor - rejected because it misrepresents multi-repository stacks and makes discovery and pruning depend on an unrelated repository. Keep workspaceRoot vocabulary but change only desktop selection - rejected because CLI and client calls from child repositories would remain inconsistent.

**Promoted:** 2026-08-07. PR: #14.

---

## Forbid overlapping stack roots

**Confidence:** HIGH

**Blast Radius:** Stack apply validation, CLI and desktop root discovery, registered-root lookup, activation identity, pruning, protocol errors, documentation, and hierarchy tests

Allow sibling stack roots but reject any new or changed registration whose canonical stackRoot is an ancestor or descendant of another registered stackRoot. Selecting a directory inside an enclosing stack resolves to that existing root. Do not add parent-child stack activation or allocation semantics. Child Git repositories remain ordinary contents of the enclosing multi-repository stack.

**Triggered by:** Nearest-ancestor discovery raised the possibility of independently registered parent and child stacks, but the feature needs one stack spanning optional child repositories rather than hierarchy-aware stacks.

**Alternatives considered:**
Allow nested stacks and choose the nearest definition - rejected because it adds hierarchy, precedence, and simultaneous activation semantics without a demonstrated use case. Make ancestor and child stacks mutually exclusive only while active - rejected because overlapping durable definitions would still make discovery and ownership confusing.

**Promoted:** 2026-08-07. PR: #14.

---

## Refuse definition changes beneath live activations

**Confidence:** HIGH

**Blast Radius:** Stack apply transaction, activation and discovery invariants, CLI and client error behavior, desktop saved-but-not-applied flow, tests, and protocol documentation

At server apply time, permit an idempotent apply of the current revision but refuse any changed revision while the exact stack has a starting, confirmed, or degraded activation. Saving the file remains independent, so desktop can report saved but not applied and retry after the activation ends. Enforce the invariant in storage/server logic so every client receives the same protection.

**Triggered by:** The desktop editor makes it easy to apply a new current revision while an activation still uses the old generation; current discovery then refuses the live generation as stale.

**Alternatives considered:**
Allow the apply and mark the live generation stale - rejected because it breaks discovery for a still-running stack. Make the desktop warn but allow CLI and client mutation - rejected because safety must not depend on one caller.

**Promoted:** 2026-08-07. PR: #14.

---

## Bind desktop file authority to opaque edit capabilities

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

**Promoted:** 2026-08-07. PR: #16.

---

## Preserve editor order with an ordered serializer

**Confidence:** HIGH

**Blast Radius:** Desktop editor draft conversion, JSON preview and saved definition
bytes, and renderer-model tests

Serialize the stack editor's valid draft through an explicit ordered-record renderer
while independently producing the normalized definition object used by trusted
validation. This preserves the exact component, endpoint, and dependency order shown in
the editor even when a legal schema name resembles an integer property key. The output
remains ordinary deterministic JSON with two-space indentation, a final newline, and
schema defaults omitted.

**Triggered by:** JavaScript object enumeration sorts integer-index property names ahead
of other keys, so passing an editor-ordered object to `JSON.stringify` can silently
violate the approved order guarantee.

**Alternatives considered:**
- Rely on `JSON.stringify` object order - rejected because legal names such as `"10"`
  and `"2"` are reordered.
- Reject integer-like names - rejected because it narrows the public stack schema only
  for a desktop implementation detail.
- Alphabetically sort all records - rejected because the approved preview and file
  contract preserves the user's editor order.

**Promoted:** 2026-08-07. PR: #21.

---

## Deliver the editor view with trusted document integration

**Confidence:** HIGH

**Blast Radius:** Desktop renderer entry points, stack editor view, navigation guards,
trusted document mutations, and packaged application verification

Deliver plan steps P6 and P7 as one coherent PR slice. The visible editor opens through
the already-merged opaque document capabilities, and its primary action performs the
approved save-then-apply flow, conflict confirmation, saved-not-applied recovery, and
successful return to stack details. A visible editor with a disabled or placeholder
save action would not provide an independently useful workflow, and issue I-6 already
owns both plan steps.

**Triggered by:** Implementing the first visible Stacks-tab editor entry point required
a meaningful primary action and complete outcome handling to support packaged runtime
verification.

**Alternatives considered:**
- Ship the form with no save action - rejected because users could build a draft but
  could not complete the advertised task.
- Expose Save and Apply but defer its outcomes - rejected because conflict and
  saved-not-applied states are part of the same filesystem mutation boundary.
- Create separate PRs for opening and saving the editor - rejected because neither
  slice would be a coherent, manually verifiable user workflow.

**Promoted:** 2026-08-08. PR: #22.

---

## Re-enable editor controls after an open operation

**Confidence:** HIGH

**Blast Radius:** Desktop stack editor controls immediately after native directory or
known-stack selection

Clear the editor's local busy state and explicitly re-enable its freshly rendered
controls when an open operation settles. The initial render intentionally occurs while
the native document operation is still marked busy, so its controls are disabled; the
same render must not remain permanently disabled after the operation completes.

**Triggered by:** Packaged macOS smoke testing showed every control disabled after
selecting a valid disposable stack root.

**Alternatives considered:**
- Render only after clearing busy - rejected because the editor should become visible
  and focusable as part of the successful open path while retaining one consistent
  operation cleanup point.
- Leave controls disabled until another renderer refresh - rejected because opening a
  new stack is otherwise unusable and no refresh is guaranteed.

**Promoted:** 2026-08-08. PR: #22.

---

## Isolate generic CLI tests from host Docker state

**Confidence:** HIGH

**Blast Radius:** Shared in-process CLI test runtime, lifecycle command tests, and every
command test that uses the shared runtime

Canonicalize temporary runtime and lifecycle-test directories before returning them to
tests, and start the shared command-test server with an intentionally unavailable Docker
executable. This keeps workspace filters and purge evidence aligned with the server's
canonical path contract and prevents a developer's unrelated running containers from
adding Docker inspection latency to non-Docker command tests. Dedicated Docker adapter,
stack evidence, compiled runtime, and server-client suites retain real or explicit
Docker coverage.

**Triggered by:** Full and isolated verification failed when macOS exposed the same
temporary directory as `/var` to the test and `/private/var` to the server, while four
unrelated running containers made each inventory request take roughly 3.5 seconds.

**Alternatives considered:**
- Raise the five-second test timeout - rejected because it would retain host-container
  coupling and would not fix the canonical workspace assertion.
- Stop the developer's containers during tests - rejected because tests must not mutate
  unrelated local workloads.
- Disable Docker evidence globally - rejected because Docker-specific suites must
  continue to verify the capability explicitly.

**Promoted:** 2026-08-08. PR: #22.

---

## Hide retry while the draft differs from the saved definition

**Confidence:** HIGH

**Blast Radius:** Desktop saved-not-applied recovery controls

Show `Retry Apply` only while the current editor draft still exactly matches the
definition that was successfully saved. Any unsaved topology or field change hides the
retry action until the draft returns to that baseline, preventing the user from applying
an older saved definition while viewing newer unsaved content.

**Triggered by:** Pinned code review found that structural add and delete actions could
leave the saved-not-applied status visible while making the draft dirty.

**Alternatives considered:**
- Apply the visible dirty draft from Retry Apply - rejected because retry must not write
  a new file or silently become another Save and Apply operation.
- Leave Retry Apply visible with an explanatory warning - rejected because hiding an
  inapplicable recovery action is clearer and prevents accidental stale apply.

**Promoted:** 2026-08-08. PR: #22.
