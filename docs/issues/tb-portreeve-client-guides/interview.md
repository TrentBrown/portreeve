# Interview - tb-portreeve-client-guides

**Feature start:** 2026-08-11
**Status:** complete 2026-08-11; synthesized into `design.md`

Working design notes captured during the Grill Me interview. This file is the
primary design-phase artifact before `design.md` exists. Capture settled
answers, draft contracts, examples, rationale, and important open questions as
the interview progresses.

Update this file after each settled decision or other high-value design
clarification.

This file is the output of Grill Me and the input to the Design step. It is
not a substitute for `design.md`; it is the source material from which
`design.md` is synthesized.

## D1 - Keep MCP, CLI, and Guide as distinct top-level destinations

**Question:** Should client documentation be grouped beneath a new Documentation
tab, or should MCP and CLI have co-equal top-level visibility while Guide remains
the conceptual introduction?

**Answer:** Keep separate MCP and CLI tabs, retain Guide, and defer consideration
of a Documentation tab.

**Decision:** The primary navigation will present MCP and CLI as first-class
supported interfaces. Guide continues to explain what PortReeve is, its
architecture, and integration maturity. MCP and CLI provide interface-specific
setup, workflows, reference, and troubleshooting. A Documentation umbrella is
out of scope for this feature.

## D2 - Make installed client guidance self-contained and version-matched

**Question:** Should the MCP and CLI tabs contain a complete version-matched
reference, or primarily curated onboarding material that links elsewhere?

**Answer:** Use the recommended hybrid.

**Decision:** Each client tab will lead with task-oriented guidance and also
provide an expandable or searchable complete reference bundled with the Desktop
application. The installed content must remain useful offline and match the
installed PortReeve version. External documentation may supplement the bundled
material but cannot be required for setup, ordinary workflows, reference, or
troubleshooting.

## D3 - Generate contract reference and author explanatory guidance

**Question:** Should the Desktop documentation be maintained manually, or should
the runtime contracts generate the exhaustive reference while authored content
provides the user guide?

**Answer:** Adopt the generated-reference plus authored-guidance model.

**Decision:** The Commander command tree and the live MCP tool catalog will be
the authoritative inventories for their respective complete references. A
deterministic documentation layer will extract command/tool names, hierarchy,
arguments, options, descriptions, schemas, annotations, and safety properties
where applicable. Separately authored, version-controlled content will explain
concepts, recipes, cautions, and troubleshooting. Tests and packaging must prove
the authored guidance refers only to current generated contracts and that the
installed Desktop bundles both layers for offline use.

## D4 - Give both client tabs a consistent four-part structure

**Question:** Should MCP and CLI use the same internal documentation structure,
or should their pages be organized independently?

**Answer:** Use the recommended shared structure.

**Decision:** Both tabs will contain Start here, Common workflows, Searchable
complete reference, and Troubleshooting and safety sections. The starting action
remains interface-specific: MCP leads with its existing host configuration
generator, while CLI leads with installed executable/version information and a
first-command walkthrough. Shared structure improves transfer between clients
without implying that their runtime models are identical.

## D5 - Keep the CLI tab copy-only and independent of CLI execution

**Question:** Should the CLI tab execute commands on the user's behalf?

**Answer:** Approve the recommendation not to execute CLI commands.

**Decision:** The CLI tab may show the installed executable and version, render
copyable commands, explain inputs, outputs, exit statuses, and safety, and
present relevant live evidence through Desktop's existing direct application
services. It will not spawn the CLI, offer Run buttons, create a terminal, or
reintroduce the CLI as Desktop's API layer. CLI and Desktop remain peer clients
of shared PortReeve services.

## D6 - Share authored guidance between Desktop and repository Markdown

**Question:** Should Desktop guidance and repository documentation be maintained
independently, or share one underlying source?

**Answer:** Share one underlying source. Repository documentation means Markdown
checked into `docs/` and rendered when browsed on GitHub, not a separate GitHub
Pages site.

**Decision:** MCP and CLI authored guidance will have one version-controlled
source that produces both the bundled Desktop presentation and GitHub-rendered
Markdown. Generated command and tool reference data will likewise render for
both destinations. Presentation may differ, but wording and contract facts must
not fork. Publishing a separate documentation website remains out of scope.

## D7 - Include a bounded product-level README redesign

**Question:** Should this documentation feature also redesign the top-level
README, despite extending beyond the two client tabs?

**Answer:** Yes.

**Decision:** Redesign `README.md` as the product landing page and documentation
index in an explicit feature slice. It will introduce the concurrent
agent/worktree problem, show the one-daemon/multiple-peer-client architecture,
help users choose Desktop, MCP, CLI, or JavaScript/native integration, provide a
minimal installation and first-run path, summarize capabilities and safety, and
link the shared guides. The README remains separately authored for its distinct
purpose, with tests validating links and important claims. A documentation
website, broader marketing site, and wholesale rewrite of unrelated documents
remain out of scope.

## D8 - Explain interface equivalence and intentional asymmetry

**Question:** Should the guides compare equivalent CLI and MCP operations and
also show where no equivalent exists?

**Answer:** Yes.

**Decision:** Both guides will include a compact, shared explanation of how the
interfaces differ, plus selective cross-links for important workflows. It will
show approximate equivalents such as CLI and MCP port inventory while making
security and authority differences explicit: MCP excludes daemon lifecycle and
unsafe eviction; CLI launcher commands may execute trusted project commands,
whereas MCP launcher tools coordinate ownership and evidence only. The design
will not add a brittle counterpart label to every command and tool.

## D9 - Make workflow recipes runnable and evidence-oriented

**Question:** Should recipes be conceptual summaries or literal executable
examples, and how should mutations and output be presented?

**Answer:** Approve the runnable recipe standard.

**Decision:** Common workflows will use copyable sequences with clearly marked
placeholders, short step explanations, important success evidence, abbreviated
representative output, and links to every referenced command or tool. Mutating
recipes must show preview/execute order and side-effect warnings explicitly.
Automated checks will resolve referenced names and options against current
generated contracts so examples cannot silently become obsolete. Large raw JSON
dumps are not the primary teaching format.

## D10 - Teach MCP through prompts plus transparent tool sequences

**Question:** Should MCP recipes use agent prompts, raw tool calls, or both?

**Answer:** Use the recommended prompt-centered presentation.

**Decision:** Each MCP workflow will include a copyable natural-language prompt,
the expected PortReeve tool sequence with compact representative arguments, the
evidence the agent should report, and any approval or preview/execute boundary.
Ordinary recipes will not teach raw JSON-RPC framing. An advanced protocol note
may cover framing, while the complete generated reference continues to expose
the exact input and output schemas for every tool.

## D11 - Require explicit human approval after consequential MCP previews

**Question:** Should consequential MCP recipes instruct the agent to stop after
preview and wait for explicit human confirmation before execution?

**Answer:** Yes.

**Decision:** Recipes for deletion, pruning, reclaim, reassignment, settings
changes, stack replacement, and other consequential actions will direct the
agent to obtain a PortReeve preview receipt, summarize the proposed action and
fresh evidence, and pause. The execute tool is called only after the human
explicitly confirms that specific preview. Receipt freshness and binding protect
technical execution but do not replace human intent, regardless of an MCP
host's automatic tool-execution settings.

## D12 - Keep complete-reference navigation local to each client tab

**Question:** How should users navigate the large complete references, and
should this feature add global documentation search?

**Answer:** Approve client-local search and filtering; defer global search.

**Decision:** Each client tab will have always-visible text search,
family/category filters, safety-oriented filters, accessible result counts,
keyboard and screen-reader-compatible collapsible entries, and stable internal
anchors used by recipes. MCP distinguishes read-only and mutating tools; CLI
uses documented safety categories. A cross-application or global documentation
search is out of scope and remains coupled to any future Documentation
destination.

## D13 - Preserve the existing MCP and CLI documentation paths

**Question:** Should the new shared guides replace the existing Markdown paths
or preserve them as stable entry points?

**Answer:** Preserve the existing paths.

**Decision:** `docs/mcp.md` and `docs/cli-contract.md` remain the stable
repository URLs for the MCP and CLI guides. Their content may be expanded,
restructured, and partially generated in place, but the feature will not rename
them or break README, test, or external links. Desktop renders the same
underlying guidance and generated reference under its corresponding tabs.

## D14 - Keep Guide conceptual and link it to the client tabs

**Question:** How much should the existing Guide tab change when the MCP and CLI
guides become first-class destinations?

**Answer:** Use the recommended narrow integration update.

**Decision:** Preserve Guide's current product explanation, architecture, and
good/better/best integration material. Add a short choose-your-client bridge,
link MCP and CLI at relevant points, and correct any text or diagrams that omit
either interface. Guide will not duplicate client setup, recipes,
troubleshooting, or complete reference content.

## D15 - Add CLI beside MCP without hiding either client

**Question:** What should the primary navigation order and narrow-window behavior
be after adding the seventh tab?

**Answer:** Approve the recommended order and responsive behavior.

**Decision:** Primary navigation will be `Overview`, `Ports`, `Stacks`,
`Launchers`, `MCP`, `CLI`, `Guide`. At narrow supported widths it remains one
row and may scroll horizontally. The implementation will not hide MCP or CLI
under a More menu or wrap destinations into an ambiguous second row.

## D16 - Author in Markdown and compile a safe static Desktop bundle

**Question:** Should shared authored guidance be maintained as Markdown or as
JavaScript/JSON presentation data?

**Answer:** Use Markdown with safe build-time compilation.

**Decision:** The existing MCP and CLI Markdown is the canonical human-edited
prose. A constrained deterministic compiler will reject raw HTML, unsafe links,
unsupported constructs, and unresolved command/tool references; combine prose
with generated contract data; and emit the static Desktop documentation bundle.
The running Desktop will not parse Markdown, interpret arbitrary documentation
HTML, or add a documentation parser to its trusted runtime. Tests and packaging
must fail when compiled or generated outputs are stale.

## D17 - Classify every executable CLI command by safety

**Question:** Should every leaf CLI command carry a generated safety
classification?

**Answer:** Yes.

**Decision:** Every executable CLI command will be assigned exactly one of five
documented safety categories: read-only or local generation; ordinary
coordination mutation; evidence-bound consequential mutation; service
administration; or unsafe override. The generated CLI reference will display
the category as a consistent badge and allow users to filter by it. Commands
that prune, purge, reclaim, reassign, forcibly evict, or otherwise cross a
safety boundary will retain their more specific warnings in addition to the
badge. Contract-generation coverage will fail if any leaf command is missing a
classification, so new commands cannot silently enter the reference without an
explicit safety decision.

## D18 - Commit deterministic generated documentation artifacts

**Question:** Should generated reference sections and the compiled Desktop
documentation bundle be committed to Git?

**Answer:** Approved.

**Decision:** Generated CLI and MCP reference sections and the compiled static
Desktop documentation bundle will be committed. This keeps the stable GitHub
documentation paths complete, lets a source checkout render the client guides
without a preliminary documentation build, and makes contract changes visible
in review. Generated regions will be clearly marked and deterministic. Human
edits remain in authored Markdown regions; tests and packaging regenerate the
artifacts and fail if the working tree output differs from the committed files.

## D19 - Teach a curated initial recipe set and defer Docker Sandboxes

**Question:** Which end-to-end workflows should the initial MCP and CLI guides
teach beyond their complete generated references?

**Answer:** Approve the proposed scope except Docker Sandboxes, which PortReeve
does not yet support and must be deferred.

**Decision:** MCP recipes will cover host setup and compatibility verification;
inspection of ports, claims, and stacks; acquisition, use, and confirmation of
a single endpoint lease; preparation and activation of an intercommunicating
local stack; and approval-gated reclaim or pruning of stale state. CLI recipes
will cover service installation, startup, and diagnosis; port and ownership
inspection; port acquisition and confirmation for a local stack; stack
definition application and operation; launcher initialization, validation,
trust, and execution; and safe preview/execute reclaim or pruning. Less-common
operations remain discoverable in the complete reference and troubleshooting
sections. Docker Sandbox recipes and claims of Docker Sandbox support are out
of scope until that integration actually exists; current Docker-shaped endpoint
metadata must not be presented as equivalent support.

## D20 - Add a live installation summary without making docs depend on it

**Question:** Should each client tab include a compact live "This installation"
panel above its static guide?

**Answer:** Approved.

**Decision:** The MCP panel will expose the exact bundled MCP serve command,
generated host configuration, detected PortReeve version, and available local
reachability and compatibility evidence. The CLI panel will expose bundled and
managed CLI versions and locations, service status, and a copyable first
diagnostic command. Evidence must be obtained through Desktop application
services rather than by invoking the CLI as an API. Missing or stale evidence
will be labeled explicitly, and neither client guide will require live evidence
to remain readable or complete.

## D21 - Give the README one durable product architecture visual

**Question:** Should the redesigned README use one durable architecture visual
rather than application screenshots?

**Answer:** Approved.

**Decision:** The README will open with the PortReeve logo and a concise product
definition, then use one compact architecture diagram showing a single local
PortReeve service reached through four peer integration paths: Desktop, MCP,
CLI, and the JavaScript client. It will not add Desktop screenshots in this
slice, because they are comparatively expensive to keep synchronized with the
UI. It will not advertise npm installation or publication badges until package
publishing is actually enabled. Detailed workflow diagrams remain in Guide.

## D22 - Organize troubleshooting by observed symptom and safest evidence

**Question:** What troubleshooting scope and structure should the two client
guides share?

**Answer:** Approve the proposed symptom-first model.

**Decision:** Both guides will organize troubleshooting around observable
failure states: absent, stopped, unreachable, or incompatible PortReeve;
occupied ports or ambiguous ownership evidence; expired leases, failed
confirmation, or interrupted activation; invalid stack definitions or worktree
mismatch; and expired or invalidated preview receipts. MCP adds host startup,
stdio configuration and executable-path failures, and protocol-output
contamination. CLI adds syntax, JSON output, exit status, launcher trust,
timeouts, and foreground-process behavior. Each entry begins with the symptom,
uses the safest diagnostic, explains likely causes, and links to the relevant
recipe and reference entry. Destructive override advice will not be the first
remedy.

## D23 - Keep authored and generated content together at stable paths

**Question:** How should the stable Markdown guides combine human-authored
guidance with generated contract reference material?

**Answer:** Approve marked generated regions within the stable Markdown files.

**Decision:** `docs/mcp.md` and `docs/cli-contract.md` will remain complete,
readable GitHub documents and the canonical homes of their authored prose.
Generated sections will be enclosed by unmistakable named start and end
markers. Humans edit outside those regions; the generator replaces only the
marked bodies and then compiles each complete document into the Desktop bundle.
Generation will reject missing, duplicate, nested, reordered, or otherwise
malformed markers. No separate hidden prose source tree will be introduced.

## D24 - Make generated reference exhaustive about contracts, not scenarios

**Question:** What information must the complete generated references contain,
and what remains authored?

**Answer:** Approved the proposed boundary.

**Decision:** Each CLI entry will include its command path, synopsis,
description, safety category, positional arguments, options, defaults, accepted
environment or configuration inputs, output modes, exit-status behavior, and
related recipe links. Each MCP entry will include its tool name and title,
description, safety annotations, input schema, structured output schema,
failure envelope or error codes, and related recipe links. Generation may show
a mechanically valid invocation shape but will not invent live evidence or
realistic success output. Human-authored recipes provide scenario judgment,
meaningful examples, abbreviated representative results, and explanations.

## D25 - Do not add a CLI documentation reader in this feature

**Question:** Should this initiative add a command such as `portreeve docs`?

**Answer:** No; keep it out of scope.

**Decision:** Commander's generated help remains the immediate terminal-native
reference. Complete guidance remains at the stable repository Markdown paths
and in the Desktop client tabs. This feature will not add another renderer,
embed long-form guides in the executable, or introduce pager, browser-opening,
and packaging behavior for a new documentation command. A terminal-oriented
offline reader may be reconsidered later, particularly for installations that
do not use Desktop.

## D26 - State client platform boundaries explicitly

**Question:** How should the guides communicate the current platform support
contract?

**Answer:** Approved the proposed platform messaging.

**Decision:** Desktop will be identified as macOS-only. The standalone CLI and
MCP bridge will be identified as supported on macOS and Linux. The JavaScript
client will be described as portable across its documented Node.js and Bun
runtimes when it can reach the local PortReeve socket. Windows remains
unsupported. The guides will distinguish supported ordinary Docker-backed
endpoint evidence from unsupported Docker Sandbox orchestration or integration.
The README choose-a-client section and each applicable guide will show a compact
boundary and link to fuller platform detail instead of scattering caveats.

## D27 - Bind Desktop documentation to its bundled contract version

**Question:** Which installed version should the Desktop guides describe when
bundled, managed, and running PortReeve versions differ?

**Answer:** Use the recommended bundled-version rule.

**Decision:** Desktop guides always describe the bundled executable and
contract shipped and verified with that Desktop build. The live installation
panel separately identifies the documentation or bundled version, managed CLI
version, running server version, and any compatibility or mismatch condition.
Desktop will not fetch or dynamically substitute documentation from a managed
executable, running daemon, or network source. Users may inspect a different
managed CLI's native help for its exact command surface.

## D28 - Treat documentation generation and UI as release-gated behavior

**Question:** What verification boundary should this feature satisfy?

**Answer:** Approved the proposed comprehensive boundary.

**Decision:** Verification will cover deterministic regeneration and clean-tree
freshness; complete CLI command and MCP tool inventory coverage; mandatory CLI
safety classifications; generated-marker, constrained-Markdown, link, and
reference validation; Desktop navigation, search, filtering, result counts,
collapsible entries, stable anchors, copy behavior, and unavailable or stale
live evidence; semantic structure, keyboard operation, focus, and screen-reader
labels; packaged-guide presence and version binding; manual review at ordinary
and minimum supported window widths; README links and diagram rendering; and
the existing CLI, MCP, Desktop, packaging, and release suites. Documentation is
part of the shipped contract rather than an unverified prose appendix.
