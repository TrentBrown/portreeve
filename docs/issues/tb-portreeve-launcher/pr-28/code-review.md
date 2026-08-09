# Code Review - PR #28

**Pinned diff:**
`3c5ce33d983a3e0b2d139642b5005f6bccc4bebf..34f2a16a4711a96c070f4304010fea7d55fb5536`

## Findings

No findings.

The final review specifically checked:

- negative-PID signals target only the detached child process group;
- stdin is closed and no PTY or daemon execution path exists;
- timeout, cancellation, spawn failure, observer failure, and signal failure settle to
  structured results;
- UTF-8 output truncation remains within the byte limit and composed Restart retains at
  most one megabyte across both steps;
- inherited `PORTREEVE_*` values cannot contaminate current context;
- Start gates are repeated after daemon admission and exact generation drift refuses
  execution;
- Stop never prepares a generation solely for cleanup and never calls reclamation;
- operation renewal loss aborts execution, an active renewal settles before completion,
  and completion metadata contains neither commands, environment, nor raw output;
- degraded behavior cannot run Start/Restart and requires exact cache plus explicit Stop
  confirmation.

## Corrections made before the pinned review

- Serialized in-flight renewal with terminal completion to remove a daemon-session race.
- Applied the one-megabyte retained-output cap across an entire composed Restart rather
  than independently retaining one megabyte for each step.
- Made truncation UTF-8 safe and scrubbed stale inherited reserved context.

## Residual risks and test gaps

- Linux process-group behavior is not executable on this macOS host and remains a native
  CI/P5 verification obligation.
- CLI and Desktop callers do not exist in this slice, so cancellation wiring and visible
  diagnostics across those boundaries are not yet end-to-end testable.
- Shell startup files can alter execution, which is an explicit property of choosing a
  user login shell and remains within the approved trust limitation.
