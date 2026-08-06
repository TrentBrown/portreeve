# Stack definitions

Portreeve coordinates a project-defined independently runnable stack for a canonical Git
worktree. Stack identity is project plus canonical worktree, and only one activation may
be current for a worktree at a time. The project remains the authority for how its
processes and containers are launched. Portreeve stores coordination state; it does not
store commands, environment secrets, Compose files, or health-check logic.

The checked-in definition is `portreeve.stack.json` at the worktree root:

```json
{
  "version": 1,
  "project": "caregiver",
  "components": {
    "api": {
      "docker": { "service": "api" },
      "endpoints": {
        "http": {
          "allocation": { "preferredPort": 8080 },
          "docker": { "containerPort": 8080 }
        }
      }
    },
    "website": {
      "endpoints": {
        "http": { "allocation": { "preferredPort": 3000 } }
      },
      "dependencies": {
        "backend": { "component": "api", "endpoint": "http" }
      }
    }
  }
}
```

The schema is strict. Unknown fields are rejected. Component and endpoint names are
stable logical identities. An omitted dependency endpoint means `default`. Endpoint
defaults are TCP, published, and required. Use `publish: false` for an endpoint that
Portreeve should understand but should not assign a host port. `preferredPort` permits
later fallback allocation; `exactPort` does not. They are mutually exclusive.

Docker metadata is declarative coordination metadata only. An endpoint with a Docker
container port must belong to a component with a Docker service. Docker inspection,
ownership evidence, and mixed process/container activations are introduced by the later
activation protocol; applying a definition never runs Docker.

Run `portreeve stacks apply` from anywhere in the worktree, or pass `--file`. The CLI
and JavaScript client send the same definition over the private socket. Portreeve
normalizes defaults, canonicalizes object-key order, hashes the JSON, and records the
SHA-256 value as an immutable definition revision. Reapplying equivalent content is
idempotent. A changed definition creates or reuses its revision and updates the stack's
current revision atomically.

Applying links every published endpoint to a sticky canonical claim. A prior standalone
`service` claim is adopted as component plus endpoint `default` without changing its
assigned port. An existing conflicting exact assignment or an ephemeral matching claim
refuses the whole apply operation.
