# Portreeve Desktop engineering slice

This private workspace contains the non-shipping Electron MVP for Portreeve Desktop. It
displays lifecycle evidence from an exact Portreeve CLI executable, global inventory and
stack coordination evidence from the official JavaScript client, and confirmed
lifecycle/reset workflows through a narrow named preload API. The CLI and server remain
the authorities for every mutation and all filesystem deletion safety.

The Stacks tab can apply a checked-in `portreeve.stack.json` through a main-process file
picker, prepare allocations, reconcile or end existing activations, preview discovery
documents, copy resolved addresses, and preview-confirm stale-stack pruning. It never
starts or stops project processes, invokes Docker Compose, stops containers, or handles
lease credentials; those responsibilities remain with each trusted project launcher.

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

The packaging script selects the host's physical ARM64 or x64 architecture, verifies the
candidate filename and SHA-256 digest against `dist/release/manifest.json`, and copies
those exact bytes into the bundle.

## Distribution boundary

The local release candidate is explicitly labeled **not for distribution**. It does not
satisfy the published-artifact, signing, notarization, or native release evidence
required for a public desktop release. That later release slice must consume the
matching published CLI artifact and configure npm Trusted Publishing for subsequent
JavaScript-client releases.
