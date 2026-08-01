// @ts-check

import { spawn } from 'node:child_process';
import { LifecycleStatusSchema } from '../../../src/supervision/schemas.js';

/**
 * @param {{executablePath: string, run?: typeof runExecutable}} options
 */
export function createLifecycleAdapter(options) {
  const run = options.run ?? runExecutable;
  return Object.freeze({
    async status() {
      const result = await run(options.executablePath, ['status', '--json']);
      let envelope;
      try {
        envelope = JSON.parse(result.stdout);
      } catch {
        throw desktopAdapterError(
          'invalid_lifecycle_json',
          'Portreeve returned invalid lifecycle data.',
        );
      }
      if (
        typeof envelope !== 'object' ||
        envelope === null ||
        envelope.version !== 1 ||
        !('status' in envelope)
      ) {
        throw desktopAdapterError(
          'invalid_lifecycle_envelope',
          'Portreeve returned an unsupported lifecycle envelope.',
        );
      }
      const parsed = LifecycleStatusSchema.safeParse(envelope.status);
      if (!parsed.success) {
        throw desktopAdapterError(
          'invalid_lifecycle_status',
          'Portreeve returned an unsupported lifecycle status.',
        );
      }
      return parsed.data;
    },
  });
}

/**
 * @param {string} executablePath
 * @param {string[]} arguments_
 * @param {number} [timeoutMilliseconds]
 */
export function runExecutable(
  executablePath,
  arguments_,
  timeoutMilliseconds = 10_000,
) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executablePath, arguments_, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    /** @type {'lifecycle_timeout'|'lifecycle_output_limit'|null} */
    let termination = null;
    const limit = 1024 * 1024;
    const timeout = setTimeout(() => {
      termination = 'lifecycle_timeout';
      child.kill('SIGKILL');
    }, timeoutMilliseconds);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > limit) {
        termination = 'lifecycle_output_limit';
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > limit) {
        termination = 'lifecycle_output_limit';
        child.kill('SIGKILL');
      }
    });
    child.on('error', () => {
      clearTimeout(timeout);
      reject(
        desktopAdapterError(
          'lifecycle_unavailable',
          'The bundled Portreeve CLI could not be started.',
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (termination === 'lifecycle_timeout') {
        reject(
          desktopAdapterError(
            'lifecycle_timeout',
            'The bundled Portreeve CLI did not respond in time.',
          ),
        );
        return;
      }
      if (termination === 'lifecycle_output_limit') {
        reject(
          desktopAdapterError(
            'lifecycle_output_limit',
            'The bundled Portreeve CLI exceeded its output limit.',
          ),
        );
        return;
      }
      resolvePromise({ stdout, exitCode: code ?? 70 });
    });
  });
}

/** @param {string} code @param {string} message */
function desktopAdapterError(code, message) {
  const error = new Error(message);
  Object.assign(error, { code });
  return error;
}
