// @ts-check

import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';

test('renders active lifecycle close protection and copyable safe diagnostics', async () => {
  const [html, preload, renderer] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/preload/index.cjs', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
  ]);

  expect(html).toContain('id="active-lifecycle-operation"');
  expect(html).toContain('id="lifecycle-diagnostic"');
  expect(html).toContain('id="copy-lifecycle-diagnostic"');
  expect(renderer).toContain('subscribeLifecycleActivity(renderLifecycleActivity)');
  expect(renderer).toContain('The operation cannot be cancelled safely.');
  expect(renderer).toContain('JSON.stringify(diagnostic, null, 2)');
  expect(preload).toContain('requireLifecycleMutationResult');
  expect(preload).toContain("!('output' in value)");
  expect(preload).toContain("!('stack' in value)");
  expect(preload).toContain("!('arguments' in value)");
});
