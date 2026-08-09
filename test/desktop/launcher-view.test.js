// @ts-check

import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';

test('wires the primary Launcher experience, cross-links, and close protection', async () => {
  const [html, renderer, view] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
    readFile('apps/desktop/renderer/launcher-view.js', 'utf8'),
  ]);

  expect(html.indexOf('data-view="launcher"')).toBeGreaterThan(
    html.indexOf('data-view="stacks"'),
  );
  expect(html).toContain('id="launcher-browser"');
  expect(html).toContain('id="launcher-editor"');
  expect(html).toContain('From experimentation to verified integration');
  expect(html).toContain('id="attached-close-dialog"');

  expect(renderer).toContain('createLauncherView({');
  expect(renderer).toContain("activeView === 'launcher'");
  expect(renderer).toContain("actionButton('Open in Launcher'");
  expect(renderer).toContain("activateNamedTab('stacks')");
  expect(renderer).toContain('subscribeApplicationCloseBlocked');
  expect(renderer).toContain('launcherView.isDirty()');

  for (const section of [
    'Execution',
    'Commands',
    'Endpoint environment',
    'Advanced',
    'Review',
  ]) {
    expect(view).toContain(`editorSection('${section}')`);
  }
  expect(view).toContain("'Save and Trust'");
  expect(view).toContain("documentState.fileState === 'missing' ? ''");
  expect(view).toContain('Overwrite external version');
  expect(view).toContain('Downgrade verified activation?');
  expect(view).toContain('Current-session output');
  expect(view).toContain('Recent operation history');
  expect(view).toContain('Endpoint environment preview');
  expect(view).not.toMatch(
    /node:|readFile|writeFile|fetch\(|WebSocket|child_process|shell\.openPath/,
  );
});

test('keeps Launcher controls keyboard-addressable and evidence content announced', async () => {
  const [html, view] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/launcher-view.js', 'utf8'),
  ]);

  expect(html).toContain('aria-label="Stack launchers"');
  expect(html).toContain('id="launcher-detail"');
  expect(html).toContain('aria-live="polite"');
  expect(view).toContain("control.type = 'button'");
  expect(view).toContain("command.setAttribute('aria-label'");
  expect(view).toContain('associateLabel(wrapper, input)');
  expect(view).toContain('if (!value)');
  expect(view).toContain('else renderEditor()');
  expect(view).toContain('launcherPreviouslyDisabled');
  expect(view).not.toContain("addEventListener('keydown'");
});
