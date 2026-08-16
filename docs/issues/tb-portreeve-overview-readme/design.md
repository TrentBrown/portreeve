# Design - tb-portreeve-overview-readme

**Feature:** `tb-portreeve-overview-readme`
**Status:** approved (gate passed 2026-08-16)

## Problem

PortReeve has two principal product introductions: the repository `README.md`
seen by evaluators on GitHub and the Overview shown inside Desktop. They now
serve similar purposes but have evolved independently. The Desktop Overview is
the richer explanation of the product's identity, integration choices, stacks,
coordination lifecycle, and safety model. The README is an effective technical
landing page but does not yet carry that full conceptual scope or make the
Desktop application a tangible, compelling next step.

Generating both surfaces from one source would reduce literal duplication but
would couple GitHub Markdown to a custom Desktop presentation, add a build step,
and make direct visual refinement harder to reason about. Leaving the surfaces
entirely independent would preserve editing freedom but invite product claims
to drift.

There is also no packaged public Desktop release yet. A conversion-oriented
README must not promise a download that does not exist.

## Intent

Make README and Desktop Overview co-equal, impressive product introductions
with the same conceptual coverage and surface-appropriate presentation.

The README should give a first-time visitor enough understanding and confidence
to want PortReeve as a daily development tool, with Desktop as the primary next
step. It should still present CLI, MCP, and JavaScript integration as supported
peer clients and accurately explain that Desktop is not required by the server.

Keep both artifacts directly editable. Prevent material drift through an
explicit product-overview contract, stable structural landmarks, a focused
parity test, and a same-PR maintenance rule for shared product claims.

## Chosen shape

### Co-equal sibling surfaces

`README.md` and Desktop Overview remain separately authored and neither is
generated from the other. They share conceptual scope but may use different
wording, ordering, diagrams, interaction, styling, and layout.

README is optimized for repository discovery, evaluation, source-based setup,
and conversion into the application. Desktop Overview is optimized for in-app
orientation, navigation, and continued product use. A surface-specific change
that does not alter a shared claim may change only that surface.

### Shared product contract

Add `docs/product-overview-contract.md`. It defines the responsibility of each
surface and eight stable topic identifiers:

1. `identity-problem` - product identity, localhost conflicts, concurrent
   agents and worktrees, and the PortReeve name.
2. `authority-model` - one per-user server and several peer clients.
3. `client-choices` - Desktop, CLI, MCP, and JavaScript integration.
4. `integration-paths` - built-in driver, generated launcher, and
   project-owned integration.
5. `stacks` - service dependencies and coordination across runnable stack
   instances.
6. `coordination-lifecycle` - claims, generations, activations, leases, and
   allocate, prepare, resolve, and confirm.
7. `evidence-ownership` - live process or container evidence and safe reclaim.
8. `boundaries-next-step` - responsibilities PortReeve does not assume and the
   appropriate continuation for the current surface.

Each contract topic explains the durable meaning rather than prescribing copy.
Invisible README comments and stable Desktop section attributes identify the
corresponding regions. A test derives the topic identifiers from the simple
contract structure and asserts that both artifacts contain every landmark plus
their critical destinations. It does not compare sentences, headings, order,
or rendered pixels.

Any change to a contracted claim updates the contract, README, and Overview in
the same pull request as applicable. Intentional temporary divergence requires
an explicit recorded decision. Human review remains responsible for whether
the two explanations are genuinely faithful.

### README product journey

Rewrite the README as a GitHub-native rendition of the complete Overview
journey:

- Lead with the approved brand lockup, the localhost-conflict promise, and a
  concise explanation of the concurrent-agent/worktree problem.
- Explain the historical name and connect the local administrative role to the
  modern port authority.
- Show one server and the Desktop, MCP, CLI, and JavaScript peer clients.
- Compare the built-in driver, generated launcher, and project-owned
  integration, including runtime ownership and how port values reach services.
- Introduce stacks through a familiar client-to-API-to-database dependency and
  explain both within-stack coordination and conflict avoidance among multiple
  runnable copies.
- Explain the coordination lifecycle and distinguish claims, generations,
  activations, and leases while showing allocate, prepare, resolve, and confirm.
- Explain live ownership evidence, safe reclaim, and the boundary between port
  coordination and project process supervision.
- End the product journey with source-based Desktop setup, alternate client
  paths, platform truth, documentation links, and the MIT license.

The primary call to action is **Build and open PortReeve Desktop**. It uses the
repository's pinned Bun toolchain and states plainly that a packaged macOS
download has not yet been published. The section is intentionally replaceable
by a future **Download PortReeve for macOS** action without reorganizing the
rest of the README. Publishing packages or a release is outside this feature.

### Visual presentation

Commit one polished screenshot of the current Desktop Overview under
`docs/assets/`. Place it near the primary Desktop action with meaningful
alternative text. Capture and refresh it manually from a clean
release-candidate state when the product's overall appearance or Overview
structure changes materially. Do not add automated capture or pixel comparison.

Use native GitHub Mermaid for editable system explanations:

- one authority with several peer clients;
- compact Good, Better, and Best integration sequences;
- a familiar stack dependency chain;
- a coordination-lifecycle sequence tying the state concepts to the protocol
  operations.

The screenshot demonstrates the application as a product. Mermaid explains the
system. README does not embed exports of Desktop's HTML/CSS diagrams.

### Desktop alignment

Preserve the current Overview's interactive layout and content unless parity
review identifies a missing or inaccurate contracted claim. Add stable topic
attributes around its existing semantic regions and adjust only the copy or
navigation needed to achieve the approved shared scope and next-step behavior.
Do not introduce a runtime Markdown renderer or make Desktop consume README.

### Verification

Add a focused documentation-parity test that checks:

- the contract exposes exactly the approved topic identifiers;
- README and Desktop Overview contain each structural topic landmark;
- the Desktop screenshot exists and README provides meaningful alt text;
- README's primary source-based commands and important documentation links
  resolve to current repository files or scripts;
- Desktop client destinations and README secondary client paths remain present;
- unsupported package downloads and Docker Sandbox integration are not claimed.

Existing Desktop semantic, security, accessibility, formatting, and test suites
remain in force. Visual review covers the rendered GitHub README, Mermaid
diagrams, and the running Desktop Overview.

## Alternatives considered

### Generate README and Overview from one source

Rejected because it adds a documentation build and couples two presentations
with substantially different rendering needs. It would make direct Desktop
iteration harder and introduce failure modes unrelated to product meaning.

### Treat README as a short teaser

Rejected because a first-time repository visitor should receive the complete
product model before deciding to install. The richer explanation is part of the
conversion experience, not content withheld until after conversion.

### Maintain both manually with no contract

Rejected because “harmonize later” creates recurring review overhead and silent
drift. A small structural contract provides discipline without owning prose.

### Compare prose or snapshots automatically

Rejected because identical wording would erase useful surface adaptation and
pixel comparison would add brittleness without proving conceptual fidelity.

### Publish a Desktop release as part of this work

Rejected as a material expansion into signing, packaging, release channels,
and authentication. The README will tell the truth about the current source
path and be ready for a future packaged release.

## Constraints

- No README-to-Desktop or Desktop-to-README generation.
- No new documentation build step, runtime Markdown parser, or shared renderer.
- No identical-prose, section-order, or pixel-parity requirement.
- No claim that a packaged release, npm package, Homebrew formula, Windows
  support, or Docker Sandbox integration exists.
- No implication that Desktop is required to run PortReeve or use CLI, MCP, or
  JavaScript clients.
- No changes to allocation, stack, launcher, lifecycle, or safety behavior.
- Shared claim changes must update both surfaces in one pull request.
- Existing brand assets and the Fogbound Coast colorway remain authoritative.

## Open risks

- Structural markers can prove that a topic region exists but not that its
  explanation remains substantively correct; human review is still essential.
- A committed screenshot can become visually stale between material refreshes.
- A complete README may become intimidating if diagrams and prose are not
  paced carefully; progressive headings, concise summaries, and restrained
  details must preserve scanability.
- GitHub Mermaid rendering can differ from Desktop diagrams and has narrower
  styling control. Concepts and actor identity must remain clear without exact
  visual parity.
- The source-based Desktop path has more friction than the desired future
  download. The README must make that friction honest without presenting the
  product as unfinished or implying that publication is already available.

## Changes

None.
