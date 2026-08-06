# Code Review - PR #9

**Pinned diff:**
`ca7b552e4aaf0690b80c554aa20afff7576c40b2..fcb75bfcf7cc93af5f1f412e6c55bd4dcbed2811`

## Findings

No findings.

## Review Notes

- Resolution begins from an activation ID, loads that activation's generation, and
  refuses invalid generations or current-definition drift before returning addresses.
- The response exposes only the requested component's published own endpoints and its
  named dependency aliases; unrelated components and non-published own endpoints are
  absent.
- Required dependency activation state is checked without demanding confirmation,
  preserving the approved address-discovery-before-startup workflow. Leased and assigned
  addresses are allocation facts, not application-readiness claims.
- Host and Docker-network addresses are represented separately. The latter is nullable
  and comes only from checked-in definition data; it is not presented as fresh container
  evidence.
- Sandbox snapshots carry canonical provider identity and one launcher-rendered TCP
  address, but exclude worktree paths, claim/lease/run records, tokens, process
  evidence, Docker identifiers, the daemon socket, and mutation operations.
- Snapshot writes parse first, create a same-directory `0600` temporary file
  exclusively, sync it, close it, and atomically rename it over the target. Failed
  writes attempt to close and remove the temporary path.
- The dependency-free reader bounds input to 1 MiB, validates the entire object shape,
  freezes nested records, and optionally rejects stale definition, generation,
  activation, or component identity.
- The server and official client both require the separately advertised
  `stack-discovery-v1` capability, preventing partial use against an older daemon.

## Residual Risks and Test Gaps

- A launcher-supplied gateway is syntactically validated but not topology-verified;
  Portreeve does not own the sandbox network.
- Optional dependency aliases retain their allocated address even if the optional
  provider was skipped. Availability remains activation state, while this contract is
  intentionally address discovery; callers that need optional-service state must also
  inspect the activation.
- Directory-entry crash durability after rename is not separately fsynced. Atomic reader
  visibility is covered; full filesystem power-loss durability is not claimed.
- Native Windows replacement behavior is untested and deferred by the approved platform
  scope.
- One broad lifecycle test fails under this account's installed supervised state; the
  same baseline was accepted in the two preceding stack PRs.
