// @ts-check

import { expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createStackDocumentService } from '../../apps/desktop/main/stack-document.js';
import { timestamp } from './fixtures.js';

test('opens a valid definition without exposing its path and requires fresh conflict evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-document-'));
  const stackRoot = join(directory, 'customer-stack');
  const childDirectory = join(stackRoot, 'frontend', 'src');
  const filename = join(stackRoot, 'portreeve.stack.json');
  const original = definitionContent('customer');
  const externalOne = definitionContent('external-one');
  const externalTwo = definitionContent('external-two');
  const candidate = definitionContent('edited');
  await mkdir(childDirectory, { recursive: true });
  await writeFile(filename, original);
  /** @type {Array<{stackRoot: string, definition: any, fileContent: string}>} */
  const applications = [];
  const service = createStackDocumentService(
    /** @type {any} */ ({
      async listStacks() {
        return [];
      },
      /** @param {any} input */
      async applyStack(input) {
        applications.push({ ...input, fileContent: await readFile(filename, 'utf8') });
        return {
          changed: true,
          stack: stackRecord(stackRoot, input.definition),
        };
      },
    }),
    {
      async selectStackRoot() {
        return childDirectory;
      },
    },
  );

  try {
    const opened = await service.openSelected();
    expect(opened).toMatchObject({
      outcome: 'opened',
      document: {
        stackRootName: basename(stackRoot),
        fileState: 'valid',
        seedSource: 'file',
        definition: { project: 'customer' },
      },
    });
    expect(JSON.stringify(opened)).not.toContain(stackRoot);
    expect(JSON.stringify(opened)).not.toContain('fingerprint');
    const documentId = opened.document?.documentId;
    if (documentId === undefined) throw new Error('Expected an open document.');

    await writeFile(filename, externalOne);
    const firstConflict = await service.save({ documentId, content: candidate });
    expect(firstConflict).toMatchObject({
      outcome: 'conflict',
      saved: false,
      conflict: { reason: 'changed-after-open' },
    });
    expect(await readFile(filename, 'utf8')).toBe(externalOne);
    expect(applications).toHaveLength(0);

    await writeFile(filename, externalTwo);
    const secondConflict = await service.save({
      documentId,
      content: candidate,
      conflictToken: firstConflict.conflict?.token,
    });
    expect(secondConflict).toMatchObject({
      outcome: 'conflict',
      conflict: { reason: 'changed-after-open' },
    });
    expect(secondConflict.conflict?.token).not.toBe(firstConflict.conflict?.token);
    expect(await readFile(filename, 'utf8')).toBe(externalTwo);

    const saved = await service.save({
      documentId,
      content: candidate,
      conflictToken: secondConflict.conflict?.token,
    });
    expect(saved).toMatchObject({
      outcome: 'saved-and-applied',
      saved: true,
      applied: true,
    });
    expect(await readFile(filename, 'utf8')).toBe(candidate);
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      stackRoot: await realpath(stackRoot),
      definition: { project: 'edited' },
      fileContent: candidate,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('creates missing definitions exclusively and refuses a file that appeared after open', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-document-'));
  const stackRoot = join(directory, 'new-stack');
  const filename = join(stackRoot, 'portreeve.stack.json');
  const candidate = definitionContent('new-stack');
  await mkdir(stackRoot);
  const service = createStackDocumentService(
    /** @type {any} */ ({
      async listStacks() {
        return [];
      },
      /** @param {any} input */
      async applyStack(input) {
        return { changed: true, stack: stackRecord(stackRoot, input.definition) };
      },
    }),
    {
      async selectStackRoot() {
        return stackRoot;
      },
    },
  );

  try {
    const opened = await service.openSelected();
    expect(opened).toMatchObject({
      document: { fileState: 'missing', seedSource: 'new', definition: null },
    });
    const documentId = opened.document?.documentId;
    if (documentId === undefined) throw new Error('Expected an open document.');
    const external = definitionContent('appeared');
    await writeFile(filename, external);
    const conflict = await service.save({ documentId, content: candidate });
    expect(conflict).toMatchObject({
      outcome: 'conflict',
      conflict: { reason: 'appeared-after-open' },
    });
    expect(await readFile(filename, 'utf8')).toBe(external);
    const saved = await service.save({
      documentId,
      content: candidate,
      conflictToken: conflict.conflict?.token,
    });
    expect(saved.outcome).toBe('saved-and-applied');
    expect(await readFile(filename, 'utf8')).toBe(candidate);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('recovers a known invalid file, preserves a save across apply failure, and retries safely', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-document-'));
  const stackRoot = join(directory, 'known-stack');
  const filename = join(stackRoot, 'portreeve.stack.json');
  const appliedDefinition = definition('applied');
  const candidate = definitionContent('recovered');
  const stack = stackRecord(stackRoot, appliedDefinition);
  await mkdir(stackRoot);
  await writeFile(filename, '{invalid');
  let applyAttempts = 0;
  const service = createStackDocumentService(
    /** @type {any} */ ({
      async getStack() {
        return stack;
      },
      /** @param {any} input */
      async applyStack(input) {
        applyAttempts += 1;
        if (applyAttempts === 1) {
          throw Object.assign(new Error('The Portreeve server is unavailable.'), {
            code: 'unavailable',
          });
        }
        return { changed: true, stack: stackRecord(stackRoot, input.definition) };
      },
    }),
    {
      async selectStackRoot() {
        return null;
      },
    },
  );

  try {
    const opened = await service.openKnown(stack.id);
    expect(opened).toMatchObject({
      document: {
        stackId: stack.id,
        fileState: 'invalid',
        seedSource: 'applied',
        definition: { project: 'applied' },
        issues: [{ code: 'invalid_json' }],
      },
    });
    const documentId = opened.document?.documentId;
    if (documentId === undefined) throw new Error('Expected an open document.');
    const replacementConflict = await service.save({
      documentId,
      content: candidate,
    });
    expect(replacementConflict).toMatchObject({
      outcome: 'conflict',
      conflict: { reason: 'invalid-file-replacement' },
    });
    expect(await readFile(filename, 'utf8')).toBe('{invalid');

    const saved = await service.save({
      documentId,
      content: candidate,
      conflictToken: replacementConflict.conflict?.token,
    });
    expect(saved).toMatchObject({
      outcome: 'saved-not-applied',
      saved: true,
      applied: false,
      error: { code: 'unavailable' },
    });
    expect(await readFile(filename, 'utf8')).toBe(candidate);

    await writeFile(filename, definitionContent('changed-after-save'));
    expect(await service.retryApply(documentId)).toMatchObject({
      outcome: 'conflict',
      conflict: { reason: 'changed-before-retry', token: null },
    });
    await writeFile(filename, candidate);
    expect(await service.retryApply(documentId)).toMatchObject({
      outcome: 'applied',
      saved: true,
      applied: true,
    });
    expect(applyAttempts).toBe(2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects invalid drafts and refuses to replace a non-regular definition path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-stack-document-'));
  const stackRoot = join(directory, 'unsafe-stack');
  const filename = join(stackRoot, 'portreeve.stack.json');
  await mkdir(stackRoot);
  await symlink(join(directory, 'elsewhere.json'), filename);
  let applications = 0;
  const service = createStackDocumentService(
    /** @type {any} */ ({
      async listStacks() {
        return [];
      },
      async applyStack() {
        applications += 1;
      },
    }),
    {
      async selectStackRoot() {
        return stackRoot;
      },
    },
  );

  try {
    const opened = await service.openSelected();
    expect(opened).toMatchObject({
      document: {
        fileState: 'invalid',
        issues: [{ code: 'definition_not_regular' }],
      },
    });
    const documentId = opened.document?.documentId;
    if (documentId === undefined) throw new Error('Expected an open document.');
    expect(await service.save({ documentId, content: '{invalid' })).toMatchObject({
      outcome: 'invalid',
      saved: false,
      issues: [{ code: 'invalid_json' }],
    });
    expect(
      await service.save({ documentId, content: definitionContent('unsafe') }),
    ).toMatchObject({
      outcome: 'failed',
      saved: false,
      conflict: null,
      error: { code: 'stack_definition_not_regular' },
    });
    expect(applications).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('does not expose client failure details while resolving a known stack document', async () => {
  const service = createStackDocumentService(
    /** @type {any} */ ({
      async getStack() {
        throw new Error('/private/socket/path must remain trusted');
      },
    }),
    {
      async selectStackRoot() {
        return null;
      },
    },
  );

  try {
    await service.openKnown('44444444-4444-4444-8444-444444444444');
    throw new Error('Expected known-stack resolution to fail.');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'stack_definition_unavailable',
      message: 'The selected stack definition is unavailable.',
    });
    expect(String(error)).not.toContain('/private/socket');
  }
});

/** @param {string} project */
function definitionContent(project) {
  return `${JSON.stringify(definition(project), null, 2)}\n`;
}

/** @param {string} project */
function definition(project) {
  return {
    version: 1,
    project,
    components: {
      api: {
        endpoints: { http: {} },
      },
    },
  };
}

/** @param {string} stackRoot @param {any} value */
function stackRecord(stackRoot, value) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    project: value.project,
    stackRoot,
    currentRevision: 'b'.repeat(64),
    definition: value,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUsedAt: timestamp,
  };
}
