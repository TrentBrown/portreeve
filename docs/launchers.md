# Project launchers

PortReeve Launcher connects one applied stack's current endpoint allocation to the
project's own lifecycle commands. PortReeve chooses and coordinates addresses, injects
the current nonsecret values, runs an explicitly trusted command, and reports fresh
listener or activation evidence. The project launcher still owns dependency ordering,
containers, credentials, application health, focus modes, and cleanup.

Launcher is intentionally not a general orchestrator. The daemon never receives or
executes project commands, raw command output, environment values, credentials, or
process authority. Desktop and CLI execute through the same application-local engine
and coordinate only bounded safe operation metadata through the daemon.

## One stack, one companion launcher

The canonical stack root contains both project-owned files:

```text
stack root/
  portreeve.stack.json
  portreeve.launcher.json
```

There is one launcher per applied canonical stack root. The launcher file does not
contain a database stack ID; the shared parent directory is the association. It may be
checked in and inspected by development agents. An unapplied launcher can be validated,
but no lifecycle command can run until its sibling stack definition is applied.

Pruning, normal uninstall, and **Delete all data** never delete either project file.
Delete all data does remove PortReeve-owned exact-revision trust, cached endpoint
context, active coordination, and safe launcher history.

## Version 1 file schema

The JSON document is strict: unknown fields, invalid references, duplicate environment
names, unsafe paths, and contradictory execution choices are refused. Canonical output
uses two-space indentation, a final newline, deterministic key order, and explicit
normalized defaults.

```json
{
  "environment": [
    {
      "endpoint": {
        "component": "api",
        "endpoint": "http"
      },
      "name": "API_HTTP_PORT",
      "value": "host-port"
    },
    {
      "endpoint": {
        "component": "api",
        "endpoint": "http"
      },
      "name": "API_URL",
      "scheme": "http",
      "value": "host-url"
    }
  ],
  "integration": {
    "mode": "command-only"
  },
  "operations": {
    "start": {
      "command": "npm run stack:start",
      "mode": "finite",
      "timeoutSeconds": 300
    },
    "status": {
      "command": "npm run stack:status",
      "timeoutSeconds": 30
    },
    "stop": {
      "command": "npm run stack:stop",
      "timeoutSeconds": 120
    }
  },
  "shell": "system",
  "version": 1,
  "workingDirectory": "."
}
```

| Field | Contract |
| --- | --- |
| `version` | Required literal `1`. |
| `integration.mode` | `command-only` by default or `verified-activation`. |
| `shell` | `system`, `bash`, or `zsh`; defaults to `system`. Arbitrary executables are not accepted. |
| `workingDirectory` | Relative to the canonical stack root and defaults to `.`. Its real path, including symlinks, must remain inside that root. |
| `operations.start` | Required command. `mode` is `finite` by default or `attached`. Finite timeout defaults to 300 seconds. Attached Start cannot declare a timeout. |
| `operations.stop` | Required finite command. Timeout defaults to 120 seconds. |
| `operations.restart` | Optional finite command with a 420-second default. When absent, Restart composes Stop, fresh allocation revalidation or preparation, and Start. It is forbidden with attached Start because attached Restart is always composed. |
| `operations.status` | Optional advisory command with a 30-second default. PortReeve evidence remains available when it is absent. |
| `environment` | Endpoint-derived mappings only. It defaults to an empty list and never contains resolved values. |

Commands may be up to 65,536 characters and timeouts must be whole seconds from 1
through 86,400. All operations run through the selected login shell with standard input
closed and no PTY.

The file never stores assigned ports, lease tokens, activation credentials, arbitrary
environment literals, general secrets, raw command output, or process identifiers.

## Assisted setup

Desktop's Launcher editor and `portreeve launcher init` can inspect supported manifest
filenames in the exact selected working directory. Discovery does not execute project
code and does not recurse into child directories or repositories. It recognizes
unambiguous lifecycle scripts in `package.json`, exact Makefile targets, and conventional
Docker Compose operations. Every suggestion includes its source filename; ambiguous
operations remain blank.

Desktop presents editable fields, endpoint environment suggestions, basename
provenance, and an exact JSON review. **Save and Trust** creates an absent file
exclusively or replaces only the exact bytes observed when editing began. An external
change offers Review, explicit Overwrite, or Cancel.

CLI setup follows the same model:

```sh
portreeve launcher init
portreeve launcher validate
portreeve launcher trust
```

`init` is interactive and refuses an existing file. `validate` checks the local schema,
stack topology, canonical form, applied state, and trust state without modifying the
file or trust. `trust` interactively reviews the resolved shell, working directory,
complete commands, and exact revision. There is no noninteractive trust bypass.

## Exact-revision trust

Trust binds the canonical stack root to the SHA-256 revision of the exact launcher file
bytes. A missing, invalid, unapplied, untrusted, or externally changed file cannot run
even Status. Desktop and CLI share the same private per-user trust state.

Opening Launcher never executes a command. A changed trusted file must be reviewed and
trusted again. Downgrading from `verified-activation` to `command-only` also requires an
explicit warning and confirmation before the resulting new revision can be saved and
trusted.

This boundary protects visible launcher configuration; it is not a sandbox. An
unchanged trusted command can still invoke changed scripts, dependencies, shell profile
logic, or inherited environment. Keep the checked-in command narrow and retain ordinary
project code review and dependency controls.

## Endpoint environment contract

Immediately before each operation, PortReeve resolves one immutable allocation
generation and adds reserved context to the user's inherited shell environment:

| Variable | Meaning |
| --- | --- |
| `PORTREEVE_STACK_ROOT` | Canonical root associated with this launcher. |
| `PORTREEVE_STACK_ID` | Applied stack identity for the current operation. |
| `PORTREEVE_GENERATION_ID` | Exact allocation generation supplied to the project command. |
| `PORTREEVE_SOCKET` | PortReeve's private Unix-socket location. |
| `PORTREEVE_ACTIVATION_ID` | Present when the operation has an applicable activation. |

User-defined mappings cannot begin with `PORTREEVE_`. Names must be valid environment
identifiers and unique. Setup suggests `<COMPONENT>_PORT` for a default endpoint and
`<COMPONENT>_<ENDPOINT>_PORT` for a named endpoint, with punctuation normalized to
uppercase underscores.

Each mapping names a component and endpoint from `portreeve.stack.json` and selects one
derived value:

- `host-port` requires a published endpoint;
- `host-url` requires a published endpoint plus `http` or `https`;
- `container-port` requires Docker component and endpoint facts; or
- `docker-network-url` requires Docker facts plus `http` or `https`.

The Desktop preview is nonsecret and reflects the current reduced stack facts. Actual
values are resolved again immediately before execution. Changing a durable port
assignment therefore needs no launcher-file edit or new trust revision.

## Command-only lifecycle

`command-only` is the default low-friction integration. PortReeve prepares or reuses a
valid generation, injects the environment, runs the trusted project command, and then
classifies fresh evidence. Command exit zero never proves ownership and PortReeve never
adopts listeners merely because their ports match.

Start follows the evidence state:

- no expected listeners or conflicts: prepare or reuse a generation and run Start;
- verified active generation: Start is disabled;
- fully observed command-only stack: use Status or Restart instead;
- partial nonconflicting evidence: preserve the generation and require explicit **Run
  Start Anyway** or `--run-start-anyway`; and
- conflicting or uncertain ownership: block Start.

Stop always runs only the configured project Stop command. It never silently kills a
listener, evicts a claim, stops Docker, or escalates into reclamation. Remaining evidence
is reported separately. Project Status output and exit code are advisory beside fresh
PortReeve evidence and are never parsed into authoritative state.

Run from the stack root or a child directory:

```sh
portreeve launcher start
portreeve launcher status
portreeve launcher restart
portreeve launcher stop
```

Use `--stack-root <path>` when automatic selection would be ambiguous. The `--json`
contract is documented in [CLI automation](cli-contract.md).

## Verified activation checklist

Use `verified-activation` after the project launcher can own the complete activation
transaction for the supplied `PORTREEVE_GENERATION_ID`:

1. Begin the exact generation and choose each process or Docker binding.
2. Store returned lease credentials only in private mode-`0600` runtime files; never put
   tokens in arguments, logs, project files, or PortReeve launcher output.
3. Renew every pending lease before its deadline while providers start.
4. Start processes or containers on the returned allocations. Docker providers must use
   every exact returned label and loopback publication.
5. Confirm each process with its live root PID or each container with its exact container
   ID. Abandon or skip failed endpoints as the stack definition permits.
6. Treat a matching confirmed or intentionally degraded activation as success. Exit zero
   without that matching current-generation evidence is failure.
7. On shutdown, stop project providers first, reconcile uncertain evidence, and request
   activation end only after fresh evidence proves they are gone.

The detailed activation commands and credential-file rules are in
[CLI automation](cli-contract.md); official JavaScript methods are in
[JavaScript client](client.md). If command-only execution already produces matching
activation evidence, Desktop reports an upgrade suggestion but never edits the file
silently.

## Attached Start and concurrency

Finite Start exits after initiating the stack. Attached Start instead has no timeout and
keeps one noninteractive application-owned process group running while bounded stdout
and stderr stream. It does not detach or survive the invoking Desktop or CLI process.
Status and Stop may run alongside it. Restart always composes finite Stop and attached
Start.

Desktop blocks normal quit while it owns an attached operation. The user must stop the
stack, explicitly terminate the exact process group created by that Desktop session, or
cancel quit. No PID is persisted for later adoption or inferred from a listener.

The daemon's renewable per-stack sessions serialize incompatible mutations across
Desktop and independent CLI processes. An attached Start admits its associated Status
and Stop, while another Start or Restart is refused. Different canonical stack roots
remain concurrent. Caller loss expires to a safe `lost` record; it does not make another
application adopt or signal the orphaned process.

## Degraded recovery

The shared local state caches only the last successfully resolved nonsecret environment,
the applied stack snapshot, generation context, and launcher revision. During a daemon
outage:

- Start and Restart refuse because no current allocation or coordination can be proven;
- Status may run from an exact-root, exact-revision cache and labels its environment and
  local `lsof` evidence stale and uncoordinated;
- Stop requires explicit **Run degraded Stop** or `--allow-degraded`; and
- no daemon-side operation history is written.

Restore PortReeve whenever possible. Degraded Stop is an escape hatch for project-owned
cleanup, not evidence of confirmed ownership.

## Output and history retention

Raw stdout and stderr are bounded and remain only in the current Desktop or CLI session.
Desktop supports Copy and an explicit user-selected Save action; PortReeve never
automatically persists raw output or attempts unreliable secret redaction.

The daemon retains at most the latest twenty safe launcher-operation records per stack.
They include operation, caller surface, launcher revision, allocation context, timing,
outcome, exit or signal, degraded or lost state, integration assessment, and reduced
before/after evidence. They exclude commands, environment values, credentials, process
identifiers, and raw output. Broader audit events remain available through
`portreeve history`.

## Platform and deferred scope

PortReeve Desktop Launcher targets macOS. The shared launcher engine and CLI target
macOS and Linux with POSIX login shells, process groups, permissions, paths, signals,
`lsof`, and optional Docker evidence. Windows PowerShell, cmd.exe, Job Objects, Windows
paths and permissions, and Windows-specific Docker behavior are not supported by this
release.

The first release also excludes interactive PTYs, detached supervision, reattachment,
arbitrary custom actions, general environment literals, persisted raw logs, and
language-specific launcher generation. Project launchers may be written in any language
that can consume the environment and CLI or JavaScript client contracts; PortReeve does
not prescribe or generate that implementation yet.

See the [mixed process and Docker example](../examples/mixed-stack/README.md),
[Desktop application](desktop.md), [migration guide](migration.md), and
[troubleshooting](troubleshooting.md) for the surrounding workflows.
