# PortReeve Desktop engineering slice

For the operator-facing behavior and security boundary, see the public
[`docs/desktop.md`](../../docs/desktop.md) guide.

This private workspace contains the non-shipping Electron MVP for PortReeve Desktop. It
displays lifecycle evidence from an exact PortReeve CLI executable, global inventory and
stack coordination evidence from the official JavaScript client, and confirmed
lifecycle/reset workflows through a narrow named preload API. The CLI and server remain
the authorities for every mutation and all filesystem deletion safety.

The Stacks tab can create or edit `portreeve.stack.json` through structured fields and
an opaque main-process document session, reopen a registered stack with **Edit
Definition**, retain manual file-based apply, prepare allocations, reconcile or end
existing activations, preview discovery documents, copy resolved addresses, and
preview-confirm stale-stack pruning. It never starts or stops project processes, invokes
Docker Compose, stops containers, or handles lease credentials; those responsibilities
remain with each trusted project launcher.

The MCP tab generates generic stdio, Codex, and Claude Code setup previews through a
strict main-process adapter. It defaults to the stable managed executable path, offers
an explicit PATH-dependent portable form, reports daemon compatibility, and copies
configuration or registration commands. The renderer cannot supply executable paths,
write third-party settings, launch agent hosts, or execute project commands.

Update discovery is separately notification-only. The main process checks the strict
fixed manifest documented in [`docs/desktop-updates.md`](../../docs/desktop-updates.md)
at most once per 24 hours, persists only the reduced check result under the desktop
user-data root, and never lets network data or renderer arguments choose an external
URL. A failed or slow check cannot delay local lifecycle or port management.

## Local prerequisites

Use the repository-pinned Bun version and build the local `0.1.0` release candidate
before starting or packaging the application:

```sh
bun run release:build
bun run desktop:start
```

Create an unsigned local macOS application bundle with:

```sh
bun run desktop:package
```

For interactive DOM-level UI inspection, launch the development-only Playwright harness:

```sh
bun run desktop:inspect
```

The harness builds the local release candidate, launches an unpackaged Desktop app with
an isolated temporary user-data profile, and presents the real renderer in a normal
window. Option-click any element to outline it and record its selector, text,
attributes, box, and selected computed styles without activating it. The terminal also
accepts `snapshot`, `selected`, `select <selector>`, `inspect <selector>`,
`click <selector>`, `hover <selector>`, `screenshot`, `reload`, and `quit`. Inspector
output is written beneath the operating system temporary directory and Playwright is not
included in packaged Desktop artifacts.

Only Electron caches and Desktop preferences are isolated. The inspector still connects
to the current per-user PortReeve service, so ordinary clicks can perform real actions.
Use Option-click when identifying an element without activating it.

Rerun `release:build` before every package used for runtime verification. Packaging
consumes and verifies the existing `dist/release` candidate but intentionally does not
rebuild it; an old candidate may share the same development version while speaking an
older internal contract.

The packaging script selects the host's physical ARM64 or x64 architecture, verifies the
candidate filename and SHA-256 digest against `dist/release/manifest.json`, and copies
those exact bytes into the bundle.

## Distribution boundary

The local release candidate is explicitly labeled **not for distribution**. It does not
satisfy the published-artifact, signing, notarization, or native release evidence
required for a public desktop release. That later release slice must consume the
matching published CLI artifact and configure npm Trusted Publishing for subsequent
JavaScript-client releases.
