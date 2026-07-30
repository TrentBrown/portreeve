// @ts-check

import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PORTREEVE_PROTOCOL_RANGE,
  canonicalWorkspaceRoot,
} from '../../packages/client/src/index.js';

test('client package source is consumable from Bun', () => {
  expect(PORTREEVE_PROTOCOL_RANGE).toEqual({
    minimum: 1,
    maximum: 1,
  });
});

test('client package source is consumable from Node 22 or newer', async () => {
  const clientUrl = pathToFileURL(resolve('packages/client/src/index.js')).href;
  const node = Bun.spawn(
    [
      'node',
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(clientUrl)}).then((module) => console.log(JSON.stringify(module.PORTREEVE_PROTOCOL_RANGE)))`,
    ],
    {
      stderr: 'pipe',
      stdout: 'pipe',
    },
  );

  const exitCode = await node.exited;
  const error = await new Response(node.stderr).text();
  const output = await new Response(node.stdout).text();

  expect(exitCode, error).toBe(0);
  expect(JSON.parse(output.trim())).toEqual({
    minimum: 1,
    maximum: 1,
  });
});

test('client canonicalizes a path inside this Git worktree', async () => {
  expect(await canonicalWorkspaceRoot(resolve('src'))).toBe(
    await canonicalWorkspaceRoot(resolve('.')),
  );
});
