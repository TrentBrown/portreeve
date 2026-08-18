// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCommandPublicationAdapters } from '../../scripts/publication-adapters.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('command publication adapters', () => {
  test('contains no direct-main Git or contents-API mutation path', async () => {
    const source = await readFile('scripts/publication-adapters.js', 'utf8');
    expect(source).not.toContain("['repo', 'clone'");
    expect(source).not.toContain("['git', 'push'");
    expect(source).not.toContain("method: 'PUT'");
    expect(source).toContain('publishRepositoryFilesViaPullRequest');
  });

  test('routes Homebrew and Desktop candidate bytes through exact PR publications', async () => {
    const releaseRoot = await mkdtemp(join(tmpdir(), 'portreeve-adapters-'));
    directories.push(releaseRoot);
    const formula = 'class Portreeve < Formula\nend\n';
    const cask = 'cask "portreeve-app" do\nend\n';
    const desktop = await readFile('distribution/desktop-update.json', 'utf8');
    await writeFile(join(releaseRoot, 'portreeve.rb'), formula);
    await writeFile(join(releaseRoot, 'portreeve-app.rb'), cask);
    await writeFile(join(releaseRoot, 'desktop-update.json'), desktop);

    /** @type {Array<Record<string, any>>} */
    const requests = [];
    const request = async (/** @type {Record<string, any>} */ value) => {
      requests.push(value);
      if (
        value.endpoint.endsWith('/contents/distribution/desktop-update.json?ref=main')
      ) {
        return {
          sha: '1'.repeat(40),
          content: Buffer.from(desktop).toString('base64'),
        };
      }
      if (value.endpoint.includes('/branches/main')) {
        return { commit: { sha: '2'.repeat(40) } };
      }
      return { name: 'repository' };
    };
    /** @type {Array<Record<string, any>>} */
    const publications = [];
    const publishRepository = async (/** @type {Record<string, any>} */ value) => {
      publications.push(value);
      return {
        commit: `${publications.length}`.repeat(40),
        pullRequestUrl: `https://github.com/example/repository/pull/${publications.length}`,
      };
    };
    const adapters = createCommandPublicationAdapters({
      request,
      // @ts-expect-error Focused adapter seam intentionally records the call contract.
      publishRepository,
    });
    const plan = publicationPlan({ formula, cask, desktop });

    await adapters.homebrew.preflight(plan);
    await adapters.desktopUpdate.preflight(plan);
    const context = { planSha256: 'f'.repeat(64) };
    await adapters.homebrew.publish(plan, releaseRoot, context);
    await adapters.desktopUpdate.publish(plan, releaseRoot, context);

    expect(requests.map(({ endpoint }) => endpoint)).toEqual([
      'repos/TrentBrown/homebrew-portreeve',
      'repos/TrentBrown/homebrew-portreeve/branches/main',
      'repos/TrentBrown/portreeve',
      'repos/TrentBrown/portreeve/branches/main',
      'repos/TrentBrown/portreeve/contents/distribution/desktop-update.json?ref=main',
    ]);
    expect(publications).toHaveLength(2);
    expect(publications[0]).toMatchObject({
      request,
      repository: 'TrentBrown/homebrew-portreeve',
      baseBranch: 'main',
      releaseVersion: '0.2.0-preview.1',
      sourceCommit: 'a'.repeat(40),
      planSha256: context.planSha256,
      files: [
        { path: 'Formula/portreeve.rb', content: formula, sha256: sha256(formula) },
        {
          path: 'Casks/portreeve-app.rb',
          content: cask,
          sha256: sha256(cask),
        },
      ],
    });
    expect(publications[1]).toMatchObject({
      request,
      repository: 'TrentBrown/portreeve',
      baseBranch: 'main',
      releaseVersion: '0.2.0-preview.1',
      sourceCommit: 'a'.repeat(40),
      planSha256: context.planSha256,
      files: [
        {
          path: 'distribution/desktop-update.json',
          content: desktop,
          sha256: sha256(desktop),
        },
      ],
    });
  });
});

/**
 * @param {{formula: string, cask: string, desktop: string}} files
 */
function publicationPlan(files) {
  return {
    releaseVersion: '0.2.0-preview.1',
    source: { commit: 'a'.repeat(40) },
    homebrew: {
      repository: 'TrentBrown/homebrew-portreeve',
      branch: 'main',
      formula: {
        path: 'portreeve.rb',
        sha256: sha256(files.formula),
      },
      cask: {
        path: 'portreeve-app.rb',
        sha256: sha256(files.cask),
      },
    },
    desktopUpdate: {
      repository: 'TrentBrown/portreeve',
      branch: 'main',
      path: 'distribution/desktop-update.json',
      artifact: {
        path: 'desktop-update.json',
        sha256: sha256(files.desktop),
      },
    },
  };
}

/** @param {string} value */
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
