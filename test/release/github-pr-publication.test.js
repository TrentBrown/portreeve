// @ts-check

import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import {
  parsePublicationPullRequestBody,
  preflightRepositoryPullRequest,
  publicationBranchName,
  publishRepositoryFilesViaPullRequest,
  renderPublicationPullRequestBody,
} from '../../scripts/github-pr-publication.js';

const repository = 'TrentBrown/homebrew-portreeve';
const releaseVersion = '0.2.0-preview.1';
const sourceCommit = '8'.repeat(40);
const planSha256 = '9'.repeat(64);
const files = [
  exactFile('Casks/portreeve-app.rb', 'cask exact\n'),
  exactFile('Formula/portreeve.rb', 'formula exact\n'),
];

describe('GitHub publication pull requests', () => {
  test('uses stable tb-prefixed branch and self-verifying PR identities', () => {
    const branch = publicationBranchName(releaseVersion);
    expect(branch).toMatch(/^tb-portreeve-release-v0\.2\.0-preview\.1-[a-f0-9]{8}$/u);
    const metadata = {
      repository,
      baseBranch: 'main',
      branch,
      releaseVersion,
      sourceCommit,
      planSha256,
      publicationCommit: 'd'.repeat(40),
      baseCommit: 'a'.repeat(40),
      files: files.map(({ path, sha256 }) => ({ path, content: '', sha256 })),
    };
    const body = renderPublicationPullRequestBody(metadata);
    expect(body).toContain(`Publication plan SHA-256: \`${planSha256}\``);
    expect(parsePublicationPullRequestBody(body)).toEqual(metadata);
  });

  test('preflights repository and destination branch without mutation', async () => {
    const github = new FakeGitHub();
    await preflightRepositoryPullRequest({
      request: github.request,
      repository,
      baseBranch: 'main',
    });
    expect(github.mutations).toEqual([]);
  });

  test('creates, validates, merge-commits, verifies, and cleans one exact PR', async () => {
    const github = new FakeGitHub();
    const result = await publish(github);
    expect(result).toMatchObject({
      commit: github.mergeCommit,
      pullRequestUrl: `https://github.com/${repository}/pull/1`,
      publicationCommit: github.publicationCommit,
      baseCommit: github.originalBase,
    });
    expect(github.pulls).toHaveLength(1);
    expect(github.refs.has(publicationBranchName(releaseVersion))).toBe(false);
    expect(github.filesAt(github.currentBase)).toEqual(fileMap(files));
    expect(
      github.mutations.map(({ method, endpoint }) => `${method} ${endpoint}`),
    ).toEqual([
      `POST repos/${repository}/git/trees`,
      `POST repos/${repository}/git/commits`,
      `POST repos/${repository}/git/refs`,
      `POST repos/${repository}/pulls`,
      `PUT repos/${repository}/pulls/1/merge`,
      `DELETE repos/${repository}/git/refs/heads/${publicationBranchName(releaseVersion)}`,
    ]);
    expect(github.mergeBodies).toEqual([
      expect.objectContaining({
        merge_method: 'merge',
        sha: github.publicationCommit,
      }),
    ]);
  });

  test('preserves a blocked exact PR and completes it on retry without duplication', async () => {
    const github = new FakeGitHub();
    github.mergeableState = 'blocked';
    await expect(publish(github)).rejects.toThrow(
      `required checks or independent review must be completed: https://github.com/${repository}/pull/1`,
    );
    expect(github.pulls).toHaveLength(1);
    expect(github.refs.has(publicationBranchName(releaseVersion))).toBe(true);

    github.mergeableState = 'clean';
    await expect(publish(github)).resolves.toMatchObject({
      commit: github.mergeCommit,
    });
    expect(github.pulls).toHaveLength(1);
  });

  test('reuses an already merged PR and verified destination on no-op retry', async () => {
    const github = new FakeGitHub();
    const first = await publish(github);
    const mutationCount = github.mutations.length;
    const second = await publish(github);
    expect(second).toEqual(first);
    expect(github.pulls).toHaveLength(1);
    expect(github.mutations.slice(mutationCount)).toEqual([]);
  });

  test('bounds unknown mergeability and leaves the exact PR available', async () => {
    const github = new FakeGitHub();
    github.mergeable = null;
    github.mergeableState = 'unknown';
    let sleeps = 0;
    await expect(
      publish(github, {
        mergeAttempts: 2,
        sleep: async () => {
          sleeps += 1;
        },
      }),
    ).rejects.toThrow('within the bounded wait');
    expect(sleeps).toBe(1);
    expect(github.pulls).toHaveLength(1);
    expect(github.refs.has(publicationBranchName(releaseVersion))).toBe(true);
  });

  test('refuses an unexpected PR path before considering merge policy', async () => {
    const github = new FakeGitHub();
    github.mergeableState = 'blocked';
    await expect(publish(github)).rejects.toThrow('required checks');
    github.pulls[0].changed_files += 1;
    github.pullFiles.push({ filename: 'README.md', status: 'modified' });
    github.mergeableState = 'clean';
    await expect(publish(github)).rejects.toThrow('changes unexpected paths');
    expect(github.mergeBodies).toEqual([]);
  });

  test('refuses matching destination bytes that have no publication PR evidence', async () => {
    const github = new FakeGitHub({ destinationFiles: fileMap(files) });
    await expect(publish(github)).rejects.toThrow(
      'no publication pull request proves their origin',
    );
    expect(github.mutations).toEqual([]);
  });

  test('refuses an exact-looking branch based outside destination history', async () => {
    const github = new FakeGitHub();
    const rogueBase = 'f'.repeat(40);
    github.commits.set(rogueBase, {
      sha: rogueBase,
      tree: { sha: github.baseTree },
      parents: [],
    });
    github.commits.set(github.publicationCommit, {
      sha: github.publicationCommit,
      tree: { sha: github.publicationTree },
      parents: [{ sha: rogueBase }],
    });
    github.commitFiles.set(github.publicationCommit, fileMap(files));
    github.refs.set(publicationBranchName(releaseVersion), github.publicationCommit);
    github.comparisonOverrides.set(`${rogueBase}...${github.publicationCommit}`, {
      status: 'ahead',
      ahead_by: 1,
    });
    await expect(publish(github)).rejects.toThrow(
      'base is not retained by the destination branch',
    );
    expect(github.pulls).toEqual([]);
  });

  test('recovers branch cleanup after content and merge have completed', async () => {
    const github = new FakeGitHub();
    github.failBranchCleanup = true;
    await expect(publish(github)).rejects.toThrow('simulated branch cleanup outage');
    expect(github.pulls[0].merged).toBe(true);
    expect(github.refs.has(publicationBranchName(releaseVersion))).toBe(true);

    github.failBranchCleanup = false;
    await expect(publish(github)).resolves.toMatchObject({
      commit: github.mergeCommit,
    });
    expect(github.refs.has(publicationBranchName(releaseVersion))).toBe(false);
    expect(github.pulls).toHaveLength(1);
  });
});

/**
 * @param {FakeGitHub} github
 * @param {{mergeAttempts?: number, sleep?: (milliseconds: number) => Promise<void>}} [runtime]
 */
function publish(github, runtime = {}) {
  return publishRepositoryFilesViaPullRequest({
    request: github.request,
    repository,
    releaseVersion,
    sourceCommit,
    planSha256,
    title: `Publish PortReeve ${releaseVersion}`,
    files,
    mergeIntervalMilliseconds: 0,
    ...runtime,
  });
}

class FakeGitHub {
  originalBase = 'a'.repeat(40);
  baseTree = 'b'.repeat(40);
  publicationTree = 'c'.repeat(40);
  publicationCommit = 'd'.repeat(40);
  mergeCommit = 'e'.repeat(40);
  currentBase = this.originalBase;
  /** @type {boolean | null} */
  mergeable = true;
  mergeableState = 'clean';
  failBranchCleanup = false;
  /** @type {Map<string, string>} */
  refs = new Map();
  /** @type {Map<string, {sha: string, tree: {sha: string}, parents: Array<{sha: string}>}>} */
  commits = new Map();
  /** @type {Map<string, Map<string, string>>} */
  commitFiles = new Map();
  /** @type {Map<string, Map<string, string>>} */
  trees = new Map();
  /** @type {any[]} */
  pulls = [];
  /** @type {Array<{filename: string, status: string}>} */
  pullFiles = [];
  /** @type {Array<{method: string, endpoint: string}>} */
  mutations = [];
  /** @type {any[]} */
  mergeBodies = [];
  /** @type {Map<string, {status: string, ahead_by: number}>} */
  comparisonOverrides = new Map();

  /** @param {{destinationFiles?: Map<string, string>}} [options] */
  constructor(options = {}) {
    const initial =
      options.destinationFiles ??
      new Map([
        ['Casks/portreeve-app.rb', 'old cask\n'],
        ['Formula/portreeve.rb', 'old formula\n'],
      ]);
    this.commits.set(this.originalBase, {
      sha: this.originalBase,
      tree: { sha: this.baseTree },
      parents: [],
    });
    this.commitFiles.set(this.originalBase, new Map(initial));
    this.trees.set(this.baseTree, new Map(initial));
    this.request = this.request.bind(this);
  }

  /** @param {import('../../scripts/github-pr-publication.js').GitHubRequest} request */
  async request(request) {
    const method = request.method ?? 'GET';
    const endpoint = request.endpoint;
    if (method !== 'GET') this.mutations.push({ method, endpoint });

    if (method === 'GET' && endpoint === `repos/${repository}`) {
      return { full_name: repository };
    }
    if (method === 'GET' && endpoint === `repos/${repository}/branches/main`) {
      return { commit: { sha: this.currentBase } };
    }
    const reference = endpoint.match(
      new RegExp(`^repos/${repository}/git/ref/heads/(.+)$`, 'u'),
    );
    if (method === 'GET' && reference !== null) {
      const branch = decodeURIComponent(String(reference[1]));
      const sha = this.refs.get(branch);
      if (sha === undefined && request.allowNotFound === true) return null;
      if (sha === undefined) throw new Error('HTTP 404 simulated ref');
      return { object: { sha } };
    }
    const commit = endpoint.match(
      new RegExp(`^repos/${repository}/git/commits/([a-f0-9]{40})$`, 'u'),
    );
    if (method === 'GET' && commit !== null) {
      const value = this.commits.get(String(commit[1]));
      if (value === undefined) throw new Error('HTTP 404 simulated commit');
      return structuredClone(value);
    }
    if (method === 'POST' && endpoint === `repos/${repository}/git/trees`) {
      const body = /** @type {any} */ (request.body);
      const result = new Map(this.trees.get(body.base_tree) ?? []);
      for (const entry of body.tree) result.set(entry.path, entry.content);
      this.trees.set(this.publicationTree, result);
      return { sha: this.publicationTree };
    }
    if (method === 'POST' && endpoint === `repos/${repository}/git/commits`) {
      const body = /** @type {any} */ (request.body);
      this.commits.set(this.publicationCommit, {
        sha: this.publicationCommit,
        tree: { sha: body.tree },
        parents: body.parents.map((/** @type {string} */ sha) => ({ sha })),
      });
      this.commitFiles.set(
        this.publicationCommit,
        new Map(this.trees.get(body.tree) ?? []),
      );
      return { sha: this.publicationCommit };
    }
    if (method === 'POST' && endpoint === `repos/${repository}/git/refs`) {
      const body = /** @type {any} */ (request.body);
      this.refs.set(body.ref.replace('refs/heads/', ''), body.sha);
      return { ref: body.ref, object: { sha: body.sha } };
    }
    if (method === 'GET' && endpoint.startsWith(`repos/${repository}/compare/`)) {
      const [base, head] = endpoint
        .slice(`repos/${repository}/compare/`.length)
        .split('...');
      const override = this.comparisonOverrides.get(`${base}...${head}`);
      if (override !== undefined) return structuredClone(override);
      if (base === this.originalBase && head === this.publicationCommit) {
        return { status: 'ahead', ahead_by: 1 };
      }
      if (base === this.originalBase && head === this.currentBase) {
        return {
          status: head === this.originalBase ? 'identical' : 'ahead',
          ahead_by: head === this.originalBase ? 0 : 1,
        };
      }
      if (base === this.mergeCommit && head === this.currentBase) {
        return { status: 'identical', ahead_by: 0 };
      }
      return { status: 'diverged', ahead_by: 0 };
    }
    if (
      method === 'GET' &&
      endpoint.startsWith(`repos/${repository}/pulls?state=all&`)
    ) {
      return structuredClone(this.pulls);
    }
    if (method === 'POST' && endpoint === `repos/${repository}/pulls`) {
      const body = /** @type {any} */ (request.body);
      const pull = {
        number: 1,
        html_url: `https://github.com/${repository}/pull/1`,
        title: body.title,
        body: body.body,
        base: { ref: body.base },
        head: {
          ref: body.head,
          sha: this.refs.get(body.head),
          repo: { full_name: repository },
        },
        draft: body.draft,
        state: 'open',
        merged: false,
        mergeable: this.mergeable,
        mergeable_state: this.mergeableState,
        changed_files: files.length,
        merge_commit_sha: null,
      };
      this.pulls.push(pull);
      this.pullFiles = files.map(({ path }) => ({
        filename: path,
        status: 'modified',
      }));
      return structuredClone(pull);
    }
    const pull = endpoint.match(new RegExp(`^repos/${repository}/pulls/(\\d+)$`, 'u'));
    if (method === 'GET' && pull !== null) {
      const value = this.pulls.find(({ number }) => number === Number(pull[1]));
      value.mergeable = this.mergeable;
      value.mergeable_state = this.mergeableState;
      return structuredClone(value);
    }
    const pullFiles = endpoint.match(
      new RegExp(`^repos/${repository}/pulls/(\\d+)/files\\?per_page=100$`, 'u'),
    );
    if (method === 'GET' && pullFiles !== null) {
      return structuredClone(this.pullFiles);
    }
    const merge = endpoint.match(
      new RegExp(`^repos/${repository}/pulls/(\\d+)/merge$`, 'u'),
    );
    if (method === 'PUT' && merge !== null) {
      const body = /** @type {any} */ (request.body);
      this.mergeBodies.push(body);
      const value = this.pulls.find(({ number }) => number === Number(merge[1]));
      value.state = 'closed';
      value.merged = true;
      value.merge_commit_sha = this.mergeCommit;
      this.commits.set(this.mergeCommit, {
        sha: this.mergeCommit,
        tree: { sha: this.publicationTree },
        parents: [{ sha: this.currentBase }, { sha: this.publicationCommit }],
      });
      this.commitFiles.set(
        this.mergeCommit,
        new Map(this.commitFiles.get(this.publicationCommit) ?? []),
      );
      this.currentBase = this.mergeCommit;
      return { merged: true, sha: this.mergeCommit };
    }
    const contents = endpoint.match(
      new RegExp(`^repos/${repository}/contents/(.+)\\?ref=(.+)$`, 'u'),
    );
    if (method === 'GET' && contents !== null) {
      const path = String(contents[1]).split('/').map(decodeURIComponent).join('/');
      const referenceName = decodeURIComponent(String(contents[2]));
      const commitSha =
        referenceName === 'main'
          ? this.currentBase
          : (this.refs.get(referenceName) ?? referenceName);
      const content = this.commitFiles.get(commitSha)?.get(path);
      if (content === undefined && request.allowNotFound === true) return null;
      if (content === undefined) throw new Error('HTTP 404 simulated file');
      return {
        type: 'file',
        content: Buffer.from(content).toString('base64'),
      };
    }
    const deletion = endpoint.match(
      new RegExp(`^repos/${repository}/git/refs/heads/(.+)$`, 'u'),
    );
    if (method === 'DELETE' && deletion !== null) {
      if (this.failBranchCleanup) throw new Error('simulated branch cleanup outage');
      this.refs.delete(decodeURIComponent(String(deletion[1])));
      return null;
    }
    throw new Error(`Unhandled fake GitHub request: ${method} ${endpoint}`);
  }

  /** @param {string} commit */
  filesAt(commit) {
    return new Map(this.commitFiles.get(commit));
  }
}

/** @param {string} path @param {string} content */
function exactFile(path, content) {
  return { path, content, sha256: sha256(content) };
}

/** @param {typeof files} values */
function fileMap(values) {
  return new Map(values.map(({ path, content }) => [path, content]));
}

/** @param {string} value */
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
