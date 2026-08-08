# Code Review - PR #26

**Pinned diff:** `20f6d42bfd6504ac2de00d39dd17ca475dc8c668..3634833b6d6fb68ddedee5fefe388d9bbb78ddb8`

## Findings

No findings.

## Review coverage

- Public schemas are strict, bounded, and exclude command, environment, credential, and
  raw-output fields (`src/protocol/schemas.js:436`).
- SQLite version 7 constrains operation and execution states, hashes credentials, and
  ties rows to stack and optional generation identities (`src/storage/migrations.js:347`).
- Admission and mutation are `BEGIN IMMEDIATE` transactions, operate across connections,
  and roll back when audit history cannot commit (`src/storage/registry.js:2609`).
- Expiry uses the exact renewable deadline, marks `lost`, and performs no process or
  listener action (`src/storage/registry.js:2908`).
- The service adds capability negotiation and keeps HTTP routing separate from durable
  rules (`src/launcher/operation-service.js:22`, `src/server/server.js:310`).
- The official client preflights the additive capability and communicates solely over
  HTTP/JSON on the Unix socket (`packages/client/src/client.js:300`).
- Active sessions block changed stack definitions, direct deletion, and prune planning.
- Tests cover strict rejection, invalid credentials, cross-connection concurrency,
  attached companions, exact idempotency, audit rollback, retention, restart expiry,
  socket integration, npm packaging, and old-daemon refusal.

## Residual risks and test gaps

- The later shared engine must renew every ten seconds and provide trustworthy evidence
  summaries; P2 cannot prove engine behavior before P3-P6 exist.
- Idempotent completion applies while a terminal record remains in the bounded latest-20
  store. A retry after twenty newer terminal operations is outside retained history and
  returns not found; the public documentation makes retention explicit.
- The full suite's three installed-LaunchAgent failures are host-state isolation, not
  changed-code failures; the isolated lifecycle file passes.
- Linux runtime behavior relies on SQLite, HTTP/JSON, and official-client primitives
  already covered by CI, but the current local verification host is macOS.
