# PortReeve Desktop updates

PortReeve Desktop performs notification-only update discovery. At application
launch, the Electron main process may fetch this fixed manifest URL:

```text
https://raw.githubusercontent.com/TrentBrown/portreeve/main/distribution/desktop-update.json
```

The request contains no installation identifier, project data, analytics, or
dynamic query parameters. A valid cached attempt suppresses another request for
24 hours. Network, HTTP, size, JSON, and schema failures are reduced to an
unavailable update state and do not delay or disable local management.

## Manifest contract

The document is strict JSON:

```json
{
  "schemaVersion": 1,
  "desktopVersion": "0.1.0"
}
```

`desktopVersion` is the latest published PortReeve Desktop semantic version.
The manifest supplies no executable or navigation URL. When a newer version is
available, the application can open only the compile-time approved page:

```text
https://github.com/TrentBrown/portreeve/releases
```

The first release remains manual: update discovery never downloads, installs,
restarts, or replaces the desktop application or managed PortReeve service.
Publishing automation must update the manifest only after the corresponding
signed and notarized desktop artifacts are available from the Releases page.
