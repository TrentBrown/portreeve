// @ts-check

import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'bun:test';

const EXPECTED_TOPICS = [
  'identity-problem',
  'authority-model',
  'client-choices',
  'integration-paths',
  'stacks',
  'coordination-lifecycle',
  'evidence-ownership',
  'boundaries-next-step',
];

/** @param {string} contract */
function contractTopics(contract) {
  return [...contract.matchAll(/^### `([a-z]+(?:-[a-z]+)*)`$/gmu)]
    .map((match) => match[1])
    .filter((topic) => topic !== undefined);
}

/**
 * @param {{topics: string[], readme: string, desktop: string}} input
 */
function missingLandmarks({ topics, readme, desktop }) {
  /** @type {string[]} */
  const missing = [];
  for (const topic of topics) {
    if (!readme.includes(`<!-- product-overview:${topic} -->`)) {
      missing.push(`README:${topic}`);
    }
    if (!desktop.includes(`data-product-overview-topic="${topic}"`)) {
      missing.push(`Desktop:${topic}`);
    }
  }
  return missing;
}

test('contracts the approved topics across README and Desktop Overview', async () => {
  const [contract, readme, desktop] = await Promise.all([
    readFile(resolve('docs', 'product-overview-contract.md'), 'utf8'),
    readFile(resolve('README.md'), 'utf8'),
    readFile(resolve('apps', 'desktop', 'renderer', 'index.html'), 'utf8'),
  ]);
  const topics = contractTopics(contract);

  expect(topics).toEqual(EXPECTED_TOPICS);
  expect(missingLandmarks({ topics, readme, desktop })).toEqual([]);
  expect(contract).toContain('same pull request');
  expect(contract).toContain('Neither surface is generated from the other');
  expect(contract).toContain('Tests must not compare prose');
});

test('structural parity reports omitted landmarks without comparing copy', () => {
  const readme = EXPECTED_TOPICS.map(
    (topic) => `<!-- product-overview:${topic} -->`,
  ).join('\n');
  const desktop = EXPECTED_TOPICS.map(
    (topic) => `<section data-product-overview-topic="${topic}"></section>`,
  ).join('\n');

  expect(
    missingLandmarks({
      topics: EXPECTED_TOPICS,
      readme: readme.replace(
        '<!-- product-overview:integration-paths -->',
        'Entirely different prose remains allowed.',
      ),
      desktop,
    }),
  ).toEqual(['README:integration-paths']);
  expect(
    missingLandmarks({
      topics: EXPECTED_TOPICS,
      readme,
      desktop: desktop.replace(
        'data-product-overview-topic="evidence-ownership"',
        'data-copy-may-change="freely"',
      ),
    }),
  ).toEqual(['Desktop:evidence-ownership']);
});

test('README keeps truthful Desktop and peer-client continuation paths', async () => {
  const [readme, packageJsonText] = await Promise.all([
    readFile(resolve('README.md'), 'utf8'),
    readFile(resolve('package.json'), 'utf8'),
  ]);
  const packageJson = JSON.parse(packageJsonText);

  expect(packageJson.packageManager).toBe('bun@1.3.14');
  expect(packageJson.scripts).toHaveProperty('build');
  expect(packageJson.scripts).toHaveProperty('desktop:start');
  for (const command of [
    'bun install --frozen-lockfile',
    'bun run build',
    'PORTREEVE_DESKTOP_CLI_PATH="$PWD/dist/portreeve" bun run desktop:start',
  ]) {
    expect(readme).toContain(command);
  }
  expect(readme).toContain('Install the alpha preview');
  expect(readme).toContain('brew install --cask trentbrown/portreeve/portreeve-app');
  expect(readme).toContain('current public alpha preview');
  expect(readme).not.toContain('npm install portreeve');
  for (const client of ['Desktop', 'MCP', 'CLI', 'JavaScript client']) {
    expect(readme).toContain(client);
  }
  expect(readme).toMatch(/does not currently\s+provide Docker\s+Sandbox/u);
});

test('README includes the maintained Desktop screenshot and required visuals', async () => {
  const readme = await readFile(resolve('README.md'), 'utf8');
  const screenshot = readme.match(
    /!\[([^\]]+)\]\((docs\/assets\/portreeve-desktop-overview\.png)\)/u,
  );

  expect(screenshot).not.toBeNull();
  expect(screenshot?.[1]?.length ?? 0).toBeGreaterThan(40);
  await access(resolve(screenshot?.[2] ?? ''));

  expect(readme.match(/```mermaid/gu)).toHaveLength(6);
  expect(readme).toContain('flowchart LR');
  expect(readme.match(/sequenceDiagram/gu)).toHaveLength(4);
  expect(readme).toContain('Initiator->>Tooling: Start');
  expect(readme).toContain('Database["Database<br/>database.postgres"]');
  for (const concept of [
    'Claim',
    'Generation',
    'Activation',
    'Lease',
    'Allocate',
    'Prepare',
    'Resolve',
    'Confirm',
  ]) {
    expect(readme).toContain(concept);
  }
});

test('Desktop topic landmarks preserve native destinations and renderer isolation', async () => {
  const [desktop, renderer] = await Promise.all([
    readFile(resolve('apps', 'desktop', 'renderer', 'index.html'), 'utf8'),
    readFile(resolve('apps', 'desktop', 'renderer', 'renderer.js'), 'utf8'),
  ]);

  for (const view of ['quick-start', 'launcher', 'mcp', 'cli']) {
    expect(desktop).toContain(`data-view="${view}"`);
  }
  expect(desktop).toContain('data-app-view="quick-start"');
  expect(desktop).toContain('data-app-view="mcp"');
  expect(desktop).toContain('data-app-view="cli"');
  expect(renderer).not.toMatch(/DOMParser|marked|markdown-it|fetch\(/u);
});
