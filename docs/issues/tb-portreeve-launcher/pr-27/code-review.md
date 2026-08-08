# Code Review - PR #27

**Pinned diff:** `12f4b014abcc422c59a30bc922432d2beda97130..2da42e61e849b7af9175ffc110a39bc7fbd75384`

## Findings

No findings.

The review identified and the source diff now fixes two pre-boundary edge cases: stale
provider rows are ignored when their activation belongs to another generation, and a
confirmed endpoint without provider evidence becomes uncertain. Explicit default URL
ports are also retained.

## Review coverage

- Strict launcher/root/generation/activation validation and fixed reserved context
  (`src/launcher/environment-service.js:83`).
- Four endpoint-derived mapping forms and nonsecret exact-revision cache
  (`src/launcher/environment-service.js:122`).
- Fresh inventory, Docker publication, activation, provider, and ownership reduction
  (`src/launcher/evidence-service.js:53`).
- Degraded local lsof classification with no verified/conflicting authority
  (`src/launcher/evidence-service.js:182`).
- Backward-readable private cache endpoint facts (`src/launcher/local-state.js:10`).
- Unit state table and real HTTP/JSON Unix-socket integration.

## Residual risks and test gaps

- P4 must consume supplied generations for Stop/Status rather than preparing around an
  observed command-only stack; the resolver supports this but no command engine exists yet.
- Local degraded evidence cannot see Docker-only state and intentionally reports only
  host listener observations.
- Linux behavior relies on existing portable client and lsof primitives but was not run
  on the local macOS host; final platform verification remains P9.
