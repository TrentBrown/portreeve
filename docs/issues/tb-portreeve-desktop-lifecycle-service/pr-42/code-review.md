# Code Review - PR #42

**Focused diff:** `a52e80f30188512dc44447f3247981e59294ead3..7e5460649fa9df5eb64ed7126c2e542b24a4cedc`

## Findings

No findings.

## Review Notes

- The holder is a genuine second process running `LifecycleService.restart()`,
  not a raw socket-only surrogate.
- Read availability is proven through `status()` and evidence-bound purge
  preview while the mutation lease is held.
- The test waits for the holder to enter manager mutation before contending,
  then waits for actual process exit after SIGKILL before next-launch recovery.
- Recovery re-enters the public service boundary and completes a new mutation;
  it does not delete a lock based on stored PID metadata.
- The Desktop test binds both production close guards to one actual
  `createStateCoordinator` mutation and checks the exact active-operation state.
- Temporary runtime state and child processes are cleaned in `finally`.

## Residual Risks and Test Gaps

- SIGKILL cannot be prevented by a normal-close guard, so interruption recovery
  and graceful Desktop close protection are necessarily separate tests.
- The packaged app does not expose a privileged mutation test hook. Native
  launchd/systemd-user mutations are instead exercised by the isolated release
  matrix on four hosts, while the packaged smoke verifies safe startup and
  direct-controller packaging.
