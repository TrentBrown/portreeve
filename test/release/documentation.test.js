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
  expect(workflow).toContain('- run: bun run check');
  expect(workflow).toContain('- run: bun run release:verify -- --native --lifecycle');
  expect(workflow).toContain('Require public repository for release distribution');
  expect(workflow.match(/needs: release-policy/gu)).toHaveLength(2);
});
