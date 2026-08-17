// @ts-check

import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DesktopUpdateManifestSchema } from '../apps/desktop/shared/schemas.js';

export function createCommandPublicationAdapters() {
  return {
    github: createGitHubReleaseAdapter(),
    homebrew: createHomebrewTapAdapter(),
    desktopUpdate: createDesktopUpdateAdapter(),
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

function createHomebrewTapAdapter() {
  return {
    async preflight(/** @type {Record<string, any>} */ plan) {
      await run('gh', ['repo', 'view', plan.homebrew.repository, '--json', 'name']);
    },
    async publish(
      /** @type {Record<string, any>} */ plan,
      /** @type {string} */ releaseRoot,
    ) {
      const directory = await mkdtemp(join(tmpdir(), 'portreeve-tap-'));
      try {
        await run('gh', ['repo', 'clone', plan.homebrew.repository, directory]);
        const formulaTarget = resolve(directory, 'Formula', 'portreeve.rb');
        const caskTarget = resolve(directory, 'Casks', 'portreeve-app.rb');
        await mkdir(dirname(formulaTarget), { recursive: true });
        await mkdir(dirname(caskTarget), { recursive: true });
        await copyFile(resolve(releaseRoot, plan.homebrew.formula.path), formulaTarget);
        await copyFile(resolve(releaseRoot, plan.homebrew.cask.path), caskTarget);
        const status = await run('git', ['status', '--porcelain'], directory);
        if (status.stdout.trim() !== '') {
          await run(
            'git',
            ['add', 'Formula/portreeve.rb', 'Casks/portreeve-app.rb'],
            directory,
          );
          await run(
            'git',
            [
              '-c',
              'user.name=github-actions[bot]',
              '-c',
              'user.email=41898282+github-actions[bot]@users.noreply.github.com',
              'commit',
              '-m',
              `Publish PortReeve ${plan.releaseVersion}`,
            ],
            directory,
          );
          await run('git', ['push', 'origin', 'HEAD'], directory);
        }
        const commit = await run('git', ['rev-parse', 'HEAD'], directory);
        return { commit: commit.stdout.trim() };
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

function createDesktopUpdateAdapter() {
  return {
    async preflight(/** @type {Record<string, any>} */ plan) {
      const current = await readRepositoryFile(
        plan.desktopUpdate.repository,
        plan.desktopUpdate.path,
        plan.desktopUpdate.branch,
      );
      DesktopUpdateManifestSchema.parse(JSON.parse(current.content));
    },
    async publish(
      /** @type {Record<string, any>} */ plan,
      /** @type {string} */ releaseRoot,
    ) {
      const expected = await readFile(
        resolve(releaseRoot, plan.desktopUpdate.artifact.path),
        'utf8',
      );
      DesktopUpdateManifestSchema.parse(JSON.parse(expected));
      const current = await readRepositoryFile(
        plan.desktopUpdate.repository,
        plan.desktopUpdate.path,
        plan.desktopUpdate.branch,
      );
      if (current.content === expected) {
        const commits = await runJson('gh', [
          'api',
          `repos/${plan.desktopUpdate.repository}/commits?path=${encodeURIComponent(plan.desktopUpdate.path)}&per_page=1`,
        ]);
        const commit = Array.isArray(commits) ? commits[0]?.sha : undefined;
        if (typeof commit !== 'string') {
          throw new Error('Unable to identify the existing Desktop update commit.');
        }
        return { commit };
      }
      const result = await runJson('gh', [
        'api',
        '--method',
        'PUT',
        `repos/${plan.desktopUpdate.repository}/contents/${plan.desktopUpdate.path}`,
        '-f',
        `message=Publish PortReeve ${plan.releaseVersion} Desktop update metadata`,
        '-f',
        `content=${Buffer.from(expected).toString('base64')}`,
        '-f',
        `sha=${current.sha}`,
        '-f',
        `branch=${plan.desktopUpdate.branch}`,
      ]);
      if (typeof result?.commit?.sha !== 'string') {
        throw new Error('Desktop update publication returned no commit identity.');
      }
      return { commit: result.commit.sha };
    },
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

/** @param {string} repository @param {string} path @param {string} branch */
async function readRepositoryFile(repository, path, branch) {
  const value = await runJson('gh', [
    'api',
    `repos/${repository}/contents/${path}?ref=${encodeURIComponent(branch)}`,
  ]);
  if (typeof value?.sha !== 'string' || typeof value?.content !== 'string') {
    throw new Error(`Repository file response is invalid: ${repository}/${path}`);
  }
  return {
    sha: value.sha,
    content: Buffer.from(value.content.replaceAll('\n', ''), 'base64').toString('utf8'),
  };
}

/** @param {string} command @param {string[]} arguments_ @param {string} [cwd] */
async function runJson(command, arguments_, cwd) {
  const result = await run(command, arguments_, cwd);
  return JSON.parse(result.stdout);
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
