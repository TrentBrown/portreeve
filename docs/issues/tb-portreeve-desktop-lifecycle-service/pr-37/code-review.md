# Code Review - PR 37

**Scope:** slice  
**Base:** `a237358c710509dc14a337f87a4641641a985a94`  
**Head:** `d51b75bc7eb6669e28c30a44a9d9b453f5796765`

## Findings

No actionable findings.

The pinned diff keeps lifecycle orchestration in
`src/supervision/service.js`, reduces the CLI to delegation, rendering, and
exit-band mapping, and preserves the existing manager and native-supervisor
mechanisms. The service validates status, mutation, purge-preview, and purge
results at its boundary. Focused tests cover all six lifecycle mutations,
success/no-change/refusal/partial/failure semantics, JSON envelope parity, and
stable error-code mapping. Broad and isolated native-fixture suites pass.

## Contract and scope review

- The CLI no longer owns mutation before/after evidence or terminal-outcome
  classification.
- CLI-specific process exit codes remain an adapter concern and are derived
  from the canonical structured error code.
- Home and socket overrides still flow through the manager factory.
- Purge continues to require exactly one of preview or an evidence-bound
  confirmation token.
- The public JavaScript client, daemon protocol, native supervisors, registry,
  and Desktop adapter are unchanged.
- The slice advances R1, R2, and R8 without claiming feature-level completion.

## Residual risks and test gaps

- A failure while gathering after-evidence can still escape without a
  canonical mutation result. This behavior existed before the extraction;
  service-owned deadlines and uncertain-outcome recovery are explicitly I-2.
- Cross-process mutation exclusion is not present yet and remains I-2.
- Electron has not adopted the service, so Desktop parity and removal of
  lifecycle CLI spawning remain I-3 and later verification.
- Linux systemd-user and packaged Desktop runtime evidence are deferred to the
  planned native/runtime verification slices.

None of these residual items is a regression or an in-scope blocker for I-1.
