# Plan - tb-portreeve-overview-readme

**Feature:** `tb-portreeve-overview-readme`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-16

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Deliver the harmonization as one documentation-focused feature slice. Establish
the explicit topic contract and its non-brittle verification first, then rewrite
README against the approved Desktop Overview, align only the necessary Desktop
landmarks and content, capture the application screenshot, and finish with both
automated and rendered-surface review. Keep README and Overview directly
editable throughout; the implementation adds no content generator or runtime
renderer.

## Steps

- **P1. Establish the product-overview contract and parity harness.** Write the
  eight-topic human-readable contract, add stable README and Desktop landmark
  conventions, and implement focused tests that cover topics, critical
  destinations, screenshot/alt text, source paths, and prohibited claims
  without comparing prose, order, style, or pixels. Include negative fixtures or
  mutations proving important omissions fail. **Advances:** R1, R6, R7.

- **P2. Rewrite README as the complete GitHub product introduction.** Adapt all
  eight topics into a scan-friendly narrative, preserve accurate documentation
  and platform links, foreground the truthful source-based Desktop path, and
  retain visible CLI, MCP, and JavaScript alternatives. **Advances:** R2, R3,
  R7.

- **P3. Add GitHub-native visual explanations and Desktop evidence.** Author the
  authority, integration, stack, and lifecycle Mermaid diagrams directly in
  README. Capture one polished current Overview screenshot under
  `docs/assets/`, add meaningful alt text, and verify that the committed asset
  is suitable at GitHub reading widths. **Advances:** R3, R4, R7.

- **P4. Align Desktop Overview to the shared contract.** Add the eight stable
  topic landmarks, correct only missing or inconsistent shared claims and
  next-step navigation, and preserve existing navigation, accessibility, theme,
  client destinations, and security boundaries. **Advances:** R2, R5, R7.

- **P5. Verify the assembled product story.** Run contract/parity, Desktop,
  formatting, type, lint, link/path, and unsupported-claim checks. Render and
  inspect README with its Mermaid diagrams and inspect the running Desktop
  Overview, correcting scanability, accuracy, or visual problems without
  expanding scope. Evaluate every rubric criterion and prepare the PR boundary
  evidence. **Advances:** R1, R2, R3, R4, R5, R6, R7.

## Verification

- Run the focused parity suite with both positive and intentional-failure cases.
- Run the complete affected Desktop test suite, typecheck, lint, formatting, and
  whitespace checks.
- Validate every README repository-relative path and source command against the
  checkout.
- Render README in a GitHub-compatible preview and inspect all Mermaid blocks,
  the screenshot, hierarchy, and calls to action.
- Launch Desktop and inspect Overview navigation, landmarks, keyboard behavior,
  responsive layout, and visual continuity.
- **Final step:** Run full rubric evaluation and produce the completion report.

