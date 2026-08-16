# Interview - tb-portreeve-overview-readme

**Feature:** `tb-portreeve-overview-readme`
**Status:** in progress

This running record captures settled design decisions for harmonizing the
repository README and the Desktop Overview without coupling their rendering.

## D1 - Keep README and Desktop Overview as sibling artifacts

**Question:** Should one shared source generate both the repository README and
the Desktop Overview, or should they remain independently rendered artifacts?

**Answer:** Keep them separate. A shared generator would add a build step and
make immediate visual refinement of the Desktop harder to reason about.

**Decision:** `README.md` and the Desktop Overview remain separately authored
and directly editable. Neither is generated from the other, and changing either
does not require a documentation build before the result can be inspected.

## D2 - Share claims and responsibilities, not presentation markup

**Question:** If the two artifacts remain separate, how should drift be
controlled without asking them to use identical prose or layout?

**Answer:** Establish clear boundaries between shared content claims and each
surface's format, style, and layout. Harmonize the surfaces deliberately rather
than hiding their relationship behind a generator.

**Decision:** Add a small, human-readable product-surface contract that names
the durable claims both artifacts must preserve and the responsibility of each
surface. Add semantic checks for those claims and important links, but do not
require identical wording, section order, diagrams, or presentation. The
Desktop remains optimized for interactive in-app explanation; the README
remains optimized for GitHub discovery, installation, and onward navigation.

## D3 - Give README and Overview the same conceptual scope

**Question:** Should the README present a curated subset of the Desktop
Overview, leaving detailed architecture and integration concepts to the app?

**Answer:** No. The initial intent was for the README and Overview to be
identical in scope. A first-time repository visitor should receive the same
substantive product introduction, be impressed and engaged by it, and want to
download and install the app as a daily driver.

**Decision:** README and Desktop Overview are co-equal product introductions
with the same conceptual coverage. Both explain the problem and promise, the
name, one authority with peer clients, integration paths, stacks and dependency
coordination, architecture and lifecycle concepts, safety boundaries, and the
available client surfaces. The README is not a teaser that withholds the richer
model until after installation. Each surface may reorder, condense, or render
the material differently: GitHub emphasizes evaluation, installation, and
continuing into the product, while Desktop emphasizes in-app navigation and
daily use. Semantic parity does not require identical prose or markup.

## D4 - Make Desktop the primary repository conversion path

**Question:** Should the README prominently ask evaluating visitors to install
PortReeve Desktop while retaining quieter paths for users who prefer another
client?

**Answer:** Yes.

**Decision:** The README's primary call to action is to install and open
PortReeve Desktop, positioning it as the intended daily driver and the easiest
way to continue the product experience introduced on GitHub. CLI, MCP, and
JavaScript integration remain visible as fully supported secondary paths rather
than being hidden or described as inferior. The README must not imply that the
Desktop application is required to run the PortReeve server or use those peer
clients.

## D5 - Enforce structural parity without generating either surface

**Question:** How should the project detect drift between two independently
authored product introductions without comparing their prose or introducing a
shared rendering pipeline?

**Answer:** Use the proposed small product-surface contract and structural
parity test.

**Decision:** Add `docs/product-overview-contract.md` as a concise,
human-readable list of shared topics and surface-specific responsibilities.
Stable markers identify each contracted topic in `README.md` and the Desktop
Overview. A focused test verifies that every topic and critical destination is
represented on both surfaces. It does not compare prose, headings, ordering,
diagrams, style, or layout. Human review remains responsible for judging
semantic fidelity and presentation quality. Neither surface is generated, and
no documentation build step is added.

## D6 - Change shared claims atomically across both surfaces

**Question:** Must every change to a shared product claim update README and
Overview in the same pull request, or may temporary divergence be the normal
maintenance workflow?

**Answer:** Require same-PR updates for shared claims.

**Decision:** A change to any topic or claim named by the product-overview
contract updates both `README.md` and Desktop Overview in the same pull request.
Surface-only work—such as layout, styling, interaction, GitHub-specific calls
to action, or installation mechanics—may change independently when it does not
alter a contracted claim. Intentional temporary divergence is an exceptional,
explicitly documented decision rather than deferred cleanup by default.

## D7 - Contract eight shared product topics

**Question:** Which exact conceptual topics must both README and Desktop
Overview cover?

**Answer:** Approve the proposed eight-topic set.

**Decision:** The product-overview contract requires both surfaces to cover:

1. **Identity and problem:** what PortReeve is, localhost conflicts, concurrent
   agents and worktrees, and the name's provenance.
2. **Authority model:** one per-user server with several peer clients.
3. **Client choices:** Desktop, CLI, MCP, and JavaScript integration.
4. **Integration paths:** built-in driver, generated launcher, and
   project-owned integration.
5. **Stacks:** familiar service dependencies and coordination across runnable
   stack instances.
6. **Coordination lifecycle:** claims, generations, activations, leases, and
   allocate, prepare, resolve, and confirm.
7. **Evidence and ownership:** live listener or container evidence and the
   safety boundary around reclaim.
8. **Boundaries and next step:** what PortReeve does not own, followed by a
   surface-appropriate continuation—install Desktop from README or begin using
   the installed app from Overview.

The contract governs meaning, not exact headings, wording, order, or diagram
form.

## D8 - Show the Desktop product with a maintained static screenshot

**Question:** Should the README show an actual Desktop screenshot as part of
its primary conversion path, and how should that asset be kept current?

**Answer:** Yes; use the proposed manually maintained static asset.

**Decision:** Place one polished screenshot of the Desktop Overview near the
README's primary Desktop call to action. Commit it under `docs/assets/` and
capture it from a clean release-candidate application state. Refresh it when
the product's overall appearance or Overview structure changes materially, not
for every small copy or styling adjustment. The parity checks require the asset
and meaningful alternative text but do not add automated screenshot capture,
pixel comparison, or another rendering pipeline.

## D9 - Use a truthful source-based Desktop call to action until release

**Question:** What primary Desktop call to action should the README present
before a packaged public release exists?

**Answer:** Approve the proposed truthful interim call to action.

**Decision:** The current primary action is **Build and open PortReeve
Desktop**, followed by a short source-based path using the repository's pinned
Bun toolchain. The README states plainly that a packaged macOS download is not
yet published. CLI and foreground or supervised server instructions remain a
secondary source-based path. The section is structured so a future release can
replace the primary action with **Download PortReeve for macOS** without
reorganizing the product introduction. Publishing a release artifact remains
outside this feature.

## D10 - Adapt visual explanations as native Mermaid diagrams

**Question:** How should the Desktop Overview's visual architecture
explanations be adapted for GitHub without sharing renderer markup?

**Answer:** Use the proposed native GitHub Mermaid approach.

**Decision:** README uses version-controlled Mermaid for one-authority and
peer-client relationships, compact Good, Better, and Best integration
sequences, a familiar stack dependency chain, and the coordination lifecycle
that connects claims, generations, activations, leases, and allocate, prepare,
resolve, and confirm. These diagrams preserve conceptual and visual scope but
are not generated from Desktop markup. The committed Desktop screenshot shows
the application's visual character; Mermaid explains the system. No exported
diagram asset pipeline is introduced.

## Open questions

- None blocking design synthesis.

## Interview close

The design is settled around two independently authored, co-equal product
introductions. README and Desktop Overview cover the same eight conceptual
topics while serving different contexts. Desktop is the primary repository
conversion path, but alternate clients remain first-class. Drift is controlled
by a small human-readable contract, stable structural markers, same-PR updates
for shared claims, and a focused parity test—not shared prose or generation.

The README will pair native Mermaid explanations with one manually maintained
Desktop screenshot. Until a public package exists, its primary call to action
truthfully builds and opens Desktop from source. No unresolved question blocks
design synthesis; the exact wording, marker syntax, screenshot framing, and
diagram layout are implementation details constrained by these decisions.
