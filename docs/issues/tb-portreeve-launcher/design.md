# Design - tb-portreeve-launcher

**Status:** approved (gate passed 2026-08-08)

## Problem

PortReeve can define a local stack, prepare a coherent allocation generation, resolve endpoint addresses, and record fresh process and Docker evidence. It deliberately does not know how an individual project builds, starts, stops, restarts, or checks the health of its services. Those responsibilities belong to a project launcher such as the Yotta CLI, which understands dependency order, application environment, containers, credentials, health checks, and cleanup.

That boundary is correct but leaves an important usability gap. A new user can define ports in PortReeve yet still has no obvious bridge from those allocations to the commands that operate the stack. Requiring the user to write a fully PortReeve-aware JavaScript, Python, or shell launcher before receiving value creates too much initial friction and prematurely forces language and project-structure choices.

The Desktop application also lacks a global place to see which applied stacks are launchable, which commands will run, which allocated values will be injected, what command output occurred, and how project-reported status compares with PortReeve's independent evidence.

## Intent

Add a Launcher capability that lets users connect each applied stack to familiar project lifecycle commands through a fill-in-the-blanks Desktop and CLI experience.

The first useful experience should:

- suggest recognizable project commands without executing discovery code;
- inject current PortReeve endpoint facts through project-defined environment-variable names;
- run trusted Start, Stop, Restart, and Status shell commands;
- show command outcome and fresh listener evidence without overstating ownership;
- support multiple stack roots globally while retaining one launcher configuration per root;
- work through both macOS Desktop and a macOS/Linux CLI;
- provide a clear, observable upgrade from command-only operation to the complete verified activation protocol; and
- make underlying failures and partial outcomes visible.

PortReeve must remain the address, activation, and listener-evidence authority. The project launcher remains the orchestration authority and, when fully integrated, owns begin, lease renewal, provider confirmation, failure cleanup, and activation ending.

## Chosen shape

### One project-owned launcher per applied stack

Each canonical stack root may have exactly one launcher configuration in the first version:

```text
stack root/
  portreeve.stack.json
  portreeve.launcher.json
```

The shared parent directory establishes the relationship. The launcher file does not embed a database-generated stack ID. PortReeve may manage many stack roots and therefore many launchers globally, but focus modes or alternate operating profiles remain inside the invoked project launcher rather than becoming competing PortReeve launcher records.

Launcher execution requires an applied stack. An unapplied launcher file may be validated but not run. Stack pruning, uninstall, and Delete all data never delete either checked-in project file. Removing endpoint topology may invalidate a launcher mapping and block execution until the file is corrected.

### Project configuration and local state

`portreeve.launcher.json` is checked in, agent-visible, secret-free, and separate from the daemon's normalized stack definition. It records only execution configuration and endpoint-derived environment mappings. It never stores assigned port numbers, lease tokens, credentials, general application environment values, or raw command output.

An illustrative shape is:

```json
{
  "version": 1,
  "integration": { "mode": "command-only" },
  "shell": "system",
  "workingDirectory": ".",
  "operations": {
    "start": {
      "command": "npm run cli -- start",
      "mode": "finite",
      "timeoutSeconds": 300
    },
    "stop": {
      "command": "npm run cli -- stop",
      "timeoutSeconds": 120
    },
    "restart": {
      "command": "npm run cli -- restart",
      "timeoutSeconds": 420
    },
    "status": {
      "command": "npm run cli -- status",
      "timeoutSeconds": 30
    }
  },
  "environment": [
    {
      "name": "API_HTTP_PORT",
      "endpoint": "api.http",
      "value": "host-port"
    },
    {
      "name": "API_URL",
      "endpoint": "api.http",
      "value": "host-url",
      "scheme": "http"
    }
  ]
}
```

The exact schema is specification work. The design requires a versioned, strict, deterministic format capable of preserving the settled distinctions.

Per-user local state stores trusted launcher revisions and the last successfully resolved non-secret endpoint environment. It is not checked in. The daemon stores launcher-operation coordination and safe durable outcome metadata. Delete all data removes both categories of PortReeve-owned state.

### Command-only and verified-activation maturity

Every launcher explicitly declares one of two success contracts.

`command-only` is the default. Desktop or CLI prepares or reuses a valid allocation generation, derives the configured environment, and invokes the project command. Success and failure reporting combine the shell outcome with fresh listener observations, but PortReeve never calls the stack confirmed or adopts observed listeners.

`verified-activation` requires the project launcher to consume the supplied generation, begin its activation, renew pending leases, start and confirm providers, clean up failures, and end the activation after stopping providers. Exit zero without a matching confirmed or intentionally degraded activation is a failure.

If a command-only launcher successfully activates the exact supplied generation, the UI offers to upgrade its checked-in success contract. Downgrading remains possible only through an explicit editor warning and a newly trusted file revision.

This creates a visible path from experimentation to full ownership guarantees without making a language-specific scaffold an entry requirement.

### Shell and execution context

The default shell is the user's system login shell. Bash and Zsh are explicit alternatives. The resolved shell appears in review and trust UI; arbitrary custom shell executables are deferred.

All operations share one `workingDirectory`, expressed relative to the canonical stack root and defaulting to `.`. Canonical resolution, including symlinks, must remain inside that root. Trust review displays both configured and resolved paths.

Initial command sessions are non-interactive. Standard input is closed, no PTY is allocated, and bounded stdout and stderr stream to the caller. An internal command-session boundary must allow later replacement with xterm.js and node-pty without changing the launcher file.

### Lifecycle operations

The first schema exposes a fixed lifecycle surface:

- Start is required.
- Stop is required.
- Restart is optional.
- Status is optional.

Without Restart, the engine visibly composes Stop, allocation revalidation or preparation, and Start. Without Status, PortReeve evidence remains available without project-specific output. Arbitrary custom actions are deferred.

Finite Start is the default and must exit after initiating the stack. Its default timeout is five minutes. Stop defaults to two minutes, Restart to seven minutes, and Status to thirty seconds. These timeouts are editable.

Start may instead declare `attached` behavior. Attached Start has no timeout and retains one application-tied process group per stack while streaming bounded output. Status and Stop remain finite and may run alongside it. Attached Restart is always the composed Stop-then-Start flow; a custom Restart command is unavailable. Normal Desktop quit requires stopping attached stacks or cancelling quit. Persistent detachment and reattachment are not provided.

Timeout or cancellation gracefully terminates, and after a short grace period may force-terminate, only the exact command process group PortReeve created. It never automatically runs Stop. Fresh evidence is displayed and cleanup remains an explicit user action.

If an attached Start remains after Stop completes, Desktop offers explicit termination of that exact tracked process group. It does not infer or kill ownership from a port listener.

### Evidence-gated Start and project-command-only Stop

Before Start, PortReeve evaluates the current allocation and fresh listener evidence:

- With no expected listeners or conflicts, it prepares or reuses a generation and runs Start.
- A verified live activation disables Start.
- A fully observed command-only stack directs the user to Status or Restart.
- Non-conflicting partial observations preserve the current generation and permit an explicit Run Start Anyway repair attempt.
- Conflicting ownership evidence blocks Start and exposes inspection or separately authorized reclamation paths.

PortReeve never silently adopts listeners or prepares a replacement generation around an apparently running command-only stack.

Stop always invokes only the configured project command. It remains available even when no endpoint listener is visible because the project may need to clean containers, files, or other state PortReeve cannot observe. Afterward, fresh evidence classifies the outcome as stopped, partial, failed, or uncertain. Remaining listeners expose Run Stop Again, inspection, and existing separately authorized reclamation controls; Stop never escalates automatically into eviction.

Project Status output is advisory. PortReeve shows its exit status and bounded raw output beside fresh `lsof` and activation evidence, but never parses it into authoritative state. Disagreement is made visible.

### Endpoint-derived environment

The launcher inherits the user's ordinary shell environment and adds reserved PortReeve context plus selected endpoint-derived values. Automatic context includes the applicable stack root, stack ID, generation ID, activation ID when present, and socket location. User mappings may not use the `PORTREEVE_` prefix.

Setup suggests a host-port mapping for every endpoint:

- A default endpoint suggests `<COMPONENT>_PORT`.
- A named endpoint suggests `<COMPONENT>_<ENDPOINT>_PORT`.
- Names use uppercase ASCII with punctuation normalized to underscores.
- Collisions and invalid environment names are refused.

Users may rename or deselect a mapping and may add HTTP or HTTPS host URLs. Docker-backed endpoints additionally permit optional fixed container-port and Docker-network URL mappings derived from declared service and container-port facts. Docker mappings do not assert application health.

Assigned ports are resolved at operation time and previewed in the UI; they are never written into the launcher file. Arbitrary literal values, credentials, tokens, and general `.env` editing remain project concerns.

### Low-friction setup and command discovery

Desktop setup and `portreeve launcher init` inspect known manifest filenames only in the selected stack-contained working directory. Discovery never executes project code and never recursively scans child repositories.

The initial detectors cover unambiguous lifecycle scripts in `package.json`, exact lifecycle targets in a Makefile, and conventional Docker Compose commands. Every suggestion displays its provenance. Ambiguous or missing operations remain blank, suggestions remain editable, and users may begin with entirely blank fields.

The interactive CLI initializer locates the applied stack, collects the working directory, presents command and environment suggestions, asks for shell and Start behavior, previews exact JSON, atomically creates an absent file, and trusts it after confirmation. It refuses an existing file rather than becoming a terminal editor. Validate and trust commands support hand-edited files.

### Revision trust and editing

Executable configuration is trusted by canonical stack root and exact launcher-file content revision. Commands created or edited and explicitly saved through Desktop are trusted at that resulting revision. Newly discovered or externally changed files require review before any command, including Status, may run. Opening the Launcher tab never executes a command.

Trust review shows the resolved shell, resolved working directory, and complete commands. Desktop and CLI share per-user trust state. Interactive CLI use can review and trust. Non-interactive execution refuses an untrusted revision. The first release has no generic bypass and no option to establish trust non-interactively.

The editor uses exact-byte conflict detection and atomic writes. External modification or deletion invalidates trust and blocks ordinary save. Review, explicit Overwrite, or Cancel are the only conflict choices; there is no automatic merge or silent recreation.

Revision trust protects the visible launcher configuration only. It does not sandbox an unchanged command or establish trust in indirectly invoked project files, dependencies, shell profiles, or environments.

### Shared engine and daemon coordination

Configuration loading, trust verification, environment construction, command sessions, timeout handling, and evidence classification live in a shared launcher engine. Electron main and the CLI call this engine. The renderer receives only narrow, validated operations. The daemon never executes or inspects commands and never stores raw output.

The daemon does coordinate per-stack launcher-operation sessions so Desktop and independent CLI processes cannot race. Sessions identify the stack, operation, trusted launcher revision, caller operation ID, renewable deadline, and safe final outcome metadata.

Different roots may operate concurrently. Finite lifecycle mutations serialize per root. An attached Start allows its associated Status and Stop but refuses another Start or Restart. Client loss expires the coordination session, records it as lost, and triggers fresh evidence without adoption or killing.

This coordination requires a versioned protocol capability, strict request and response schemas, renewable deadlines, idempotent completion, and history integration. Route names and exact payloads remain specification work.

### Desktop Launcher tab

Launcher is a primary tab after Stacks. Its normal view is a stack-linked master-detail browser.

The list shows every applied stack with its root and launcher configuration, trust, operation, allocation, observation, and activation state. An applied stack without a launcher offers Set up launcher. Cross-links allow opening a stack in Launcher and returning to edit its stack definition.

The selected detail shows:

- a short explanation of PortReeve versus project-launcher responsibility;
- command-only or verified integration maturity and the upgrade path;
- exact stack and root association;
- prepared, observed, confirmed, conflicting, or degraded evidence;
- available lifecycle controls;
- current operation progress and cancel behavior;
- endpoint environment preview;
- current-session bounded output with Copy and Save output actions; and
- the most recent twenty safe launcher-operation records.

Set up or Edit opens a dedicated in-tab editor rather than a modal. Its sections are Execution, Commands, Endpoint environment, Advanced, and Review. Save and Trust atomically writes and trusts the resulting revision. External changes use the conflict flow above.

Failure presentation exposes the underlying available error code and message, failed step, exit or timeout state, current-session output, and fresh evidence. The same cross-cutting requirement applies to existing Desktop lifecycle failures so the earlier generic install-and-start error is not left unresolved.

### CLI surface

The initial CLI exposes the same semantics through commands equivalent to:

```text
portreeve launcher init
portreeve launcher validate
portreeve launcher trust
portreeve launcher start
portreeve launcher stop
portreeve launcher restart
portreeve launcher status
```

Commands discover the launcher from the current applied stack root by default and may accept an explicit root. Interactive trust is supported; non-interactive untrusted execution refuses. Attached Start blocks in the invoking CLI session and forwards cancellation to the exact tracked command group under the shared engine's policy.

### Output, history, and degraded recovery

Raw stdout and stderr are bounded and retained only for the current application or CLI session. Desktop keeps recent session output available while navigating, and offers explicit copy or save. PortReeve never automatically persists raw output or attempts unreliable secret redaction.

Durable safe metadata records operation and stack identity, launcher revision, allocation context, timestamps, duration, outcome, exit or timeout state, before and after evidence, degraded execution, and client loss. The Launcher detail shows the latest twenty records; broader filtering remains in existing history.

The shared engine caches the last successfully resolved non-secret endpoint environment per root and launcher revision. When the daemon is unavailable, Start and Restart refuse. Status may run with visibly stale cached context. Stop may run only after explicit degraded-mode confirmation. Local `lsof` observations remain labeled local, with no daemon coordination or server-side history. The UI prominently offers restoring the PortReeve service.

### Platform and upgrade boundaries

The first Desktop implementation targets macOS. The shared launcher engine and CLI execute on macOS and Linux. The checked-in schema remains platform-neutral where possible. Windows shell, path, process, permission, and Docker semantics are deferred rather than implied.

The first release explains the complete verified integration contract and links to official client and CLI documentation, but it does not generate language-specific source. JavaScript, Python, POSIX shell, framework templates, regeneration rules, and cross-language conformance are a separate follow-up initiative.

Embedded PTY support is likewise deferred. The intended later implementation uses a sandboxed terminal renderer such as xterm.js, a main-process PTY such as node-pty, and narrowly validated IPC without changing project launcher configuration.

## Alternatives considered

### Make PortReeve the project orchestrator

Rejected. PortReeve would need to absorb project-specific dependency order, containers, credentials, health checks, environment construction, focus modes, and cleanup. That duplicates mature project CLIs and weakens the current authority boundary.

### Require a generated language-specific launcher first

Rejected as the initial experience. It creates premature language and framework choices and raises the onboarding cost before a user sees value. Generators remain a follow-up after the integration contract is proven.

### Use a final curl callback

Rejected. Activation is not a terminal notification: begin must precede provider startup, leases may require renewal, providers confirm individually, and failures require cleanup. Searching command text for a callback would prove nothing and would not work through delegated scripts.

### Let Desktop or the daemon execute the complete activation transaction

Rejected. A generic stack-level command cannot reliably report every root process or container identity, especially when it backgrounds services. The daemon must not gain arbitrary command-execution authority. The project launcher owns the verified transaction.

### Automatically adopt whatever is listening on the assigned ports

Rejected. A fresh listener proves occupancy, not that the listener was started by the intended project command. Command-only observations remain explicitly unverified.

### Store launcher configuration only in PortReeve's database

Rejected. Project commands and mappings should be visible to developers, agents, and version control. Port assignments and runtime evidence remain local database state.

### Support multiple launcher profiles per stack

Rejected for the first version. Project focus and mode selection remain inside one launcher, preserving the one independently runnable stack per canonical root model.

### Parse arbitrary Status output

Rejected. Text parsing would be brittle and could incorrectly override fresh evidence. Structured status may be designed later as a separate contract.

### Persist all terminal output automatically

Rejected. Project commands may emit credentials or sensitive application data, and reliable redaction is not possible. Safe metadata is durable; raw output persistence requires explicit user action.

### Embed a terminal immediately

Rejected for the first release. A renderer widget alone is insufficient; native PTY packaging, IPC flow control, credentials, process lifecycle, and cross-platform behavior form a separate subsystem. The engine preserves a later upgrade seam.

### Claim first-release Windows support

Rejected. PowerShell and cmd semantics, Job Objects, permissions, path containment, and Windows Docker behavior require deliberate design and verification.

## Constraints

- PortReeve remains the source of durable allocation and activation state; fresh `lsof` and binding-appropriate Docker evidence remain live authority.
- The daemon coordinates launcher sessions but never executes or inspects project commands or raw output.
- Project launchers retain orchestration and verified activation ownership.
- Command-only operation must never be described as confirmed ownership.
- There is exactly one launcher file per applied canonical stack root in the first version.
- The working directory must resolve inside its canonical stack root.
- Launcher files are strict, versioned, deterministic, checked in, and free of assigned ports, tokens, secrets, and arbitrary literal environment values.
- Executable revisions require explicit trust; external change invalidates it.
- Renderer code remains sandboxed behind narrow, validated IPC.
- Start and Restart require a healthy daemon; degraded Stop and Status are explicit and visibly stale.
- Project files survive pruning, uninstall, and Delete all data.
- Initial commands are non-interactive; only attached Start may remain running.
- macOS and Linux share POSIX execution semantics; Windows is out of scope.
- Existing non-stack and non-launcher PortReeve clients remain unaffected.

## Open risks

- Command-only allocation still has an allocation-to-bind race and cannot prove that an observed listener belongs to the intended process. The UI must keep this limitation prominent.
- Trusting the launcher revision does not trust delegated project code. Users may overread the trust badge unless its scope is explained precisely.
- Login-shell startup files and desktop-launched environments vary across machines. Shell resolution and command-not-found diagnostics require careful runtime testing on macOS and Linux.
- An abnormal Desktop or CLI loss during attached Start may leave project processes alive without a reattachable command session. Recovery must fall back to evidence and explicit Stop.
- Degraded Stop uses a stale cached environment and lacks daemon locking. The confirmation must identify the snapshot age and limitations.
- Renewable launcher-operation coordination adds another client-loss and idempotency surface to the public protocol. Session expiry must never trigger command execution, process adoption, or killing.
- Conservative command discovery may miss valid project conventions. Missing suggestions must remain a normal blank state rather than an error.
- Bounded session-only output may remove the earliest portion of a large failure and disappears on application restart. The cap and Save output affordance need clear behavior.
- Attached Start, operation concurrency, and external launcher edits can interact. An active session must retain an immutable trusted execution snapshot even if a new file revision appears.
- Adding a fourth primary tab and a substantial editor risks crowding the current Desktop layout. The master-detail and dedicated-editor states require focused usability testing.
- The existing generic lifecycle failure presentation must be fixed alongside the new operation-result model rather than lost in Launcher scope.

## Changes

None. The original design was approved on 2026-08-08; subsequent amendments must be recorded in this section.
