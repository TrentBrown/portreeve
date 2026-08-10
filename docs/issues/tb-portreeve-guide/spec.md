# Spec - tb-portreeve-guide

**Feature:** `tb-portreeve-guide`
**Created:** 2026-08-10
**Design gate:** approved 2026-08-10

## Summary

PortReeve Desktop gains a static, offline Guide and uses plural collection naming for
Launchers. The Guide explains the responsibility boundary, three integration paths,
architecture, lifecycle/evidence concepts, and deliberate non-goals without changing
any privileged contract or live runtime behavior.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** Primary navigation appears in this order: Overview, Ports, Stacks,
  Launchers, Guide; the collection page heading and cross-tab action use Launchers,
  while labels for one launcher remain singular.
- **AC2.** Selecting Guide displays a rightmost, static orientation surface and hides
  the four other primary sections; leaving a dirty Stacks or Launchers editor for Guide
  continues to require the existing discard decision.
- **AC3.** The Guide clearly distinguishes PortReeve's address-coordination
  responsibilities from project-owned process/container lifecycle and application
  readiness responsibilities.
- **AC4.** The Guide presents Good, Better, and Best integration paths with their runtime
  dependencies and tradeoffs: built-in desktop driver, generated independent launcher,
  and native project integration.
- **AC5.** The Guide describes the single per-user architecture and the relationships
  among interfaces, server/registry/supervisor, project definition/launcher/providers,
  host and Docker evidence, and sandbox discovery.
- **AC6.** Expandable content covers allocation and confirmation, stack identity and
  generations, process/Docker evidence, sandbox boundaries, shared interfaces, and
  deliberate non-goals, including the statement that listener ownership does not prove
  application readiness.
- **AC7.** The Guide is keyboard-accessible, responsive at the supported minimum window
  width, completely local/offline, and introduces no renderer network, IPC, protocol,
  storage, or runtime dependency surface.
- **AC8.** Public desktop documentation and automated tests describe and protect the new
  five-tab surface, static Guide boundary, and plural collection naming.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Five-tab navigation and naming | Navigation order is Overview, Ports, Stacks, Launchers, Guide; collection heading/cross-link are plural and individual labels remain singular | Order is wrong, Guide is absent, or collection-level Launcher remains singular | Renderer markup/source assertions and focused desktop tests |
| R2 | Guide navigation behavior | Guide can be selected as an exclusive section and existing dirty-editor guards apply before leaving Stacks or Launchers | Multiple sections remain visible or Guide bypasses an editor guard | Renderer source assertions and focused navigation tests |
| R3 | Responsibility boundary | Guide visibly says PortReeve coordinates addresses, project tools coordinate work, and listener ownership is not readiness | Any responsibility statement is missing or implies PortReeve owns application lifecycle/health | Static content assertions and manual rendered-app review |
| R4 | Three integration paths | Good, Better, and Best are all present with correct desktop/generated/native dependency tradeoffs | A path is absent or misstates who owns lifecycle/runtime dependencies | Static content assertions and manual rendered-app review |
| R5 | Architecture and deep dives | Single-authority architecture and all required concept groups are represented in semantic, expandable content | A required relationship/concept is absent or only available as an inaccessible image | Markup assertions, accessibility inspection, and manual rendered-app review |
| R6 | Offline trust boundary | Change adds no renderer network, new IPC/protocol/storage surface, external content, or runtime diagram dependency | Any new privileged/network path or runtime content dependency is introduced | Source diff, security tests, dependency inspection, and package tests |
| R7 | Responsive accessible presentation | Native tab/disclosures and semantic structure remain readable at the supported minimum width | Controls are not keyboard-native or layout clips/depends on visual-only text | Markup/CSS assertions and manual narrow-window review |
| R8 | Documentation and regression coverage | Desktop docs explain the Guide and tests protect navigation, content, naming, and trust boundary | Public docs or targeted regression coverage is absent | Documentation test plus focused desktop test suite |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
