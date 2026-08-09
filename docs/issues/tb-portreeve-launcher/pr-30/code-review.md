# Code Review - PR #30

**Pinned diff:** `9e59c0d8283c2b49d5f731d15d6abb6a97f0fd67..8786913293e42b4bd55331eab262918766711bd5`

## Findings

No findings remain.

The review did identify one stable-contract inconsistency before the final pin: attached
Restart returned raw daemon `unavailable` instead of the established
`launcher_daemon_required` refusal. Commit `8786913` corrects the special composition
path and adds a regression test. The pinned diff includes that fix.

## Review coverage

- Process-group creation, closed input, timeout absence, output bounds, SIGTERM/SIGKILL
  escalation, cancellation, registry cleanup, and stale-group refusal.
- Same-root daemon coordination, attached Status/Stop companions, caller-loss metadata,
  and composed attached Restart.
- Immutable launcher snapshots and exact-generation revalidation before execution.
- Verified Start and Stop enforcement, attached in-flight verification capture,
  intentionally degraded matching through the evidence classifier, upgrade detection,
  and downgrade confirmation.
- Strict operation completion and record schemas, idempotent storage, old completion JSON
  defaults, official client declarations, and exclusion of commands, environment,
  process identities, credentials, and raw output.
- CLI cancellation and human/JSON maturity presentation.
- Workflow scope and test evidence against P6 / I-6.

## Residual risks and test gaps

- Abrupt application death can leave a project process alive; the daemon records the
  renewable operation as `lost` and never adopts or signals that process. This is the
  approved first-release boundary, not an unhandled regression.
- Desktop close blocking, renderer reduction, and packaged macOS attached-process smoke
  are intentionally deferred to P7-P9.
- Linux behavior is covered by the shared POSIX implementation and later release matrix;
  this boundary's native process execution ran on macOS.
