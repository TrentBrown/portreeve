// @ts-check

import { expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStackAdapter } from '../../apps/desktop/main/stack-adapter.js';
import { stackStatus } from './fixtures.js';

test('uses the official client for current stack status and component resolution', async () => {
  const fixture = stackStatus();
  const fixtureResolution = fixture.resolutions[0]?.resolution;
  if (fixtureResolution === undefined)
    throw new Error('Expected a resolution fixture.');
  /** @type {string[]} */
  const resolved = [];
  const adapter = createStackAdapter(
    /** @type {any} */ ({
      async listStacks() {
        return [fixture.stack];
      },
      /** @param {string} stackId */
      async getStackStatus(stackId) {
        expect(stackId).toBe(fixture.stack.id);
        return fixture;
      },
      /** @param {string} activationId @param {string} component */
      async resolveStackEndpoints(activationId, component) {
        resolved.push(component);
        return {
          ...fixtureResolution,
          activationId,
          component,
        };
      },
    }),
    {
      async selectDefinitionFile() {
        return null;
      },
    },
  );
  const result = await adapter.list();
  expect(result).toHaveLength(1);
  expect(resolved.sort()).toEqual(['api', 'website']);
  const first = result[0];
  if (first === undefined) throw new Error('Expected one stack.');
  expect(first.resolutions.every(({ error }) => error === null)).toBe(true);
});

test('owns file selection and submits the selected definition directory as stack root', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-desktop-stack-'));
  const filename = join(directory, 'portreeve.stack.json');
  const fixture = stackStatus();
  await writeFile(filename, JSON.stringify(fixture.stack.definition));
  let submitted;
  const adapter = createStackAdapter(
    /** @type {any} */ ({
      /** @param {any} input */
      async applyStack(input) {
        submitted = input;
        return { changed: true, stack: fixture.stack };
      },
    }),
    {
      async selectDefinitionFile() {
        return filename;
      },
    },
  );
  expect(await adapter.applySelectedDefinition()).toMatchObject({
    cancelled: false,
    result: { changed: true },
  });
  expect(/** @type {any} */ (submitted)).toEqual({
    stackRoot: directory,
    definition: fixture.stack.definition,
  });
});

test('reports malformed selected JSON without exposing its path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-desktop-stack-'));
  const filename = join(directory, 'portreeve.stack.json');
  await writeFile(filename, '{nope');
  const adapter = createStackAdapter(/** @type {any} */ ({}), {
    async selectDefinitionFile() {
      return filename;
    },
  });
  try {
    await adapter.applySelectedDefinition();
    throw new Error('Expected malformed JSON to fail.');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'invalid_stack_definition_file',
      message: 'The selected stack definition is not valid JSON.',
    });
    expect(String(error)).not.toContain(directory);
  }
});
