# Portreeve Desktop engineering slice

This private workspace contains the non-shipping, read-only Electron slice for Portreeve
Desktop. It displays lifecycle evidence from an exact Portreeve CLI executable and
global inventory from the official JavaScript client. It does not expose lifecycle
mutations.

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
