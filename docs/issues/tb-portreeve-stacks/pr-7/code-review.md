# Code Review - PR #7

**Pinned diff:**
`8e14a33c42fa59bd1909555d4e9bbe7dffde48eb..3db03073f3848e740882327461a7d2ebea57f01c`

## Findings

No remaining findings.

Two correctness findings discovered during the boundary review were fixed and repinned
before this report:

1. Transformed record keys could silently collapse `"api"` and `" api "`, and
   `localeCompare` could make content hashes depend on runtime locale data. Names are
   now rejected unless already trimmed and canonical key ordering is locale-independent
   (`src/protocol/schemas.js:100`, `src/stacks/definition.js:37`).
2. A new client talking to an old daemon would receive `not_found` before the unknown
   route could negotiate its request capability. `applyStack` now preflights health for
   `stack-definitions-v1`, while the mutation still performs server-side negotiation
   (`packages/client/src/client.js:92`).

## Review Notes

- The version-2 table rebuild preserves primary keys and dependent rows while checking
  foreign-key integrity before commit and restoring enforcement in a `finally` block
  (`src/storage/migrations.js:104`).
- Definition application prevalidates every published endpoint before writing, then uses
  one immediate transaction for the stack, revision, claim links, compatibility-claim
  adoption, and history (`src/storage/registry.js:286`).
- Equivalent canonical content exits without writes. Changed content retains prior
  revision rows and existing port assignments (`test/stacks/service.test.js:37`,
  `test/stacks/service.test.js:122`).
- The public surfaces remain deliberately narrow: apply/list/show/status only; there is
  no project-process or Docker execution path.

## Residual Risks and Test Gaps

- Raw HTTP callers, unlike the official client, must supply the canonical worktree path
  promised by the protocol. Future client implementations should reuse the same
  Git-root/realpath rule.
- Local evidence is macOS ARM64. The checked-in release workflow remains the Linux
  portability gate.
- One broad lifecycle test fails because this account already has supervised Portreeve
  state; the identical failure was reproduced at the base SHA and is documented in
  `verification.md`.
