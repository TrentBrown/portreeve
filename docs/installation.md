# Installation and release channels

GitHub Release executables and their `SHA256SUMS` file are the authoritative
Portreeve distribution artifacts. They are self-contained and require neither
Node.js nor Bun. V1 publishes:

| Operating system | Architecture | Artifact suffix |
|---|---|---|
| macOS | Apple Silicon ARM64 | `macos-arm64` |
| macOS | Intel x64 | `macos-x64` |
| Linux glibc | ARM64 | `linux-arm64` |
| Linux glibc | x64 | `linux-x64` |

Download the matching executable and verify it before making it executable:

```sh
shasum -a 256 -c SHA256SUMS
chmod 755 portreeve-vVERSION-OS-ARCH
./portreeve-vVERSION-OS-ARCH --version
```

On Linux, `sha256sum -c SHA256SUMS` is equivalent.

## Homebrew

The release includes a versioned `portreeve.rb` formula whose URLs and
checksums point to the same authoritative executables:

```sh
brew install ./portreeve.rb
portreeve --version
```

Installing the CLI does not install login supervision. Run `portreeve install`
explicitly to place a managed copy behind launchd or `systemd --user`, then
run `portreeve start`.

## npm client

The separately versioned protocol client is:

```sh
npm install portreeve
```

It does not contain or install the server executable.

## Building a release

The repository pins Bun 1.3.14. Supply the repository and release locations,
then build all four executables, the npm tarball, checksums, manifest, and
Homebrew formula:

```sh
PORTREEVE_HOMEPAGE_URL="https://github.com/TrentBrown/portreeve" \
PORTREEVE_RELEASE_BASE_URL="https://github.com/TrentBrown/portreeve/releases/download" \
bun run release:build

bun run release:verify -- --native --lifecycle
bun run release:verify -- --homebrew
```

`release:verify -- --native` verifies every artifact's checksum and executable
header, validates the formula syntax, and actually runs the artifact matching
the current machine. Adding `--lifecycle` uses a unique temporary native
service to verify inactive installation, start, active upgrade, restart, stop,
uninstall, data preservation, and cleanup.

Every advertised OS/architecture combination must pass the complete source
gate and both native release smokes before publication. Cross-compilation alone
is not release evidence. Native jobs require Node.js 22, Bun 1.3.14, Git,
`lsof`, `ps`, Ruby, and a non-root login session. Linux runners must provide a
working `systemd --user` manager; the Linux ARM64 job is selected with the
`self-hosted`, `linux`, `ARM64`, and `portreeve-release` labels.

Development may occur while the GitHub repository is private, and branch or
manual Actions runs still work. Before pushing a release tag, make the
repository public: GitHub release assets in a private repository require
authentication and therefore cannot serve as public Homebrew download URLs.
The release workflow refuses tag publication while repository visibility is
private.

On macOS, the explicit `--homebrew` smoke refuses to disturb an existing
Portreeve formula, installs a temporary checksum-pinned local formula, runs its
executable, and uninstalls it.
