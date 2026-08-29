# Code Review - PR #74

**Pinned diff:**
`9c126fb4074072fb1a74039313072256c89d7f72..2d367ae3e8bf715aa98bc2fe12902a629b9c499e`

**Verdict:** FAIL - remediation required

## Findings

### [P1] Bind macOS CLI authority mode to the selected trust policy

`scripts/release-record.js:648` accepts either `unsigned-internal` or
`developer-id-signed` for every schema-version-2 record. A record whose policy
requires `developer-id-notarized` can therefore advance through
`macos-cli-authority-established` with unsigned CLI authority. Later stages
could no longer prove that the trusted policy began from Developer ID-signed
CLI bytes. Require `unsigned-internal` only for unsigned policy and
`developer-id-signed` only for trusted policy, with negative tests.

### [P1] Bind candidate qualification to recorded initial artifacts

`scripts/release-record.js:635` accepts any integer artifact count of at least
four. The value is not checked against the record's initial artifact set or
its four required executable targets, so hand-edited evidence can claim a
qualified candidate even when the recorded artifact matrix is incomplete.
Bind schema-version-2 candidate qualification to the actual pre-qualification
artifacts and exact four executable targets, with tamper fixtures.

## Residual risks

Live Apple command formats and protected credential behavior remain deferred
to the reviewed producer and rehearsal slices by design; this review does not
treat absent live credential use as a defect in the contract-foundation slice.
