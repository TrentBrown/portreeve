# Migrating existing services

Migration is intentionally incremental. PortReeve can coexist with projects
that still use their existing persisted remapping logic while services are
retrofitted one at a time.

## Per-service sequence

1. Give the service a stable identity: project namespace, canonical worktree
   root, service name, and `tcp`.
2. Replace startup-time probing with `client.withPort(...)` or the low-level
   acquire/bind/confirm sequence.
3. Pass the allocated port into the existing server startup path.
4. Release the confirmed `runId` during graceful shutdown.
5. Treat PortReeve unavailability as a startup failure. Do not silently fall
   back to the old allocator.
6. Remove only that service's obsolete remapping persistence and probing code
   after its PortReeve path is verified.

Use `preferredPort` when the old default is desirable but substitutable. Use
`exactPort` only when external constraints make substitution invalid. Sticky
claims preserve stable developer URLs; ephemeral claims are appropriate for
short-lived workers and tests.

## Transition operations

Start PortReeve before migrated services. `ports list` exposes both claimed
and unclaimed live listeners, so developers can see legacy and migrated
processes together. Existing processes are not adopted merely because their
port matches a claim.

Worktrees should pass a path inside their own checkout. The client resolves the
canonical Git worktree root, giving sibling agent worktrees distinct claim
identities without an additional instance variable.

If a deleted worktree leaves an old idle claim, preview with:

```sh
portreeve claims prune --dry-run
```

Then run the interactive command or use `--yes` in explicit noninteractive
automation.

## Migrating a stack component to Docker evidence

Docker support is also incremental and may be mixed with ordinary process-backed
components in one activation:

1. Add the component's Compose service and each published endpoint's container port to
   `portreeve.stack.json`.
2. Begin the activation with that component selected as Docker-backed. The CLI form is
   `stacks begin GENERATION_ID --docker-component api`.
3. Have the trusted launcher apply every `requiredLabels` value and publish the returned
   host port on `127.0.0.1` to the returned container port.
4. Confirm with the exact container ID. Do not pass a PID for a Docker-backed endpoint.
5. Keep container start, stop, health, and Compose ownership in the launcher. PortReeve
   coordinates endpoint identity and verifies evidence; it does not orchestrate Docker.

If Docker or its daemon is unavailable, `docker-evidence-v1` is not advertised and a
Docker-backed begin or confirm fails explicitly. Existing process-only allocation and
stack activations continue to work.

## Migrating an existing stack orchestrator

Retain the project launcher and move only address coordination into PortReeve:

1. Choose the exact directory representing the one independently runnable stack. It may
   be a non-Git parent containing multiple child repositories.
2. Create `portreeve.stack.json` with component, endpoint, dependency, allocation, and
   optional Docker placement metadata. Do not move commands, secrets, health checks, or
   startup ordering into the definition.
3. Apply and prepare the whole topology before starting providers. Resolve consumer
   addresses from that one immutable generation instead of allocating one service at a
   time and injecting ports opportunistically.
4. Keep the launcher responsible for starting processes or containers, mapping resolved
   addresses into each service's environment, checking application health, confirming
   listener/container evidence, and stopping providers before ending the activation.
5. During transition, continue using standalone `withPort` claims for services not yet
   represented in the stack. Exact-root adoption can preserve a compatible standalone
   default endpoint assignment when the stack definition is first applied.

PortReeve Desktop can create or edit the definition, but it does not replace the
launcher. Applying through either the CLI, client, or desktop never prepares ports or
starts the stack.

## Moving an existing orchestrator to PortReeve Launcher

After the stack topology is applied, add `portreeve.launcher.json` beside it. Keep the
existing project CLI as the implementation of Start, Stop, Restart, Status, dependency
ordering, health checks, container control, and cleanup; the PortReeve file merely names
those commands and maps current endpoints into their environment.

Begin in `command-only` mode. It removes static-port and cross-service address wiring
without pretending that exit zero proves ownership. Review fresh evidence and keep the
old startup path available until the new command receives every required mapping. When
the project launcher can begin, renew, confirm, abandon, reconcile, and end the exact
supplied activation generation, switch to `verified-activation`, review the changed
file, and trust its new exact revision.

Desktop offers fill-in-the-blanks editing. CLI users can run:

```sh
portreeve launcher init
portreeve launcher validate
portreeve launcher trust
portreeve launcher start
```

Do not copy assigned ports into the file, add a second PortReeve launcher per operating
profile, or move arbitrary secrets into launcher environment mappings. Focus modes and
secrets remain options or environment owned by the invoked project CLI. See
[Project launchers](launchers.md) for the complete transition checklist.
