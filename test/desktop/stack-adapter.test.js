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
  /** @type {string[]} */
  const remembered = [];
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
      documents: {
        /** @param {any} stack */
        rememberStack(stack) {
          remembered.push(stack.id);
        },
      },
    },
  );
  const result = await adapter.list();
  expect(result).toHaveLength(1);
  expect(resolved.sort()).toEqual(['api', 'website']);
  const first = result[0];
  if (first === undefined) throw new Error('Expected one stack.');
  expect(first.resolutions.every(({ error }) => error === null)).toBe(true);
  expect(remembered).toEqual([fixture.stack.id]);
});

test('routes only opaque document capabilities to the trusted document service', async () => {
  /** @type {any[]} */
  const calls = [];
  const documents = {
    async openSelected() {
      calls.push(['open-selected']);
      return { outcome: 'cancelled' };
    },
    /** @param {string} stackId */
    async openKnown(stackId) {
      calls.push(['open-known', stackId]);
      return { outcome: 'opened' };
    },
    /** @param {any} request */
    async save(request) {
      calls.push(['save', request]);
      return { outcome: 'saved-and-applied' };
    },
    /** @param {string} documentId */
    async retryApply(documentId) {
      calls.push(['retry', documentId]);
      return { outcome: 'applied' };
    },
  };
  const adapter = createStackAdapter(/** @type {any} */ ({}), {
    documents,
    async selectDefinitionFile() {
      return null;
    },
  });
  const stackId = '44444444-4444-4444-8444-444444444444';
  const documentId = '99999999-9999-4999-8999-999999999999';
  const request = { documentId, content: '{}', conflictToken: null };

  expect(await adapter.openStackDocument()).toEqual({ outcome: 'cancelled' });
  expect(await adapter.openKnownStackDocument(stackId)).toEqual({ outcome: 'opened' });
  expect(await adapter.saveStackDocument(request)).toEqual({
    outcome: 'saved-and-applied',
  });
  expect(await adapter.retryStackDocumentApply(documentId)).toEqual({
    outcome: 'applied',
  });
  expect(calls).toEqual([
    ['open-selected'],
    ['open-known', stackId],
    ['save', request],
    ['retry', documentId],
  ]);
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
