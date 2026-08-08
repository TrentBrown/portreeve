# Spec Evaluation - PR #26

**Scope:** P2 / I-2 against pinned diff
`20f6d42bfd6504ac2de00d39dd17ca475dc8c668..3634833b6d6fb68ddedee5fefe388d9bbb78ddb8`

## Definition of Done

- **Build status:** PASS - pinned Bun 1.3.14 toolchain, typecheck, and compiled build.
- **Lint status:** PASS - ESLint, changed-file Prettier, and whitespace checks.
- **Tests written:** strict protocol, operation service, cross-connection SQLite,
  official socket client, startup expiry, history, and documentation coverage.
- **Test suite status:** PASS WITH KNOWN HOST ISOLATION - 114 focused tests pass; every
  unique repository test passes across the 321-pass normal run and 5/5 isolated
  lifecycle rerun.
- **Integration verified:** Yes - real SQLite, restart, Unix socket, official client,
  npm tarball, and Node consumer.
- **Application runs:** Yes for the affected daemon surface; Desktop is N/A.
- **Pending manual verification:** None for this daemon-only slice.

## Acceptance Criteria

| # | Status | Evidence |
| --- | --- | --- |
| AC6 | PASS for P2 coordination; cumulative NOT YET | Capability negotiation, strict begin/renew/complete/inspect/recent routes, per-root admission, attached companions, thirty-second loss, and no-command boundary are implemented and tested. Shared engine and CLI delivery remain P3-P6. |
| AC7 | PASS for P2 history substrate; cumulative NOT YET | Bounded safe records expose operation, outcome, duration, exit, generation, evidence, and failure details without raw output. Desktop presentation remains P7-P8. |
| AC8 | PASS for P2 retention and non-action behavior; cumulative NOT YET | Additive capability preserves existing clients; expiry never adopts or kills; cascade/reset placement removes database coordination while project files remain external. Degraded execution remains P3-P8. |

## Rubric

| # | Result | Scope | Evidence |
| --- | --- | --- | --- |
| R6 | PASS for P2; cumulative NOT YET | Daemon coordination | `src/protocol/schemas.js`, `src/launcher/operation-service.js`, `src/storage/registry.js`, server routes, official client, and cross-connection tests satisfy the P2 coordination contract. |
| R7 | PASS for P2; cumulative NOT YET | Safe history substrate | Version-7 records, latest-twenty retention, global history events, and strict safe summaries are available for the later Desktop coordinator and renderer. |
| R8 | PASS for P2; cumulative NOT YET | Loss and additive compatibility | Startup/lazy expiry becomes `lost` without process action, active work blocks destructive stack changes, and capability refusal preserves old-daemon behavior. |

R1-R5 are outside this slice and remain `NOT YET`. No criterion moves to cumulative
`PASS` because the approved sequential plan intentionally completes these feature-level
outcomes through later engine, CLI, attached execution, and Desktop PRs.
