# Desktop application

Portreeve Desktop is the graphical inspection and coordination surface for the same
per-user Portreeve installation managed by the CLI. It does not install a second server,
keep a separate registry, or bypass the HTTP/JSON Unix-socket protocol. The application
bundles a verified CLI artifact and can install that artifact into the one managed
per-user location used by native supervision.

## Overview and lifecycle

The Overview tab reports the desktop, bundled CLI, managed CLI, running-server,
supervisor, and socket layers independently. Lifecycle actions invoke an exact bundled
or managed executable from the Electron main process; the renderer cannot choose an
executable, run a shell command, or search `PATH`.

Available actions follow current evidence:

- install and start the managed Portreeve service;
- start, stop, or restart native per-user supervision;
- stop an explicitly manual `portreeve serve` process without adopting it;
- upgrade the managed CLI after version and artifact verification;
- uninstall supervision while retaining Portreeve data;
- preview and confirm a complete Portreeve data reset.

Install, reset, and upgrade decisions remain explicit. Update discovery only reports a
new desktop release and opens one fixed project download page after confirmation; it
does not download or install updates automatically.

Lifecycle operations display a stable outcome plus safe structured error codes and
messages. For example, an unsafe supervisor log mode is shown as an actionable
permission failure rather than only `internal`. Unstructured errors are generalized so
arbitrary exception detail does not become renderer content.

## Ports

The Ports tab uses the official JavaScript client to show global claimed and unclaimed
TCP listeners. The main process reduces inventory before publishing it to the renderer.
Claims show project, component, endpoint, worktree basename, mode, and timing; listeners
show reduced ownership and process evidence. Lease tokens, internal database fields, and
arbitrary executable paths are not exposed.

## Stacks

The Stacks tab reads definitions and current generation, activation, resolution, and
fresh provider evidence through the official client. It supports:

- selecting and applying a checked-in `portreeve.stack.json` through the native file
  picker;
- preparing or reusing one complete allocation generation;
- inspecting components, endpoints, dependencies, placements, host addresses,
  Docker-network addresses, and provider evidence;
- copying individual addresses and previewing a component-scoped sandbox discovery
  document for a launcher-supplied gateway;
- explicitly reconciling provider evidence after launcher loss;
- requesting evidence-gated activation ending after the project launcher stops its
  providers;
- previewing seven-day missing-stack-root pruning and typing `PRUNE` before
execution.

The desktop's stack editor uses a fixed `portreeve.stack.json` at the selected or
registered stack root. Directory selection, file inspection, schema validation, and
writes remain in the trusted main process. The renderer receives an opaque document ID,
the editable definition, a root display name, and reduced validation issues; it does not
receive the full path or file fingerprint. Missing files are created exclusively, and
existing regular files are replaced atomically only after the exact bytes observed when
the editor opened are rechecked.

If another program changes the file, Portreeve offers Overwrite or Cancel. Overwrite is
authorized by a one-use conflict capability bound to the newly observed bytes; a second
external change requires another confirmation. Malformed regular files can be replaced
after confirmation, but oversized files, symbolic links, and other non-regular
definition paths are refused. Saving precedes server apply, so a valid file remains
saved if the daemon is unavailable and can be applied later with an explicit retry.
Editing never prepares a stack generation automatically.

Portreeve Desktop never starts or stops a project process or container, invokes Docker
Compose, owns application startup order, maps project environment variables, or asserts
application health. Those remain responsibilities of the project launcher. Stale stack
evidence remains visible for diagnosis but withholds stack mutation controls until
current evidence returns; the server revalidates every requested action as final
authority.

## Trust and data boundary

Electron runs a sandboxed renderer with context isolation, Node integration disabled,
and a restrictive local content policy. The preload exposes only named, schema-validated
capabilities. The main process accepts IPC only from the primary `app://portreeve`
renderer frame and owns the native file picker, clipboard write, fixed download-page
navigation, exact CLI execution, and official client connection.

The desktop receives no general filesystem, shell, network-navigation, SQLite, Docker,
or Portreeve-socket capability. Stack view models omit full stack-root paths, claim and
lease identifiers, run identifiers, Docker labels, and credentials. Discovery previews
contain only their documented component-scoped address contract.

## Local package

Build and open an unsigned local macOS application bundle with the repository-pinned Bun
toolchain:

```sh
PORTREEVE_HOMEPAGE_URL=https://github.com/TrentBrown/portreeve \
PORTREEVE_RELEASE_BASE_URL=https://github.com/TrentBrown/portreeve/releases/download \
bun run release:build

bun run desktop:package
open dist/desktop/Portreeve-darwin-arm64/Portreeve.app
```

The packaging script selects the physical host architecture and verifies the bundled
CLI against the generated release manifest and SHA-256 digest. This local bundle is a
release candidate for manual verification, not a signed or notarized public desktop
distribution.
