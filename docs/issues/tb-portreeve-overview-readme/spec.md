# Spec - tb-portreeve-overview-readme

**Feature:** `tb-portreeve-overview-readme`
**Created:** 2026-08-16
**Status:** approved (gate passed 2026-08-16)

## Summary

README and Desktop Overview must become independently authored, co-equal
product introductions with the same approved conceptual scope. README must
engage a first-time repository visitor and truthfully lead toward Desktop while
preserving first-class alternate clients. A small contract and structural test
must prevent topic-level drift without generating either surface or comparing
their prose and presentation.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** **Product-overview contract.** A human-readable
  `docs/product-overview-contract.md` defines README and Desktop Overview
  responsibilities, the approved same-PR maintenance rule, and exactly these
  eight stable topics: identity and problem, authority model, client choices,
  integration paths, stacks, coordination lifecycle, evidence and ownership,
  and boundaries plus next step. It specifies meaning and landmarks without
  requiring shared prose, section ordering, rendering, or generated content.

- **AC2.** **Co-equal conceptual coverage.** README and Desktop Overview each
  contain an identifiable region for every contracted topic and communicate
  the same durable claims. README is not merely a teaser: it explains the name,
  concurrent-agent/worktree problem, per-user authority and peer clients,
  integration maturity, stack dependency coordination, lifecycle concepts,
  live ownership evidence, and product boundaries. Desktop retains the same
  conceptual scope in its interactive presentation.

- **AC3.** **Truthful client and conversion paths.** README prominently offers a
  working source-based **Build and open PortReeve Desktop** path using the
  repository's pinned Bun toolchain, states that a packaged macOS download is
  not yet published, and includes a tangible Desktop screenshot. CLI, MCP, and
  JavaScript remain visible supported peer-client paths, and neither surface
  implies that Desktop is required to run PortReeve or use another client.

- **AC4.** **GitHub-native visual explanation.** README contains a meaningful
  Desktop screenshot with useful alternative text plus valid Mermaid diagrams
  that explain: one authority with peer clients; Good, Better, and Best
  integration sequences; a familiar client-to-API-to-database stack; and the
  lifecycle relationship among claims, generations, activations, leases,
  allocate, prepare, resolve, and confirm. The diagrams are authored directly
  in README and do not depend on exported Desktop diagram assets.

- **AC5.** **Desktop alignment without renderer coupling.** Desktop Overview uses
  stable landmarks for the eight topics and receives only the content or
  navigation adjustments needed for parity. Its existing interactive behavior,
  Fogbound Coast presentation, and client destinations remain functional.
  Desktop does not parse README or Markdown at runtime and no shared rendering
  or documentation-generation pipeline is introduced.

- **AC6.** **Focused drift detection.** An automated test derives or validates the
  approved topic set and fails when either surface loses a contracted landmark,
  when a critical client or documentation destination disappears, when the
  referenced screenshot is absent or lacks meaningful alternative text, or
  when source-based setup points at missing repository scripts or files. The
  test does not compare prose, heading text, section order, styling, diagram
  pixels, or screenshot pixels.

- **AC7.** **Accurate scope and usable rendering.** README links and source-based
  commands resolve against the current repository; README and Desktop do not
  claim a public package, Homebrew formula, Windows support, Docker Sandbox
  integration, or responsibility for project process supervision. README
  renders legibly on GitHub, Desktop Overview remains keyboard and
  screen-reader navigable, and the full affected documentation/Desktop test
  suites pass.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Product-overview contract | The contract exists, is human-readable, assigns surface responsibilities, states the same-PR rule, and defines exactly the eight approved topics without prescribing shared rendering or prose. | The contract is missing, ambiguous, contains a different topic set, or introduces generation or literal-copy requirements. | Contract inspection plus automated contract/topic test. |
| R2 | Co-equal scope | Both surfaces visibly and accurately cover all eight contracted topics, with README providing a complete product introduction rather than directing readers elsewhere for the core model. | Either surface omits a topic, materially contradicts the other, or README withholds the substantive product model until after installation. | README and running Desktop review mapped topic-by-topic to the contract; parity test results. |
| R3 | Truthful Desktop conversion and peer clients | README's primary Desktop path runs from source using pinned tooling, discloses the absence of a packaged download, shows Desktop, and keeps CLI, MCP, and JavaScript paths visible and independent. | Commands are unusable, an unavailable download is promised, Desktop is not made tangible, alternate clients are hidden, or Desktop is presented as required. | Command/link verification, rendered README inspection, and client landmark tests. |
| R4 | Visual explanations | The screenshot exists with meaningful alt text and the required authority, integration, stack, and lifecycle concepts render as valid native Mermaid. | An asset is missing, alt text is unhelpful, required concepts lack a diagram, Mermaid is invalid, or Desktop diagram exports are used as the explanatory source. | Asset/link checks, Mermaid validation or GitHub rendering review, and rendered README inspection. |
| R5 | Independent Desktop presentation | Overview landmarks and any parity corrections preserve working navigation, accessibility, theme, and client destinations without runtime Markdown or a shared generator. | Overview behavior or accessibility regresses, styling is materially broken, a client destination disappears, or Desktop becomes coupled to README rendering. | Desktop semantic/security/accessibility tests and running-app inspection. |
| R6 | Non-brittle drift detection | Automated verification fails for missing topics, destinations, screenshot/alt text, and invalid source paths while allowing independent wording, order, and presentation. | Important omissions pass undetected, or tests require identical prose, headings, ordering, styles, or pixels. | Focused positive and negative test cases plus test implementation review. |
| R7 | Accuracy and overall usability | Repository paths resolve, unsupported capabilities are not claimed, GitHub README is legible and engaging, Desktop remains navigable, and affected suites pass. | Broken paths, unsupported claims, unreadable presentation, navigation/accessibility failures, or affected test failures remain. | Link/path checks, negative-claim assertions, GitHub preview, Desktop runtime review, and verification logs. |

## Changes

None.
