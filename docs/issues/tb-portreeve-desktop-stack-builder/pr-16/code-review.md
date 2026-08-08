# Code Review - PR #16

**Pinned diff:**
`4740cf4a6012eac339595a289727c9ec3236557b..b9f72833160ea3d723640717a26dfd992113311d`

## Findings

No findings.

The review traced native directory and known-stack selection through canonical root
resolution, document-session creation, bounded parsing, exact-byte evidence, conflict
capability rotation, exclusive create, synced atomic replacement, post-write
verification, official-client apply, retry, coordinator refresh, strict IPC parsing,
and the reduced preload API. It cross-checked the real-filesystem and IPC tests against
AC4 and AC6-AC8 and confirmed that the tracker does not prematurely claim the visible
editor criteria.

Before the final pinned head, review identified and corrected two edge cases: a normal
client-unavailable error could have exposed the private socket path, and an oversized
file had metadata rather than exact-byte evidence. The final implementation generalizes
the unavailable message and refuses oversized replacement instead of authorizing it.

## Residual risks and test gaps

- Portable rename APIs cannot conditionally replace a file by content hash. The service
  syncs its temporary file and performs a final exact-byte recheck immediately before
  rename, but a noncooperating writer could theoretically change the file in the final
  syscall interval.
- Open document sessions are intentionally process-local. Restarting the desktop app
  invalidates document and conflict UUIDs; later UI work must reopen rather than persist
  those capabilities.
- The packaged-app smoke proves that the final main-process bundle starts and loads the
  existing renderer. It cannot exercise document editing until P6/P7 connect the named
  capabilities to the dedicated editor view.

None of these residuals blocks the trusted P4 boundary.
