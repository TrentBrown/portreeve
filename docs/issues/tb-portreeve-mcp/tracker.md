# Branch Tracker - tb-portreeve-mcp

**Spec:** [`spec.md`](spec.md)
**Plan:** [`plan.md`](plan.md)
**Issues:** [`issues.md`](issues.md)
**Created:** 2026-08-10

## Rubric Status

| # | Criterion (short) | Status | PR | Notes |
| --- | --- | --- | --- | --- |
| R1 | Transport and single authority | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43) | P1 pins SDK v2 and preserves the daemon/socket authority; stdio and packaged proof remain P2/P7. |
| R2 | Complete typed tool surface | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43) | P1 freezes the catalog; registrations and completeness audit remain P2/P5/P7. |
| R3 | Availability and explicit scope | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43) | P1 adds diagnostic-only origin and explicit catalog scope; availability/setup remain P2/P6/P7. |
| R4 | Credential custody | NOT YET | - | Planned across P3 and P7 / I-3 and I-7. |
| R5 | Lifecycle and idempotency | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43) | P1 supplies durable replay and serialized receipt execution; lifecycle families remain P3-P5/P7. |
| R6 | Consequential mutation safety | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43) | P1 supplies five-minute evidence-bound receipts; action-specific integration remains P4/P7. |
| R7 | Safe documents and observability | NOT YET | [#43](https://github.com/TrentBrown/portreeve/pull/43) | P1 completes bounded cursored history; documents and snapshots remain P2/P4/P5/P7. |
| R8 | Setup and shipped compatibility | NOT YET | - | Planned across P6 and P7 / I-6 and I-7. |

## PR Log

Append PR boundary entries here.

- [PR #43](https://github.com/TrentBrown/portreeve/pull/43) - I-1 protocol and client foundations. Packet: [`pr-43/boundary.json`](pr-43/boundary.json). Slice verdict PASS; all feature-level criteria remain `NOT YET` pending I-2 through I-7.
