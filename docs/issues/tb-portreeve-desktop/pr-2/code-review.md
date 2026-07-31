# Code Review - PR #2

**Scope:** pinned diff `2e1ed01d038ae94b1a296e18229d15f00ffa9f55..3b5bb6b59678313fe1486d9998d29f8cfb78e2a3`
**Result:** PASS

## Outstanding findings

No outstanding findings.

## Findings resolved during review

1. **P1 - A path created during supervised shutdown could enter the second
   preview and be deleted without appearing in the user's confirmed preview.**
   Fixed at `src/supervision/purge.js:245-261`: the post-shutdown path set must
   be a subset of the confirmed preview, otherwise the new path is retained
   with `path-added-after-preview`. Regression coverage is at
   `test/supervision/purge.test.js:74-135`.
2. **P1 - A supervisor adapter that returned success without deleting its
   definition could lead purge to report complete success.** Fixed at
   `src/supervision/purge.js:234-244`: a retained definition refuses data
   deletion and remains reported. Regression coverage is at
   `test/supervision/purge.test.js:211-246`.
3. **P1 - Pre-marker migration validated only top-level names, allowing an
   unrelated nested file under `bin` to become claimed state.** Fixed at
   `src/platform/ownership.js:138-216`: recognized state now validates type,
   owner, permissions, and managed-bin contents before writing the marker.
   Regression coverage is in `test/platform/ownership.test.js`.
4. **P2 - A malformed `--confirm` token reached the purge result schema and
   could become an internal error instead of a CLI usage error.** Fixed at
   `src/cli/commands/lifecycle.js:96-103` with the exported token schema and a
   CLI regression test.

## Residual risks and test gaps

- Native systemd-user lifecycle evidence remains P4/I-3; the current native
  proof is macOS x64 LaunchAgent.
- The non-AVX Bun host warning still contaminates one child-process stderr JSON
  assertion, and the unrelated real-process `lsof` timing test remains
  nondeterministic on this host.
- Desktop/Electron, signed/notarized packaging, macOS ARM64, and published
  artifact identity are future slices.

The final focused source matrix passes 33 tests with one documented unrelated
host failure, and the final six-artifact native lifecycle verification passes.
