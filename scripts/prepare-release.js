// @ts-check

import { Command } from 'commander';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PORTREEVE_CLIENT_VERSION } from '../packages/client/src/version.js';
import { PORTREEVE_VERSION } from '../src/version.js';
import { buildReleaseArtifacts } from './release-build.js';
import {
  advanceReleaseRecord,
  createReleaseRecord,
  readReleaseRecord,
  registerReleaseArtifact,
  writeReleaseRecord,
} from './release-record.js';
import { assertCoordinatedReleaseVersion } from './release-version.js';

const DEFAULT_HOMEPAGE = 'https://github.com/TrentBrown/portreeve';
const DEFAULT_RELEASE_BASE = `${DEFAULT_HOMEPAGE}/releases/download`;

/**
 * @param {{
 *   channel: 'preview'|'stable',
 *   version: string,
 *   workspaceRoot?: string,
 *   outputRoot?: string,
 *   homepageUrl?: string,
 *   releaseBaseUrl?: string,
 *   resume?: boolean,
 * }} options
 * @param {{
 *   sourceIdentity?: (workspaceRoot: string) => Promise<{repository: string, commit: string, clean: boolean}>,
 *   build?: (options: {destination: string, releaseVersion: string, releaseBaseUrl: string, homepageUrl: string, workspaceRoot?: string}) => Promise<{releaseDirectory: string, manifest: {artifacts: Array<{type: unknown, filename: string, operatingSystem?: unknown, architecture?: unknown}>}}>,
 *   now?: () => Date,
 * }} [dependencies]
 */
export async function prepareRelease(options, dependencies = {}) {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const outputRoot = resolve(
    options.outputRoot ?? resolve(workspaceRoot, 'dist', 'releases'),
  );
  const releaseRoot = resolve(outputRoot, options.version);
  const recordPath = resolve(releaseRoot, 'release-record.json');
  const recordExists = await exists(recordPath);
  if (recordExists && options.resume !== true) {
    throw new Error(
      `Release workspace already exists: ${releaseRoot}. Published identities are immutable; choose a new version or resume the existing record.`,
    );
  }
  const source = await (dependencies.sourceIdentity ?? inspectSource)(workspaceRoot);
  if (!source.clean) {
    throw new Error('Release preparation requires a clean source checkout.');
  }
  const desktopMetadata = JSON.parse(
    await readFile(resolve(workspaceRoot, 'apps', 'desktop', 'package.json'), 'utf8'),
  );
  const workspaceMetadata = JSON.parse(
    await readFile(resolve(workspaceRoot, 'package.json'), 'utf8'),
  );
  const clientMetadata = JSON.parse(
    await readFile(
      resolve(workspaceRoot, 'packages', 'client', 'package.json'),
      'utf8',
    ),
  );
  assertCoordinatedReleaseVersion(options.version, {
    server: PORTREEVE_VERSION,
    workspace: String(workspaceMetadata.version),
    client: PORTREEVE_CLIENT_VERSION,
    'client package': String(clientMetadata.version),
    'Desktop package': String(desktopMetadata.version),
  });
  const now = dependencies.now ?? (() => new Date());
  const policy =
    options.channel === 'preview'
      ? /** @type {const} */ ({
          maturity: 'alpha',
          channel: 'preview',
          desktopTrust: 'unsigned',
        })
      : /** @type {const} */ ({
          maturity: 'stable',
          channel: 'stable',
          desktopTrust: 'developer-id-notarized',
        });
  let record;
  if (recordExists) {
    record = await readReleaseRecord(recordPath);
    assertResumablePreparation(record, {
      version: options.version,
      source,
      policy,
    });
  } else {
    record = createReleaseRecord({
      releaseVersion: options.version,
      source: { repository: source.repository, commit: source.commit },
      versions: {
        server: options.version,
        desktop: options.version,
        client: options.version,
      },
      policy,
      tools: { bun: Bun.version, node: process.versions.node },
      now,
    });
    await mkdir(releaseRoot, { recursive: true });
    record = advanceReleaseRecord(
      record,
      'source-pinned',
      { repository: source.repository, commit: source.commit, clean: true },
      now,
    );
    record = advanceReleaseRecord(record, 'policy-resolved', { ...policy }, now);
    await writeReleaseRecord(recordPath, record);
  }

  const artifactsRoot = resolve(releaseRoot, 'artifacts');
  const built = await (dependencies.build ?? buildReleaseArtifacts)({
    destination: artifactsRoot,
    releaseVersion: options.version,
    releaseBaseUrl: options.releaseBaseUrl ?? DEFAULT_RELEASE_BASE,
    homepageUrl: options.homepageUrl ?? DEFAULT_HOMEPAGE,
    workspaceRoot,
  });
  record = advanceReleaseRecord(
    record,
    'native-cli-built',
    { artifactCount: built.manifest.artifacts.length },
    now,
  );
  for (const artifact of built.manifest.artifacts) {
    record = await registerReleaseArtifact(record, {
      root: releaseRoot,
      path: resolve(artifactsRoot, artifact.filename),
      type: String(artifact.type),
      provenanceStage: 'native-cli-built',
      ...(typeof artifact.operatingSystem === 'string'
        ? { operatingSystem: artifact.operatingSystem }
        : {}),
      ...(typeof artifact.architecture === 'string'
        ? { architecture: artifact.architecture }
        : {}),
    });
  }
  for (const filename of ['manifest.json', 'SHA256SUMS']) {
    record = await registerReleaseArtifact(record, {
      root: releaseRoot,
      path: resolve(artifactsRoot, filename),
      type: 'release-metadata',
      provenanceStage: 'native-cli-built',
    });
  }
  record = advanceReleaseRecord(
    record,
    'artifact-digests-established',
    { artifactCount: record.artifacts.length },
    now,
  );
  await writeReleaseRecord(recordPath, record);
  await writeFile(
    resolve(releaseRoot, 'publication-plan.md'),
    renderPreparationPlan(record),
    'utf8',
  );
  return { releaseRoot, recordPath, record };
}

/** @param {{releaseVersion: string, state: string, policy: {channel: string, maturity: string, desktopTrust: string}, source: {commit: string}, artifacts: Array<{filename: string, sha256: string}>}} record */
export function renderPreparationPlan(record) {
  const artifacts = record.artifacts
    .map((artifact) => `- \`${artifact.filename}\` - ${artifact.sha256}`)
    .join('\n');
  return `# PortReeve ${record.releaseVersion} publication plan

**State:** ${record.state}
**Channel:** ${record.policy.channel}
**Maturity:** ${record.policy.maturity}
**Desktop trust:** ${record.policy.desktopTrust}
**Source:** \`${record.source.commit}\`

## Prepared artifacts

${artifacts}

## Remaining evidence

- Native CLI and lifecycle verification on macOS/Linux ARM64/x64
- Architecture-specific Desktop applications and DMGs
- Desktop trust evidence appropriate to the selected channel
- Formula/cask and publication metadata finalization
- Explicit human publication approval

This preparation has not created a Git tag or release, changed a Homebrew tap,
or published npm. Public mutation is a separate command and approval boundary.
`;
}

/** @param {string} workspaceRoot */
async function inspectSource(workspaceRoot) {
  const [commit, status, remote] = await Promise.all([
    runGit(workspaceRoot, ['rev-parse', 'HEAD']),
    runGit(workspaceRoot, ['status', '--porcelain', '--untracked-files=all']),
    runGit(workspaceRoot, ['remote', 'get-url', 'origin']),
  ]);
  return { repository: normalizeRepository(remote), commit, clean: status === '' };
}

/** @param {string} workspaceRoot @param {string[]} arguments_ */
async function runGit(workspaceRoot, arguments_) {
  const child = Bun.spawn(['git', ...arguments_], {
    cwd: workspaceRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0) {
    throw new Error(`git ${arguments_.join(' ')} failed: ${error.trim()}`);
  }
  return output.trim();
}

/** @param {string} value */
function normalizeRepository(value) {
  const ssh = /^git@github\.com:(.+?)(?:\.git)?$/u.exec(value);
  if (ssh !== null) return `https://github.com/${ssh[1]}`;
  return value.replace(/\.git$/u, '');
}

/**
 * @param {Record<string, any>} record
 * @param {{version: string, source: {repository: string, commit: string}, policy: Record<string, string>}} expected
 */
function assertResumablePreparation(record, expected) {
  if (
    record.releaseVersion !== expected.version ||
    record.source.repository !== expected.source.repository ||
    record.source.commit !== expected.source.commit ||
    record.policy.maturity !== expected.policy.maturity ||
    record.policy.channel !== expected.policy.channel ||
    record.policy.desktopTrust !== expected.policy.desktopTrust
  ) {
    throw new Error(
      'Existing release preparation does not match this source or policy.',
    );
  }
  if (
    record.artifacts.length !== 0 ||
    record.stages.map((/** @type {{name: string}} */ stage) => stage.name).join(',') !==
      'source-pinned,policy-resolved'
  ) {
    throw new Error(
      'Existing release preparation has progressed beyond the resumable build boundary.',
    );
  }
}

/** @param {string} path */
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:prepare')
    .description('Prepare a non-publishing PortReeve release workspace')
    .requiredOption('--channel <channel>', 'preview or stable')
    .requiredOption('--version <version>', 'coordinated semantic release version')
    .option('--resume', 'resume an interrupted build from its exact recorded source')
    .action(async (values) => {
      if (!['preview', 'stable'].includes(values.channel)) {
        throw new Error('--channel must be preview or stable.');
      }
      const result = await prepareRelease({
        channel: values.channel,
        version: values.version,
        resume: values.resume,
        ...(process.env.PORTREEVE_HOMEPAGE_URL === undefined
          ? {}
          : { homepageUrl: process.env.PORTREEVE_HOMEPAGE_URL }),
        ...(process.env.PORTREEVE_RELEASE_BASE_URL === undefined
          ? {}
          : { releaseBaseUrl: process.env.PORTREEVE_RELEASE_BASE_URL }),
      });
      console.log(result.releaseRoot);
    });
  await program.parseAsync();
}
