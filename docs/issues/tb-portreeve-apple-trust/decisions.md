# Decisions - tb-portreeve-apple-trust

**Feature start:** 2026-08-28

Permanent record of decisions promoted from `scratchpad.md`.

---

## Restart the feature under GateReeve on macOS

**Confidence:** HIGH

**Blast Radius:** PortReeve Apple-trust lifecycle records, branch naming, and
cross-machine resumption; no production code or published release state

Archive this Playpen branch as a read-only reference, then start a fresh
`tb-portreeve-apple-trust` branch from `main` in Codex Desktop on Trent Brown's
Mac. The new feature must initialize through the GateReeve protocol and record
fresh design, specification, and plan passages. The archived interview,
approved design, and approved spec are authoritative context inputs but are not
retroactive protocol evidence.

**Triggered by:** The GateReeve protocol plugin was installed only after the
design and specification gates had passed, and protocol v1 classifies the
in-flight feature as legacy with no adoption mechanism.

**Alternatives considered:**

- Continue in legacy mode - rejected because the objective is to dogfood
  GateReeve gate enforcement during this lifecycle.
- Synthesize a model lock and event journal for the existing branch - rejected
  because GateReeve v1 deliberately forbids mid-feature adoption or
  reconstructed passage history.
- Run GateReeve Desktop on Playpen - rejected because the public Desktop
  distribution is macOS-only and Trent wants the native Mac observer.

**Promoted:** 2026-08-28.
