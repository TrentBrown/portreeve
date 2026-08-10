# Plan - tb-portreeve-guide

**Feature:** `tb-portreeve-guide`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-10

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Keep the slice entirely in the existing local renderer. Add one semantic Guide section
to the desktop document, extend the existing tab switcher by one section, and style its
cards, architecture flow, and disclosures with existing Fogbound Coast variables.
Update collection-level Launcher wording without changing stable internal identifiers.
Protect the result with static renderer/security tests and public documentation checks,
then package and inspect the desktop application at normal and minimum widths.

## Steps

- **P1.** Add the plural Launchers navigation/page/cross-link wording and the rightmost
  Guide tab/section with semantic orientation, integration paths, architecture, and
  disclosures. **Advances:** R1, R3, R4, R5.
- **P2.** Extend tab activation for Guide while preserving the existing Stacks and
  Launchers dirty-editor guards. **Advances:** R2.
- **P3.** Add responsive Guide styling using only existing theme variables and native
  controls. **Advances:** R5, R6, R7.
- **P4.** Update desktop documentation and add focused navigation, content,
  accessibility, trust-boundary, and packaging regression tests. **Advances:** R1, R2,
  R3, R4, R5, R6, R7, R8.
- **P5.** Run focused and broad automated verification, package the desktop, and inspect
  the rendered Guide at normal and minimum widths. **Advances:** R1, R2, R3, R4, R5,
  R6, R7, R8.

## Verification

- **Final step:** Run full rubric evaluation and produce the completion report.
