# Interview - tb-portreeve-guide

**Feature start:** 2026-08-10
**Status:** complete
**Design gate:** approved in the originating Guide discussion and reaffirmed on 2026-08-10

## Settled product intent

- PortReeve is the per-user authority for local development TCP-port identities,
  allocations, leases, confirmations, and evidence. It does not own application
  service lifecycle.
- The desktop needs a static, rightmost **Guide** tab that explains how PortReeve fits
  into a developer's local stack rather than reporting another live status surface.
- Primary navigation uses collection names: **Overview**, **Ports**, **Stacks**,
  **Launchers**, and **Guide**. Singular language remains appropriate for one launcher,
  such as **Launcher details** or **Set up launcher**.
- The Guide must explain three progressively stronger integration paths:
  1. **Good — Built-in driver:** PortReeve Desktop invokes the user's existing stack
     commands and supplies resolved endpoint variables.
  2. **Better — Generated launcher:** PortReeve helps produce a separate project tool
     that can run without the desktop application, although that tool remains another
     integration artifact to maintain.
  3. **Best — Native integration:** the project's own service-management code calls the
     PortReeve server through the official client or common protocol.
- The durable boundary is: **PortReeve coordinates addresses; project tools coordinate
  work.**

## Settled content and presentation

- Lead with a short orientation and a responsive architecture explanation.
- Keep the project launcher central: it owns startup order, process or Compose actions,
  environment injection, health checks, secrets, failure recovery, and shutdown.
- Clarify that listener ownership confirmation is not an application-readiness claim.
- Group the detailed concepts into expandable native HTML disclosures so newcomers can
  scan the page and experienced users can inspect a topic.
- Keep the content local, offline, version-matched, keyboard accessible, and readable at
  the desktop's minimum width.
- Use semantic HTML and CSS rather than Mermaid or another runtime diagram dependency.
- Do not add a web-documentation link in this slice; it would add a navigation/trust
  decision without improving the offline explanation.

## Architecture content

- Interfaces: PortReeve Desktop, the `portreeve` CLI, the official JavaScript client,
  and a project launcher all communicate with one per-user PortReeve server.
- Authority: the server alone coordinates the SQLite registry and consults fresh host
  listener/process and Docker evidence.
- Project side: `portreeve.stack.json` describes topology and constraints; a trusted
  launcher acquires a coherent allocation, starts host processes or containers, binds
  and confirms endpoints, resolves dependencies, and optionally writes a reduced
  read-only sandbox snapshot.
- Supervision: launchd on macOS or `systemd --user` on Linux keeps the server running;
  it does not supervise project stacks.

## Detailed concepts to retain

- Acquire, bind, and confirm as a two-phase allocation flow.
- One independently runnable stack per root, containing components and named endpoints.
- Allocation generations keep a stack on one coherent endpoint plan; activations
  represent individual start attempts.
- Fresh `lsof` evidence is authority for host listeners; stored PIDs are context only.
- Docker confirmation uses container state, exact labels, and published-port evidence;
  PortReeve does not stop containers.
- Sandboxed consumers receive only an activation-scoped, read-only endpoint snapshot,
  never the control socket or mutation credentials.
- Desktop, CLI, and official JavaScript client share the same private HTTP/JSON
  Unix-domain socket contract.
- PortReeve is not a general process supervisor, Compose replacement, startup-order
  engine, secret manager, health system, reverse proxy, DNS server, or sandbox control
  plane.

## Rejected alternatives

- A live Guide tied to refresh state: duplicates Overview, Ports, and Stacks and creates
  unnecessary IPC/schema coupling.
- Mermaid at runtime: adds a dependency solely for one static explanation.
- A packaged diagram image with text: less responsive and accessible than semantic
  markup at the current minimum window width.
- Database-only explanatory content or server-fetched documentation: breaks the desired
  offline, release-matched behavior.

## Open questions

None block this slice.
