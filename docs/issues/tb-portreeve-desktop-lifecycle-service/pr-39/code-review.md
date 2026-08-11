# Code Review - PR 39

**Scope:** slice
**Base:** `6e2b36359d3ecc788ed6f328bf24fd2f30366f32`
**Head:** `7efceb1c2fe0adbea0d457579d00b4b355f1240d`

## Findings

No actionable findings.

## Contract and scope review

- Electron main constructs exactly one direct lifecycle controller from the
  checksum-verified artifact. No renderer input can select its executable,
  home, socket, supervisor, environment, paths, or native arguments.
- The shared `LifecycleService` now owns Desktop status, install/upgrade,
  start, stop, manual stop, restart, uninstall, purge preview, and purge
  execution. The old lifecycle `spawn` adapter, stdout/stderr buffering,
  process timeout, CLI JSON parsing, and fallback tests are removed.
- The verified artifact path is passed only as `sourceExecutable`, preserving
  the exact installation and upgrade bytes rather than installing Electron's
  embedded JavaScript.
- The controller validates all direct service results against the same strict
  lifecycle and purge schemas consumed elsewhere. It also verifies operation
  identity and purge token identity.
- Purge confirmation tokens remain confined to Electron main, are cleared by
  competing mutations, and are consumed once before execution.
- Embedded controller and artifact versions are semantic versions and must be
  exactly equal for mutation. Mismatch refuses before service entry while
  preserving status and preview reads.
- The renderer receives only version, mutation availability, and a stable safe
  error. Strict schema refinement prevents contradictory enabled/error state.
- Mismatch is visible in the versions panel, current-error banner, lifecycle
  guidance, absent action set, and preview-only purge dialog. Stack actions
  remain available because their derivation reacts only to stack errors.
- Host-sensitive lifecycle CLI tests now inject unique launchd labels and
  systemd units, so a developer's legitimate global PortReeve installation is
  neither observed nor changed.

## Residual risks and test gaps

- `createService` and `controllerVersion` dependency injection are exported for
  deterministic main-process tests. Production startup supplies neither, and
  renderer IPC has no route to this constructor.
- Exact packaged controller/manifest identity, bundle inspection, and a full
  packaged Desktop smoke remain I-5/P6.
- Active-operation close blocking, complete renderer-safe diagnostics, and
  forced-interruption recovery remain I-4/I-6.
- Real Linux systemd-user and complete macOS launchd lifecycle execution remain
  I-6/P7.

None is a regression or an in-scope blocker for I-3.
