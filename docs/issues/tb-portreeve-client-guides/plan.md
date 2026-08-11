# Plan - tb-portreeve-client-guides

**Feature:** `tb-portreeve-client-guides`
**Spec:** [`spec.md`](spec.md)
**Design:** [`design.md`](design.md)
**Interview:** [`interview.md`](interview.md)
**Created:** 2026-08-11
**Status:** approved 2026-08-11 under the user's delegated autonomous workflow

## Inputs

- `spec.md` controls scope, required behavior, and rubric mapping.
- `design.md` supplies the chosen architecture, constraints, and boundaries.
- `interview.md` supplies supporting examples, rationale, references, and edge cases.

## Strategy

Deliver the feature in five sequential, independently reviewable slices. Start
with side-effect-free contract metadata and a deterministic documentation
pipeline so later prose and UI consume a stable artifact rather than creating
parallel representations. Keep CLI documentation metadata beside Commander
definitions and MCP metadata beside the tool catalog; prove complete coverage
before expanding authored guidance.

Next, restructure the two stable Markdown paths around the approved common
information architecture and populate the initial recipes, interface
comparison, safety, platform, and troubleshooting content. Generate the
committed complete reference blocks and compile a static presentation bundle.

Add the Desktop surface only after the bundle contract is stable. Reuse the
existing MCP setup adapter, direct lifecycle/inventory services, strict IPC,
preload, and renderer model boundaries. Add a peer CLI tab, shared guide
renderer, local search/filtering, accessible disclosures, copy behavior, and
version-bound live installation summaries without invoking the CLI or parsing
Markdown at runtime.

Then perform the bounded README redesign and narrow Guide integration, keeping
platform and Docker Sandbox boundaries consistent. Finish with packaged/offline
verification, ordinary and narrow-width visual review, full rubric evaluation,
independent workflow gates, and the feature-final completion report.

Generated artifacts are committed in every slice that changes their sources.
Each intermediate PR is merged with a merge commit after its slice boundary
passes. The final PR remains open for explicit user approval.

## Steps

- **P1. Build contract metadata and deterministic documentation generation.**
  Add CLI documentation metadata and the mandatory five-way safety
  classification alongside the Commander tree. Expose side-effect-free MCP
  catalog metadata suitable for generation. Implement strict generated-region
  replacement, constrained Markdown validation/compilation, stable anchors,
  cross-reference resolution, committed bundle generation, and freshness/
  coverage tests. Seed valid generated regions in the two stable documents
  without yet performing the full prose redesign. **Advances:** R1, R2, R7.

- **P2. Author the complete MCP and CLI guides.** Restructure the stable
  Markdown files into Start here, Common workflows, Searchable complete
  reference, and Troubleshooting and safety. Add the approved recipe sets,
  prompt/tool transparency, preview/approval boundary, CLI shell examples,
  interface comparison, platform and Docker boundaries, symptom-first
  troubleshooting, representative evidence, and validated reference links.
  Regenerate the complete references and Desktop bundle. **Advances:** R1, R2,
  R5, R7.

- **P3. Add first-class Desktop MCP and CLI guide destinations.** Expand the
  MCP destination and add the peer CLI tab in the exact primary-nav order.
  Render the compiled static bundle through trusted components; add local
  search, family/safety filters, counts, disclosures, anchors, copying, and
  empty states. Add direct-service **This installation** summaries with strict
  main/preload/IPC schemas and bundled/managed/running version distinctions.
  Prove no runtime Markdown/HTML/network docs or CLI subprocess path and verify
  accessibility and narrow-width navigation. **Advances:** R3, R4, R8.

- **P4. Redesign README and connect Guide.** Replace the accumulated README
  with the approved product landing page, logo, compact one-daemon/four-client
  architecture diagram, client-choice guidance, truthful source-install path,
  capability/safety summary, platform boundaries, and stable documentation
  links. Add only the choose-your-client bridge and client links to Guide;
  correct inconsistent Docker Sandbox claims in changed user-facing surfaces.
  **Advances:** R5, R6, R7.

- **P5. Prove packaged offline behavior and complete the feature.** Inspect the
  packaged macOS application for the correct static guide bundle and contract
  version; exercise offline rendering, stale/mismatch/unavailable evidence,
  ordinary and minimum-width UI, keyboard/focus/accessibility behavior, and
  prohibited runtime paths. Run deterministic regeneration, full relevant
  source/build/package/release regressions, complete rubric evaluation,
  independent judge/review gates, and write the completion report. **Advances:**
  R1, R2, R3, R4, R5, R6, R7, R8.

## Verification

- **Generation:** Compare the Commander/MCP inventories to generated output;
  require one safety class per CLI leaf; test malformed markers, unsafe links,
  raw HTML, unsupported Markdown, duplicate anchors, and unresolved references;
  regenerate twice and prove a clean working tree.
- **Guidance:** Resolve every recipe command, option, tool, and anchor; assert
  approved workflows and platform/safety language; inspect GitHub-rendered
  Markdown structure and representative examples.
- **Desktop:** Exercise nav order, narrow horizontal scrolling, both four-part
  guides, search/filter/count/disclosure/anchor/copy/empty states, live evidence
  variants, bundled-version binding, strict IPC, and absence of CLI execution.
- **Security/offline:** Prove no runtime Markdown parser, arbitrary docs HTML,
  remote docs fetch, prose-provided executable code, or documentation-triggered
  subprocess authority.
- **Product documentation:** Validate README and Guide links, logo and Mermaid
  source, choose-client content, source-install instructions, and consistent
  macOS/Linux/Windows/Docker Sandbox boundaries.
- **Release matrix:** Run repository tests, typecheck, lint, formatting,
  standalone build checks, Desktop package verification, relevant MCP and native
  release gates, and manual ordinary/minimum-width review.
- **Final step:** Run full rubric evaluation and produce the completion report.
