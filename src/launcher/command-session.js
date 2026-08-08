// @ts-check

import { spawn } from 'node:child_process';
import { userInfo } from 'node:os';
import { z } from 'zod';

export const LAUNCHER_OUTPUT_LIMIT_BYTES = 1_048_576;
export const LAUNCHER_TERMINATION_GRACE_MILLISECONDS = 2_000;

const OutputChunkSchema = z
  .object({
    sequence: z.number().int().min(0),
    stream: z.enum(['stdout', 'stderr', 'system']),
    text: z.string(),
  })
  .strict();

export const LauncherCommandResultSchema = z
  .object({
    outcome: z.enum(['succeeded', 'failed', 'cancelled', 'timed-out']),
    shellPath: z.string().min(1),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    durationMilliseconds: z.number().int().min(0),
    exitCode: z.number().int().min(0).max(255).nullable(),
    signal: z.string().nullable(),
    processGroupId: z.number().int().positive().nullable(),
    output: z
      .object({
        chunks: z.array(OutputChunkSchema),
        truncated: z.boolean(),
        retainedBytes: z.number().int().min(0),
        totalBytes: z.number().int().min(0),
      })
      .strict(),
    failure: z
      .object({ code: z.string().min(1), message: z.string().min(1) })
      .strict()
      .nullable(),
  })
  .strict();

/**
 * Resolve one visible POSIX login shell. Arbitrary executables are deliberately absent
 * from the launcher contract; explicit Bash and Zsh selections use their conventional
 * portable command names and the system selection uses the account login shell.
 *
 * @param {'system' | 'bash' | 'zsh'} selection
 * @param {{platform?: NodeJS.Platform, environment?: NodeJS.ProcessEnv, accountShell?: () => string | null}} [options]
 */
export function resolveLauncherShell(selection, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin' && platform !== 'linux') {
    throw commandError(
      'launcher_platform_unsupported',
      'Launcher commands are supported only on macOS and Linux.',
    );
  }
  if (selection === 'bash') return 'bash';
  if (selection === 'zsh') return 'zsh';
  const accountShell = options.accountShell ?? (() => userInfo().shell || null);
  const shell = accountShell() ?? options.environment?.SHELL ?? process.env.SHELL;
  return typeof shell === 'string' && shell.startsWith('/') ? shell : '/bin/sh';
}

/**
 * Run one finite, non-interactive shell command in its own POSIX process group.
 *
 * @param {{
 *   command: string,
 *   shellPath: string,
 *   workingDirectory: string,
 *   environment: Record<string, string>,
 *   inheritedEnvironment?: NodeJS.ProcessEnv,
 *   timeoutMilliseconds: number,
 *   signal?: AbortSignal,
 *   onOutput?: (chunk: z.infer<typeof OutputChunkSchema>) => void,
 *   outputLimitBytes?: number,
 *   terminationGraceMilliseconds?: number,
 *   now?: () => Date,
 *   spawnProcess?: typeof spawn,
 *   signalProcessGroup?: (processGroupId: number, signal: NodeJS.Signals) => void,
 * }} input
 */
export async function runFiniteCommand(input) {
  const started = (input.now ?? (() => new Date()))();
  const output = createOutputTail(
    input.outputLimitBytes ?? LAUNCHER_OUTPUT_LIMIT_BYTES,
  );
  let sequence = 0;
  const emit = (
    /** @type {'stdout' | 'stderr' | 'system'} */ stream,
    /** @type {string | Buffer} */ value,
  ) => {
    const chunk = OutputChunkSchema.parse({
      sequence,
      stream,
      text: Buffer.isBuffer(value) ? value.toString('utf8') : String(value),
    });
    sequence += 1;
    output.append(chunk);
    try {
      input.onOutput?.(chunk);
    } catch {
      // Output observers cannot be allowed to crash or alter the command session.
    }
  };
  if (input.signal?.aborted) {
    return commandResult({
      outcome: 'cancelled',
      shellPath: input.shellPath,
      started,
      completed: (input.now ?? (() => new Date()))(),
      exitCode: null,
      signal: null,
      processGroupId: null,
      output: output.result(),
      failure: commandFailure(
        'launcher_command_cancelled',
        'The command was cancelled.',
      ),
    });
  }

  const spawnProcess = input.spawnProcess ?? spawn;
  const signalProcessGroup =
    input.signalProcessGroup ??
    ((processGroupId, signal) => {
      process.kill(-processGroupId, signal);
    });
  let child;
  try {
    child = spawnProcess(input.shellPath, ['-l', '-c', input.command], {
      cwd: input.workingDirectory,
      detached: true,
      env: mergeEnvironment(input.environment, input.inheritedEnvironment),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return commandResult({
      outcome: 'failed',
      shellPath: input.shellPath,
      started,
      completed: (input.now ?? (() => new Date()))(),
      exitCode: null,
      signal: null,
      processGroupId: null,
      output: output.result(),
      failure: errorFailure('launcher_command_spawn_failed', error),
    });
  }
  const processGroupId = child.pid ?? null;
  child.stdout?.on('data', (chunk) => emit('stdout', chunk));
  child.stderr?.on('data', (chunk) => emit('stderr', chunk));

  return new Promise((resolvePromise) => {
    let settled = false;
    let termination = /** @type {'cancelled' | 'timed-out' | null} */ (null);
    let terminationSignal = /** @type {NodeJS.Signals | null} */ (null);
    let processFailure = /** @type {{code: string, message: string} | null} */ (null);
    let terminationTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
    const timeoutTimer = setTimeout(
      () => terminate('timed-out'),
      input.timeoutMilliseconds,
    );
    timeoutTimer.unref?.();

    const abort = () => terminate('cancelled');
    input.signal?.addEventListener('abort', abort, { once: true });

    /** @param {'cancelled' | 'timed-out'} outcome */
    function terminate(outcome) {
      if (settled || termination !== null) return;
      termination = outcome;
      if (processGroupId === null) return;
      terminationSignal = signalGroup('SIGTERM');
      terminationTimer = setTimeout(() => {
        if (settled) return;
        terminationSignal = signalGroup('SIGKILL') ?? terminationSignal;
      }, input.terminationGraceMilliseconds ?? LAUNCHER_TERMINATION_GRACE_MILLISECONDS);
      terminationTimer.unref?.();
    }

    /** @param {NodeJS.Signals} signal */
    function signalGroup(signal) {
      if (processGroupId === null) return null;
      try {
        signalProcessGroup(processGroupId, signal);
        return signal;
      } catch (error) {
        if (!hasCode(error, 'ESRCH')) {
          emit(
            'system',
            `[PortReeve could not send ${signal}: ${errorMessage(error)}]\n`,
          );
        }
        return null;
      }
    }

    /** @param {number | null} exitCode @param {NodeJS.Signals | null} signal */
    function finish(exitCode, signal) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (terminationTimer !== null) clearTimeout(terminationTimer);
      input.signal?.removeEventListener('abort', abort);
      const completed = (input.now ?? (() => new Date()))();
      const outcome =
        termination ?? (exitCode === 0 ? 'succeeded' : /** @type {const} */ ('failed'));
      resolvePromise(
        commandResult({
          outcome,
          shellPath: input.shellPath,
          started,
          completed,
          exitCode,
          signal: signal ?? terminationSignal,
          processGroupId,
          output: output.result(),
          failure:
            processFailure ??
            (outcome === 'succeeded'
              ? null
              : commandFailure(
                  outcome === 'timed-out'
                    ? 'launcher_command_timed_out'
                    : outcome === 'cancelled'
                      ? 'launcher_command_cancelled'
                      : 'launcher_command_failed',
                  outcome === 'timed-out'
                    ? 'The command exceeded its configured timeout.'
                    : outcome === 'cancelled'
                      ? 'The command was cancelled.'
                      : `The command exited with ${exitCode === null ? `signal ${signal ?? 'unknown'}` : `code ${exitCode}`}.`,
                )),
        }),
      );
    }

    child.once('error', (error) => {
      processFailure = errorFailure('launcher_command_spawn_failed', error);
      emit(
        'system',
        `[PortReeve could not start the command: ${errorMessage(error)}]\n`,
      );
      finish(null, null);
    });
    child.once('close', finish);
  });
}

/** @param {Record<string, string>} injected @param {NodeJS.ProcessEnv} [inherited] */
function mergeEnvironment(injected, inherited = process.env) {
  /** @type {Record<string, string>} */
  const environment = {};
  for (const [name, value] of Object.entries(inherited)) {
    if (value !== undefined && !name.startsWith('PORTREEVE_')) {
      environment[name] = value;
    }
  }
  return { ...environment, ...injected };
}

/** @param {number} limit */
function createOutputTail(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw commandError('launcher_output_limit_invalid', 'The output limit is invalid.');
  }
  /** @type {Array<z.infer<typeof OutputChunkSchema> & {bytes: number}>} */
  const chunks = [];
  let retainedBytes = 0;
  let totalBytes = 0;
  let truncated = false;
  return {
    /** @param {z.infer<typeof OutputChunkSchema>} chunk */
    append(chunk) {
      const bytes = Buffer.byteLength(chunk.text, 'utf8');
      totalBytes += bytes;
      chunks.push({ ...chunk, bytes });
      retainedBytes += bytes;
      while (retainedBytes > limit && chunks.length > 0) {
        const first = chunks[0];
        if (first === undefined) break;
        const excess = retainedBytes - limit;
        if (first.bytes <= excess) {
          chunks.shift();
          retainedBytes -= first.bytes;
        } else {
          const value = utf8Suffix(first.text, first.bytes - excess);
          retainedBytes -= first.bytes - Buffer.byteLength(value, 'utf8');
          chunks[0] = {
            ...first,
            text: value,
            bytes: Buffer.byteLength(value, 'utf8'),
          };
        }
        truncated = true;
      }
    },
    result() {
      const retained = chunks.map((chunk) => ({
        sequence: chunk.sequence,
        stream: chunk.stream,
        text: chunk.text,
      }));
      if (truncated) {
        retained.unshift({
          sequence: retained[0]?.sequence ?? 0,
          stream: 'system',
          text: '[PortReeve: earlier output truncated]\n',
        });
      }
      return { chunks: retained, truncated, retainedBytes, totalBytes };
    },
  };
}

/** @param {string} value @param {number} maximumBytes */
export function utf8Suffix(value, maximumBytes) {
  const characters = Array.from(value);
  let retainedBytes = 0;
  let index = characters.length;
  while (index > 0) {
    const character = characters[index - 1];
    if (character === undefined) break;
    const bytes = Buffer.byteLength(character, 'utf8');
    if (retainedBytes + bytes > maximumBytes) break;
    retainedBytes += bytes;
    index -= 1;
  }
  return characters.slice(index).join('');
}

/** @param {{outcome: 'succeeded' | 'failed' | 'cancelled' | 'timed-out', shellPath: string, started: Date, completed: Date, exitCode: number | null, signal: string | null, processGroupId: number | null, output: ReturnType<ReturnType<typeof createOutputTail>['result']>, failure: {code: string, message: string} | null}} value */
function commandResult(value) {
  return LauncherCommandResultSchema.parse({
    outcome: value.outcome,
    shellPath: value.shellPath,
    startedAt: value.started.toISOString(),
    completedAt: value.completed.toISOString(),
    durationMilliseconds: Math.max(
      0,
      value.completed.getTime() - value.started.getTime(),
    ),
    exitCode: value.exitCode,
    signal: value.signal,
    processGroupId: value.processGroupId,
    output: value.output,
    failure: value.failure,
  });
}

/** @param {string} code @param {string} message */
function commandFailure(code, message) {
  return { code, message };
}

/** @param {string} code @param {unknown} error */
function errorFailure(code, error) {
  return commandFailure(code, errorMessage(error));
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {unknown} error @param {string} code */
function hasCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code;
}

/** @param {string} code @param {string} message */
function commandError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
