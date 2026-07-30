# Code Review - PR #1

**Result:** PASS after one finding was fixed.

## Fixed finding

- `.github/workflows/release.yml` originally granted `contents: write` at the
  workflow level, unnecessarily exposing a write-capable token to build and
  native verification jobs, including the self-hosted runner. Commit
  `b37c2ed` changes the default to `contents: read` and grants write only to
  `publish-github`.

## Review coverage

- Runtime-path ownership, modes, symlink rejection, and stale-socket handling.
- SQLite transaction, uniqueness, lease-secret hashing, and audit boundaries.
- Two-phase acquisition and concurrent candidate selection.
- `lsof` listener completeness, process fingerprints, fresh lineage, and PID
  reuse resistance.
- Verified reclamation and unsafe-eviction consent, target-set binding,
  per-signal revalidation, and graceful-before-force ordering.
- LaunchAgent/systemd command construction, managed executable promotion, and
  rollback.
- Release artifact identity, checksums, Homebrew reuse, npm-package contents,
  tag/version policy, and workflow permissions.

No additional blocking correctness or safety findings remain in the pinned
source diff.

## Residual risks and gaps

- The authoritative GitHub Actions matrix cannot prove Linux ARM64 until the
  labeled self-hosted runner is registered.
- npm ownership and credentials remain external state; only packaging and
  dry-run behavior have been verified.
- The initial PR is large. The extensive tests and cumulative design record
  reduce review ambiguity, but future work should be delivered in smaller
  slices.
