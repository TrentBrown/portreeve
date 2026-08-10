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
    'Project integration',
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
    'Prepare allocates one immutable generation',
    'Resolve',
    'Confirm',
    'Ownership is not readiness',
    'Sandboxes move the conflict boundary—not the need for PortReeve',
    'Dr. Sandbox',
    'shared host-port namespace',
    'the control socket and lease credentials do not',
    'Claims, preparation, and leases',
    'Generations, activations, resolve, and confirm',
    'Process and Docker evidence',
    'Sandbox discovery and trust boundaries',
    'What PortReeve deliberately does not do',
  ]) {
    expect(html).toContain(phrase);
  }
  expect(html.match(/<details>/g)).toHaveLength(6);
  expect(html).toContain('<figure class="guide-architecture guide-sequence-five">');
  expect(html).toContain('<figcaption>');
  expect(html.match(/class="guide-mini-sequence/g)).toHaveLength(3);
  expect(html.match(/class="guide-mini-sequence guide-sequence-four"/g)).toHaveLength(
    2,
  );
  expect(html).toContain(
    'class="guide-mini-sequence guide-mini-sequence-dense guide-sequence-five"',
  );
  expect(html).toContain('Start services');
  expect(html).toContain('Actors in these integration paths');
  expect(html).toContain('Colors identify the same actor wherever it appears.');
  expect(html.match(/class="guide-actor-pill guide-actor-/g)).toHaveLength(20);
  expect(html).toContain('The person or agent that initiates and observes');
  expect(html).toContain('npm run dev');
  expect(html).toContain('Shell command');
  expect(html).toContain('Project tooling');
  expect(html).toContain('Inject env + invoke');
  expect(html).toContain('Inject env + start');
  expect(html).toContain('Request ports');
  expect(html.match(/<dt>Port access<\/dt>/g)).toHaveLength(3);
  expect(html.match(/<dd>Environment variables<\/dd>/g)).toHaveLength(2);
  expect(html).toContain('<dd>Direct PortReeve client</dd>');
  expect(html).toContain('requests assignments directly from PortReeve');
  expect(html).toMatch(/pass them\s+to child processes through environment variables/);
  expect(html).toContain('Tightest lifecycle coupling');
  expect(html).not.toContain('The least integration hair');
  expect(html).not.toContain('Highest lifecycle fidelity');
  expect(html).toContain('Acquisition and binding share one control flow.');
  expect(html).toContain('What project integration adds');
  expect(html).toContain('a generated launcher can obtain the same');
  expect(html).toContain('Confirmation proves ownership, not application readiness.');
  expect(html).toContain('expected provider owns the binding');
  expect(html).toContain('aria-label="Canonical PortReeve stack lifecycle"');
  expect(html).toContain('class="guide-sequence-note note-portreeve concept-claim"');
  expect(html).toContain('class="guide-object-model"');
  expect(html).toContain('class="guide-object-generation"');
  expect(html).toContain('class="guide-object-activation"');
  expect(html).toContain('class="guide-object-leases"');
  expect(html).toContain('aria-label="Sandbox publication and discovery sequence"');
  expect(html).toContain('Addresses enter the');
  expect(html).not.toMatch(/<script[^>]+(?:mermaid|https?:)/i);
  expect(html).not.toMatch(/<(?:iframe|object|embed)\b/i);
  expect(renderer).not.toMatch(/fetch\(|WebSocket|EventSource/);
  expect(renderer).toContain('void requestView(tab, view)');
  expect(renderer).toContain("await requestView(guideTab, 'guide')");
  expect(renderer).toContain(
    "requiredElement('guide-title').focus({ preventScroll: true })",
  );
  expect(packageJson).not.toMatch(/"mermaid"/);
  expect(css).toContain('.guide-sequence-lifelines');
  expect(css).toContain('.guide-message.reverse::after');
  expect(html.match(/guide-actor-developer/g)).toHaveLength(4);
  expect(html.match(/guide-actor-portreeve/g)).toHaveLength(4);
  expect(html.match(/guide-actor-services/g)).toHaveLength(4);
  for (const actor of ['desktop', 'generated', 'project', 'commands', 'services']) {
    expect(css).toContain(`.guide-actor-${actor}`);
  }
  expect(css).toContain('background: var(--pr-color-success-soft)');
  expect(css).toContain('background: var(--pr-color-actor-portreeve-background)');
  expect(css).toContain('background: var(--pr-color-accent-soft)');
  expect(css).toContain('.guide-object-model');
  expect(css).toContain('.guide-actor-legend-list');
  expect(css).toContain('.guide-project-integration-advantage');
  expect(css).toContain('align-items: baseline');
  expect(css).toContain('@media (max-width: 900px)');
  expect(css).toContain('.guide-trust-bands');
  expect(css).toMatch(
    /\.guide-identity-mark img\s*{[^}]*width:\s*220px;[^}]*height:\s*220px;/,
  );
});
