# Code Review - PR #31

**Pinned diff:** `2604a18f7ec56b332f978ae938e925c57be1970f..59a3d55ba0e121d6a8807e67836e7ecd4c583c3f`

## Findings

No findings remain.

The review identified one close-safety race before the final pin: an attached Start
could still be in trust, evidence, or daemon-admission work before its process group
appeared in the local registry. Commit `59a3d55` changes close protection to cover the
entire app-owned attached Start or Restart session, including that pre-spawn interval,
and adds regression coverage. The pinned diff includes the fix.

## Review coverage

- Opaque document capabilities, exclusive create, exact-revision replacement, external
  changes, invalid-file overwrite, downgrade confirmation, and exact trust.
- Shared runtime construction, daemon per-root coordination, asynchronous execution,
  cancellation, exact local attached termination, bounded output, session retention,
  and close-state lifecycle.
- Strict shared schemas, trusted-main-frame IPC, narrow preload methods, and exclusion
  of root paths, process identities, credentials, raw environment values, and generic
  filesystem or shell authority.
- Safe launcher inventory/history/evidence reductions and unexpected error redaction.
- Existing lifecycle failure step, code/message, exit/timeout, bounded output, and
  before/after evidence from CLI adapter through renderer display.
- Packaged artifact construction/startup and full regression evidence against P7 / I-7.

## Residual risks and test gaps

- The visible Launcher tab does not exist in this slice, so there is no end-user flow to
  exercise these capabilities until P8. This is the deliberate sequential boundary.
- The packaged smoke proves secure startup and renderer load, not a packaged attached
  Start followed by an attempted close. That assembled workflow remains P8-P9.
- Linux behavior relies on the already-tested shared POSIX engine; the Electron Desktop
  first target remains macOS.
