// @ts-check

import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findEnclosingStackDefinition,
  selectRegisteredEnclosingStack,
  selectStackDefinition,
} from '../../src/cli/stack-selection.js';
import { CliUsageError } from '../../src/cli/exit.js';

test('definition selection discovers the nearest ancestor independently of Git', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-selection-'));
  const outerRoot = join(directory, 'outer');
  const innerRoot = join(outerRoot, 'component');
  const sourceDirectory = join(innerRoot, 'src', 'routes');
  const outerDefinition = join(outerRoot, 'portreeve.stack.json');
  const innerDefinition = join(innerRoot, 'portreeve.stack.json');
  await mkdir(join(innerRoot, '.git'), { recursive: true });
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(outerDefinition, '{}');
  await writeFile(innerDefinition, '{}');

  try {
    const canonicalInnerRoot = await realpath(innerRoot);
    const canonicalOuterRoot = await realpath(outerRoot);
    await expect(findEnclosingStackDefinition(sourceDirectory)).resolves.toEqual({
      filename: join(canonicalInnerRoot, 'portreeve.stack.json'),
      stackRoot: canonicalInnerRoot,
    });
    await expect(
      selectStackDefinition({ stackRoot: outerRoot, cwd: sourceDirectory }),
    ).resolves.toEqual({
      filename: join(canonicalOuterRoot, 'portreeve.stack.json'),
      stackRoot: canonicalOuterRoot,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('definition selection rejects competing explicit selectors', async () => {
  await expect(
    selectStackDefinition({ file: 'definition.json', stackRoot: 'stack' }),
  ).rejects.toBeInstanceOf(CliUsageError);
});

test('registered-root fallback uses path boundaries and rejects invalid overlap', () => {
  const stack = { id: 'stack-a', stackRoot: '/tmp/customer-stack' };
  expect(
    selectRegisteredEnclosingStack([stack], '/tmp/customer-stack/services/api'),
  ).toBe(stack);
  expect(
    selectRegisteredEnclosingStack([stack], '/tmp/customer-stack-copy'),
  ).toBeNull();
  expect(() =>
    selectRegisteredEnclosingStack(
      [stack, { id: 'stack-b', stackRoot: '/tmp/customer-stack/services' }],
      '/tmp/customer-stack/services/api',
    ),
  ).toThrow('non-overlapping-root invariant');
});
