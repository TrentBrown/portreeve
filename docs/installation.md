# Install and remove PortReeve

> **Alpha Preview**
>
> PortReeve is evolving quickly and may make breaking changes. The current public alpha
> preview is available on
> [GitHub Releases](https://github.com/TrentBrown/portreeve/releases), and its macOS
> application is unsigned until Apple Developer ID signing and notarization are
> configured. Product maturity (`alpha`), release channel (`preview`), and macOS trust
> (`unsigned`) are separate facts.

Use [GitHub Releases](https://github.com/TrentBrown/portreeve/releases) to identify the
newest preview and verify its assets. The commands below install the currently published
Homebrew, DMG, and direct-download artifacts.

## Choose an installation path

| Need | Recommended path | What it installs |
| --- | --- | --- |
| macOS graphical application | Homebrew cask | `PortReeve.app`; service setup remains explicit in Desktop |
| macOS graphical application without Homebrew | Architecture-specific DMG | `PortReeve.app`; service setup remains explicit in Desktop |
| macOS or Linux terminal/MCP use | Homebrew formula on macOS or direct CLI download | One standalone `portreeve` executable |
| Contributor development or an unreleased change | Source build | Local development CLI and Desktop |

There is one PortReeve installation and one per-user registry. Desktop, CLI, MCP, and
the JavaScript client are peer clients of the same server; installing Desktop does not
create a second authority.

## Homebrew on macOS

If Homebrew is not installed, follow [Homebrew's maintained installation
instructions](https://docs.brew.sh/Installation). Review Homebrew's installer and its
requested filesystem changes before running it.

Add the personal tap, review the requested artifact, and trust only the formula or cask
you intend to install. Current Homebrew releases require explicit trust for third-party
taps and otherwise refuse to load PortReeve. Specific-artifact trust is narrower than
trusting every current and future artifact in the tap.

```sh
brew tap TrentBrown/portreeve

# Graphical application
brew trust --cask trentbrown/portreeve/portreeve-app
brew install --cask trentbrown/portreeve/portreeve-app

# Standalone CLI and MCP bridge
brew trust --formula trentbrown/portreeve/portreeve
brew install trentbrown/portreeve/portreeve
```

The cask moves `PortReeve.app` into Applications. The formula installs the CLI. Neither
one silently installs or starts the PortReeve supervised service, and neither one
deletes PortReeve data during routine uninstall. See Homebrew's
[Tap Trust](https://docs.brew.sh/Tap-Trust) documentation before choosing broader
whole-tap trust.

## Direct macOS DMG

GitHub Releases provides separate images:

- `PortReeve-VERSION-macos-arm64.dmg` for Apple Silicon;
- `PortReeve-VERSION-macos-x64.dmg` for Intel Macs.

Download the matching DMG and `SHA256SUMS-DISTRIBUTION` from the
[GitHub Releases page](https://github.com/TrentBrown/portreeve/releases),
compare the recorded checksum, open the DMG, and drag **PortReeve** to Applications. The
DMG installs no daemon and runs no package script.

```sh
shasum -a 256 PortReeve-VERSION-macos-ARCH.dmg
```

Compare the complete output with the corresponding line in the downloaded checksum
file. Do not continue when the values differ.

## Opening an unsigned preview safely

Try to open PortReeve normally first. An unsigned preview may be blocked because Apple
cannot verify a Developer ID signature or notarization ticket. Only continue when the
DMG came from the PortReeve GitHub Release and its SHA-256 matches the release checksum.

If macOS blocks it:

1. Attempt to open **PortReeve** once and dismiss the warning.
2. Open **System Settings**, then **Privacy & Security**.
3. Scroll to **Security** and choose **Open Anyway** for PortReeve.
4. Authenticate if macOS asks, review the warning again, and choose **Open**.

Apple describes this scoped exception in [Open apps safely on your
Mac](https://support.apple.com/102445). The exception applies to that application. This
guide intentionally does not disable Gatekeeper, change system-wide security policy, or
remove quarantine attributes with a shell command.

## Start the PortReeve service explicitly

Opening Desktop does not start a hidden installer. In Desktop, open **Service**, inspect
the bundled and managed versions, and choose **Install and Start PortReeve**. This
installs the verified bundled CLI into PortReeve's managed per-user location and creates
normal `launchd` supervision. Root access is not required.

With the standalone CLI, the equivalent explicit sequence is:

```sh
portreeve install
portreeve start
portreeve status --json
```

For a temporary trial with no supervisor registration, run `portreeve serve` in a
terminal and leave it in the foreground until you press Control-C.

## Direct CLI downloads on macOS and Linux

Preview releases include four self-contained executables and `SHA256SUMS`:

| Operating system | Architecture | Artifact suffix |
| --- | --- | --- |
| macOS | Apple Silicon ARM64 | `macos-arm64` |
| macOS | Intel x64 | `macos-x64` |
| Linux glibc | ARM64 | `linux-arm64` |
| Linux glibc | x64 | `linux-x64` |

Verify the download before making it executable:

```sh
shasum -a 256 portreeve-vVERSION-OS-ARCH
chmod 755 portreeve-vVERSION-OS-ARCH
./portreeve-vVERSION-OS-ARCH --version
```

Compare the complete digest with that artifact's line in `SHA256SUMS`. On Linux,
`sha256sum portreeve-vVERSION-OS-ARCH` is equivalent. Linux has no Desktop application;
the CLI, MCP bridge, and JavaScript client are the supported surfaces. `portreeve
install` uses `systemd --user` when a per-user manager is available.

## Routine uninstall preserves data

Remove supervision before removing the application or CLI:

- In Desktop **Service**, choose **Uninstall service**; or
- run `portreeve uninstall`.

This removes the per-user `launchd` or `systemd --user` definition while preserving
claims, history, settings, and the owned data directory. Then remove the installed
artifact:

```sh
brew uninstall --cask portreeve-app
brew uninstall portreeve
```

For a direct DMG installation, move `PortReeve.app` from Applications to Trash. Removing
the app does not imply permission to remove service data.

## Complete reset is a separate confirmed operation

Use complete reset only when preserved assignments and history are intentionally no
longer wanted. Keep Desktop or the CLI available until the reset finishes.

In Desktop **Service**, expand **Uninstall or reset PortReeve**, choose **Preview
complete reset**, inspect every path, and type `DELETE` to confirm.

The CLI keeps preview and execution separate:

```sh
portreeve purge --dry-run --json
portreeve purge --confirm PREVIEW_TOKEN --json
```

Purge revalidates PortReeve's ownership marker and refuses broad or unsafe paths. After
it succeeds, remove the cask, formula, direct application, or downloaded executable as
appropriate.

## Build from source

Before the first public preview, macOS users can build the current source with the
pinned Bun 1.3.14 toolchain:

```sh
git clone https://github.com/TrentBrown/portreeve.git
cd portreeve
bun install --frozen-lockfile
bun run build

PORTREEVE_DESKTOP_CLI_PATH="$PWD/dist/portreeve" bun run desktop:start
```

Run `bun run check` before treating a source build as a release candidate. Maintainers
should use the deterministic [release operator runbook](releasing.md), not the legacy
individual build commands, for release preparation.
