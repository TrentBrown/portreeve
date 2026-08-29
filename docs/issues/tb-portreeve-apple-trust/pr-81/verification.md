# Verification - PR #81

**Scope:** Slice 13, P5/P7/P8 (`I-13`)
**Pinned base:** `bfa64a9d930154ce0509c67b23a81ee1aa601221`
**Pinned source:** `8957c037b6a8e0c71e3e8ef34108bd0cfc93b548`
**Result:** PASS

## Matrix

| Category | Command or evidence | Result |
|---|---|---|
| Build and typecheck | Pinned Bun 1.3.14 `bun run check`, including toolchain, generated-document, and TypeScript checks | PASS |
| Lint and formatting | The full check includes ESLint and Prettier; workflow spec, branch-doc, issues, and tracker validators also exited zero | PASS |
| Focused unit tests | Pinned Bun 1.3.14 `bun test test/release/apple-native-trust-evidence.test.js` | PASS - 4 tests, 19 expectations |
| Broad regression | Pinned Bun 1.3.14 `bun run check` | PASS - 581 tests, 3,040 expectations, 0 failures |
| Integration diagnostic | The corrected collector advanced through real codesign, DMG/app Gatekeeper, staple, exact-byte, and quarantine checks against exact preview.9 ARM64 producer output | PASS FOR CORRECTION; the native lifecycle callback was isolated because this local machine's launchd smoke timed out, so this diagnostic is not represented as formal native evidence |
| Hosted lifecycle baseline | Preview.9's preliminary ARM64 and x64 native jobs had already passed the release lifecycle before the protected producer; its independent Apple jobs then exposed only the invalid bare-CLI `spctl` category | PASS FOR PREEXISTING LIFECYCLE |
| End-to-end/browser | No browser or renderer behavior changed | N/A |
| Application runtime | The mounted preview.9 ARM64 app passed deep strict signing and Gatekeeper execution assessment during diagnosis; a fresh complete two-architecture run remains the next slice | PENDING FINAL SLICE |
| Publication | No publication command ran and public authorities remained unchanged after preview.9 | PASS |

## Corrected trust contract

- The standalone CLI retains exact Developer ID identity, Team ID, hardened
  runtime, secure timestamp, byte equality, and native lifecycle requirements.
- A private exact copy receives and retains a quarantine attribute, executes,
  and must report the exact coordinated release version.
- Gatekeeper remains mandatory for the mounted application and notarized DMG;
  no standalone executable is misrepresented as an application bundle.
- Every command remains bounded and any nonzero result, changed attribute, or
  wrong version fails before immutable evidence is written.

## Known failures

None in the pinned correction. Preview.9 is retained as a consumed failed
attempt and will not be rerun or reused. Fresh protected acceptance uses
preview.10 only after this PR lands on reviewed `main`.
