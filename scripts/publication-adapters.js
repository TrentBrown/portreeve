// @ts-check

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DesktopUpdateManifestSchema } from '../apps/desktop/shared/schemas.js';
import {
  preflightRepositoryPullRequest,
  publishRepositoryFilesViaPullRequest,
  requestGitHubApi,
} from './github-pr-publication.js';

/**
 * @param {{
 *   request?: import('./github-pr-publication.js').GitHubRequester,
 *   publishRepository?: typeof publishRepositoryFilesViaPullRequest,
 * }} [dependencies]
 */
export function createCommandPublicationAdapters(dependencies = {}) {
  const request = dependencies.request ?? requestGitHubApi;
  const publishRepository =
    dependencies.publishRepository ?? publishRepositoryFilesViaPullRequest;
  return {
    github: createGitHubReleaseAdapter(),
    homebrew: createHomebrewTapAdapter(request, publishRepository),
    desktopUpdate: createDesktopUpdateAdapter(request, publishRepository),
  };
}

function createGitHubReleaseAdapter() {
  return {
    async preflight(/** @type {Record<string, any>} */ plan) {
      const existing = await inspectRelease(plan);
      if (existing !== null) assertExistingRelease(plan, existing);
    },
    async publish(
      /** @type {Record<string, any>} */ plan,
      /** @type {string} */ releaseRoot,
    ) {
      const existing = await inspectRelease(plan);
      if (existing !== null) {
        assertExistingRelease(plan, existing);
        return { url: String(existing.html_url) };
      }
      const arguments_ = [
        'release',
        'create',
        plan.tag,
        '--repo',
        plan.github.repository,
        '--target',
        plan.source.commit,
        '--title',
        plan.github.releaseName,
        '--notes-file',
        resolve(releaseRoot, 'publication-plan.md'),
        ...(plan.prerelease ? ['--prerelease'] : []),
        ...plan.github.assets.map((/** @type {Record<string, any>} */ artifact) =>
          resolve(releaseRoot, artifact.path),
        ),
      ];
      await run('gh', arguments_);
      const published = await inspectRelease(plan);
      if (published === null) {
        throw new Error('GitHub release was not observable after publication.');
      }
      assertExistingRelease(plan, published);
      return { url: String(published.html_url) };
    },
  };
}

/**
 * @param {import('./github-pr-publication.js').GitHubRequester} request
 * @param {typeof publishRepositoryFilesViaPullRequest} publishRepository
 */
function createHomebrewTapAdapter(request, publishRepository) {
  return {
    async preflight(/** @type {Record<string, any>} */ plan) {
      await preflightRepositoryPullRequest({
        request,
        repository: plan.homebrew.repository,
        baseBranch: plan.homebrew.branch,
      });
    },
    async publish(
      /** @type {Record<string, any>} */ plan,
      /** @type {string} */ releaseRoot,
      /** @type {{planSha256: string}} */ context,
    ) {
      return publishRepository({
        request,
        repository: plan.homebrew.repository,
        baseBranch: plan.homebrew.branch,
        releaseVersion: plan.releaseVersion,
        sourceCommit: plan.source.commit,
        planSha256: context.planSha256,
        title: `Publish PortReeve ${plan.releaseVersion} Homebrew metadata`,
        files: [
          await publicationFile(
            releaseRoot,
            plan.homebrew.formula,
            'Formula/portreeve.rb',
          ),
          await publicationFile(
            releaseRoot,
            plan.homebrew.cask,
            'Casks/portreeve-app.rb',
          ),
        ],
      });
    },
  };
}

/**
 * @param {import('./github-pr-publication.js').GitHubRequester} request
 * @param {typeof publishRepositoryFilesViaPullRequest} publishRepository
 */
function createDesktopUpdateAdapter(request, publishRepository) {
  return {
    async preflight(/** @type {Record<string, any>} */ plan) {
      await preflightRepositoryPullRequest({
        request,
        repository: plan.desktopUpdate.repository,
        baseBranch: plan.desktopUpdate.branch,
      });
      const current = await readRepositoryFile(
        request,
        plan.desktopUpdate.repository,
        plan.desktopUpdate.path,
        plan.desktopUpdate.branch,
      );
      DesktopUpdateManifestSchema.parse(JSON.parse(current.content));
    },
    async publish(
      /** @type {Record<string, any>} */ plan,
      /** @type {string} */ releaseRoot,
      /** @type {{planSha256: string}} */ context,
    ) {
      const expected = await readFile(
        resolve(releaseRoot, plan.desktopUpdate.artifact.path),
        'utf8',
      );
      DesktopUpdateManifestSchema.parse(JSON.parse(expected));
      return publishRepository({
        request,
        repository: plan.desktopUpdate.repository,
        baseBranch: plan.desktopUpdate.branch,
        releaseVersion: plan.releaseVersion,
        sourceCommit: plan.source.commit,
        planSha256: context.planSha256,
        title: `Publish PortReeve ${plan.releaseVersion} Desktop update metadata`,
        files: [
          {
            path: plan.desktopUpdate.path,
            content: expected,
            sha256: plan.desktopUpdate.artifact.sha256,
          },
        ],
      });
    },
  };
}

/**
 * @param {string} releaseRoot
 * @param {Record<string, any>} artifact
 * @param {string} path
 */
async function publicationFile(releaseRoot, artifact, path) {
  return {
    path,
    content: await readFile(resolve(releaseRoot, artifact.path), 'utf8'),
    sha256: artifact.sha256,
  };
}

/** @param {Record<string, any>} plan */
async function inspectRelease(plan) {
  const result = await runAllowingNotFound('gh', [
    'api',
    `repos/${plan.github.repository}/releases/tags/${plan.tag}`,
  ]);
  return result === null ? null : JSON.parse(result.stdout);
}

/** @param {Record<string, any>} plan @param {Record<string, any>} release */
function assertExistingRelease(plan, release) {
  if (
    release.tag_name !== plan.tag ||
    release.prerelease !== plan.prerelease ||
    release.target_commitish !== plan.source.commit
  ) {
    throw new Error(`Existing GitHub release differs from ${plan.tag}.`);
  }
  const assets = new Map(
    (Array.isArray(release.assets) ? release.assets : []).map((artifact) => [
      artifact.name,
      artifact,
    ]),
  );
  for (const expected of plan.github.assets) {
    const actual = assets.get(expected.filename);
    if (
      actual?.size !== expected.bytes ||
      actual?.digest !== `sha256:${expected.sha256}`
    ) {
      throw new Error(`Existing GitHub asset differs: ${expected.filename}`);
    }
  }
}

/**
 * @param {import('./github-pr-publication.js').GitHubRequester} request
 * @param {string} repository
 * @param {string} path
 * @param {string} branch
 */
async function readRepositoryFile(request, repository, path, branch) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const value = await request({
    endpoint: `repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
  });
  if (typeof value?.sha !== 'string' || typeof value?.content !== 'string') {
    throw new Error(`Repository file response is invalid: ${repository}/${path}`);
  }
  return {
    sha: value.sha,
    content: Buffer.from(value.content.replaceAll('\n', ''), 'base64').toString('utf8'),
  };
}

/** @param {string} command @param {string[]} arguments_ */
async function runAllowingNotFound(command, arguments_) {
  const result = await spawn(command, arguments_);
  if (result.code === 0) return result;
  if (/HTTP 404/u.test(result.stderr)) return null;
  throw commandError(command, arguments_, result);
}

/** @param {string} command @param {string[]} arguments_ @param {string} [cwd] */
async function run(command, arguments_, cwd) {
  const result = await spawn(command, arguments_, cwd);
  if (result.code !== 0) throw commandError(command, arguments_, result);
  return result;
}

/** @param {string} command @param {string[]} arguments_ @param {string} [cwd] */
async function spawn(command, arguments_, cwd) {
  const child = Bun.spawn([command, ...arguments_], {
    ...(cwd === undefined ? {} : { cwd }),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

/** @param {string} command @param {string[]} arguments_ @param {{code: number, stdout: string, stderr: string}} result */
function commandError(command, arguments_, result) {
  return new Error(
    `${command} ${arguments_.join(' ')} failed (${result.code}): ${result.stderr.trim() || result.stdout.trim()}`,
  );
}
