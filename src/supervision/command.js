// @ts-check

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DEFAULT_NATIVE_COMMAND_TIMEOUT_MILLISECONDS,
  LifecycleTimeoutError,
} from './deadline.js';

const execFileAsync = promisify(execFile);

/**
 * @param {string} executable
 * @param {string[]} args
 * @param {{
 *   timeoutMilliseconds?: number,
 *   signal?: AbortSignal,
 *   timeoutLayer?: string
 * }} [options]
 */
export async function runCommand(executable, args, options = {}) {
  const timeoutMilliseconds =
    options.timeoutMilliseconds ?? DEFAULT_NATIVE_COMMAND_TIMEOUT_MILLISECONDS;
  const timeoutLayer = options.timeoutLayer ?? 'native-command';
  try {
    const result = await execFileAsync(executable, args, {
      encoding: 'utf8',
      timeout: timeoutMilliseconds,
      killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    if (
      options.signal?.aborted ||
      hasCode(error, 'ABORT_ERR') ||
      hasCode(error, 'ETIMEDOUT') ||
      (error instanceof Error &&
        'killed' in error &&
        /** @type {{killed?: unknown}} */ (error).killed === true)
    ) {
      throw new LifecycleTimeoutError(timeoutLayer, timeoutMilliseconds);
    }
    if (hasCode(error, 'ENOENT')) {
      return {
        code: 127,
        stdout: '',
        stderr: `Executable not found in $PATH: ${JSON.stringify(executable)}`,
      };
    }
    if (
      error instanceof Error &&
      'code' in error &&
      typeof (/** @type {{code?: unknown}} */ (error).code) === 'number'
    ) {
      return {
        code: /** @type {{code: number}} */ (error).code,
        stdout:
          'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '',
        stderr:
          'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '',
      };
    }
    throw error;
  }
}

/** @param {unknown} error @param {string} code */
function hasCode(error, code) {
  return (
    error instanceof Error &&
    'code' in error &&
    /** @type {{code?: unknown}} */ (error).code === code
  );
}

/**
 * @param {{code: number, stdout: string, stderr: string}} result
 * @param {string} operation
 */
export function assertCommandSucceeded(result, operation) {
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || 'no output';
    throw new Error(`${operation} failed (${result.code}): ${detail}`);
  }
}
