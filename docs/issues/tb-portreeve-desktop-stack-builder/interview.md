# Interview - tb-portreeve-desktop-stack-builder

**Feature start:** 2026-08-07
**Status:** complete

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - Keep completed stack definitions file-backed

**Question:** Should the desktop stack builder always write
`portreeve.stack.json` into the selected worktree and then apply it, or should
Portreeve also permit database-only stack definitions?

**Answer:** Always create the file when it does not exist.

**Decision:** A completed desktop-authored stack is project-owned and
file-backed. The in-app form may hold an unsaved draft, but successful creation
writes `portreeve.stack.json` in the selected worktree and applies that
definition to Portreeve. Database-only stack topology is out of scope. The file
is the source of truth for topology; Portreeve persists its normalized revision
and coordination state.

## D2 - Let Portreeve allocate host ports by default

**Question:** Should ordinary desktop-created endpoints omit host-port choices
and let Portreeve allocate them, with preferred and exact host ports available
only as advanced settings?

**Answer:** Yes.

**Decision:** The normal stack-builder path does not ask for a host port.
Omitting `allocation`, or using its empty default, delegates host-port selection
and persistence to Portreeve. Preferred and exact host ports remain advanced
escape hatches. Docker `containerPort` remains topology because it identifies
where the service listens inside the container; it is not the allocated host
port.

This split simplifies the ownership concerns: Git retains reproducible project
topology and Portreeve retains machine-local allocation authority. The stack
file does not record assigned host ports, so normal allocation changes do not
create repository churn or competing sources of truth.

## D3 - Use one builder for creation and editing

**Question:** Should the first desktop stack-builder version be creation-only,
or should it also load and edit an existing `portreeve.stack.json` with
overwrite protection and external-change detection?

**Answer:** Include editing. Build the overwrite protection and external-change
detection rather than deferring editing.

**Decision:** The desktop builder supports both new and existing stack
definitions. When editing, it retains a fingerprint of the exact file bytes it
loaded. Immediately before saving, the main process re-reads the file and
compares the current fingerprint with the loaded fingerprint. A mismatch is a
conflict and prevents an ordinary save. An unchanged file is replaced using an
atomic same-directory write. Creation similarly refuses to overwrite a file
that appeared after the initial absence check. The renderer never receives
general filesystem authority; selection, validation, conflict detection, and
writes remain in the trusted main process.

The conflict-recovery interaction remains open: the design must decide whether
an external change is an absolute refusal until reload, or whether a separately
confirmed force-overwrite path is allowed after review.

## D4 - Resolve external edits with Overwrite or Cancel

**Question:** When an existing stack definition changes externally while an
edit form is open, should the desktop require reload and preserve/export the
draft, or offer a simpler explicit overwrite path?

**Answer:** Draft preservation is not important enough to justify additional
handling. Offer an Overwrite or Cancel choice.

**Decision:** On save, an unchanged fingerprint follows the ordinary atomic
write path. A changed fingerprint opens a clear conflict confirmation naming
the stack definition and explaining that another process modified it.
`Overwrite` deliberately replaces the then-current file with the validated
draft; `Cancel` returns to the form without writing or applying. No merge,
diff, reload requirement, recovery copy, or draft export is required. The
conflict is never overwritten silently.

## D5 - Select a worktree and use its canonical definition path

**Question:** Should one `Create or Edit Stack...` action ask for a worktree
directory and then open or create exactly `<worktree>/portreeve.stack.json`,
while preserving the existing manual file-apply action separately?

**Answer:** Agreed.

**Decision:** The builder begins with a native directory picker and operates
only on the canonical `portreeve.stack.json` at that directory's root. If the
file exists, the builder validates and edits it; otherwise it starts a new
definition draft. The current `Apply definition...` path remains available for
manually authored JSON rather than being folded into the builder or silently
rewritten.

## D6 - Round-trip the complete current stack schema

**Question:** Should the first editor support every variable field in the
current stack-definition schema, rather than a simplified subset that could not
safely edit every existing definition?

**Answer:** Yes.

**Decision:** The editor represents project identity; component identity and
Docker service metadata; endpoint identity, publication, requirement, Docker
container port, and automatic/preferred/exact allocation policy; and dependency
alias, target component, target endpoint, and requirement. The fixed schema
version and currently fixed TCP transport remain implicit. Loading and saving a
valid current definition must not silently discard any schema field.

## D7 - Use a dedicated editor inside the Stacks tab

**Question:** Should the builder use a dedicated editor view that temporarily
replaces the normal stack list and detail area within the existing Stacks tab,
with `Back to stacks`, `Cancel`, and `Save and Apply` returning to the normal
view?

**Answer:** Yes; this layout is preferred.

**Decision:** `Stacks` remains one of the existing top-level application tabs.
Starting creation or editing replaces that tab's list/detail content with a
full-width editor rather than opening another top-level tab, separate window,
or large modal. The editor shows worktree and project context, a component
selector, the selected component's endpoint and dependency fields, validation,
and persistent cancel/save actions. Leaving the editor returns to the ordinary
Stacks management view.

## D8 - Warn before discarding a dirty form

**Question:** Should navigating away from an editor with unsaved field changes
show a minimal discard confirmation, without adding autosave or draft recovery?

**Answer:** Yes.

**Decision:** `Back to stacks`, `Cancel`, switching to another top-level tab,
and closing the window must warn before discarding a dirty draft. The choices
are `Keep editing` and `Discard changes`. An untouched form exits immediately.
The desktop does not autosave, persist recovery drafts, or attempt to restore a
discarded draft.

## D9 - Preserve a successful save when apply fails

**Question:** Should the editor remain usable without a running Portreeve
service and allow an explicit `saved but not applied` outcome when the project
file write succeeds but the subsequent server apply fails?

**Answer:** Yes.

**Decision:** `Save and Apply` validates the full draft, writes the canonical
file, and only then asks Portreeve to apply those saved bytes. A successful file
write is not rolled back because the daemon is unavailable or refuses the
apply. The UI reports `Saved, but not applied`, preserves the actionable error,
and offers `Retry Apply`. File authoring remains available while lifecycle or
stack evidence is unavailable; operations that require the server remain
subject to its revalidation and authority.

## D10 - Keep port preparation explicit

**Question:** After `Save and Apply` succeeds, should the desktop automatically
prepare the stack and allocate its host ports, or retain `Prepare Stack` as a
separate explicit action?

**Answer:** Keep preparation explicit.

**Decision:** Saving and applying creates or updates the durable topology and
returns to the normal stack details. It does not create an allocation
generation. The existing explicit `Prepare Stack` action remains responsible
for allocating host ports, allowing project launchers or the developer to
choose when preparation occurs.

## D11 - Infer only the project name for a new definition

**Question:** Should a new definition pre-fill only the editable project
identifier from the selected worktree directory name, leaving components and
all subordinate topology for the user to specify?

**Answer:** Yes.

**Decision:** New drafts derive an editable project value from the worktree's
basename. They do not invent a starter component, endpoint, Docker service,
dependency, or port preference. The empty component area presents a prominent
`Add component` action, and validation requires at least one fully specified
component before saving.

## D12 - Show an exact read-only JSON preview

**Question:** Should the editor include a collapsible generated JSON preview
showing the exact formatted content that `Save and Apply` will write?

**Answer:** Yes.

**Decision:** A collapsible, read-only preview updates with the form and shows
the exact serialized `portreeve.stack.json` candidate. It reflects validation
state but is not an alternative raw-editing surface, so form state and JSON
text cannot diverge.

## D13 - Cascade draft renames through dependencies

**Question:** Should renaming a component or endpoint automatically update all
dependency references within the unsaved draft?

**Answer:** Yes.

**Decision:** Components and endpoints receive editor-local stable identities
that are separate from their editable schema names. Dependency selectors refer
to those draft identities, so renaming a target updates every generated
dependency reference consistently. The read-only JSON preview immediately
reflects the new names. Only the final names enter the saved definition and
Portreeve protocol.

## D14 - Confirm cascading deletion of referenced topology

**Question:** When deleting a component or endpoint that dependencies target,
should the editor name the impact and offer an explicit cascading deletion of
the target and those dependencies?

**Answer:** Yes.

**Decision:** Deleting an unreferenced component or endpoint is immediate.
Deleting a referenced target opens a confirmation that identifies the target
and the number and identities of affected dependencies. Confirming removes the
target and those dependency entries from the draft; cancelling changes
nothing. The editor never leaves dangling dependency references silently.

## D15 - Serialize concise deterministic JSON

**Question:** Should the generated definition use two-space deterministic JSON,
preserve editor collection order, omit default-valued schema fields, and accept
that the first editor save may reformat an existing hand-formatted file?

**Answer:** Yes.

**Decision:** Saved definitions use two-space indentation and a final newline.
They preserve the editor's component, endpoint, and dependency order while
omitting implicit TCP transport, true publication/requirement flags, empty
automatic allocation, and other empty default structures where the schema
permits omission. Explicit Docker container ports and preferred/exact host-port
policies are emitted. The preview shows these exact bytes. The editor does not
attempt token-level formatting preservation; a save may deliberately reformat
an existing valid file without changing its normalized semantic revision.

## D16 - Offer direct editing from known stack details

**Question:** Should a selected known stack expose an `Edit Definition` action
that opens its canonical worktree definition directly, alongside the general
directory-based `Create or Edit Stack...` entry point?

**Answer:** Yes.

**Decision:** Known stack details include `Edit Definition`. The renderer sends
only the stack identity; the trusted main process resolves the durable stack's
canonical workspace root and its root `portreeve.stack.json`. The full path is
not added to the reduced renderer view model. `Create or Edit Stack...` remains
available for worktrees that Portreeve does not yet know.

## D17 - Recover a missing file from the applied definition

**Question:** When a known stack's canonical file is missing, should `Edit
Definition` populate the form from Portreeve's currently applied definition and
offer to recreate the file?

**Answer:** Yes.

**Decision:** If a known stack has no root `portreeve.stack.json`, the editor
may use the durable currently applied definition as recovery input. It clearly
labels the file as missing and states that saving will recreate it. The
recovered form then follows ordinary validation, deterministic serialization,
file creation, and apply behavior. This does not make the database a peer
topology authority when a project file exists.

## D18 - Recover invalid files through explicit replacement

**Question:** Should an existing definition that is invalid JSON or fails the
stack schema avoid partial recovery and instead offer an explicitly confirmed
replacement path?

**Answer:** Yes.

**Decision:** The editor never guesses a form model from an invalid definition.
It shows safe structured parse or schema errors. For a known stack, the user may
cancel or start a replacement draft from the currently applied definition. For
an unknown worktree, the user may cancel or start a new definition draft. In
either case, the invalid file remains untouched until `Save and Apply`, which
requires explicit overwrite confirmation before replacing it.

## D19 - Make an arbitrary directory the stack boundary

**Question:** Should Portreeve define a stack by an arbitrary canonical
filesystem root, with Git repositories optional, rather than requiring one Git
worktree to be the stack boundary?

**Answer:** Yes. Take on the wider refactor and do it thoroughly.

**Decision:** A stack root is the real path of any existing directory that
represents one independently runnable stack. It may itself be a Git worktree,
contain multiple child repositories, or contain no Git repository. The
canonical `portreeve.stack.json` belongs at that root. Git metadata is optional
context rather than stack identity. The selected root's basename supplies the
new-draft project default, and missing-root pruning tests that directory's
existence.

The current client already falls back to the caller-supplied real directory
outside Git, so an explicitly supplied non-Git parent works. The incompatible
behavior is implicit resolution inside a child repository: current Git
canonicalization selects the child repository rather than discovering an
ancestor stack root. The refactor must cover client and CLI resolution,
protocol vocabulary, server/storage relationships, claim adoption, pruning,
desktop paths and labels, documentation, and integration tests. Earlier
worktree-specific wording in D1, D5, D7, D11, D16, D17, and D18 is superseded
by `stack root`; their remaining behavioral decisions still stand.

## D20 - Use stack-root vocabulary in the public stack contract

**Question:** Before the initial public release, should stack-specific public
APIs and CLI options replace the ambiguous `workspaceRoot` vocabulary with
`stackRoot`, rather than retaining the old name with broader semantics?

**Answer:** Yes.

**Decision:** Stack requests, records, filters, client types, JSON protocol
payloads, CLI rendering, and documentation use `stackRoot`. Stack CLI selectors
use `--stack-root`; missing-root pruning and UI labels say stack root rather
than worktree. Standalone claim APIs continue to use `workspaceRoot`, whose
Git-oriented identity remains separately meaningful. The server/storage bridge
must explicitly map stack endpoint claims to the selected stack root so this
vocabulary split does not weaken allocation identity, adoption, activation
exclusivity, or evidence checks. No compatibility alias is required before the
initial public release.

## D21 - Allow nested stack roots with nearest-file discovery

**Question:** If multiple ancestor directories contain
`portreeve.stack.json`, should implicit CLI discovery select the nearest file
while allowing an outer stack to be selected explicitly?

**Answer:** Yes.

**Decision:** Nested stack roots are permitted. Commands that discover a stack
definition from the current directory walk upward and choose the nearest
ancestor `portreeve.stack.json`. `--stack-root` explicitly selects a different
root, including an outer ancestor. The CLI does not merge nested definitions or
infer parent-child runtime relationships between their stacks.

## D22 - Fall back to registered roots for status discovery

**Question:** When no ancestor definition file exists, should `stacks status`
query Portreeve's registered stack roots containing the current directory and
select the deepest match?

**Answer:** Yes.

**Decision:** Status resolution order is explicit `--stack-root`, nearest
ancestor definition file, then the deepest registered stack root containing the
current real directory. If none exists, status reports that no stack can be
resolved. `stacks apply` still requires the canonical file and never constructs
a definition from registered state implicitly.

## D23 - Adopt only standalone claims at the exact stack root

**Question:** When a stack root contains child repositories with preexisting
standalone claims, should Portreeve avoid guessing component ownership and
adopt only claims whose workspace root already equals the stack root?

**Answer:** Yes.

**Decision:** Stack application preserves the current conservative adoption
invariant at the newly named boundary: project, component/endpoint shorthand,
transport, and exact canonical root must match. Claims rooted at child
repositories remain distinct and are not moved or adopted automatically. New
stack preparation creates canonical endpoint claims at the parent stack root.
The definition does not gain component filesystem paths solely for transitional
claim adoption.

## D24 - Forbid overlapping registered stack roots

**Question:** Are nested stacks a useful abstraction, or should Portreeve
simplify the model by refusing registered stack roots related by ancestor and
descendant containment?

**Answer:** Remove nested stacks and take the simpler model.

**Decision:** Registered stack roots may be siblings but may not contain one
another. A parent root may contain any number of child Git repositories; those
repositories are ordinary contents or components of the one parent stack, not
independently registered nested stacks. Applying or creating a child root under
a registered parent is refused, as is applying a parent that contains a
registered descendant root. Directory selection inside an existing enclosing
stack resolves to that stack. Portreeve does not define parent/child stack
activation, allocation, or orchestration semantics.

This decision supersedes D21's allowance for nested roots and the corresponding
nearest-definition-wins behavior. Upward definition discovery remains useful,
but a valid registered hierarchy contains at most one applicable stack. D22's
registered-root fallback remains, with overlap rejected rather than resolved by
depth.

## D25 - Refuse changed applies beneath live activations

**Question:** Should Portreeve refuse to apply a changed definition while the
same stack has a `starting`, `confirmed`, or `degraded` activation, preventing
the live generation from becoming revision-stale beneath its launcher?

**Answer:** Yes.

**Decision:** The server is the final authority for this rule across desktop,
CLI, and JavaScript clients. Reapplying the identical current revision remains
idempotent. A changed revision is refused while a live activation exists. The
desktop still preserves a successful project-file write and reports `Saved,
but not applied: end the current activation first`, with `Retry Apply` after
the activation ends. This closes an existing path in which a changed current
revision caused discovery for the still-live old generation to become stale.

## D26 - Validate progressively and revalidate at every trust boundary

**Question:** Should the editor allow incomplete drafts, validate touched
fields inline, summarize and focus errors on save, and revalidate the complete
definition in both the trusted main process and existing client/server schema?

**Answer:** Yes.

**Decision:** Drafts may be temporarily incomplete. Touched fields receive
inline feedback, the read-only JSON preview reflects the latest valid
candidate, and an invalid `Save and Apply` attempt shows a summary and focuses
the first invalid control. The save action remains discoverable rather than
being silently disabled. The renderer's draft is untrusted: the main process
validates the full definition before any file write, and the client/server
contract validates it again before apply.

## Interview close

The feature has two connected deliverables. First, the desktop Stacks tab gains
a full-width field editor that creates and edits the canonical
`portreeve.stack.json`, covers the complete current schema, defaults host ports
to Portreeve allocation, previews exact concise JSON, protects external writes,
and saves before applying. Second, the underlying stack contract is corrected
before public release: an arbitrary canonical directory is a `stackRoot`, Git
is optional, CLI discovery works from child repositories, overlapping roots are
refused, public stack vocabulary uses `stackRoot`, and changed definitions
cannot be applied beneath live activations.

The product boundary remains firm. Portreeve owns topology coordination,
allocation state, validation, evidence, and safe lifecycle transitions. It does
not gain project launch commands, Compose ownership, health checks, component
source paths, nested-stack orchestration, raw JSON editing, autosave, draft
recovery, or database-only topology.

The primary implementation risks are consistent stack-root migration across
protocol/client/CLI/server/storage/desktop surfaces; exact filesystem conflict
and atomic-write behavior; accessible dynamic form state; and ensuring the
new editor cannot bypass renderer capability reduction or server authority.
Each risk is concrete and testable; no unresolved product decision remains in
the interview.
