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

## Prepare and activate

Preparation creates or reuses one immutable allocation generation containing every
published endpoint:

```sh
portreeve stacks prepare STACK_ID --json
```

Preparation is durable and does not start a lease deadline. Exact ports fail without a
partial generation. Preferred ports fall back through the configured automatic range. If
fresh listener evidence shows that an assigned port was taken by another owner, the old
generation becomes stale and the launcher must prepare again before deriving environment
variables or Compose overrides.

When the launcher is ready to start providers, begin one activation:

```sh
portreeve stacks begin GENERATION_ID --json
```

Beginning atomically creates pending leases for all non-skipped endpoints. Only one
activation may be live for a canonical worktree. The JSON response contains private
lease tokens; keep them out of source control and process arguments. Use a mode-0600
JSON file with `stacks renew --leases-file`, or the JavaScript client, to renew the
whole pending batch during startup.

Providers bind their assigned ports and confirm individually with fresh process-tree
evidence. Required endpoints must confirm. Optional endpoints may be named with
`--skip-endpoint component.endpoint`; after all required endpoints confirm, a skipped or
failed optional endpoint makes the activation `degraded`. A required dependency on an
optional provider endpoint must promote it with `--required-endpoint component.endpoint`
for that activation. When a component or endpoint name itself contains a dot, pass a
JSON object such as
`--required-endpoint '{"component":"api.v2","endpoint":"http.internal"}'`.

Activation states are `starting`, `confirmed`, `degraded`, `failed`, and `ended`.
Endpoint states are `leased`, `confirmed`, `skipped`, `failed`, and `released`.
Abandoning or expiring a required endpoint fails the activation and cancels every
remaining unconfirmed lease as one batch. A still-valid allocation generation may be
reused for the next attempt.

`stacks generation` and `stacks activation` provide token-free inspection. After the
launcher has stopped its providers, `stacks end` takes fresh listener evidence and
refuses to end while any confirmed process endpoint is still listening. Ending never
signals or stops the provider itself.
