# Code Review - PR #10

**Pinned diff:**
`f16addf71026c8fe8fdc231d20154f451e4b9624..885ffc5c00fd21ea1fdc43e39974bdb850ca12ba`

## Findings

No remaining findings.

## Corrections Made During Review

- Replaced Docker's unreliable `ps --filter publish=<host-port>` shortcut with exact
  inspection of running containers; a real dynamically published Docker Desktop port
  exposed the defect before the PR packet was pinned.
- Made unsafe eviction refuse a persisted Docker run when fresh Docker discovery is
  unavailable, preventing fallback to shared-backend process signaling.
- Avoided attaching an unavailable Docker adapter to process-only inventory, preserving
  process behavior when Docker is absent.
- Treated a matching `docker-managed` run as active during activation begin so a second
  attempt does not incorrectly invalidate its still-valid generation.

## Review Notes

- Capability advertisement and mutation-time availability checks are separate: health
  exposes Docker only after startup verification, while begin and confirm recheck the
  daemon before mutation.
- The confirmation transaction validates the pending token and Docker activation
  endpoint before assigning the claim, confirming the lease, inserting a provider-typed
  run, and updating activation state.
- Process and Docker runs share claim exclusivity without inventing a Docker PID.
- Exact labels bind a container to one stack definition revision, generation,
  activation, component, and endpoint map. Non-Portreeve labels are removed from public
  inventory.
- Docker-managed evidence short-circuits both normal reclamation and unsafe eviction
  before any fingerprint revalidation or signal path.
- The official client and CLI preserve the existing process confirmation shorthand;
  Docker use is additive and explicitly capability-gated.

## Residual Risks and Test Gaps

- `ports list` may repeat exhaustive Docker inspection for several listening ports. The
  implementation favors correctness over caching; a single-operation Docker snapshot is
  a possible optimization.
- Native Linux-host listener evidence is not manually proven in this packet. Docker
  Desktop's real Linux Engine and macOS host publication were proven.
- Docker capability changes after server startup require restart to change advertised
  health, although attempted Docker mutations fail safely on a fresh availability check.
- Container lifecycle and application health remain launcher-owned and are intentionally
  outside this review scope.
