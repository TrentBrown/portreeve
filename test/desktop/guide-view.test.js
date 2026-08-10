// @ts-check

import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';

test('presents the five primary views with plural collection naming', async () => {
  const [html, renderer] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
  ]);

  const tabs = [
    ['overview', 'Overview'],
    ['ports', 'Ports'],
    ['stacks', 'Stacks'],
    ['launcher', 'Launchers'],
    ['guide', 'Guide'],
  ];
  let previousIndex = -1;
  for (const [view, label] of tabs) {
    const index = html.indexOf(`data-view="${view}">${label}</button>`);
    expect(index).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }

  expect(html).toContain('<h2 id="launcher-title">Launchers</h2>');
  expect(html).toContain('<h3>Launcher details</h3>');
  expect(renderer).toContain("actionButton('Open in Launchers'");
  expect(renderer).toContain("requiredElement('guide').hidden = view !== 'guide'");
  expect(renderer).toContain("runtimeStatus.hidden = view === 'guide'");
  expect(renderer).toContain("if (view !== 'stacks' && stackEditor.isOpen())");
  expect(renderer).toContain("if (view !== 'launcher' && launcherView.isOpen())");
});

test('ships the Guide as static semantic architecture and integration guidance', async () => {
  const [html, css, renderer, packageJson] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/styles.css', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);

  expect(html).toContain('id="guide"');
  expect(html).toContain('PortReeve coordinates addresses.');
  expect(html).toContain('Project tools coordinate work.');
  for (const phrase of [
    'Good',
    'Built-in driver',
    'Better',
    'Generated launcher',
    'Best',
    'Native integration',
    'One authority, project-owned execution',
    'Ownership is not readiness',
    'Allocate, bind, and confirm',
    'Stacks, generations, and activations',
    'Process and Docker evidence',
    'Sandbox discovery and trust boundaries',
    'What PortReeve deliberately does not do',
  ]) {
    expect(html).toContain(phrase);
  }
  expect(html.match(/<details>/g)).toHaveLength(6);
  expect(html).toContain('<figure class="guide-architecture">');
  expect(html).toContain('<figcaption>');
  expect(html).not.toMatch(/<script[^>]+(?:mermaid|https?:)/i);
  expect(html).not.toMatch(/<(?:iframe|object|embed)\b/i);
  expect(renderer).not.toMatch(/fetch\(|WebSocket|EventSource/);
  expect(packageJson).not.toMatch(/"mermaid"/);
  expect(css).toContain('.guide-system-map');
  expect(css).toContain('@media (max-width: 900px)');
  expect(css).toContain('.guide-interface-row');
});
