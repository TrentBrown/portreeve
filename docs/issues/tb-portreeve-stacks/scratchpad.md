# Decision Scratchpad - tb-portreeve-stacks

**Feature start:** 2026-08-06

Working record of decisions made during this feature's lifetime. Append entries across
delivery branches and sessions. Triage at each PR boundary; promoted entries are
appended to `decisions.md`.

## [1] Rebuild claims table for canonical endpoint identity

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** SQLite migration runner, claims table, every persisted claim/lease/run
relationship, and migration fixtures

Add a migration mode that disables foreign-key enforcement only around one immediate
transaction, rebuilds claims with component and endpoint columns plus the new five-part
uniqueness constraint, copies every existing service as component with endpoint default,
restores enforcement, and fails if foreign_key_check reports any violation. This
preserves IDs and lets existing lease, run, listener, and history references continue to
resolve to the recreated claims table.

**Triggered by:** P1 must replace the service-only uniqueness constraint while
preserving existing relational data.

**Alternatives considered:** ALTER plus endpoint column - rejected because SQLite
retains the old service-level UNIQUE constraint; encode endpoint into the legacy service
column - rejected as a hidden storage invariant that corrupts the meaning of service;
reset the unreleased database - rejected because the approved spec requires assignment
and history preservation.

## [2] Normalize legacy service input to one canonical identity

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** Protocol schemas, registry queries, client declarations, inventory
filters, CLI rendering, and desktop port view models

Use one normalization boundary that accepts service, component, or matching service plus
component; rejects conflicting aliases; defaults endpoint to default; and returns
canonical component and endpoint together with service as a compatibility alias. Persist
and compare only component and endpoint. Legacy inventory service filtering maps to
component while new component and endpoint filters remain first-class.

**Triggered by:** P1 adds first-class component and endpoint without breaking current
service-based clients.

**Alternatives considered:** Maintain separate legacy and stack claim types - rejected
because they could allocate duplicate identities and ports; remove service immediately -
rejected by AC5; store both service and component as independent authority - rejected
because disagreement would make identity ambiguous.

## [3] Content-address definitions and advertise registration separately

[ ] **Promote**

**Confidence:** HIGH

**Blast Radius:** Stack definition schema, canonical JSON hashing, SQLite revision
storage, health capabilities, server routes, official client, and CLI

Parse CLI and client input through one strict version-1 schema, materialize defaults,
sort JSON object keys recursively, and use the SHA-256 digest as the immutable
definition revision. Advertise only stack-definitions-v1 for apply/list/show support;
later slices add separate capabilities only when their complete route, client, and CLI
contracts are usable.

**Triggered by:** P2 introduces the first public stack protocol surface before
allocation generations and activations exist.

**Alternatives considered:** Use raw file bytes as the revision - rejected because
harmless key ordering would create drift; advertise one broad stacks-v1 capability now -
rejected because it would overstate incomplete activation and Docker behavior; defer all
public stack endpoints until the whole feature is complete - rejected because it
prevents a safe independently testable migration and registration slice.
