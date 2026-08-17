// @ts-check

import { expect, test } from 'bun:test';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  normalizeLauncherDefinition,
  validateLauncherTopology,
} from '../../src/launcher/definition.js';

test('protocol documentation covers every public endpoint', async () => {
  const protocol = await readFile(resolve('docs', 'protocol.md'), 'utf8');
  for (const endpoint of [
    '/v1/health',
    '/v1/ports',
    '/v1/ports/{port}',
    '/v1/ports/{port}/reclaim',
    '/v1/ports/{port}/unsafe-evict',
    '/v1/actions/ports/{port}/reclaim/preview',
    '/v1/actions/ports/{port}/reclaim/execute',
    '/v1/claims',
    '/v1/claims/{claimId}',
    '/v1/claims/{claimId}/reassign',
    '/v1/claims/{claimId}/delete',
    '/v1/claims/prune',
    '/v1/actions/claims/{claimId}/reassign/preview',
    '/v1/actions/claims/{claimId}/reassign/execute',
    '/v1/actions/claims/{claimId}/delete/preview',
    '/v1/actions/claims/{claimId}/delete/execute',
    '/v1/actions/claims/prune/preview',
    '/v1/actions/claims/prune/execute',
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
    '/v1/stack-document',
    '/v1/actions/stack-definition/validate',
    '/v1/actions/stacks/apply/preview',
    '/v1/actions/stacks/apply/execute',
    '/v1/actions/stacks/prune/preview',
    '/v1/actions/stacks/prune/execute',
    '/v1/actions/settings/preview',
    '/v1/actions/settings/execute',
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
    '/v1/launcher-operations/begin',
    '/v1/launcher-operations/{id}',
    '/v1/launcher-operations/{id}/renew',
    '/v1/launcher-operations/{id}/complete',
    '/v1/stacks/{stackId}/launcher-operations',
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

test('README is a truthful product landing page for the four peer clients', async () => {
  const readme = await readFile(resolve('README.md'), 'utf8');
  expect(readme).toContain('portreeve-lockup.svg');
  expect(readme).toContain('One PortReeve server');
  for (const client of ['Desktop', 'MCP', 'CLI', 'JavaScript client']) {
    expect(readme).toContain(client);
  }
  expect(readme).toContain('bun install --frozen-lockfile');
  expect(readme).toContain('./dist/portreeve status --json');
  expect(readme).toContain('has not published its first npm package');
  expect(readme).toMatch(/does not currently\s+provide Docker\s+Sandbox/u);
  expect(readme).not.toContain('npm install portreeve');
});

test('public documentation does not claim Docker Sandbox integration', async () => {
  const files = [
    'README.md',
    'docs/client.md',
    'docs/cli-contract.md',
    'docs/desktop.md',
    'docs/mcp.md',
    'docs/protocol.md',
    'docs/stacks.md',
    'examples/mixed-stack/README.md',
  ];
  const documents = await Promise.all(
    files.map((file) => readFile(resolve(file), 'utf8')),
  );
  const combined = documents.join('\n');
  for (const unsupported of [
    'Dr. Sandbox',
    'Docker or Codex sandbox',
    'Sandbox consumers',
    'sandbox-only document',
    'Sandbox publication and discovery sequence',
  ]) {
    expect(combined).not.toContain(unsupported);
  }
  expect(combined).toMatch(/does not currently\s+provide Docker\s+Sandbox/u);
  expect(combined).toContain('generic snapshot');
});

test('release documentation distinguishes build from native execution', async () => {
  const installation = await readFile(resolve('docs', 'installation.md'), 'utf8');
  expect(installation).toMatch(/Cross-compilation alone\s+is not/u);
  expect(installation).toContain('npm install portreeve');
  expect(installation).toContain('SHA256SUMS');
  expect(installation).toContain('Homebrew');
});

test('uses PortReeve as the display name without changing stable machine identifiers', async () => {
  const renderer = await readFile(resolve('apps/desktop/renderer/index.html'), 'utf8');
  const packager = await readFile(resolve('scripts/package-desktop.js'), 'utf8');
  const program = await readFile(resolve('src/cli/program.js'), 'utf8');
  const client = await readFile(resolve('packages/client/src/client.js'), 'utf8');
  const userData = await readFile(resolve('apps/desktop/main/user-data.js'), 'utf8');
  const clientPackage = await readFile(resolve('packages/client/package.json'), 'utf8');
  const releaseLib = await readFile(resolve('scripts/release-lib.js'), 'utf8');

  expect(renderer).toContain('<title>PortReeve</title>');
  expect(renderer).toContain('<h1>PortReeve</h1>');
  expect(packager).toContain("productName: 'PortReeve'");
  expect(packager).toContain("name: 'PortReeve'");
  expect(program).toContain(".name('portreeve')");
  expect(program).toContain('Run the PortReeve server in the foreground');

  expect(client).toContain('export class PortreeveClient');
  expect(client).toContain("'Application Support', 'Portreeve'");
  expect(userData).toContain("'Portreeve Desktop'");
  expect(JSON.parse(clientPackage)).toMatchObject({ name: 'portreeve' });
  expect(packager).toContain("appBundleId: 'com.trentbrown.portreeve.desktop'");
  expect(releaseLib).toContain('class Portreeve < Formula');
});

test('release workflow transports one record through native gates and isolated publication', async () => {
  const workflow = await readFile(resolve('.github/workflows/release.yml'), 'utf8');

  expect(workflow).toContain('NODE_VERSION: 22');
  expect(workflow).toContain('node-version: ${{ env.NODE_VERSION }}');
  expect(workflow).toContain('actions/checkout@v7');
  expect(workflow).toContain('actions/setup-node@v7');
  expect(workflow).toContain('actions/upload-artifact@v7');
  expect(workflow).toContain('actions/download-artifact@v8');
  expect(workflow).toContain('- run: bun run check');
  expect(workflow).toContain('release:prepare');
  expect(workflow).toContain('release:native-evidence');
  expect(workflow).toContain('release:merge-native-evidence');
  expect(workflow).toContain('release:package-desktop');
  expect(workflow).toContain('release:finalize-desktop');
  expect(workflow).toContain('release:publish');
  expect(workflow).toContain('runner: ubuntu-24.04-arm');
  expect(workflow).toContain('runner: macos-15-intel');
  expect(workflow).not.toContain('self-hosted');
  expect(workflow).toContain('Restore promoted executable modes');
  expect(workflow.match(/run: bun run stacks:verify/gu)).toHaveLength(1);
  expect(workflow).toContain("if: startsWith(matrix.platform, 'linux-')");
  expect(workflow).toContain('environment: release-publication');
  expect(workflow).toContain('if: inputs.publish');
  expect(workflow).toContain('PORTREEVE_RELEASE_TOKEN');
  expect(workflow).not.toContain('NPM_TOKEN');
  expect(workflow).not.toContain('npm publish');
  expect(workflow).not.toContain('push:\n    tags:');
  expect(workflow).not.toContain('release:build');
});

test('public guides cover desktop and one representative mixed-stack launcher', async () => {
  const [desktop, example, definition] = await Promise.all([
    readFile(resolve('docs', 'desktop.md'), 'utf8'),
    readFile(resolve('examples', 'mixed-stack', 'README.md'), 'utf8'),
    readFile(resolve('examples', 'mixed-stack', 'portreeve.stack.json'), 'utf8'),
  ]);
  expect(desktop).toContain('The Stacks tab never starts or stops a project process');
  expect(desktop).toContain('Launchers is the fourth primary tab');
  expect(desktop).toContain('Guide is the rightmost primary tab');
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
  expect(protocol).toMatch(/not general file\s+discovery or arbitrary-path APIs/u);
  expect(desktop).toContain('Create or Edit Stack');
  expect(desktop).toContain('opaque document ID');
  expect(safety).toMatch(/exact bytes observed/u);
  expect(migration).toMatch(/Retain the project launcher/u);
  expect(troubleshooting).toContain('Saved, but not applied');
  expect(troubleshooting).toContain('external definition change');
});

test('public guides document the complete project-launcher contract', async () => {
  const [
    readme,
    launcherGuide,
    desktop,
    cli,
    migration,
    troubleshooting,
    stack,
    launcher,
  ] = await Promise.all([
    readFile(resolve('README.md'), 'utf8'),
    readFile(resolve('docs', 'launchers.md'), 'utf8'),
    readFile(resolve('docs', 'desktop.md'), 'utf8'),
    readFile(resolve('docs', 'cli-contract.md'), 'utf8'),
    readFile(resolve('docs', 'migration.md'), 'utf8'),
    readFile(resolve('docs', 'troubleshooting.md'), 'utf8'),
    readFile(resolve('examples', 'mixed-stack', 'portreeve.stack.json'), 'utf8'),
    readFile(resolve('examples', 'mixed-stack', 'portreeve.launcher.json'), 'utf8'),
  ]);

  expect(readme).toContain('[Project launchers](docs/launchers.md)');
  for (const phrase of [
    'One stack, one companion launcher',
    'Version 1 file schema',
    'Exact-revision trust',
    'Endpoint environment contract',
    'Command-only lifecycle',
    'Verified activation checklist',
    'Attached Start and concurrency',
    'Degraded recovery',
    'Output and history retention',
    'Platform and deferred scope',
  ]) {
    expect(launcherGuide).toContain(phrase);
  }
  for (const reserved of [
    'PORTREEVE_STACK_ROOT',
    'PORTREEVE_STACK_ID',
    'PORTREEVE_GENERATION_ID',
    'PORTREEVE_SOCKET',
    'PORTREEVE_ACTIVATION_ID',
  ]) {
    expect(launcherGuide).toContain(reserved);
  }
  expect(launcherGuide).toMatch(/never\s+automatically persists raw output/u);
  expect(launcherGuide).toContain('Delete all data');
  expect(launcherGuide).toContain('Start and Restart refuse');
  expect(desktop).toContain('Save and Trust');
  expect(cli).toContain('stop --allow-degraded');
  expect(migration).toContain('Moving an existing orchestrator to PortReeve Launcher');
  expect(troubleshooting).toMatch(/There is\s+no force-execute/u);

  const stackDefinition = JSON.parse(stack);
  const normalizedLauncher = normalizeLauncherDefinition(JSON.parse(launcher));
  validateLauncherTopology(normalizedLauncher.definition, stackDefinition);
  expect(normalizedLauncher.content).toBe(launcher);
});
