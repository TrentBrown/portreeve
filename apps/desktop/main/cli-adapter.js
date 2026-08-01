// @ts-check

import { spawn } from 'node:child_process';
import {
  LifecycleMutationResultSchema,
  LifecycleStatusSchema,
} from '../../../src/supervision/schemas.js';
import {
  PurgePreviewSchema,
  PurgeResultSchema,
} from '../../../src/supervision/purge.js';

/**
 * @param {{executablePath: string, run?: typeof runExecutable}} options
 */
export function createLifecycleAdapter(options) {
  const run = options.run ?? runExecutable;
  /** @type {string|null} */
  let purgeToken = null;

  /** @param {string} operation */
  const mutate = async (operation) => {
    purgeToken = null;
    const envelope = await invokeJson(
      run,
      options.executablePath,
      [operation, '--json'],
      'lifecycle',
    );
    if (!('result' in envelope)) {
      throw desktopAdapterError(
        'invalid_lifecycle_envelope',
        'Portreeve returned an unsupported lifecycle envelope.',
      );
    }
    const parsed = LifecycleMutationResultSchema.safeParse(envelope.result);
    if (!parsed.success || parsed.data.operation !== operation) {
      throw desktopAdapterError(
        'invalid_lifecycle_result',
        'Portreeve returned an unsupported lifecycle result.',
      );
    }
    return parsed.data;
  };

  return Object.freeze({
    async status() {
      const envelope = await invokeJson(
        run,
        options.executablePath,
        ['status', '--json'],
        'lifecycle',
      );
      if (!('status' in envelope)) {
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
    install: () => mutate('install'),
    start: () => mutate('start'),
    stop: () => mutate('stop'),
    stopManual: () => mutate('stop-manual'),
    restart: () => mutate('restart'),
    uninstall: () => mutate('uninstall'),
    async previewPurge() {
      purgeToken = null;
      const envelope = await invokeJson(
        run,
        options.executablePath,
        ['purge', '--dry-run', '--json'],
        'purge',
        30_000,
      );
      if (!('preview' in envelope)) {
        throw desktopAdapterError(
          'invalid_purge_envelope',
          'Portreeve returned an unsupported purge preview.',
        );
      }
      const parsed = PurgePreviewSchema.safeParse(envelope.preview);
      if (!parsed.success) {
        throw desktopAdapterError(
          'invalid_purge_preview',
          'Portreeve returned an unsupported purge preview.',
        );
      }
      purgeToken = parsed.data.confirmationToken;
      return {
        allowed: parsed.data.allowed,
        root: parsed.data.root,
        paths: parsed.data.paths.map(({ path, type, size }) => ({ path, type, size })),
        refused: parsed.data.refused,
      };
    },
    async executePurge() {
      const token = purgeToken;
      purgeToken = null;
      if (token === null) {
        throw desktopAdapterError(
          'purge_preview_required',
          'A fresh purge preview is required before deletion.',
        );
      }
      const envelope = await invokeJson(
        run,
        options.executablePath,
        ['purge', '--confirm', token, '--json'],
        'purge',
        30_000,
      );
      if (!('result' in envelope)) {
        throw desktopAdapterError(
          'invalid_purge_envelope',
          'Portreeve returned an unsupported purge result.',
        );
      }
      const parsed = PurgeResultSchema.safeParse(envelope.result);
      if (!parsed.success || parsed.data.confirmationToken !== token) {
        throw desktopAdapterError(
          'invalid_purge_result',
          'Portreeve returned an unsupported purge result.',
        );
      }
      return {
        outcome: parsed.data.outcome,
        removed: parsed.data.removed,
        retained: parsed.data.retained,
        missing: parsed.data.missing,
        refused: parsed.data.refused,
      };
    },
    clearPurgePreview() {
      purgeToken = null;
    },
  });
}

/**
 * @param {typeof runExecutable} run
 * @param {string} executablePath
 * @param {string[]} arguments_
 * @param {'lifecycle'|'purge'} kind
 * @param {number} [timeoutMilliseconds]
 */
async function invokeJson(run, executablePath, arguments_, kind, timeoutMilliseconds) {
  const result = await run(executablePath, arguments_, timeoutMilliseconds);
  let envelope;
  try {
    envelope = JSON.parse(result.stdout);
  } catch {
    throw desktopAdapterError(
      `invalid_${kind}_json`,
      `Portreeve returned invalid ${kind} data.`,
    );
  }
  if (typeof envelope !== 'object' || envelope === null || envelope.version !== 1) {
    throw desktopAdapterError(
      `invalid_${kind}_envelope`,
      `Portreeve returned an unsupported ${kind} envelope.`,
    );
  }
  return /** @type {Record<string, unknown>} */ (envelope);
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
