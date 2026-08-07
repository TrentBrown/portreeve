// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PORTREEVE_PROTOCOL_RANGE,
  canonicalStackRoot,
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

test('client preserves an explicitly selected stack root inside a Git worktree', async () => {
  expect(await canonicalStackRoot(resolve('src'))).toBe(await realpath(resolve('src')));
  expect(await canonicalStackRoot(resolve('src'))).not.toBe(
    await canonicalWorkspaceRoot(resolve('src')),
  );
});

test('client refuses to treat a file as a stack root', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'portreeve-stack-root-'));
  const filename = resolve(directory, 'not-a-directory');
  try {
    await writeFile(filename, '');
    await expect(canonicalStackRoot(filename)).rejects.toThrow('must be a directory');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
