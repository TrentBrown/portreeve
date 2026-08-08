# Code Review - PR #22

**Pinned diff:**
`62cad2e05f159b085644c34a3180e2a3a9208099..3115c5eafff96eff211992b5c896b4eec08372c7`

## Findings

No open findings.

The review traced both editor entry paths, trusted document acquisition, all mutable
field controls, dependency-aware deletion, progressive validation and focus, preview
bytes, conflict confirmation, saved-not-applied handling, retry, tab/window dirty
guards, renderer containment, and the host-independent CLI test-runtime changes.

Two Retry visibility defects were found and corrected before the final pinned head:

1. Structural edits could leave Retry Apply visible while the draft differed from the
   saved definition. Commit `b12ef89` added the clean-baseline requirement.
2. After an edit was reverted to the saved baseline, Retry remained hidden because its
   visibility also depended on a transient warning banner. Commit `63fe5bf` made the
   durable saved baseline plus `!isDirty()` the complete visibility rule.

Exact final typecheck, lint, focused tests, release assembly, and desktop packaging pass
after both corrections.

## Residual risks and test gaps

- The view wiring test intentionally inspects renderer source rather than running a DOM
  emulator. Packaged macOS smoke covers the critical interaction paths, but future
  refactors should consider a small renderer harness if the view grows materially.
- The exact final package was rebuilt after the last Retry guard correction; the broad
  packaged interaction sequence preceded that final condition-only change. Focused
  assertions cover the final rule, and no protocol, persistence, or IPC behavior changed.
- The shared command-test runtime intentionally disables Docker discovery only for
  generic CLI tests. Dedicated Docker adapter, stack evidence, compiled runtime, and
  server/client suites remain responsible for Docker behavior.

None of these residuals blocks PR #22.
