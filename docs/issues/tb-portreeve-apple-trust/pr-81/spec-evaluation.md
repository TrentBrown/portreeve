# Spec Evaluation - PR #81

**Scope:** Slice 13, P5/P7/P8 (`I-13`)
**Pinned base:** `bfa64a9d930154ce0509c67b23a81ee1aa601221`
**Pinned source:** `8957c037b6a8e0c71e3e8ef34108bd0cfc93b548`
**Verdict:** PASS FOR SLICE; FEATURE NOT YET COMPLETE

## Definition of Done

- **Build status:** PASS - pinned Bun 1.3.14 completed toolchain,
  generated-document, and TypeScript checks.
- **Lint status:** PASS - ESLint, Prettier, and all applicable workflow-document
  validators exited zero.
- **Tests written:** The native evidence tests require quarantine smoke, ensure
  no CLI Gatekeeper fact is synthesized, exercise the exact `xattr`/version
  path, and reject a mismatched release identity.
- **Test suite status:** PASS - 581 tests, 3,040 expectations, 0 failures;
  focused tests passed 4/4.
- **Integration verified:** The exact preview.9 ARM64 producer output passed the
  corrected signing, DMG/app Gatekeeper, staple, byte, and quarantine path in
  an isolated diagnostic. This does not replace the hosted complete native
  evidence required from preview.10.
- **Application runs:** Existing preview.9 mounted-app and quarantine diagnosis
  passed; the fresh protected run remains the final slice.
- **Pending manual verification:** Preview.10 protected nonpublishing rehearsal
  after PR #81 reaches reviewed `main`.

## Acceptance Criteria

| # | Slice result | Evidence |
|---|---|---|
| AC4 | PASS | The correction does not alter the main-only producer, credential scope, upload root, or publication separation. |
| AC5 | PASS FOR SLICE | Native evidence now truthfully applies Gatekeeper to the app and DMG, requires exact signing facts for all three surfaces, and adds fail-closed quarantined CLI execution. Complete ARM64/x64 documents remain preview.10 work. |
| AC7 | PASS FOR SLICE | Missing or incorrect codesign, Gatekeeper, quarantine, version, byte, smoke, notarization, or staple facts still stop evidence creation. Preview.9 remains immutable and preview.10 is required. |
| AC8 | NOT YET | The reviewed-main preview.10 run must produce the complete packet and zero-public-mutation proof. |

## Rubric

| # | Result | Scope | Notes |
|---|---|---|---|
| R4 | PASS | P5/P7 | Protected production and credential custody are unchanged; the correction gains no credential or publication authority. |
| R5 | PASS FOR SLICE; OVERALL NOT YET | P5 | The schema and collector now match the approved delivery surfaces and reject incomplete quarantine facts; hosted ARM64/x64 evidence remains required. |
| R7 | PASS | P7/P8 | The new check is fail-closed and bounded, and the consumed preview.9 identity is preserved rather than reused. |
| R8 | NOT YET | P8 | This intermediate correction deliberately does not claim final live acceptance. |

No in-scope correction criterion fails. The tracker correctly retains overall
`NOT YET` for R3, R5, and R8 until preview.10 supplies complete hosted evidence.
