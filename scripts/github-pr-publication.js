// @ts-check

import { createHash } from 'node:crypto';

const COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DEFAULT_MERGE_ATTEMPTS = 6;
const DEFAULT_MERGE_INTERVAL_MILLISECONDS = 2_000;

/**
 * @typedef {{method?: string, endpoint: string, body?: unknown, allowNotFound?: boolean}}
 * GitHubRequest
 */

/** @typedef {(request: GitHubRequest) => Promise<any>} GitHubRequester */

/**
 * @typedef {{path: string, content: string, sha256: string}}
 * PublicationFile
 */

/**
 * @typedef {{repository: string, baseBranch: string, branch: string, releaseVersion: string, sourceCommit: string, planSha256: string, files: Array<{path: string, sha256: string}>}}
 * PublicationIdentity
 */

/**
 * @param {string} releaseVersion
 */
export function publicationBranchName(releaseVersion) {
  const slug = releaseVersion.replaceAll(/[^0-9A-Za-z._-]/gu, '-');
  const suffix = createHash('sha256').update(releaseVersion).digest('hex').slice(0, 8);
  return `tb-portreeve-release-v${slug}-${suffix}`;
}

/**
 * @param {{repository: string, baseBranch: string, branch: string, releaseVersion: string, sourceCommit: string, planSha256: string, publicationCommit: string, baseCommit: string, files: PublicationFile[]}}
 * metadata
 */
export function renderPublicationPullRequestBody(metadata) {
  validateMetadata(metadata);
  const marker = Buffer.from(JSON.stringify(metadata)).toString('base64url');
  const files = metadata.files
    .map((file) => `- \`${file.path}\` - \`${file.sha256}\``)
    .join('\n');
  return `This pull request was generated from an approved PortReeve publication plan.

- Release: \`${metadata.releaseVersion}\`
- Source commit: \`${metadata.sourceCommit}\`
- Publication plan SHA-256: \`${metadata.planSha256}\`
- Destination: \`${metadata.repository}:${metadata.baseBranch}\`

## Exact generated files

${files}

The publisher will merge this pull request with a merge commit only after GitHub reports
that repository checks and review policy permit it. Do not add unrelated changes.

<!-- portreeve-publication:v1:${marker} -->
`;
}

/** @param {string} body */
export function parsePublicationPullRequestBody(body) {
  const match = /<!-- portreeve-publication:v1:([0-9A-Za-z_-]+) -->/u.exec(body);
  if (match?.[1] === undefined) {
    throw new Error('Publication pull request is missing its exact identity marker.');
  }
  let value;
  try {
    value = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Publication pull request identity marker is invalid.');
  }
  validateMetadata(value);
  return value;
}

/**
 * @param {{request: GitHubRequester, repository: string, baseBranch: string}}
 * options
 */
export async function preflightRepositoryPullRequest(options) {
  await options.request({ endpoint: `repos/${options.repository}` });
  const branch = await options.request({
    endpoint: `repos/${options.repository}/branches/${encodeURIComponent(options.baseBranch)}`,
  });
  requireCommit(branch?.commit?.sha, 'destination branch commit');
}

/**
 * @param {{
 *   request: GitHubRequester,
 *   repository: string,
 *   baseBranch?: string,
 *   releaseVersion: string,
 *   sourceCommit: string,
 *   planSha256: string,
 *   title: string,
 *   files: PublicationFile[],
 *   sleep?: (milliseconds: number) => Promise<void>,
 *   mergeAttempts?: number,
 *   mergeIntervalMilliseconds?: number,
 * }} options
 */
export async function publishRepositoryFilesViaPullRequest(options) {
  const baseBranch = options.baseBranch ?? 'main';
  const branch = publicationBranchName(options.releaseVersion);
  const files = normalizeFiles(options.files);
  const identity = {
    repository: options.repository,
    baseBranch,
    branch,
    releaseVersion: options.releaseVersion,
    sourceCommit: options.sourceCommit,
    planSha256: options.planSha256,
    files: files.map(({ path, sha256 }) => ({ path, sha256 })),
  };
  const pulls = await listPublicationPullRequests(options.request, identity);
  if (pulls.length > 1) {
    throw new Error(
      `Multiple publication pull requests use ${options.repository}:${branch}.`,
    );
  }

  let pull = pulls[0];
  let publicationCommit;
  let baseCommit;
  if (pull === undefined) {
    const reference = await readBranchReference(
      options.request,
      options.repository,
      branch,
    );
    if (reference === null) {
      if (
        await destinationFilesMatch(
          options.request,
          options.repository,
          baseBranch,
          files,
        )
      ) {
        throw new Error(
          `Destination files already match ${options.releaseVersion}, but no publication pull request proves their origin.`,
        );
      }
      const created = await createPublicationBranch({
        request: options.request,
        repository: options.repository,
        baseBranch,
        branch,
        title: options.title,
        files,
      });
      publicationCommit = created.publicationCommit;
      baseCommit = created.baseCommit;
    } else {
      publicationCommit = reference;
      const commit = await readCommit(
        options.request,
        options.repository,
        publicationCommit,
      );
      if (commit.parents.length !== 1) {
        throw new Error(
          'Existing publication branch must contain one generated commit.',
        );
      }
      baseCommit = commit.parents[0].sha;
    }
    await assertPublicationBranch({
      request: options.request,
      ...identity,
      files,
      publicationCommit,
      baseCommit,
    });
    const metadata = {
      ...identity,
      publicationCommit,
      baseCommit,
      files: files.map(({ path, sha256 }) => ({ path, content: '', sha256 })),
    };
    pull = await options.request({
      method: 'POST',
      endpoint: `repos/${options.repository}/pulls`,
      body: {
        title: options.title,
        body: renderPublicationPullRequestBody(metadata),
        head: branch,
        base: baseBranch,
        draft: false,
        maintainer_can_modify: false,
      },
    });
  }

  const verified = await assertPublicationPullRequest({
    request: options.request,
    pull,
    title: options.title,
    identity,
    files,
  });
  publicationCommit = verified.publicationCommit;
  baseCommit = verified.baseCommit;

  let currentPull = verified.pull;
  if (currentPull.merged !== true) {
    if (currentPull.state !== 'open') {
      throw new Error(
        `Publication pull request is closed without merge: ${pullUrl(currentPull)}`,
      );
    }
    currentPull = await waitForMergeability({
      request: options.request,
      repository: options.repository,
      number: currentPull.number,
      url: pullUrl(currentPull),
      sleep: options.sleep ?? defaultSleep,
      attempts: options.mergeAttempts ?? DEFAULT_MERGE_ATTEMPTS,
      intervalMilliseconds:
        options.mergeIntervalMilliseconds ?? DEFAULT_MERGE_INTERVAL_MILLISECONDS,
    });
    if (currentPull.mergeable !== true || currentPull.mergeable_state !== 'clean') {
      throw mergePolicyError(currentPull);
    }
    const merge = await options.request({
      method: 'PUT',
      endpoint: `repos/${options.repository}/pulls/${currentPull.number}/merge`,
      body: {
        merge_method: 'merge',
        sha: publicationCommit,
        commit_title: options.title,
        commit_message: `Approved publication plan ${options.planSha256}.`,
      },
    });
    if (merge?.merged !== true) {
      throw new Error(
        `GitHub did not merge the exact publication pull request: ${pullUrl(currentPull)}`,
      );
    }
    currentPull = await readPullRequest(
      options.request,
      options.repository,
      currentPull.number,
    );
  }

  const mergeCommit = requireCommit(
    currentPull.merge_commit_sha,
    'publication merge commit',
  );
  await assertMergedDestination({
    request: options.request,
    repository: options.repository,
    baseBranch,
    mergeCommit,
    files,
  });
  await cleanupPublicationBranch({
    request: options.request,
    repository: options.repository,
    branch,
    publicationCommit,
  });
  return {
    commit: mergeCommit,
    pullRequestUrl: pullUrl(currentPull),
    publicationCommit,
    baseCommit,
  };
}

/**
 * Production GitHub API request implementation. Tests inject a deterministic fake.
 *
 * @param {GitHubRequest} request
 */
export async function requestGitHubApi(request) {
  const arguments_ = [
    'api',
    '--method',
    request.method ?? 'GET',
    request.endpoint,
    '-H',
    'Accept: application/vnd.github+json',
    '-H',
    'X-GitHub-Api-Version: 2022-11-28',
    ...(request.body === undefined ? [] : ['--input', '-']),
  ];
  const child = Bun.spawn(['gh', ...arguments_], {
    stdin: request.body === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (request.body !== undefined) {
    if (child.stdin === undefined) {
      throw new Error('GitHub API request input pipe is unavailable.');
    }
    child.stdin.write(JSON.stringify(request.body));
    child.stdin.end();
  }
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0) {
    if (request.allowNotFound === true && /HTTP 404/u.test(stderr)) return null;
    throw new Error(
      `gh ${arguments_.join(' ')} failed (${code}): ${stderr.trim() || stdout.trim()}`,
    );
  }
  return stdout.trim() === '' ? null : JSON.parse(stdout);
}

/** @param {PublicationFile[]} files */
function normalizeFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Publication pull request requires at least one exact file.');
  }
  const paths = new Set();
  return files
    .map((file) => {
      if (
        typeof file.path !== 'string' ||
        file.path === '' ||
        file.path.startsWith('/') ||
        file.path.split('/').includes('..') ||
        typeof file.content !== 'string' ||
        !SHA256.test(file.sha256) ||
        sha256(file.content) !== file.sha256
      ) {
        throw new Error(`Publication file identity is invalid: ${String(file.path)}`);
      }
      if (paths.has(file.path)) {
        throw new Error(`Publication file path is duplicated: ${file.path}`);
      }
      paths.add(file.path);
      return { ...file };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * @param {{request: GitHubRequester, repository: string, baseBranch: string, branch: string, title: string, files: PublicationFile[]}}
 * options
 */
async function createPublicationBranch(options) {
  const base = await options.request({
    endpoint: `repos/${options.repository}/branches/${encodeURIComponent(options.baseBranch)}`,
  });
  const baseCommit = requireCommit(base?.commit?.sha, 'destination branch commit');
  const commit = await readCommit(options.request, options.repository, baseCommit);
  const tree = await options.request({
    method: 'POST',
    endpoint: `repos/${options.repository}/git/trees`,
    body: {
      base_tree: commit.tree.sha,
      tree: options.files.map((file) => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: file.content,
      })),
    },
  });
  const treeSha = requireCommit(tree?.sha, 'publication tree');
  const publication = await options.request({
    method: 'POST',
    endpoint: `repos/${options.repository}/git/commits`,
    body: {
      message: options.title,
      tree: treeSha,
      parents: [baseCommit],
    },
  });
  const publicationCommit = requireCommit(
    publication?.sha,
    'publication branch commit',
  );
  await options.request({
    method: 'POST',
    endpoint: `repos/${options.repository}/git/refs`,
    body: { ref: `refs/heads/${options.branch}`, sha: publicationCommit },
  });
  return { baseCommit, publicationCommit };
}

/**
 * @param {{request: GitHubRequester, repository: string, baseBranch: string, branch: string, releaseVersion: string, sourceCommit: string, planSha256: string, files: PublicationFile[], publicationCommit: string, baseCommit: string}}
 * options
 */
async function assertPublicationBranch(options) {
  const commit = await readCommit(
    options.request,
    options.repository,
    options.publicationCommit,
  );
  if (commit.parents.length !== 1 || commit.parents[0]?.sha !== options.baseCommit) {
    throw new Error('Publication branch ancestry differs from its recorded base.');
  }
  const ancestry = await options.request({
    endpoint: `repos/${options.repository}/compare/${options.baseCommit}...${options.publicationCommit}`,
  });
  if (ancestry?.status !== 'ahead' || ancestry?.ahead_by !== 1) {
    throw new Error('Publication branch must be exactly one commit ahead of its base.');
  }
  const destination = await options.request({
    endpoint: `repos/${options.repository}/branches/${encodeURIComponent(options.baseBranch)}`,
  });
  const destinationCommit = requireCommit(
    destination?.commit?.sha,
    'destination branch commit',
  );
  const retainedBase = await options.request({
    endpoint: `repos/${options.repository}/compare/${options.baseCommit}...${destinationCommit}`,
  });
  if (!['ahead', 'identical'].includes(retainedBase?.status)) {
    throw new Error(
      'Publication branch base is not retained by the destination branch.',
    );
  }
  await assertFilesAtReference(
    options.request,
    options.repository,
    options.publicationCommit,
    options.files,
  );
}

/**
 * @param {{request: GitHubRequester, pull: any, title: string, identity: PublicationIdentity, files: PublicationFile[]}}
 * options
 */
async function assertPublicationPullRequest(options) {
  const pull = await readPullRequest(
    options.request,
    options.identity.repository,
    options.pull.number,
  );
  const url = pullUrl(pull);
  if (
    pull.title !== options.title ||
    pull.base?.ref !== options.identity.baseBranch ||
    pull.head?.ref !== options.identity.branch ||
    pull.head?.repo?.full_name !== options.identity.repository ||
    pull.draft === true
  ) {
    throw new Error(`Publication pull request identity differs: ${url}`);
  }
  const metadata = parsePublicationPullRequestBody(String(pull.body ?? ''));
  const expectedIdentity = {
    ...options.identity,
    publicationCommit: metadata.publicationCommit,
    baseCommit: metadata.baseCommit,
    files: options.files.map(({ path, sha256 }) => ({ path, content: '', sha256 })),
  };
  if (
    JSON.stringify(metadata) !== JSON.stringify(expectedIdentity) ||
    pull.body !== renderPublicationPullRequestBody(expectedIdentity)
  ) {
    throw new Error(`Publication pull request plan identity differs: ${url}`);
  }
  if (pull.head?.sha !== metadata.publicationCommit) {
    throw new Error(`Publication pull request head changed: ${url}`);
  }
  await assertPublicationBranch({
    request: options.request,
    ...options.identity,
    files: options.files,
    publicationCommit: metadata.publicationCommit,
    baseCommit: metadata.baseCommit,
  });
  const changedResponse = await options.request({
    endpoint: `repos/${options.identity.repository}/pulls/${pull.number}/files?per_page=100`,
  });
  const changed = Array.isArray(changedResponse) ? changedResponse : [];
  const expectedPaths = options.files.map(({ path }) => path);
  const actualPaths = changed.map((file) => file.filename).sort();
  if (
    pull.changed_files !== expectedPaths.length ||
    JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths) ||
    changed.some(
      (file) =>
        !['added', 'modified'].includes(file.status) ||
        file.previous_filename !== undefined,
    )
  ) {
    throw new Error(`Publication pull request changes unexpected paths: ${url}`);
  }
  return {
    pull,
    publicationCommit: metadata.publicationCommit,
    baseCommit: metadata.baseCommit,
  };
}

/**
 * @param {{request: GitHubRequester, repository: string, baseBranch: string, mergeCommit: string, files: PublicationFile[]}}
 * options
 */
async function assertMergedDestination(options) {
  const base = await options.request({
    endpoint: `repos/${options.repository}/branches/${encodeURIComponent(options.baseBranch)}`,
  });
  const baseCommit = requireCommit(base?.commit?.sha, 'destination branch commit');
  const comparison = await options.request({
    endpoint: `repos/${options.repository}/compare/${options.mergeCommit}...${baseCommit}`,
  });
  if (!['ahead', 'identical'].includes(comparison?.status)) {
    throw new Error(
      'Publication merge commit is not retained by the destination branch.',
    );
  }
  await assertFilesAtReference(
    options.request,
    options.repository,
    baseCommit,
    options.files,
  );
}

/**
 * @param {{request: GitHubRequester, repository: string, branch: string, publicationCommit: string}}
 * options
 */
async function cleanupPublicationBranch(options) {
  const reference = await readBranchReference(
    options.request,
    options.repository,
    options.branch,
  );
  if (reference === null) return;
  if (reference !== options.publicationCommit) {
    throw new Error('Refusing to delete a publication branch whose head changed.');
  }
  await options.request({
    method: 'DELETE',
    endpoint: `repos/${options.repository}/git/refs/heads/${encodeURIComponent(options.branch)}`,
  });
}

/**
 * @param {{request: GitHubRequester, repository: string, number: number, url: string, sleep: (milliseconds: number) => Promise<void>, attempts: number, intervalMilliseconds: number}}
 * options
 */
async function waitForMergeability(options) {
  if (!Number.isSafeInteger(options.attempts) || options.attempts < 1) {
    throw new Error('Mergeability attempts must be a positive integer.');
  }
  let pull;
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    pull = await readPullRequest(options.request, options.repository, options.number);
    if (pull.merged === true) return pull;
    if (pull.mergeable !== null && pull.mergeable_state !== 'unknown') return pull;
    if (attempt + 1 < options.attempts) {
      await options.sleep(options.intervalMilliseconds);
    }
  }
  throw new Error(
    `GitHub did not resolve publication pull request mergeability within the bounded wait: ${options.url}`,
  );
}

/** @param {any} pull */
function mergePolicyError(pull) {
  const url = pullUrl(pull);
  if (pull.mergeable === false || pull.mergeable_state === 'dirty') {
    return new Error(`Publication pull request has a merge conflict: ${url}`);
  }
  let action = 'repository policy must permit merge';
  if (pull.mergeable_state === 'blocked') {
    action = 'required checks or independent review must be completed';
  } else if (pull.mergeable_state === 'behind') {
    action = 'the destination branch policy requires an update';
  } else if (pull.mergeable_state === 'unstable') {
    action = 'required checks are not successful';
  } else if (pull.mergeable_state === 'has_hooks') {
    action = 'repository merge hooks have not permitted the merge';
  }
  return new Error(`Publication pull request remains open; ${action}: ${url}`);
}

/**
 * @param {GitHubRequester} request
 * @param {Record<string, any>} identity
 */
async function listPublicationPullRequests(request, identity) {
  const owner = identity.repository.split('/')[0];
  const result = await request({
    endpoint: `repos/${identity.repository}/pulls?state=all&head=${encodeURIComponent(`${owner}:${identity.branch}`)}&base=${encodeURIComponent(identity.baseBranch)}&per_page=100`,
  });
  if (!Array.isArray(result)) {
    throw new Error('GitHub publication pull request inventory is invalid.');
  }
  return result;
}

/** @param {GitHubRequester} request @param {string} repository @param {number} number */
async function readPullRequest(request, repository, number) {
  const pull = await request({ endpoint: `repos/${repository}/pulls/${number}` });
  if (!Number.isSafeInteger(pull?.number)) {
    throw new Error('GitHub publication pull request response is invalid.');
  }
  return pull;
}

/** @param {GitHubRequester} request @param {string} repository @param {string} commit */
async function readCommit(request, repository, commit) {
  const result = await request({
    endpoint: `repos/${repository}/git/commits/${commit}`,
  });
  requireCommit(result?.sha, 'GitHub commit');
  requireCommit(result?.tree?.sha, 'GitHub commit tree');
  if (!Array.isArray(result?.parents)) {
    throw new Error('GitHub commit parents are invalid.');
  }
  for (const parent of result.parents)
    requireCommit(parent?.sha, 'GitHub parent commit');
  return result;
}

/**
 * @param {GitHubRequester} request
 * @param {string} repository
 * @param {string} branch
 */
async function readBranchReference(request, repository, branch) {
  const result = await request({
    endpoint: `repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`,
    allowNotFound: true,
  });
  return result === null
    ? null
    : requireCommit(result?.object?.sha, 'branch reference');
}

/**
 * @param {GitHubRequester} request
 * @param {string} repository
 * @param {string} reference
 * @param {PublicationFile[]} files
 */
async function assertFilesAtReference(request, repository, reference, files) {
  for (const file of files) {
    const actual = await readRepositoryFile(request, repository, file.path, reference);
    if (actual !== file.content) {
      throw new Error(
        `Publication repository file differs: ${repository}/${file.path}`,
      );
    }
  }
}

/**
 * @param {GitHubRequester} request
 * @param {string} repository
 * @param {string} reference
 * @param {PublicationFile[]} files
 */
async function destinationFilesMatch(request, repository, reference, files) {
  for (const file of files) {
    const actual = await readRepositoryFile(
      request,
      repository,
      file.path,
      reference,
      true,
    );
    if (actual !== file.content) return false;
  }
  return true;
}

/**
 * @param {GitHubRequester} request
 * @param {string} repository
 * @param {string} path
 * @param {string} reference
 * @param {boolean} [allowNotFound]
 */
async function readRepositoryFile(
  request,
  repository,
  path,
  reference,
  allowNotFound = false,
) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const value = await request({
    endpoint: `repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(reference)}`,
    allowNotFound,
  });
  if (value === null && allowNotFound) return null;
  if (value?.type !== 'file' || typeof value?.content !== 'string') {
    throw new Error(`Repository file response is invalid: ${repository}/${path}`);
  }
  return Buffer.from(value.content.replaceAll('\n', ''), 'base64').toString('utf8');
}

/** @param {any} pull */
function pullUrl(pull) {
  if (typeof pull?.html_url !== 'string' || pull.html_url.trim() === '') {
    throw new Error('Publication pull request URL is invalid.');
  }
  return pull.html_url;
}

/** @param {unknown} value @param {string} label */
function requireCommit(value, label) {
  if (typeof value !== 'string' || !COMMIT.test(value)) {
    throw new Error(`${label} must be a full lowercase Git SHA.`);
  }
  return value;
}

/** @param {any} metadata */
function validateMetadata(metadata) {
  if (
    metadata === null ||
    typeof metadata !== 'object' ||
    typeof metadata.repository !== 'string' ||
    !metadata.repository.includes('/') ||
    typeof metadata.baseBranch !== 'string' ||
    metadata.baseBranch === '' ||
    typeof metadata.branch !== 'string' ||
    !metadata.branch.startsWith('tb-') ||
    typeof metadata.releaseVersion !== 'string' ||
    metadata.releaseVersion === '' ||
    !COMMIT.test(String(metadata.sourceCommit ?? '')) ||
    !SHA256.test(String(metadata.planSha256 ?? '')) ||
    !COMMIT.test(String(metadata.publicationCommit ?? '')) ||
    !COMMIT.test(String(metadata.baseCommit ?? '')) ||
    !Array.isArray(metadata.files) ||
    metadata.files.length === 0
  ) {
    throw new Error('Publication pull request identity is invalid.');
  }
  const paths = new Set();
  for (const file of metadata.files) {
    if (
      typeof file?.path !== 'string' ||
      file.path === '' ||
      paths.has(file.path) ||
      file.content !== '' ||
      !SHA256.test(String(file.sha256 ?? ''))
    ) {
      throw new Error('Publication pull request file identity is invalid.');
    }
    paths.add(file.path);
  }
}

/** @param {string} value */
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** @param {number} milliseconds */
function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
