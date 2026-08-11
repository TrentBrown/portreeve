#!/usr/bin/env bun
// @ts-check

import { generateClientGuides } from './client-guides-lib.js';

const check = process.argv.includes('--check');
const unexpected = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unexpected.length > 0) {
  console.error(`Unexpected client-guide arguments: ${unexpected.join(' ')}`);
  process.exitCode = 2;
} else {
  const result = await generateClientGuides({ root: process.cwd(), write: !check });
  if (check && result.changed.length > 0) {
    console.error(`Client guide artifacts are stale: ${result.changed.join(', ')}`);
    console.error('Run `bun run docs:generate` and commit the results.');
    process.exitCode = 1;
  } else {
    console.log(
      `${check ? 'Verified' : 'Generated'} ${result.cliCommands} CLI commands and ${result.mcpTools} MCP tools${result.changed.length === 0 ? ' (already current)' : `; updated ${result.changed.join(', ')}`}.`,
    );
  }
}
