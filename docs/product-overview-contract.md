# Product Overview Contract

README and Desktop Overview are independently authored, co-equal product
introductions. They cover the same durable product model while adapting copy,
order, diagrams, interaction, and layout to their respective surfaces.

## Surface responsibilities

- **README** serves repository discovery and evaluation. It gives a complete
  product introduction, makes Desktop tangible, provides a truthful primary
  path to install and open the current Desktop preview, retains a contributor
  source-build path, and preserves visible CLI, MCP, and JavaScript alternatives.
- **Desktop Overview** serves in-application orientation and continued use. It
  presents the same product model through native interaction and links users to
  the installed application's client and workflow destinations.
- Neither surface is generated from the other. No wording, heading, order,
  style, diagram, or pixel parity is required.

## Shared topics

Each topic heading below is a stable identifier consumed by the focused parity
test. Its description is the durable meaning both surfaces must preserve.

### `identity-problem`

Explain what PortReeve is, why localhost port conflicts intensify when several
agents run independent worktrees, and how the historical reeve and portreeve
roles motivate the name.

- README landmark: `<!-- product-overview:identity-problem -->`
- Desktop landmark: `data-product-overview-topic="identity-problem"`

### `authority-model`

Explain that one per-user PortReeve server—normally supervised or explicitly run
in the foreground—owns the registry and serves several peer clients. PortReeve
coordinates addresses but does not own project process lifecycle or application
health.

- README landmark: `<!-- product-overview:authority-model -->`
- Desktop landmark: `data-product-overview-topic="authority-model"`

### `client-choices`

Present Desktop, MCP, CLI, and the official JavaScript client as supported peer
surfaces with distinct workflow roles. Desktop may be the primary conversion
path without becoming a prerequisite for the others.

- README landmark: `<!-- product-overview:client-choices -->`
- Desktop landmark: `data-product-overview-topic="client-choices"`

### `integration-paths`

Explain the built-in Desktop driver, generated launcher, and project-owned
integration. Distinguish their runtime dependencies and whether resolved ports
reach project commands through environment variables or direct client calls.

- README landmark: `<!-- product-overview:integration-paths -->`
- Desktop landmark: `data-product-overview-topic="integration-paths"`

### `stacks`

Relate PortReeve stacks to familiar local service dependencies. Explain both
coordination within a client-to-API-to-database stack and conflict avoidance
among multiple independently runnable copies.

- README landmark: `<!-- product-overview:stacks -->`
- Desktop landmark: `data-product-overview-topic="stacks"`

### `coordination-lifecycle`

Explain claims, generations, activations, and leases together with allocate,
prepare, resolve, and confirm. Make clear that binding ownership and application
readiness are different facts.

- README landmark: `<!-- product-overview:coordination-lifecycle -->`
- Desktop landmark: `data-product-overview-topic="coordination-lifecycle"`

### `evidence-ownership`

Explain that fresh listener or container evidence is live authority, stored
process identifiers are context rather than proof, and normal reclaim remains
evidence- and ownership-bound.

- README landmark: `<!-- product-overview:evidence-ownership -->`
- Desktop landmark: `data-product-overview-topic="evidence-ownership"`

### `boundaries-next-step`

State what PortReeve deliberately does not own. Continue with the
surface-appropriate action: README truthfully installs and opens the published
Desktop preview while retaining a source-build path; Desktop leads into installed
workflows. Preserve CLI, MCP, and JavaScript alternatives on both surfaces.

- README landmark: `<!-- product-overview:boundaries-next-step -->`
- Desktop landmark: `data-product-overview-topic="boundaries-next-step"`

## Maintenance rule

A change to a shared topic or claim updates this contract, README, and Desktop
Overview in the same pull request as applicable. Surface-only presentation or
interaction changes may remain independent when they do not alter a contracted
claim. Intentional temporary divergence requires an explicit recorded decision.

Structural tests detect missing landmarks, critical destinations, assets, and
source paths. Human review decides whether the explanations are substantively
faithful and well presented. Tests must not compare prose, headings, section
order, styles, diagrams, screenshots, or pixels.
