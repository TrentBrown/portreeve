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
  expect(
    renderer.match(/if \(view !== 'stacks' && stackEditor\.isOpen\(\)\)/g),
  ).toHaveLength(1);
  expect(
    renderer.match(/if \(view !== 'launcher' && launcherView\.isOpen\(\)\)/g),
  ).toHaveLength(1);
});

test('ships the Guide as static semantic architecture and integration guidance', async () => {
  const [html, css, renderer, packageJson] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/styles.css', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);

  expect(html).toContain('id="guide"');
  expect(html).toContain('id="open-guide"');
  expect(html).toContain('What is this?');
  expect(html).toContain('What is PortReeve?');
  expect(html).toContain('<h2 id="guide-title" tabindex="-1">');
  expect(html).not.toContain('Familiar ports:');
  expect(html).toContain('a civic official');
  expect(html).toContain('market town—not only a seaport');
  expect(html).toContain('concurrent agentic development');
  expect(html).toContain('different Git worktrees on one machine');
  expect(html).toContain('collisions become frequent');
  expect(html).toContain('PortReeve coordinates addresses.');
  expect(html).toMatch(
    /Your project tools start, supervise, and evaluate the health of your\s+services\./,
  );
  for (const phrase of [
    'Good',
    'Built-in driver',
    'Better',
    'Generated launcher',
    'Best',
    'Native integration',
    'One authority, project-owned execution',
    'The integration tool changes between Good, Better, and Best.',
    'Define and plan',
    'Begin one attempt',
    'Start and prove ownership',
    'Run and finish',
    'Claim',
    'Generation',
    'Activation',
    'Lease',
    'Allocate / prepare',
    'Resolve',
    'Confirm',
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
  expect(html.match(/class="guide-path-diagram"/g)).toHaveLength(3);
  expect(html).toContain('class="guide-sequence"');
  expect(html).toContain('class="guide-concept-grid"');
  expect(html).toContain('class="guide-operation-grid"');
  expect(html).not.toMatch(/<script[^>]+(?:mermaid|https?:)/i);
  expect(html).not.toMatch(/<(?:iframe|object|embed)\b/i);
  expect(renderer).not.toMatch(/fetch\(|WebSocket|EventSource/);
  expect(renderer).toContain('void requestView(tab, view)');
  expect(renderer).toContain("await requestView(guideTab, 'guide')");
  expect(renderer).toContain(
    "requiredElement('guide-title').focus({ preventScroll: true })",
  );
  expect(packageJson).not.toMatch(/"mermaid"/);
  expect(css).toContain('.guide-sequence');
  expect(css).toContain('.guide-concept-grid');
  expect(css).toContain('@media (max-width: 900px)');
  expect(css).toContain('.guide-actor-row');
  expect(css).toMatch(
    /\.guide-identity-mark img\s*{[^}]*width:\s*220px;[^}]*height:\s*220px;/,
  );
});
