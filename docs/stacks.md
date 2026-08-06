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
Portreeve should understand but should not assign a host port; a dependency cannot
target an unpublished endpoint. `preferredPort` permits later fallback allocation;
`exactPort` does not. They are mutually exclusive.

Docker metadata is declarative coordination metadata. An endpoint with a Docker
container port must belong to a component with a Docker service. Applying a definition
never runs Docker; it supplies the facts later used by activation evidence.

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

Add `--docker-component api` for each component the launcher will place in Docker.
Omitted components remain process-backed, so an activation may mix both kinds. Docker
selection is per activation and does not change logical endpoint identity.

Beginning atomically creates pending leases for all non-skipped endpoints. Only one
activation may be live for a canonical worktree. The JSON response contains private
lease tokens; keep them out of source control and process arguments. Use a mode-0600
JSON file with `stacks renew --leases-file`, or the JavaScript client, to renew the
whole pending batch during startup.

Providers bind their assigned ports and confirm individually. Process endpoints use
fresh process-tree evidence. Each Docker lease includes the exact required labels;
after the launcher starts the labeled container and publishes
`127.0.0.1:HOST_PORT:CONTAINER_PORT`, it confirms with:

```sh
portreeve stacks confirm-docker ACTIVATION_ID \
  --lease-file .portreeve/private/api-http.json \
  --container-id CONTAINER_ID
```

The container ID is only a lookup key. Portreeve freshly verifies running state, every
stack/component/revision/generation/activation/endpoint label, the exact publication,
and a live `lsof` listener. It never applies process lineage to Docker's backend.
Required endpoints must confirm. Optional endpoints may be named with
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
refuses to end while any confirmed endpoint is still listening. Ending never
signals or stops the provider itself.

If Docker is absent or inaccessible, health omits `docker-evidence-v1`; process-only
activations continue normally. Inventory marks fresh Docker publications as
`docker-managed`. Both normal reclamation and `unsafe-evict` return
`launcher-action-required` with the container IDs and send no process signal. The
trusted launcher stops the container and retries.

## Resolve dependencies and publish sandbox discovery

Dependencies are address references, not startup-order edges. Portreeve resolves each
consumer from one activation generation and returns two non-overlapping maps: its own
published endpoints and its declared dependency aliases. It never reveals unrelated
components. Circular address references are permitted because every address was prepared
before activation.

```sh
portreeve stacks resolve ACTIVATION_ID --component website --json
```

Each resolved endpoint contains the host publication plus a nullable Docker-network
fact. The host fact is always the generation's loopback allocation. A Docker-network
fact exists only when the checked-in provider component declares a Docker service and
that endpoint declares a fixed container port. These are address facts, not application
health or Docker ownership evidence.

A trusted launcher may render and atomically write a sandbox-only document:

```sh
portreeve stacks snapshot ACTIVATION_ID \
  --component website \
  --gateway-host host.docker.internal \
  --file /private/runtime/endpoints.json
```

The launcher chooses the platform gateway. Portreeve substitutes it for loopback while
retaining the allocated host ports, but does not claim that gateway as an independently
owned listener. The strict document contains only revision, generation, activation,
consumer, and scoped TCP addresses. It excludes worktree paths, claims, lease tokens,
runs, process and Docker identifiers, the daemon socket, and mutation authority.

Mount the file read-only instead of exposing Portreeve's socket. The official JavaScript
reader accepts an explicit path or `PORTREEVE_ENDPOINTS_FILE` and can reject a document
whose expected generation or activation no longer matches.
