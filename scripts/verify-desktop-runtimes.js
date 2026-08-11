// @ts-check

import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const electronBinary = /** @type {string} */ (require('electron'));
const runner = resolve('scripts', 'run-desktop-runtime-contract.js');

const bun = await runContract(process.execPath, {}, 'Bun');
const electron = await runContract(
  electronBinary,
  { ELECTRON_RUN_AS_NODE: '1' },
  'Electron Node',
);
if (!bun.runtime.startsWith('bun-') || !electron.runtime.startsWith('electron-')) {
  throw new Error('Desktop runtime contract did not execute under both runtimes.');
}
if (bun.controllerVersion !== electron.controllerVersion) {
  throw new Error('Desktop runtime controller identities do not match.');
}
console.log(
  `Verified the Desktop direct-controller contract under ${bun.runtime} and ${electron.runtime}.`,
);

/** @param {string} executable @param {NodeJS.ProcessEnv} environment @param {string} label */
async function runContract(executable, environment, label) {
  let result;
  try {
    result = await execute(executable, [runner], {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 64 * 1024,
    });
  } catch (error) {
    throw new Error(
      `${label} Desktop runtime contract failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const line = result.stdout.trim().split(/\r?\n/u).at(-1);
  if (line === undefined) {
    throw new Error(`${label} Desktop runtime contract returned no evidence.`);
  }
  return JSON.parse(line);
}
