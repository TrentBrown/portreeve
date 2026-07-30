// @ts-check

import { CommanderError } from 'commander';
import { z } from 'zod';
import { PortreeveClientError } from '../../packages/client/src/index.js';
import { EXIT_CODES } from '../protocol/constants.js';

export class CliUsageError extends Error {
  /**
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'CliUsageError';
    this.code = 'invalid_input';
    this.details = details;
  }
}

/**
 * @param {number} code
 */
export function setExitCode(code) {
  process.exitCode = code;
}

/**
 * @param {unknown} error
 */
export function exitCodeForError(error) {
  if (error instanceof CommanderError) {
    return error.exitCode === 0 ? EXIT_CODES.success : EXIT_CODES.invalidInput;
  }
  if (error instanceof z.ZodError || error instanceof CliUsageError) {
    return EXIT_CODES.invalidInput;
  }
  if (error instanceof PortreeveClientError) {
    if (error.code === 'unavailable') {
      return EXIT_CODES.unavailable;
    }
    if (error.code === 'incompatible_protocol') {
      return EXIT_CODES.incompatible;
    }
    if (error.code === 'invalid_input' || error.status === 400) {
      return EXIT_CODES.invalidInput;
    }
    if (
      error.code === 'conflict' ||
      error.code === 'not_found' ||
      error.status === 404 ||
      error.status === 409
    ) {
      return EXIT_CODES.conflict;
    }
  }
  return EXIT_CODES.internal;
}

/**
 * @param {unknown} error
 */
export function cliErrorBody(error) {
  if (error instanceof z.ZodError) {
    return {
      code: 'invalid_input',
      message: 'Invalid command input.',
      details: { issues: error.issues },
    };
  }
  if (error instanceof CliUsageError || error instanceof PortreeveClientError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  if (error instanceof CommanderError) {
    return {
      code: 'invalid_input',
      message: error.message,
      details: { commanderCode: error.code },
    };
  }
  return {
    code: 'internal',
    message: error instanceof Error ? error.message : String(error),
    details: {},
  };
}
