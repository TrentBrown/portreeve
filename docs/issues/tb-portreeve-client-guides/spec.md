# Spec - tb-portreeve-client-guides

**Feature:** `tb-portreeve-client-guides`
**Created:** 2026-08-11
**Status:** approved 2026-08-11 under the user's delegated autonomous workflow

## Summary

Ship first-class MCP and CLI documentation in PortReeve Desktop and at the
stable repository Markdown paths. Authored guidance and generated contract
reference must remain one versioned source, render safely as a committed static
Desktop bundle, expose usable client-local navigation, and fail verification
when runtime contracts or documentation artifacts drift. Redesign the README as
a truthful product landing page and connect the existing Guide to the client
destinations without duplicating their content.

## Definition of Done

The global Definition of Done in the software development workflow applies.

## Acceptance Criteria

- **AC1.** `docs/mcp.md` and `docs/cli-contract.md` remain stable, complete,
  GitHub-readable guides containing authored onboarding, workflows, safety, and
  troubleshooting plus generated reference regions that cover every advertised
  MCP tool and every executable CLI leaf command. Each CLI leaf has exactly one
  of the five approved safety classifications, and unresolved command, option,
  tool, recipe, or internal-anchor references fail generation.
- **AC2.** One deterministic documentation command updates only valid marked
  generated regions and produces the committed static Desktop documentation
  bundle. It rejects malformed markers, raw HTML, unsafe links, unsupported
  Markdown, duplicate anchors, and unresolved references; a freshness check
  fails whenever regeneration would change committed Markdown or bundle output.
- **AC3.** Desktop navigation is `Overview`, `Ports`, `Stacks`, `Launchers`,
  `MCP`, `CLI`, `Guide` in one horizontally scrollable row at narrow supported
  widths. Both client tabs expose Start here, Common workflows, Searchable
  complete reference, and Troubleshooting and safety, with always-visible local
  search, family and safety filters, accessible result counts, keyboard-usable
  disclosures, stable anchors, copy actions, and clear empty states.
- **AC4.** Each client tab has a live **This installation** summary obtained
  through Desktop application services rather than CLI execution. MCP shows the
  bundled serve command, generated host configuration, version, and available
  compatibility evidence; CLI shows bundled/managed executable versions and
  locations, running service evidence, and a copyable diagnostic command.
  Missing, stale, unavailable, incompatible, and version-mismatch states remain
  distinguishable, while the static guides stay fully usable without live
  evidence and always describe the Desktop-bundled contract.
- **AC5.** The authored MCP and CLI recipes cover the approved initial workflow
  sets with copyable placeholders, representative evidence, and validated links
  into reference. MCP recipes include copyable prompts and transparent tool
  sequences; consequential workflows stop after preview and require explicit
  human approval before execute. Troubleshooting is symptom-first and begins
  with safe diagnostics. The guides distinguish interface asymmetries and do
  not claim or teach unsupported Docker Sandbox integration.
- **AC6.** The redesigned README uses the approved logo and one compact
  one-daemon/four-client architecture diagram; explains the concurrent-agent and
  worktree problem; helps readers choose Desktop, MCP, CLI, or JavaScript client;
  gives a truthful current first-run path; summarizes capabilities and safety;
  and links the stable documentation. Guide receives only a concise
  choose-your-client bridge and accurate client links. No Desktop screenshots,
  npm-publication claims, documentation website, or new `portreeve docs` command
  are introduced.
- **AC7.** Platform statements consistently identify Desktop as macOS-only, CLI
  and MCP artifacts as supported on macOS and Linux, the JavaScript client by
  its documented Node.js/Bun and socket boundary, and Windows as unsupported.
  Ordinary Docker-backed endpoint evidence is never described as Docker
  Sandbox orchestration or integration.
- **AC8.** The packaged macOS Desktop contains the static version-bound client
  guides and renders them offline without runtime Markdown parsing, arbitrary
  documentation HTML, network documentation fetches, CLI subprocesses, or
  executable content from authored prose. Existing CLI, MCP, Desktop,
  packaging, and release verification continues to pass, and manual review at
  ordinary and minimum supported widths finds the client guides readable and
  operable.

## Rubric

| # | Criterion | Pass | Fail | Evidence |
|---|-----------|------|------|----------|
| R1 | Stable shared guides and complete contract coverage | Both stable Markdown files combine authored guidance with marked generated reference; every MCP tool and CLI leaf is present; every CLI leaf has one approved safety class; all contract and anchor references resolve | Either path is renamed/incomplete, authored content forks, inventory coverage is missing, safety metadata is absent/duplicated, or a stale reference passes | Generator coverage tests, generated Markdown inspection, CLI/MCP inventory comparison, reference-link tests |
| R2 | Deterministic safe generation | One command reproducibly updates marked regions and the committed Desktop bundle; malformed/untrusted input and stale output fail closed | Generation changes unrelated prose, accepts forbidden content or bad markers/references, is nondeterministic, or freshness permits drift | Generator unit/integration tests, two-pass hash/clean-tree check, negative fixtures, `git diff --check` |
| R3 | Complete accessible Desktop client destinations | Exact nav order and responsive behavior are present; both tabs contain all four sections and usable search/filter/count/disclosure/anchor/copy/empty-state behavior | A destination/section is missing or hidden, narrow navigation wraps ambiguously, or controls cannot be used or understood by keyboard/screen reader | Renderer/model tests, accessibility assertions, manual ordinary/narrow-window review |
| R4 | Direct-service live installation evidence and version binding | MCP and CLI panels show the required evidence through validated Desktop services, label unavailable/stale/mismatch states, and keep docs tied to the bundled contract without invoking CLI | Required evidence is absent/ambiguous, docs depend on a live daemon, dynamic/managed docs replace bundled content, or Desktop shells out to CLI for the panel | Main/preload/renderer tests, subprocess prohibition/security assertions, version-mismatch fixtures, packaged-app inspection |
| R5 | Safe useful recipes and troubleshooting | All approved MCP/CLI recipes are runnable in form, resolve to current contracts, show evidence and safety boundaries, and provide symptom-first safe troubleshooting without Sandbox claims | Required workflows are absent/stale, MCP consequential examples proceed without explicit approval, override is first-line advice, or unsupported Sandbox behavior is taught | Documentation-reference tests, content assertions, recipe review, rendered Desktop/GitHub inspection |
| R6 | Product README and bounded Guide integration | README contains the approved product framing, logo, durable architecture diagram, client choice, truthful start path, capabilities/safety, and working docs links; Guide links clients without duplicating them; excluded surfaces remain absent | README lacks required orientation or contains stale/unsupported claims, links fail, Guide duplicates the guides, or excluded screenshots/site/docs command/publication claims appear | README/link tests, rendered Markdown review, Guide renderer tests, repository diff inspection |
| R7 | Accurate platform and Docker boundaries | All changed user-facing surfaces consistently state the approved macOS/Linux/runtime/Windows boundaries and distinguish Docker evidence from Docker Sandbox support | A surface contradicts the supported platform contract or implies Docker Sandbox integration | Content assertions, cross-document search, manual rendered review, existing platform verification evidence |
| R8 | Secure offline packaged behavior and regression safety | Packaged Desktop includes and renders the versioned static guides offline with no runtime Markdown/HTML/network/CLI execution path; existing relevant suites and manual width review pass | Bundle is missing/stale, runtime introduces a prohibited execution/content path, offline rendering fails, a relevant existing suite regresses, or supported-width UI is unusable | Package verification, security tests, offline app smoke, full relevant test/build/release suites, manual visual checklist |

## Changes

Append spec amendments here. Do not remove or weaken original criteria.
