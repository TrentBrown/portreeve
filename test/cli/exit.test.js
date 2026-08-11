// @ts-check

import { expect, test } from 'bun:test';
import { PortreeveClientError } from '../../packages/client/src/index.js';
import {
  CliUsageError,
  exitCodeForError,
  exitCodeForErrorCode,
} from '../../src/cli/exit.js';
import { EXIT_CODES } from '../../src/protocol/constants.js';

test('maps stable CLI exit-code bands', () => {
  expect(EXIT_CODES.stateDifference).toBe(10);
  expect(
    exitCodeForError(
      new PortreeveClientError('conflict', { code: 'conflict', status: 409 }),
    ),
  ).toBe(20);
  expect(
    exitCodeForError(new PortreeveClientError('unavailable', { code: 'unavailable' })),
  ).toBe(30);
  expect(
    exitCodeForError(
      new PortreeveClientError('incompatible', {
        code: 'incompatible_protocol',
        status: 426,
      }),
    ),
  ).toBe(40);
  expect(exitCodeForError(new CliUsageError('invalid'))).toBe(50);
  expect(exitCodeForError(new Error('unexpected'))).toBe(70);
  expect(exitCodeForErrorCode('conflict')).toBe(20);
  expect(exitCodeForErrorCode('unavailable')).toBe(30);
  expect(exitCodeForErrorCode('incompatible_protocol')).toBe(40);
  expect(exitCodeForErrorCode('invalid_input')).toBe(50);
  expect(exitCodeForErrorCode('unexpected')).toBe(70);
});
