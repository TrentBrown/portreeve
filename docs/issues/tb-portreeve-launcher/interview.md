# Design Interview: tb-portreeve-launcher

## D1 — Responsibility boundary

**Question:** Should PortReeve become the stack orchestrator, or should its built-in launcher invoke project-owned orchestration commands?

**Answer:** The built-in launcher should be a project-command adapter. The project launcher remains responsible for dependency ordering, processes, containers, environment construction, health checks, and the PortReeve activation transaction.

**Decision:** PortReeve Desktop will configure, invoke, and observe project-owned launcher commands without duplicating their orchestration logic.

## D2 — Configuration ownership

**Question:** Where should launcher commands be stored, and how should a launcher be associated with a stack?

**Answer:** Use a checked-in `portreeve.launcher.json` companion file at the same canonical stack root as `portreeve.stack.json`. The shared parent directory establishes the relationship; do not persist a database-generated stack ID in the file.

**Decision:** Launcher configuration is project-visible, agent-visible, secret-free, and separate from the daemon's stack topology protocol and database.

## D3 — Launcher cardinality

**Question:** Should a stack support multiple launcher profiles, or exactly one launcher configuration while project-specific focus and mode selection remains inside the invoked launcher?

**Answer:** Exactly one launcher configuration per applied stack root. PortReeve may manage many stacks globally, and therefore many stack-linked launchers, but it will not introduce competing launcher profiles for one stack in the first version.

**Decision:** The Launcher tab uses a one-to-one stack-to-launcher model. Project-specific modes remain the responsibility of the invoked project launcher.

## D4 — Activation ownership

**Question:** Should PortReeve Desktop own activation begin, renewal, provider confirmation, failure cleanup, and ending, or should the invoked project launcher own that complete transaction?

**Answer:** The project launcher should own the complete activation transaction. PortReeve Desktop may prepare a valid immutable allocation generation and inject its identity and derived endpoint values into the command environment.

**Decision:** Desktop prepares and observes; the project launcher begins the supplied generation, renews pending leases, starts and confirms providers, performs failure cleanup, and ends the activation after stopping providers.

## D5 — Initial onboarding level

**Question:** Should the primary onboarding path generate a language-specific PortReeve-aware launcher, with shell and CLI recipes secondary?

**Answer:** No. Requiring generated JavaScript introduces too much initial friction and immediately raises language and project-structure preferences. The first experience should be a fill-in-the-blanks shell-command launcher for operations such as start, stop, restart, and status. Language-specific scaffolds remain a desired next step and should eventually offer multiple languages and structures.

**Decision:** Design the initial Launcher experience around user-supplied shell commands. Treat generated PortReeve-aware project launchers as an advanced graduation path, not an entry requirement.

## D6 — Command-only guarantees and upgrade path

**Question:** May the initial command-only launcher prepare and inject allocated addresses and report fresh listener evidence while explicitly withholding confirmed activation status until the project launcher adopts the complete integration contract?

**Answer:** Yes. This lower-friction approach is approved, including an explanation that users can later upgrade the project launcher to lock in ownership, renewal, confirmation, and cleanup guarantees after experimenting.

**Decision:** The initial launcher distinguishes prepared, observed, confirmed, and conflicting states. Command-only operation never claims verified activation ownership. The UI presents full PortReeve integration as a clear upgrade path rather than an initial prerequisite.

## D7 — Executable configuration trust

**Question:** Should PortReeve trust a launcher configuration once per exact file revision and canonical stack root, while requiring review again after any external change?

**Answer:** Yes.

**Decision:** Launcher commands created or edited and explicitly saved in PortReeve are trusted at that revision. A newly discovered or externally changed launcher file must show its shell, working directory, and commands for explicit review and trust before any operation, including status, may run. Commands never run automatically merely because the Launcher tab was opened.

## D8 — Shell selection

**Question:** Should the initial command launcher require Bash, or default to the user's system login shell while permitting explicit Bash and Zsh selection?

**Answer:** Default to the system login shell with explicit Bash and Zsh choices.

**Decision:** Launcher command strings are shell commands rather than Bash-specific scripts. `system` is the default shell selection and resolves visibly to the user's login shell; `bash` and `zsh` are explicit alternatives. Arbitrary custom shell executables are deferred from the first version.

## D9 — Working directory

**Question:** Should lifecycle operations have separate working directories, or share one launcher-level directory constrained within the canonical stack root?

**Answer:** Use one shared launcher-level working directory.

**Decision:** `workingDirectory` is a path relative to the canonical stack root and defaults to `.`. PortReeve resolves it, including symlinks, and refuses any target outside the stack root. Start, stop, restart, and status all run from that directory, whose configured and resolved forms appear during trust review.

## D10 — Environment mapping scope

**Question:** Should the initial launcher environment editor accept arbitrary literal values and secrets, or only map PortReeve endpoint facts into project-defined environment-variable names?

**Answer:** Allow only endpoint-derived values.

**Decision:** The launcher inherits the user's ordinary shell environment and adds validated endpoint-derived mappings plus reserved automatic `PORTREEVE_*` context. Arbitrary literals, credentials, tokens, and general `.env` editing remain outside PortReeve and in the project's existing configuration system.

## D11 — Initial operation set

**Question:** Should the first launcher schema expose a fixed lifecycle surface or arbitrary custom operations?

**Answer:** Use the proposed fixed lifecycle surface.

**Decision:** Start and Stop are required. Restart and Status are optional. When Restart is absent, Desktop visibly runs Stop with the current allocation context, revalidates or prepares the next allocation, and runs Start with the resulting context. When Status is absent, PortReeve evidence remains available without project-specific output. Arbitrary custom operations are deferred.

## D12 — Command duration model

**Question:** Must the first launcher supervise indefinitely attached foreground commands, or may it require lifecycle commands to terminate after performing their operation?

**Answer:** Initial lifecycle commands must terminate.

**Decision:** The command-only launcher executes finite orchestration commands, captures their output and exit status, and then refreshes evidence. Persistent foreground process supervision, reattachment, and app-close behavior are deferred to a separate future feature.

## D13 — Timeout and cancellation cleanup

**Question:** Should command timeout or cancellation automatically run project cleanup, or terminate only the exact launcher process group and leave cleanup explicit?

**Answer:** Use configurable per-operation timeouts and explicit cleanup.

**Decision:** Start, Stop, Restart, and Status have editable operation-specific timeouts, defaulting to five minutes, two minutes, seven minutes, and thirty seconds respectively. Timeout or cancellation gracefully terminates, then if necessary force-terminates, only the exact shell process group PortReeve created. Desktop refreshes and reports partial listener evidence and offers Run Stop, but never invokes Stop automatically.

## D14 — Interactive terminal sequencing

**Question:** Should the first Launcher release embed a pseudo-terminal, or begin with non-interactive execution while preserving an upgrade boundary for a later terminal subsystem?

**Answer:** Begin with non-interactive execution and plan the terminal upgrade.

**Decision:** Initial launcher operations have closed standard input and stream stdout and stderr without a PTY. The command-session abstraction must permit a later xterm.js renderer plus node-pty main-process implementation without changing `portreeve.launcher.json`. Interactive prompts, terminal emulation, and native PTY packaging are deferred.

## D15 — Command output retention

**Question:** Should raw launcher stdout and stderr persist automatically, or remain session-only while safe operation metadata is durable?

**Answer:** Keep raw output session-only with durable metadata.

**Decision:** Desktop streams and retains bounded raw output per stack for the current application session and provides explicit Copy output and Save output actions. PortReeve history stores operation identity, trusted revision, allocation context, timing, outcome, and listener-evidence summary, but never automatically persists raw stdout or stderr or attempts unreliable secret redaction.

## D16 — Evidence-gated Start

**Question:** How should command-only Start behave when some or all allocated endpoints already have listeners?

**Answer:** Use the proposed evidence-gated behavior with a narrow explicit escape hatch.

**Decision:** With no expected listeners or conflicts, Desktop prepares or reuses a generation and runs Start. A verified live activation disables Start. A fully observed command-only stack directs the user to Status or Restart. Non-conflicting partial observations retain the current generation and permit an explicit Run Start Anyway repair attempt. Conflicting evidence blocks Start. PortReeve never silently adopts listeners or reallocates around an apparently running stack.

## D17 — Command-only Stop

**Question:** Should command-only Stop invoke only the configured project command and classify the result from fresh evidence, without automatically signaling remaining listeners?

**Answer:** Yes.

**Decision:** Stop remains available even with no observed listeners because project cleanup may extend beyond PortReeve evidence. Desktop invokes only the trusted Stop command, then reports stopped, partial, failed, or uncertain from its exit and fresh evidence. Remaining listeners expose Run Stop Again, inspection, and separately authorized reclamation actions; Stop never escalates automatically into process eviction.

## D18 — Optional attached Start

**Question:** May a launcher explicitly declare a Start command that remains in the foreground rather than daemonizing or backgrounding the stack?

**Answer:** Yes.

**Decision:** Finite Start remains the default, but a launcher may select attached Start. Attached Start has no timeout, closed standard input, live bounded output, and at most one tracked process group per stack. Status and Stop remain finite and may run alongside it. Stop never automatically kills the attached process; Desktop offers explicit termination of the exact group it created. Attached Restart is always composed Stop then Start. Normal Desktop quit requires stopping attached stacks or cancelling the quit; persistent detach and reattachment are deferred. This amends D12 only for explicitly attached Start.

## D19 — Shared engine and CLI surface

**Question:** Should launcher execution be Desktop-only, or live in a shared application library with both Desktop and initial CLI entry points?

**Answer:** Use a shared engine and provide both surfaces.

**Decision:** Configuration loading, trust verification, environment construction, command execution, timeout handling, and evidence classification live outside the renderer and daemon in a shared launcher engine. Electron main and `portreeve launcher validate|start|stop|restart|status` consume the same semantics. The daemon remains a port authority and never executes project commands.

## D20 — Shared revision trust without an automation escape hatch

**Question:** How much of the proposed exact-revision trust mechanism belongs in the first release?

**Answer:** Keep revision-based trust but defer the explicit `--trusted-revision` automation option.

**Decision:** Desktop and CLI share per-user trust keyed by canonical stack root and exact launcher-file content revision. Desktop requires review after external changes; an interactive CLI may review and trust; a non-interactive CLI refuses an untrusted revision. The first release has no generic bypass and no command-line option for establishing trust non-interactively. That advanced mechanism is deferred until a concrete automation workflow needs it.

## D21 — Command suggestions

**Question:** Should Launcher setup conservatively suggest lifecycle commands from recognizable project manifests?

**Answer:** Yes; this is strongly desired.

**Decision:** After the user selects the stack-contained working directory, Desktop may inspect known manifest filenames in that exact directory without executing code or recursively scanning child repositories. It suggests unambiguous package-script, Makefile-target, or Docker Compose lifecycle commands with visible provenance. Ambiguous or absent operations remain blank, all suggestions are editable, and nothing is trusted until explicit review and save.

## D22 — Endpoint environment suggestions

**Question:** Should setup preselect deterministic, editable host-port environment mappings for every endpoint and allow optional URL mappings?

**Answer:** Yes.

**Decision:** Default endpoints suggest `<COMPONENT>_PORT`; named endpoints suggest `<COMPONENT>_<ENDPOINT>_PORT`, using validated uppercase ASCII with punctuation normalized to underscores. Every endpoint begins selected for host-port injection. Users may rename or deselect mappings and add HTTP or HTTPS URL mappings. Collisions and the reserved `PORTREEVE_` prefix are refused. The file stores endpoint references, never assigned port numbers.

## D23 — Docker-derived environment values

**Question:** Should Docker-backed endpoints expose optional container-port and Docker-network URL mappings in addition to the default allocated host-port mapping?

**Answer:** Yes.

**Decision:** Every endpoint continues to suggest its allocated host port by default. When the stack definition supplies Docker service and fixed container-port metadata, users may add a container-port mapping or an HTTP/HTTPS Docker-network URL derived from the declared service and container port. Docker-specific rows are optional and do not assert application health.

## D24 — Cross-surface operation coordination

**Question:** Should Desktop and CLI coordinate launcher operations per stack through the daemon while retaining command execution outside it?

**Answer:** Yes.

**Decision:** The daemon issues renewable launcher-operation sessions keyed to stack, operation, launcher revision, caller operation ID, and deadline, and durably records safe final outcome metadata. Different stack roots may operate concurrently. A stack serializes finite lifecycle mutations; attached Start admits its associated Status and Stop but refuses a second Start or Restart. Client loss expires the coordination session and triggers fresh evidence without adoption or killing. The daemon never executes or inspects project commands or raw output.

## D25 — Launcher tab and editor layout

**Question:** Should launcher browsing and execution use the normal Launcher tab while setup and editing use a dedicated in-tab editor rather than a modal?

**Answer:** Yes.

**Decision:** The Launcher tab is a stack-linked master-detail browser showing runtime controls, coordination state, endpoint evidence, and session output. Set up or Edit replaces the runtime detail with a dedicated editor containing Execution, Commands, Endpoint environment, Advanced, and Review sections. Save and Trust atomically writes the file and trusts that exact revision; Cancel returns to runtime view.

## D26 — External launcher-file conflicts

**Question:** Should launcher editing reuse exact-byte conflict detection with explicit Review, Overwrite, or Cancel and no automatic merge?

**Answer:** Yes.

**Decision:** The editor saves atomically only when the on-disk bytes still match its loaded baseline. External modification or deletion invalidates trust and blocks ordinary save. Review loads the external revision, Overwrite requires explicit confirmation and trusts the resulting bytes, and Cancel preserves the draft without mutation. No automatic merge or silent recreation occurs.

## D27 — Applied-stack prerequisite and project-file retention

**Question:** Should launcher execution require an applied stack while stack pruning and PortReeve data deletion leave the project-owned launcher file untouched?

**Answer:** Yes.

**Decision:** Desktop discovers launchers only at registered canonical stack roots. An applied stack without a launcher offers setup; an unapplied launcher file may be validated but not run. Removed endpoint references invalidate execution. Stack pruning and Delete all data remove PortReeve coordination, trust, and history as applicable but never delete `portreeve.stack.json` or `portreeve.launcher.json`.

## D28 — Interactive CLI initialization

**Question:** Should the first release include an interactive `portreeve launcher init` workflow for non-Desktop users?

**Answer:** Yes.

**Decision:** From an applied stack root, `launcher init` prompts for the contained working directory, presents non-executing manifest-derived command suggestions and endpoint mappings, collects shell and Start behavior, previews the exact JSON, atomically creates the absent launcher file, and trusts that revision after confirmation. It refuses an existing file rather than becoming a terminal editor; validate and trust support hand-edited files.

## D29 — Initial platform support

**Question:** Which operating systems must execute launcher commands in the first release?

**Answer:** Support macOS Desktop and macOS/Linux CLI; defer Windows.

**Decision:** The checked-in launcher schema remains platform-neutral where possible. Desktop Launcher follows the current macOS application, while the shared engine and CLI implement POSIX shell, path, signal, and permission semantics on macOS and Linux. PowerShell, cmd.exe, Job Objects, Windows path and trust permissions, and Windows-specific Docker behavior are deferred rather than implied.

## D30 — Degraded Stop and Status

**Question:** When the daemon is unavailable, may Stop and Status run from a cached non-secret endpoint environment while Start and Restart remain blocked?

**Answer:** Yes.

**Decision:** The shared engine atomically caches the last successfully resolved stack, generation, and derived address facts per root and launcher revision, excluding tokens and secrets. With the daemon unavailable, Start and Restart refuse. Status may run with visibly stale cached context; Stop requires explicit degraded-mode confirmation. Local `lsof` results are labeled locally observed, with no operation lease or daemon history, and the UI prominently offers service restoration.

## D31 — Explicit integration maturity

**Question:** Should launchers explicitly declare command-only versus verified-activation success criteria, with an upgrade suggestion after a matching activation is observed?

**Answer:** Yes.

**Decision:** New launchers default to `command-only`, where command outcome and listener observations are reported without verified ownership. `verified-activation` requires the invoked launcher to activate the exact supplied generation and confirm required endpoints; exit zero without that outcome fails. A matching activation in command-only mode prompts an optional file revision upgrade. Downgrading remains possible through an explicit editor warning and new trusted revision.

## D32 — Scaffolding follow-up boundary

**Question:** Should language-specific launcher source generation be part of the first Launcher release or a separate follow-up initiative?

**Answer:** Make it a separate follow-up.

**Decision:** The first release includes command-only execution, verified-activation mode, upgrade explanation, integration checklist, successful-integration detection, and links to official client and CLI documentation. JavaScript, Python, POSIX shell, framework templates, regeneration rules, versioning, and cross-language conformance belong to a distinct later initiative.

## D33 — Status evidence authority

**Question:** Should project Status output be parsed into PortReeve state or remain advisory beside authoritative live evidence?

**Answer:** Keep it advisory and unparsed.

**Decision:** Fresh `lsof` and verified activation evidence remain authoritative for PortReeve classifications. Status exit code and raw bounded output are displayed for human interpretation but never override listener evidence or require a project JSON contract. Disagreement is surfaced explicitly rather than reconciled by parsing project output.

## D34 — Recent operation history

**Question:** Should Launcher detail expose a bounded recent-operation history from the durable safe metadata?

**Answer:** Yes.

**Decision:** The selected stack shows its most recent twenty launcher operations with operation, outcome, duration, and exit status. Detail includes launcher revision, generation, timing, degraded or lost state, and before/after evidence, plus an explicit notice that raw output was not retained. Current-session raw output remains reopenable while in memory; broader history stays in the existing PortReeve history surface.

## D35 — Visible actionable failure details

**Question:** What existing cross-cutting UI requirement must remain in scope while adding Launcher operations?

**Answer:** Failure details must be visible; the earlier generic install-and-start failure presentation must not be forgotten.

**Decision:** Launcher and existing lifecycle operation results must expose available underlying error codes and messages, failed step, exit or timeout state, bounded current-session output, and fresh evidence rather than only a generic failure summary. Safe durable metadata supports later diagnosis without persisting raw terminal output.

## Interview conclusion

The product boundary is solid. PortReeve remains the durable address and evidence authority while project-owned launchers retain orchestration and, when upgraded, the complete activation transaction. The first experience is a trusted, checked-in, fill-in-the-blanks command launcher available through Desktop and CLI, with endpoint-derived environment injection and an honest distinction between prepared, observed, and verified states.

The execution model is also settled: one launcher per applied stack root; system login shell by default; one contained working directory; fixed lifecycle operations; finite commands by default; optional application-tied attached Start; non-interactive I/O; bounded session-only raw output; explicit cancellation and cleanup; and daemon-mediated per-stack coordination across Desktop and CLI.

The consciously accepted weaknesses are that command-only mode cannot verify process ownership or remove the allocation-to-bind race, launcher revision trust cannot secure indirectly invoked project code, and attached Start cannot survive or reattach across Desktop closure. These are visible limitations with explicit upgrade paths rather than hidden guarantees.

Language-specific scaffolds, embedded PTY support, persistent detached supervision, Windows execution, arbitrary actions, general environment editing, and automatic raw-log persistence are intentionally deferred. Exact JSON schemas, daemon route names, buffer bounds, lease intervals, and delivery slicing remain specification and planning work rather than unresolved product decisions.
