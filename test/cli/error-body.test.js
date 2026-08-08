// @ts-check

import { expect, test } from 'bun:test';
import { CommanderError } from 'commander';
import { z } from 'zod';
import { PortreeveClientError } from '../../packages/client/src/index.js';
import {
  CliUsageError,
  cliErrorBody,
  exitCodeForError,
  setExitCode,
} from '../../src/cli/exit.js';
import { EXIT_CODES } from '../../src/protocol/constants.js';

/** @returns {z.ZodError} */
function zodError() {
  const parsed = z.object({ port: z.number() }).safeParse({ port: 'nope' });
  if (parsed.success) {
    throw new Error('Fixture parse unexpectedly succeeded.');
  }
  return parsed.error;
}

test('maps successful help and version requests apart from usage failures', () => {
  expect(
    exitCodeForError(new CommanderError(0, 'commander.helpDisplayed', 'help')),
  ).toBe(EXIT_CODES.success);
  expect(
    exitCodeForError(new CommanderError(1, 'commander.unknownOption', 'bad')),
  ).toBe(EXIT_CODES.invalidInput);
});

test('maps schema, status-only, and unclassified client failures', () => {
  expect(exitCodeForError(zodError())).toBe(EXIT_CODES.invalidInput);
  expect(
    exitCodeForError(
      new PortreeveClientError('bad request', { code: 'internal', status: 400 }),
    ),
  ).toBe(EXIT_CODES.invalidInput);
  expect(
    exitCodeForError(new PortreeveClientError('missing', { code: 'not_found' })),
  ).toBe(EXIT_CODES.conflict);
  expect(
    exitCodeForError(
      new PortreeveClientError('gone', { code: 'internal', status: 404 }),
    ),
  ).toBe(EXIT_CODES.conflict);
  expect(
    exitCodeForError(new PortreeveClientError('internal', { code: 'internal' })),
  ).toBe(EXIT_CODES.internal);
  expect(exitCodeForError('not an error')).toBe(EXIT_CODES.internal);
});

test('renders machine-readable bodies for every recognized failure shape', () => {
  expect(cliErrorBody(zodError())).toMatchObject({
    code: 'invalid_input',
    message: 'Invalid command input.',
    details: { issues: expect.any(Array) },
  });
  expect(cliErrorBody(new CliUsageError('bad usage', { key: 'limit' }))).toEqual({
    code: 'invalid_input',
    message: 'bad usage',
    details: { key: 'limit' },
  });
  expect(
    cliErrorBody(
      new PortreeveClientError('conflicting', {
        code: 'conflict',
        details: { port: 3000 },
      }),
    ),
  ).toEqual({
    code: 'conflict',
    message: 'conflicting',
    details: { port: 3000 },
  });
  expect(
    cliErrorBody(
      new CommanderError(1, 'commander.missingArgument', 'missing argument'),
    ),
  ).toEqual({
    code: 'invalid_input',
    message: 'missing argument',
    details: { commanderCode: 'commander.missingArgument' },
  });
  expect(cliErrorBody(new Error('unexpected'))).toEqual({
    code: 'internal',
    message: 'unexpected',
    details: {},
  });
  expect(cliErrorBody('plain rejection')).toEqual({
    code: 'internal',
    message: 'plain rejection',
    details: {},
  });
});

test('publishes the exit code through the process contract', () => {
  const previous = process.exitCode ?? 0;
  try {
    setExitCode(EXIT_CODES.stateDifference);
    expect(process.exitCode).toBe(EXIT_CODES.stateDifference);
  } finally {
    process.exitCode = previous;
  }
});
