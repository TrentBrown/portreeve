// @ts-check

import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';

test('presents the eight primary views with peer MCP and CLI destinations', async () => {
  const [html, renderer] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
  ]);

  const tabs = [
    ['overview', 'Overview'],
    ['quick-start', 'Quick Start'],
    ['service', 'Service'],
    ['ports', 'Ports'],
    ['stacks', 'Stacks'],
    ['launcher', 'Integrations'],
    ['mcp', 'MCP'],
    ['cli', 'CLI'],
  ];
  let previousIndex = -1;
  for (const [view, label] of tabs) {
    const index = html.indexOf(`data-view="${view}">${label}</button>`);
    expect(index).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }

  expect(html).toContain('<h2 id="launcher-title">Integrations</h2>');
  expect(html).toContain('<h3>Launcher details</h3>');
  expect(renderer).toContain("actionButton('Open in Integrations'");
  expect(renderer).toContain(
    "requiredElement('overview').hidden = view !== 'overview'",
  );
  expect(renderer).toContain(
    "requiredElement('quick-start').hidden = view !== 'quick-start'",
  );
  expect(renderer).toContain("requiredElement('service').hidden = view !== 'service'");
  expect(renderer).toContain("requiredElement('mcp').hidden = view !== 'mcp'");
  expect(renderer).toContain("requiredElement('cli').hidden = view !== 'cli'");
  expect(renderer).toContain("runtimeStatus.hidden = view === 'overview'");
  expect(html).not.toContain('data-view="guide"');
  expect(
    renderer.match(/if \(view !== 'stacks' && stackEditor\.isOpen\(\)\)/g),
  ).toHaveLength(1);
  expect(
    renderer.match(/if \(view !== 'launcher' && launcherView\.isOpen\(\)\)/g),
  ).toHaveLength(1);
});

test('separates the product overview, guided trial, and service lifecycle', async () => {
  const [html, renderer] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
  ]);
  const quickStart = html.slice(
    html.indexOf('id="quick-start"'),
    html.indexOf('<section id="service"'),
  );
  const service = html.slice(
    html.indexOf('<section id="service"'),
    html.indexOf('<section id="ports"'),
  );

  expect(html).toContain('<section id="overview" class="guide"');
  expect(html).toContain('<h2 id="overview-title" tabindex="-1">');
  expect(html).not.toContain('Try the Quick Start');
  expect(html).not.toContain('id="open-guide"');
  expect(html).not.toContain('What is this?');

  expect(quickStart).toContain('Try PortReeve with a project you already run');
  expect(quickStart).toContain('Foreground—no service installation');
  expect(quickStart).toContain('id="quick-start-serve-command"');
  expect(quickStart).toContain('npm run dev');
  expect(quickStart).toContain('PORT → frontend.default');
  expect(quickStart).toContain('Add a backend dependency');
  expect(quickStart).toContain('Terminate attached command');

  expect(service).toContain('PortReeve service');
  expect(service).toContain('id="status-cards"');
  expect(service).toContain('id="service-actions"');
  expect(service).toContain('Uninstall or reset PortReeve');
  expect(renderer).toContain("querySelectorAll('[data-app-view]')");
  expect(renderer).toContain('foregroundServeCommand(');
  expect(renderer).toContain('quickStartAuthorityPresentation(next)');
});

test('ships static version-bound MCP and CLI guide surfaces', async () => {
  const [html, renderer, view, model, css] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
    readFile('apps/desktop/renderer/client-guide-view.js', 'utf8'),
    readFile('apps/desktop/renderer/client-guide-model.js', 'utf8'),
    readFile('apps/desktop/renderer/styles.css', 'utf8'),
  ]);
  expect(html).toContain('id="mcp-guide-content"');
  expect(html).toContain('id="cli-guide-content"');
  expect(html).toContain('id="cli-installation-title">This installation</h3>');
  expect(html).toContain('id="copy-cli-diagnostic"');
  expect(renderer).toContain("from './generated/client-guides.js'");
  expect(renderer).toContain('clientGuideBundle.generatedForVersion');
  expect(renderer).toContain('clientInstallationEvidence(next)');
  expect(view).toContain("search.setAttribute('aria-label', search.placeholder)");
  expect(view).toContain("count.setAttribute('aria-live', 'polite')");
  expect(view).toContain("details.className = 'client-reference-entry'");
  expect(view).toContain('target.focus({ preventScroll: true })');
  expect(view).toContain('navigateAnchor(id)');
  expect(renderer.match(/restoreSame: true/g)).toHaveLength(4);
  expect(model).toContain("'troubleshooting-and-safety'");
  expect(css).toContain('overflow-x: auto');
  expect(css).toContain('min-width: 420px');
  expect(css).toContain('.client-reference-controls');
  expect(`${renderer}\n${view}`).not.toMatch(
    /fetch\(|innerHTML|DOMParser|marked|markdown-it/,
  );
});

test('ships Overview as static semantic architecture and integration guidance', async () => {
  const [html, css, renderer, packageJson] = await Promise.all([
    readFile('apps/desktop/renderer/index.html', 'utf8'),
    readFile('apps/desktop/renderer/styles.css', 'utf8'),
    readFile('apps/desktop/renderer/renderer.js', 'utf8'),
    readFile('package.json', 'utf8'),
  ]);
  const normalizedHtml = html.replace(/\s+/g, ' ');
  const overviewHtml = html.slice(
    html.indexOf('<section id="overview"'),
    html.indexOf('</main>'),
  );

  expect(html).toContain('id="overview"');
  expect(html).not.toContain('id="open-guide"');
  expect(html).not.toContain('What is this?');
  expect(html).toContain('What is PortReeve?');
  expect(html).toContain('<h2 id="overview-title" tabindex="-1">');
  expect(html).toContain('data-app-view="quick-start"');
  expect(html).not.toContain('Familiar ports:');
  expect(html).toContain('Localhost port conflicts, solved.');
  expect(html).toContain('Hostnames do not by themselves');
  expect(html).toContain('Modern agentic development multiplies the pressure');
  expect(html).toContain('several agents may run independent copies');
  expect(html).toMatch(/different\s+Git worktrees/);
  expect(html).toContain('A <em>reeve</em> was a person');
  expect(html).toMatch(/shire reeve, borough reeve,\s+and portreeve/);
  expect(html).toMatch(/<em>shire reeve<\/em> survives in contracted form/);
  expect(html).toMatch(/modern word\s+<em>sheriff<\/em>/);
  expect(html).toMatch(/market town, not only a\s+seaport/);
  expect(html).toContain('One authority, several peer clients');
  expect(html).toContain('One PortReeve server runs at a time');
  expect(html).toContain('explicitly in the foreground');
  expect(html).toContain('MCP integrations');
  expect(html).toContain('peers of one another');
  expect(html).toMatch(
    /your project tooling remains\s+responsible for starting, supervising, and judging the health of your\s+services\./,
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
    'Choose a client',
    'Four peer clients, one PortReeve authority',
    'Open MCP guide',
    'Open CLI guide',
    'Complete API guidance:',
    'Claims, preparation, and leases',
    'Generations, activations, resolve, and confirm',
    'Process and Docker evidence',
    'What PortReeve deliberately does not do',
    'provide Docker Sandbox orchestration or integration',
  ]) {
    expect(html).toContain(phrase);
  }
  expect(overviewHtml.match(/<details\b/g)).toHaveLength(5);
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
  expect(html.match(/aria-label="You or agent"/g)).toHaveLength(4);
  expect(html.match(/<span>You or<\/span><span>agent<\/span>/g)).toHaveLength(4);
  expect(html.match(/aria-label="PortReeve Desktop"/g)).toHaveLength(2);
  expect(html.match(/<span>PortReeve<\/span><span>Desktop<\/span>/g)).toHaveLength(2);
  expect(html.match(/aria-label="PortReeve Server"/g)).toHaveLength(4);
  expect(html.match(/<span>PortReeve<\/span><span>Server<\/span>/g)).toHaveLength(4);
  expect(html).not.toMatch(/>Developer<\/span>/);
  expect(html).toContain('The person or agent that initiates and observes');
  expect(html).toContain('npm run dev');
  expect(html.match(/Shell command/g)).toHaveLength(2);
  expect(html.match(/aria-label="Generated launcher"/g)).toHaveLength(2);
  expect(html.match(/<span>Generated<\/span><span>launcher<\/span>/g)).toHaveLength(2);
  expect(html).toContain('<dd>Server plus generated launcher</dd>');
  expect(html).toContain('The planned generator will create');
  expect(html).toContain('It is not yet shipped.');
  expect(html).toContain('<dt>Payoff</dt>');
  expect(html).toContain('<dd>Reusable automation without Desktop</dd>');
  expect(html.match(/aria-label="Your services"/g)).toHaveLength(4);
  expect(html.match(/<span>Your<\/span><span>services<\/span>/g)).toHaveLength(4);
  expect(html.match(/aria-label="Your project tooling"/g)).toHaveLength(2);
  expect(html.match(/<span>Your project<\/span><span>tooling<\/span>/g)).toHaveLength(
    2,
  );
  expect(html).toContain('Inject env + invoke');
  expect(html).toContain('Inject env + start');
  expect(html).toContain('Request ports');
  expect(html.match(/<dt>Port access<\/dt>/g)).toHaveLength(3);
  expect(html.match(/<dd>Environment variables<\/dd>/g)).toHaveLength(2);
  expect(html).toContain('<dd>Direct PortReeve client</dd>');
  expect(normalizedHtml).toContain('requests assignments directly from PortReeve');
  expect(normalizedHtml).toContain(
    'pass them to child processes through environment variables',
  );
  expect(html).toContain('Tightest lifecycle coupling');
  expect(html).not.toContain('The least integration hair');
  expect(html).not.toContain('Highest lifecycle fidelity');
  expect(html).toContain('Acquisition and binding share one control flow.');
  expect(html).toContain('What project integration adds');
  expect(html).toContain('Your local development stack already exists');
  expect(html).toContain('Name relationships, not port numbers');
  expect(html).toContain('A familiar local dependency chain');
  expect(html).toContain('<strong>Database</strong>');
  expect(html).toContain('<code>database.postgres</code>');
  expect(html).not.toContain('<code>search.http</code>');
  expect(html).toContain('Coordinate service dependencies');
  expect(html).toContain('Prevent port collisions');
  expect(html).toContain('Project tooling still owns execution.');
  expect(html).toContain('a generated launcher can obtain the same');
  expect(html).toContain('Confirmation proves ownership, not application readiness.');
  expect(html).toContain('expected provider owns the binding');
  expect(normalizedHtml).toContain(
    'Normal reclaim remains ownership- and evidence-bound',
  );
  expect(html).toContain('Unsafe any-owner eviction is a separate, explicit');
  expect(html).toContain('aria-label="Canonical PortReeve stack lifecycle"');
  expect(html).toContain('class="guide-sequence-note note-portreeve concept-claim"');
  expect(html).toContain('class="guide-object-model"');
  expect(html).toContain('class="guide-object-generation"');
  expect(html).toContain('class="guide-object-activation"');
  expect(html).toContain('class="guide-object-leases"');
  expect(html).toContain('data-app-view="mcp"');
  expect(html).toContain('data-app-view="cli"');
  expect(html).toContain('data-overview-anchor="guide-project-integration"');
  expect(html).not.toContain('Dr. Sandbox');
  expect(html).not.toContain('Sandbox publication and discovery sequence');
  expect(html).not.toMatch(/<script[^>]+(?:mermaid|https?:)/i);
  expect(html).not.toMatch(/<(?:iframe|object|embed)\b/i);
  expect(renderer).not.toMatch(/fetch\(|WebSocket|EventSource/);
  expect(html).toContain('id="navigate-back"');
  expect(html).toContain('id="navigate-forward"');
  expect(html).toContain('aria-label="Navigation history"');
  expect(html).toMatch(
    /<header class="app-header">[\s\S]*<div class="header-actions">[\s\S]*id="refresh"[\s\S]*id="notice"[\s\S]*<\/header>/,
  );
  expect(html).not.toMatch(/id="runtime-status">[\s\S]*?id="notice"/);
  expect(css).toContain('.header-refresh-status');
  expect(renderer).toContain("from './navigation-history.js'");
  expect(renderer).toContain('void navigateTo({ view, anchor: null, scrollY: 0 })');
  expect(renderer).toContain("anchor: 'guide-project-integration'");
  expect(renderer).toContain('void traverseNavigation(-1)');
  expect(renderer).toContain('void traverseNavigation(1)');
  expect(renderer).toContain("event.metaKey && !event.altKey && event.key === '['");
  expect(renderer).toContain(
    "event.altKey && !event.metaKey && event.key === 'ArrowLeft'",
  );
  expect(renderer).toContain("querySelectorAll('[data-app-view]')");
  expect(renderer).toContain("querySelectorAll('[data-overview-anchor]')");
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
  expect(css).toContain('.guide-client-options');
  expect(css).toMatch(
    /\.guide-identity-mark img\s*{[^}]*width:\s*220px;[^}]*height:\s*220px;/,
  );
});
