// @ts-check

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { errorCode, isMissingFile } from '../platform/errors.js';

const execFileAsync = promisify(execFile);

/**
 * @param {string} executable
 * @param {string[]} args
 */
export async function runCommand(executable, args) {
  try {
    const result = await execFileAsync(executable, args, {
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    if (isMissingFile(error)) {
      return {
        code: 127,
        stdout: '',
        stderr: `Executable not found in $PATH: ${JSON.stringify(executable)}`,
      };
    }
    const exitCode = errorCode(error);
    if (error instanceof Error && typeof exitCode === 'number') {
      return {
        code: exitCode,
        stdout:
          'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '',
        stderr:
          'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '',
      };
    }
    throw error;
  }
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
