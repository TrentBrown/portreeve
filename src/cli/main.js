#!/usr/bin/env bun
// @ts-check

import { createProgram } from './program.js';
import { cliErrorBody, exitCodeForError } from './exit.js';

const program = createProgram();
configureCommand(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const body = cliErrorBody(error);
  if (process.argv.includes('--json')) {
    console.error(JSON.stringify({ version: 1, error: body }));
  } else if (!(
    error instanceof Error &&
    'code' in error &&
    (error.code === 'commander.helpDisplayed' || error.code === 'commander.version')
  )) {
    console.error(`${body.code}: ${body.message}`);
  }
  process.exitCode = exitCodeForError(error);
}

/**
 * @param {import('commander').Command} command
 */
function configureCommand(command) {
  command.exitOverride();
  command.configureOutput({
    writeErr() {},
  });
  for (const child of command.commands) {
    configureCommand(child);
  }
}
