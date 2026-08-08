// @ts-check

import { expect, test } from 'bun:test';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

test('protocol documentation covers every public endpoint', async () => {
  const protocol = await readFile(resolve('docs', 'protocol.md'), 'utf8');
  for (const endpoint of [
    '/v1/health',
    '/v1/ports',
    '/v1/ports/{port}',
    '/v1/ports/{port}/reclaim',
    '/v1/ports/{port}/unsafe-evict',
    '/v1/claims',
    '/v1/claims/{claimId}',
    '/v1/claims/{claimId}/reassign',
    '/v1/claims/{claimId}/delete',
    '/v1/claims/prune',
    '/v1/config',
    '/v1/history',
    '/v1/logs',
    '/v1/server/stop',
    '/v1/leases/acquire',
    '/v1/leases/{leaseId}/confirm',
    '/v1/leases/{leaseId}/abandon',
    '/v1/runs/{runId}/release',
    '/v1/stacks',
    '/v1/stacks/{stackId}',
    '/v1/stacks/apply',
    '/v1/stacks/prune',
    '/v1/stacks/{stackId}/status',
    '/v1/stacks/{stackId}/prepare',
    '/v1/stack-activations/begin',
    '/v1/stack-activations/{id}',
    '/v1/stack-generations/{id}',
    '/v1/stack-activations/{id}/renew',
    '/v1/stack-activations/{id}/confirm',
    '/v1/stack-activations/{id}/abandon',
    '/v1/stack-activations/{id}/skip',
    '/v1/stack-activations/{id}/reconcile',
    '/v1/stack-activations/{id}/end',
    '/v1/stack-activations/{id}/resolve',
    '/v1/stack-activations/{id}/snapshot',
  ]) {
    expect(protocol).toContain(endpoint);
  }
});

test('README documentation links resolve to repository files', async () => {
  const readmePath = resolve('README.md');
  const readme = await readFile(readmePath, 'utf8');
  const links = [...readme.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/gu)].map(
    (match) => match[1],
  );
  expect(links.length).toBeGreaterThanOrEqual(7);
  for (const link of links) {
    if (link === undefined || /^[a-z]+:/iu.test(link)) {
      continue;
    }
    await access(resolve(dirname(readmePath), link));
  }
});

test('release documentation distinguishes build from native execution', async () => {
  const installation = await readFile(resolve('docs', 'installation.md'), 'utf8');
  expect(installation).toMatch(/Cross-compilation alone\s+is not/u);
  expect(installation).toContain('npm install portreeve');
  expect(installation).toContain('SHA256SUMS');
  expect(installation).toContain('Homebrew');
});

test('release workflow runs full and lifecycle gates on every native target', async () => {
  const workflow = await readFile(resolve('.github/workflows/release.yml'), 'utf8');

  expect(workflow).toContain('node-version: 22');
  expect(workflow).toContain('actions/checkout@v7');
  expect(workflow).toContain('actions/setup-node@v7');
  expect(workflow).toContain('actions/upload-artifact@v7');
  expect(workflow).toContain('actions/download-artifact@v8');
  expect(workflow).toContain('- run: bun run check');
  expect(workflow).toContain('- run: bun run release:verify -- --native --lifecycle');
  expect(workflow).toContain('runner: ubuntu-24.04-arm');
  expect(workflow).not.toContain('self-hosted');
  expect(workflow).toContain('Restore executable artifact modes');
  expect(workflow.match(/run: bun run stacks:verify/gu)).toHaveLength(1);
  expect(workflow).toContain("if: startsWith(matrix.platform, 'linux-')");
  expect(workflow).toContain('Require public repository for release distribution');
  expect(workflow).toContain('Require npm publishing authority');
  expect(workflow).toContain('Require unpublished npm version');
  expect(workflow.match(/needs: release-policy/gu)).toHaveLength(2);
});

test('public guides cover desktop and one representative mixed-stack launcher', async () => {
  const [desktop, example, definition] = await Promise.all([
    readFile(resolve('docs', 'desktop.md'), 'utf8'),
    readFile(resolve('examples', 'mixed-stack', 'README.md'), 'utf8'),
    readFile(resolve('examples', 'mixed-stack', 'portreeve.stack.json'), 'utf8'),
  ]);
  expect(desktop).toContain('never starts or stops a project process or container');
  expect(desktop).toContain('actionable');
  expect(example).toContain('bun run stacks:verify');
  expect(example).toContain('PORTREEVE_ENDPOINTS_FILE');
  expect(JSON.parse(definition)).toMatchObject({
    version: 1,
    components: {
      api: { docker: { service: 'api' } },
      website: { dependencies: { backend: { component: 'api' } } },
    },
  });
});

test('public documentation explains Docker evidence without transferring launcher authority', async () => {
  const [protocol, stacks, safety, client, cli, migration] = await Promise.all(
    [
      'protocol.md',
      'stacks.md',
      'safety.md',
      'client.md',
      'cli-contract.md',
      'migration.md',
    ].map((filename) => readFile(resolve('docs', filename), 'utf8')),
  );

  expect(protocol).toContain('docker-evidence-v1');
  expect(stacks).toContain('confirm-docker');
  expect(client).toContain("bindings: { api: 'docker' }");
  expect(cli).toContain('--docker-component');
  expect(migration).toContain('process-only allocation');
  expect(safety).toContain('never signal Docker Desktop');
  expect(safety).toContain('trusted launcher');
});

test('public guides describe the final stack-root and desktop editor contract', async () => {
  const [
    readme,
    protocol,
    stacks,
    desktop,
    client,
    cli,
    migration,
    safety,
    troubleshooting,
  ] = await Promise.all(
    [
      'README.md',
      'docs/protocol.md',
      'docs/stacks.md',
      'docs/desktop.md',
      'docs/client.md',
      'docs/cli-contract.md',
      'docs/migration.md',
      'docs/safety.md',
      'docs/troubleshooting.md',
    ].map((filename) => readFile(resolve(filename), 'utf8')),
  );

  expect(readme).toContain('one independently runnable stack');
  expect(stacks).toMatch(/need not be a\s+Git repository/u);
  expect(client).toMatch(/does not discover, read, or write/u);
  expect(cli).toMatch(/does not prepare a\s+generation/u);
  expect(protocol).toMatch(/protocol has no project-file operation/u);
  expect(desktop).toContain('Create or Edit Stack');
  expect(desktop).toContain('opaque document ID');
  expect(safety).toMatch(/exact bytes observed/u);
  expect(migration).toMatch(/Retain the project launcher/u);
  expect(troubleshooting).toContain('Saved, but not applied');
  expect(troubleshooting).toContain('external definition change');
});
