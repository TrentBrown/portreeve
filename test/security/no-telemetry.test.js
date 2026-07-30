// @ts-check

import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

test('runtime source contains no outbound URL or telemetry integration', async () => {
  const files = [
    ...(await sourceFiles('src')),
    ...(await sourceFiles('packages/client/src')),
  ];
  const findings = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (/https?:\/\//u.test(content) || /\btelemetry\b|\banalytics\b/iu.test(content)) {
      findings.push(file);
    }
  }
  expect(findings).toEqual([]);
});

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)));
    } else if (['.js', '.json'].includes(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}
