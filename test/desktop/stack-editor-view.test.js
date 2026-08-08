// @ts-check

import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';
import {
  documentNotice,
  draftSignature,
} from '../../apps/desktop/renderer/stack-editor-view.js';
import {
  createEmptyStackDraft,
  updateDraftComponent,
} from '../../apps/desktop/renderer/stack-editor-model.js';

test('describes new, recovered, and invalid project-file states without paths', () => {
  expect(
    documentNotice({
      fileState: 'missing',
      seedSource: 'new',
      issues: [],
    }),
  ).toEqual({
    kind: 'info',
    message: 'No project definition file exists yet.',
    details: ['Save and Apply will create portreeve.stack.json exclusively.'],
  });
  expect(
    documentNotice({
      fileState: 'missing',
      seedSource: 'applied',
      issues: [],
    }),
  ).toMatchObject({
    kind: 'warning',
    message: 'The project definition file is missing.',
    details: expect.arrayContaining([
      'This draft was recovered from the currently applied definition.',
    ]),
  });
  expect(
    documentNotice({
      fileState: 'invalid',
      seedSource: 'applied',
      issues: [{ message: 'Component name is invalid.' }],
    }),
  ).toMatchObject({
    kind: 'warning',
    message: 'The existing project definition is invalid.',
    details: expect.arrayContaining([
      'Component name is invalid.',
      'This replacement draft uses the currently applied definition.',
    ]),
  });
  expect(
    documentNotice({ fileState: 'valid', seedSource: 'file', issues: [] }),
  ).toBeNull();
});

test('tracks dirty drafts independently of a component rename', () => {
  const empty = createEmptyStackDraft('customer');
  const added = {
    ...empty,
    components: [
      {
        id: 'component-1',
        name: 'api',
        dockerService: '',
        endpoints: [],
        dependencies: [],
      },
    ],
    nextIdentity: 2,
  };
  const baseline = draftSignature(added);
  expect(draftSignature(added)).toBe(baseline);
  expect(
    draftSignature(updateDraftComponent(added, 'component-1', { name: 'backend' })),
  ).not.toBe(baseline);
});

test('wires both editor entry points, guards navigation, and exposes no raw editor', async () => {
  const [html, renderer, view] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
    readFile('apps/desktop/renderer/stack-editor-view.js', 'utf8'),
  ]);

  expect(html).toContain('id="create-edit-stack"');
  expect(html).toContain('Create or Edit Stack…');
  expect(html).toContain('id="stack-editor"');
  expect(html).toContain('Keep editing');
  expect(html).toContain('Discard changes');
  expect(html).not.toMatch(/textarea|contenteditable/i);

  expect(renderer).toContain('stackEditor.openSelected()');
  expect(renderer).toContain('stackEditor.openKnown(stack.id)');
  expect(renderer).toContain("window.addEventListener('beforeunload'");
  expect(renderer).toContain('stackEditor.requestClose()');
  expect(renderer).toContain('Delete and cascade');

  expect(view).toContain("actionButton('Save and Apply'");
  expect(view).toContain("actionButton('Retry Apply'");
  expect(view).toContain('options.api.saveStackDocument(');
  expect(view).toContain('options.api.retryStackDocumentApply(');
  expect(view).toContain('firstInvalidControlId');
  expect(view).toContain('Preview JSON — last valid draft');
  expect(view).toContain('if (isOpen()) setEditorBusy(false);');
  expect(view).not.toMatch(
    /node:|readFile|writeFile|fetch\(|WebSocket|portreeveDesktop\s*=/,
  );
});
