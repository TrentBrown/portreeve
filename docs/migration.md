# Migrating existing services

Migration is intentionally incremental. Portreeve can coexist with projects
that still use their existing persisted remapping logic while services are
retrofitted one at a time.

## Per-service sequence

1. Give the service a stable identity: project namespace, canonical worktree
   root, service name, and `tcp`.
2. Replace startup-time probing with `client.withPort(...)` or the low-level
   acquire/bind/confirm sequence.
3. Pass the allocated port into the existing server startup path.
4. Release the confirmed `runId` during graceful shutdown.
5. Treat Portreeve unavailability as a startup failure. Do not silently fall
   back to the old allocator.
6. Remove only that service's obsolete remapping persistence and probing code
   after its Portreeve path is verified.

Use `preferredPort` when the old default is desirable but substitutable. Use
`exactPort` only when external constraints make substitution invalid. Sticky
claims preserve stable developer URLs; ephemeral claims are appropriate for
short-lived workers and tests.

## Transition operations

Start Portreeve before migrated services. `ports list` exposes both claimed
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
