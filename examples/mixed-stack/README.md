# Mixed process and Docker stack

This example models a process-backed `website` and Docker-backed `api` as one
independently runnable worktree stack. Portreeve allocates both host publications and
verifies their evidence. The project launcher still owns the website child process,
Docker or Compose invocation, environment injection, startup order, health checks, and
shutdown.

Copy [`portreeve.stack.json`](portreeve.stack.json) to the root of a disposable worktree
or adapt its project and component names there. The file declares topology and preferred
ports only; it contains no command, secret, environment value, or lease credential.

## Launcher sequence

1. Apply and prepare before deriving any environment or Compose override:

   ```sh
   portreeve stacks apply --json
   portreeve stacks prepare STACK_ID --json
   ```

2. Begin one mixed activation. The API receives a Docker lease and the website receives
   a process lease:

   ```sh
   portreeve stacks begin GENERATION_ID --docker-component api --json
   ```

3. The trusted launcher writes private lease output to a mode-`0600` runtime file. It
   starts the API container with every returned `requiredLabels` entry and publishes
   `127.0.0.1:API_HOST_PORT:3000`. It confirms the exact container ID with
   `stacks confirm-docker`.

4. The launcher starts the website on its returned host port, sets its backend URL from
   the resolved `backend` alias, and confirms the website root PID with
   `stacks confirm`:

   ```sh
   portreeve stacks resolve ACTIVATION_ID --component website --json
   ```

   A typical environment mapping is:

   ```text
   PORT=website.own.http.host.port
   API_URL=http://website.dependencies.backend.host.host:website.dependencies.backend.host.port
   ```

   Resolution describes network addresses, not startup readiness. The launcher decides
   when the API is healthy enough to start the website.

5. For a Docker or Codex sandbox, the host launcher renders a separate read-only
   discovery file instead of mounting the Portreeve socket:

   ```sh
   portreeve stacks snapshot ACTIVATION_ID \
     --component website \
     --gateway-host host.docker.internal \
     --file .portreeve/runtime/website-endpoints.json
   ```

   Linux launchers supply their configured host-gateway name or address. Sandboxed code
   reads the mounted file through `readEndpointSnapshot` or `PORTREEVE_ENDPOINTS_FILE`.

6. On shutdown, the launcher stops the website process and API container first, then
   requests `stacks end`. After a launcher crash, its replacement runs
   `stacks reconcile` and acts on `active`, `gone`, or `unknown` provider evidence
   rather than trusting the old launcher PID.

## Native assembled verification

Repository contributors with Docker available can run:

```sh
bun run stacks:verify
```

That harness creates a uniquely named disposable container and process listener and
drives this complete lifecycle through the official JavaScript client: apply, prepare,
begin, both confirmations, status, resolution, sandbox snapshot write/read, live end
refusal, reconciliation, end, missing-worktree prune, and retained-history inspection.
It removes every process, container, worktree, and Portreeve data path it creates.
