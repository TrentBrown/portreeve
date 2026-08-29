// @ts-check

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sha256File } from './release-lib.js';

export const RELEASE_RECORD_SCHEMA_VERSION = 2;

export const LEGACY_RELEASE_STAGES = Object.freeze([
  'source-pinned',
  'policy-resolved',
  'native-cli-built',
  'artifact-digests-established',
  'native-cli-verified',
  'desktop-packaged',
  'desktop-trust-verified',
  'distribution-finalized',
  'publication-approved',
  'published',
]);

export const RELEASE_STAGES = Object.freeze([
  'source-pinned',
  'policy-resolved',
  'native-cli-built',
  'artifact-digests-established',
  'candidate-qualified',
  'macos-cli-authority-established',
  'desktop-packaged',
  'authoritative-native-verified',
  'desktop-trust-verified',
  'distribution-finalized',
  'publication-approved',
  'published',
]);

const SEMANTIC_VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const NATIVE_TARGET_KEYS = ['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'];

/**
 * @typedef {{
 *   type: string,
 *   filename: string,
 *   path: string,
 *   bytes: number,
 *   sha256: string,
 *   provenanceStage: string,
 *   operatingSystem?: string,
 *   architecture?: string,
 * }} ReleaseArtifact
 */

/**
 * @typedef {{
 *   schemaVersion: 1,
 *   kind: 'native-cli-verification',
 *   releaseId: string,
 *   releaseVersion: string,
 *   source: {repository: string, commit: string},
 *   target: {operatingSystem: 'macos'|'linux', architecture: 'arm64'|'x64'},
 *   artifact: {filename: string, bytes: number, sha256: string},
 *   checks: {executableFormat: true, executableVersion: true, manualServer: true, supervisedLifecycle: true},
 *   runner: {name: string, operatingSystem: string, architecture: string},
 *   verifiedAt: string,
 * }} NativeVerification
 */

/**
 * @typedef {{
 *   schemaVersion: 1|2,
 *   releaseId: string,
 *   releaseVersion: string,
 *   source: {repository: string, commit: string},
 *   versions: {server: string, desktop: string, client: string},
 *   policy: {maturity: 'alpha'|'beta'|'stable', channel: 'preview'|'stable', desktopTrust: 'unsigned'|'developer-id-notarized'},
 *   tools: Record<string, string>,
 *   state: string,
 *   stages: Array<{name: string, completedAt: string, evidence: Record<string, unknown>}>,
 *   artifacts: ReleaseArtifact[],
 *   verifications: Array<Record<string, unknown>>,
 *   publication: Record<string, unknown> & {state: string},
 *   createdAt: string,
 *   updatedAt: string,
 * }} ReleaseRecord
 */

/**
 * @param {{
 *   releaseVersion: string,
 *   source: {repository: string, commit: string},
 *   versions: {server: string, desktop: string, client: string},
 *   policy: {maturity: 'alpha'|'beta'|'stable', channel: 'preview'|'stable', desktopTrust: 'unsigned'|'developer-id-notarized'},
 *   tools: Record<string, string>,
 *   now?: () => Date,
 * }} options
 */
export function createReleaseRecord(options) {
  validateReleasePolicy(options.releaseVersion, options.policy);
  requiredString(options.source.repository, 'source repository');
  if (!COMMIT.test(options.source.commit)) {
    throw new Error('Source commit must be a full lowercase Git SHA.');
  }
  for (const [name, version] of Object.entries(options.versions)) {
    assertSemanticVersion(version, `${name} version`);
  }
  for (const [name, version] of Object.entries(options.tools)) {
    requiredString(name, 'tool name');
    requiredString(version, `tool version for ${name}`);
  }
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  /** @type {ReleaseRecord} */
  const record = {
    schemaVersion: RELEASE_RECORD_SCHEMA_VERSION,
    releaseId: `portreeve-v${options.releaseVersion}`,
    releaseVersion: options.releaseVersion,
    source: { ...options.source },
    versions: { ...options.versions },
    policy: { ...options.policy },
    tools: { ...options.tools },
    state: 'initialized',
    stages: [],
    artifacts: [],
    verifications: [],
    publication: { state: 'unpublished' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return record;
}

/**
 * @param {string} releaseVersion
 * @param {{maturity: string, channel: string, desktopTrust: string}} policy
 */
export function validateReleasePolicy(releaseVersion, policy) {
  const prerelease = assertSemanticVersion(releaseVersion, 'release version');
  if (!['alpha', 'beta', 'stable'].includes(policy.maturity)) {
    throw new Error(`Unsupported product maturity: ${policy.maturity}`);
  }
  if (!['preview', 'stable'].includes(policy.channel)) {
    throw new Error(`Unsupported release channel: ${policy.channel}`);
  }
  if (!['unsigned', 'developer-id-notarized'].includes(policy.desktopTrust)) {
    throw new Error(`Unsupported Desktop trust state: ${policy.desktopTrust}`);
  }
  if (policy.channel === 'preview' && prerelease === null) {
    throw new Error('Preview releases require a semantic prerelease version.');
  }
  if (policy.channel === 'stable' && prerelease !== null) {
    throw new Error('Stable releases require a semantic version without a prerelease.');
  }
  if (policy.channel === 'stable' && policy.maturity !== 'stable') {
    throw new Error('The stable channel requires stable product maturity.');
  }
  if (policy.channel === 'stable' && policy.desktopTrust !== 'developer-id-notarized') {
    throw new Error('Stable Desktop releases require Developer ID notarization.');
  }
}

/**
 * @param {ReleaseRecord} record
 * @param {string} stage
 * @param {Record<string, unknown>} evidence
 * @param {() => Date} [now]
 */
export function advanceReleaseRecord(record, stage, evidence, now = () => new Date()) {
  assertReleaseRecord(record);
  assertMutableReleaseRecord(record);
  const expected = stagesFor(record.schemaVersion)[record.stages.length];
  if (expected === undefined) {
    throw new Error('The release record is already in its terminal published state.');
  }
  if (stage !== expected) {
    throw new Error(`Release stage ${stage} is invalid; expected ${expected}.`);
  }
  assertStageEvidence(record, stage, evidence);
  if (
    stage === 'macos-cli-authority-established' &&
    (!Array.isArray(evidence.verifications) ||
      evidence.verifications.length !== NATIVE_TARGET_KEYS.length)
  ) {
    throw new Error(
      'macOS CLI authority requires the complete preliminary verification matrix.',
    );
  }
  const timestamp = now().toISOString();
  const next = structuredClone(record);
  const persistedEvidence =
    stage === 'macos-cli-authority-established'
      ? {
          mode: evidence.mode,
          architectures: evidence.architectures,
          targets: evidence.targets,
          verificationCount: evidence.verificationCount,
        }
      : evidence;
  if (stage === 'macos-cli-authority-established') {
    next.verifications = structuredClone(
      /** @type {NativeVerification[]} */ (evidence.verifications),
    );
  }
  next.stages.push({
    name: stage,
    completedAt: timestamp,
    evidence: persistedEvidence,
  });
  next.updatedAt = timestamp;
  next.state = stateAfter(stage);
  if (stage === 'publication-approved') {
    next.publication = {
      state: 'approved',
      approvedBy: evidence.approvedBy,
      approvedAt: evidence.approvedAt,
      planSha256: evidence.planSha256,
      ...(evidence.transport === undefined ? {} : { transport: evidence.transport }),
    };
  }
  if (stage === 'published') {
    next.publication = { state: 'published', ...evidence };
  }
  assertReleaseRecord(next);
  return next;
}

/**
 * @param {ReleaseRecord} record
 * @param {{root: string, path: string, type: string, provenanceStage: string, operatingSystem?: string, architecture?: string}} artifact
 */
export async function registerReleaseArtifact(record, artifact) {
  assertReleaseRecord(record);
  assertMutableReleaseRecord(record);
  requiredString(artifact.type, 'artifact type');
  requiredString(artifact.provenanceStage, 'artifact provenance stage');
  if (!stagesFor(record.schemaVersion).includes(artifact.provenanceStage)) {
    throw new Error(`Unknown artifact provenance stage: ${artifact.provenanceStage}`);
  }
  if (!record.stages.some(({ name }) => name === artifact.provenanceStage)) {
    throw new Error(
      `Artifact provenance stage has not completed: ${artifact.provenanceStage}`,
    );
  }
  const root = resolve(artifact.root);
  const path = resolve(artifact.path);
  const relativePath = relative(root, path);
  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    relativePath.startsWith('/')
  ) {
    throw new Error('Release artifacts must be files beneath the release workspace.');
  }
  const filename = basename(path);
  if (record.artifacts.some((entry) => entry.filename === filename)) {
    throw new Error(`Release artifact is already recorded: ${filename}`);
  }
  const metadata = await stat(path);
  if (!metadata.isFile()) {
    throw new Error(`Release artifact is not a file: ${relativePath}`);
  }
  const next = structuredClone(record);
  next.artifacts.push({
    type: artifact.type,
    filename,
    path: relativePath,
    bytes: metadata.size,
    sha256: await sha256File(path),
    provenanceStage: artifact.provenanceStage,
    ...(artifact.operatingSystem === undefined
      ? {}
      : { operatingSystem: artifact.operatingSystem }),
    ...(artifact.architecture === undefined
      ? {}
      : { architecture: artifact.architecture }),
  });
  return next;
}

/**
 * @param {ReleaseRecord} record
 * @param {string} root
 */
export async function verifyReleaseArtifacts(record, root) {
  assertReleaseRecord(record);
  for (const artifact of record.artifacts) {
    const path = resolve(root, artifact.path);
    const relativePath = relative(resolve(root), path);
    if (relativePath.startsWith('..') || relativePath.startsWith('/')) {
      throw new Error(
        `Recorded artifact escapes the release workspace: ${artifact.path}`,
      );
    }
    const metadata = await stat(path);
    const digest = await sha256File(path);
    if (metadata.size !== artifact.bytes || digest !== artifact.sha256) {
      throw new Error(`Recorded artifact identity changed: ${artifact.filename}`);
    }
  }
}

/** @param {string} path @param {ReleaseRecord} record */
export async function writeReleaseRecord(path, record) {
  assertReleaseRecord(record);
  assertMutableReleaseRecord(record);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(record, null, 2).concat('\n'), {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** @param {string} path */
export async function readReleaseRecord(path) {
  const record = JSON.parse(await readFile(path, 'utf8'));
  assertReleaseRecord(record);
  return record;
}

/** @param {unknown} record @returns {asserts record is ReleaseRecord} */
export function assertReleaseRecord(record) {
  const schemaVersion =
    record !== null && typeof record === 'object' && 'schemaVersion' in record
      ? record.schemaVersion
      : undefined;
  if (
    typeof schemaVersion !== 'number' ||
    ![1, RELEASE_RECORD_SCHEMA_VERSION].includes(schemaVersion)
  ) {
    throw new Error('Unsupported release record schema.');
  }
  const candidate = /** @type {Record<string, any>} */ (record);
  const releaseStages = stagesFor(candidate.schemaVersion);
  assertSemanticVersion(candidate.releaseVersion, 'release version');
  if (candidate.releaseId !== `portreeve-v${candidate.releaseVersion}`) {
    throw new Error('Release record identity does not match its version.');
  }
  requiredString(candidate.source?.repository, 'source repository');
  if (!COMMIT.test(String(candidate.source?.commit ?? ''))) {
    throw new Error('Source commit must be a full lowercase Git SHA.');
  }
  for (const name of ['server', 'desktop', 'client']) {
    assertSemanticVersion(candidate.versions?.[name], `${name} version`);
  }
  if (
    candidate.tools === null ||
    typeof candidate.tools !== 'object' ||
    Array.isArray(candidate.tools)
  ) {
    throw new Error('Release record tool versions are invalid.');
  }
  for (const [name, version] of Object.entries(candidate.tools)) {
    requiredString(name, 'tool name');
    requiredString(version, `tool version for ${name}`);
  }
  assertTimestamp(candidate.createdAt, 'release creation time');
  assertTimestamp(candidate.updatedAt, 'release update time');
  if (
    !Array.isArray(candidate.stages) ||
    !Array.isArray(candidate.artifacts) ||
    !Array.isArray(candidate.verifications) ||
    candidate.publication === null ||
    typeof candidate.publication !== 'object' ||
    Array.isArray(candidate.publication)
  ) {
    throw new Error('Release record collections are invalid.');
  }
  validateReleasePolicy(candidate.releaseVersion, candidate.policy ?? {});
  const names = candidate.stages.map((/** @type {Record<string, unknown>} */ entry) => {
    assertTimestamp(
      entry.completedAt,
      `completion time for stage ${String(entry.name)}`,
    );
    if (
      entry.evidence === null ||
      typeof entry.evidence !== 'object' ||
      Array.isArray(entry.evidence)
    ) {
      throw new Error(`Release stage evidence is invalid: ${String(entry.name)}`);
    }
    return entry.name;
  });
  if (names.some((name, index) => name !== releaseStages[index])) {
    throw new Error('Release record stages are not a valid ordered prefix.');
  }
  for (const stage of candidate.stages) {
    assertStageEvidence(
      /** @type {ReleaseRecord} */ (candidate),
      stage.name,
      stage.evidence,
    );
  }
  const filenames = new Set();
  const paths = new Set();
  for (const artifact of candidate.artifacts) {
    requiredString(artifact.type, 'artifact type');
    requiredString(artifact.filename, 'artifact filename');
    requiredString(artifact.path, 'artifact path');
    if (
      basename(artifact.filename) !== artifact.filename ||
      basename(artifact.path) !== artifact.filename ||
      isAbsolute(artifact.path) ||
      artifact.path === '..' ||
      artifact.path.startsWith('../')
    ) {
      throw new Error(`Release artifact path is invalid: ${artifact.filename}`);
    }
    if (filenames.has(artifact.filename) || paths.has(artifact.path)) {
      throw new Error(`Release artifact identity is duplicated: ${artifact.filename}`);
    }
    filenames.add(artifact.filename);
    paths.add(artifact.path);
    if (
      !SHA256.test(artifact.sha256) ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 0
    ) {
      throw new Error(`Release artifact identity is invalid: ${artifact.filename}`);
    }
    if (
      !releaseStages.includes(artifact.provenanceStage) ||
      !names.includes(artifact.provenanceStage)
    ) {
      throw new Error(`Release artifact provenance is invalid: ${artifact.filename}`);
    }
    if (
      artifact.operatingSystem !== undefined &&
      !['macos', 'linux'].includes(artifact.operatingSystem)
    ) {
      throw new Error(
        `Release artifact operating system is invalid: ${artifact.filename}`,
      );
    }
    if (
      artifact.architecture !== undefined &&
      !['arm64', 'x64'].includes(artifact.architecture)
    ) {
      throw new Error(`Release artifact architecture is invalid: ${artifact.filename}`);
    }
  }
  const verificationKeys = [];
  for (const verification of candidate.verifications) {
    assertNativeVerification(verification);
    if (
      verification.releaseId !== candidate.releaseId ||
      verification.releaseVersion !== candidate.releaseVersion ||
      verification.source.repository !== candidate.source.repository ||
      verification.source.commit !== candidate.source.commit
    ) {
      throw new Error('Native verification release identity is invalid.');
    }
    const artifact = candidate.artifacts.find(
      (/** @type {ReleaseArtifact} */ entry) =>
        entry.type === 'executable' &&
        entry.operatingSystem === verification.target.operatingSystem &&
        entry.architecture === verification.target.architecture,
    );
    if (
      artifact === undefined ||
      artifact.filename !== verification.artifact.filename ||
      artifact.bytes !== verification.artifact.bytes ||
      artifact.sha256 !== verification.artifact.sha256
    ) {
      throw new Error('Native verification artifact identity is invalid.');
    }
    verificationKeys.push(
      `${verification.target.operatingSystem}-${verification.target.architecture}`,
    );
  }
  const nativeStageCompleted = names.includes(
    candidate.schemaVersion === 1
      ? 'native-cli-verified'
      : 'macos-cli-authority-established',
  );
  if (
    (nativeStageCompleted &&
      verificationKeys.join(',') !== NATIVE_TARGET_KEYS.join(',')) ||
    (!nativeStageCompleted && verificationKeys.length !== 0)
  ) {
    throw new Error(
      'Native verification matrix does not match the release stage state.',
    );
  }
  const lastStage = names.at(-1);
  const expectedState =
    lastStage === undefined ? 'initialized' : stateAfter(String(lastStage));
  if (candidate.state !== expectedState) {
    throw new Error('Release record state does not match its completed stages.');
  }
  const expectedPublicationState =
    lastStage === 'published'
      ? 'published'
      : lastStage === 'publication-approved'
        ? 'approved'
        : 'unpublished';
  if (candidate.publication.state !== expectedPublicationState) {
    throw new Error('Release publication state does not match its completed stages.');
  }
  const terminalEvidence = candidate.stages.at(-1)?.evidence;
  const expectedPublication =
    lastStage === 'published'
      ? { state: 'published', ...terminalEvidence }
      : lastStage === 'publication-approved'
        ? {
            state: 'approved',
            approvedBy: terminalEvidence?.approvedBy,
            approvedAt: terminalEvidence?.approvedAt,
            planSha256: terminalEvidence?.planSha256,
            ...(terminalEvidence?.transport === undefined
              ? {}
              : { transport: terminalEvidence.transport }),
          }
        : { state: 'unpublished' };
  if (!isDeepStrictEqual(candidate.publication, expectedPublication)) {
    throw new Error('Release publication evidence differs from its terminal stage.');
  }
}

/** @param {unknown} verification @returns {asserts verification is NativeVerification} */
export function assertNativeVerification(verification) {
  if (
    verification === null ||
    typeof verification !== 'object' ||
    /** @type {Record<string, any>} */ (verification).schemaVersion !== 1 ||
    /** @type {Record<string, any>} */ (verification).kind !== 'native-cli-verification'
  ) {
    throw new Error('Unsupported native verification schema.');
  }
  const candidate = /** @type {Record<string, any>} */ (verification);
  requiredString(candidate.releaseId, 'native verification release ID');
  assertSemanticVersion(
    candidate.releaseVersion,
    'native verification release version',
  );
  requiredString(candidate.source?.repository, 'native verification source repository');
  if (!COMMIT.test(String(candidate.source?.commit ?? ''))) {
    throw new Error('Native verification source commit is invalid.');
  }
  if (!['macos', 'linux'].includes(candidate.target?.operatingSystem)) {
    throw new Error('Native verification operating system is invalid.');
  }
  if (!['arm64', 'x64'].includes(candidate.target?.architecture)) {
    throw new Error('Native verification architecture is invalid.');
  }
  requiredString(candidate.artifact?.filename, 'native verification artifact filename');
  if (
    basename(candidate.artifact.filename) !== candidate.artifact.filename ||
    !Number.isSafeInteger(candidate.artifact.bytes) ||
    candidate.artifact.bytes < 0 ||
    !SHA256.test(String(candidate.artifact.sha256 ?? ''))
  ) {
    throw new Error('Native verification artifact identity is invalid.');
  }
  for (const check of [
    'executableFormat',
    'executableVersion',
    'manualServer',
    'supervisedLifecycle',
  ]) {
    if (candidate.checks?.[check] !== true) {
      throw new Error(`Native verification check is incomplete: ${check}`);
    }
  }
  requiredString(candidate.runner?.name, 'native verification runner name');
  requiredString(
    candidate.runner?.operatingSystem,
    'native verification runner operating system',
  );
  requiredString(
    candidate.runner?.architecture,
    'native verification runner architecture',
  );
  assertTimestamp(candidate.verifiedAt, 'native verification time');
}

/**
 * @param {ReleaseRecord} record
 * @param {string} stage
 * @param {Record<string, unknown>} evidence
 */
function assertStageEvidence(record, stage, evidence) {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error(`Release stage ${stage} requires structured evidence.`);
  }
  if (stage === 'desktop-trust-verified') {
    if (record.policy.desktopTrust === 'unsigned') {
      const expectedStatus =
        record.schemaVersion === 1 ? 'unsigned-preview' : 'unsigned-internal';
      if (evidence.status !== expectedStatus) {
        throw new Error(
          `Unsigned Desktop evidence must identify an ${expectedStatus} candidate.`,
        );
      }
      return;
    }
    for (const field of ['signatureIdentity', 'notarizationId']) {
      requiredString(evidence[field], `Desktop trust evidence ${field}`);
    }
    const nativeArchitectures = evidence.nativeArchitectures;
    if (
      evidence.hardenedRuntime !== true ||
      evidence.secureTimestamp !== true ||
      evidence.stapled !== true ||
      evidence.gatekeeperAssessment !== 'accepted' ||
      !Array.isArray(nativeArchitectures) ||
      !['arm64', 'x64'].every((architecture) =>
        nativeArchitectures.includes(architecture),
      )
    ) {
      throw new Error('Developer ID Desktop trust evidence is incomplete.');
    }
  }
  if (
    stage ===
      (record.schemaVersion === 1
        ? 'native-cli-verified'
        : 'macos-cli-authority-established') &&
    (!Array.isArray(evidence.targets) ||
      evidence.targets.join(',') !== NATIVE_TARGET_KEYS.join(',') ||
      evidence.verificationCount !== NATIVE_TARGET_KEYS.length)
  ) {
    throw new Error(
      'Native CLI authority evidence requires the complete target matrix.',
    );
  }
  if (stage === 'candidate-qualified') {
    const artifactCount = evidence.artifactCount;
    if (
      typeof artifactCount !== 'number' ||
      !Number.isSafeInteger(artifactCount) ||
      artifactCount < NATIVE_TARGET_KEYS.length ||
      evidence.credentialAccess !== false
    ) {
      throw new Error(
        'Candidate qualification requires artifact coverage without credential access.',
      );
    }
  }
  if (stage === 'macos-cli-authority-established') {
    if (
      !['unsigned-internal', 'developer-id-signed'].includes(String(evidence.mode)) ||
      !Array.isArray(evidence.architectures) ||
      evidence.architectures.join(',') !== 'arm64,x64'
    ) {
      throw new Error('macOS CLI authority evidence is incomplete.');
    }
  }
  if (stage === 'authoritative-native-verified') {
    if (
      !Array.isArray(evidence.targets) ||
      evidence.targets.join(',') !== NATIVE_TARGET_KEYS.join(',') ||
      !Array.isArray(evidence.desktopArchitectures) ||
      evidence.desktopArchitectures.join(',') !== 'arm64,x64' ||
      evidence.verificationCount !== NATIVE_TARGET_KEYS.length + 2
    ) {
      throw new Error(
        'Authoritative native evidence requires CLI and Desktop coverage.',
      );
    }
  }
  if (stage === 'desktop-packaged') {
    const packages = evidence.packages;
    if (
      !Array.isArray(packages) ||
      packages.length !== 2 ||
      packages.map((entry) => entry?.architecture).join(',') !== 'arm64,x64'
    ) {
      throw new Error('Desktop package stage requires arm64 and x64 evidence.');
    }
    for (const entry of packages) {
      if (
        typeof entry.filename !== 'string' ||
        basename(entry.filename) !== entry.filename ||
        !SHA256.test(String(entry.sha256 ?? '')) ||
        !SHA256.test(String(entry.cliSha256 ?? ''))
      ) {
        throw new Error('Desktop package stage artifact identity is invalid.');
      }
    }
  }
  if (stage === 'publication-approved') {
    if (
      record.schemaVersion === RELEASE_RECORD_SCHEMA_VERSION &&
      record.policy.desktopTrust !== 'developer-id-notarized'
    ) {
      throw new Error(
        'Public publication requires Developer ID-signed and notarized macOS artifacts.',
      );
    }
    requiredString(evidence.approvedBy, 'publication approver');
    requiredString(evidence.approvedAt, 'publication approval time');
    if (!SHA256.test(String(evidence.planSha256 ?? ''))) {
      throw new Error('Publication approval requires the exact plan digest.');
    }
    if (
      evidence.transport !== undefined &&
      evidence.transport !== 'github-pull-request-v1'
    ) {
      throw new Error('Publication approval transport is unsupported.');
    }
  }
  if (stage === 'published') {
    requiredString(evidence.githubReleaseUrl, 'GitHub Release URL');
    requiredString(evidence.tag, 'published tag');
    for (const field of ['homebrewCommit', 'desktopUpdateCommit']) {
      if (!COMMIT.test(String(evidence[field] ?? ''))) {
        throw new Error(`Published evidence ${field} must be a full Git SHA.`);
      }
    }
    const approval = record.stages.find(
      ({ name }) => name === 'publication-approved',
    )?.evidence;
    const transport = approval?.transport;
    if (transport !== undefined) {
      if (transport !== 'github-pull-request-v1' || evidence.transport !== transport) {
        throw new Error('Published evidence transport differs from its approval.');
      }
      assertGitHubPullRequestUrl(
        evidence.homebrewPullRequestUrl,
        'Homebrew pull request URL',
      );
      assertGitHubPullRequestUrl(
        evidence.desktopUpdatePullRequestUrl,
        'Desktop update pull request URL',
      );
    } else if (
      evidence.transport !== undefined ||
      evidence.homebrewPullRequestUrl !== undefined ||
      evidence.desktopUpdatePullRequestUrl !== undefined
    ) {
      throw new Error('Legacy published evidence cannot claim pull request transport.');
    }
    assertTimestamp(evidence.publishedAt, 'publication time');
  }
}

/** @param {number} schemaVersion */
function stagesFor(schemaVersion) {
  if (schemaVersion === 1) return LEGACY_RELEASE_STAGES;
  if (schemaVersion === RELEASE_RECORD_SCHEMA_VERSION) return RELEASE_STAGES;
  throw new Error('Unsupported release record schema.');
}

/** @param {ReleaseRecord} record */
function assertMutableReleaseRecord(record) {
  if (record.schemaVersion !== RELEASE_RECORD_SCHEMA_VERSION) {
    throw new Error('Schema-version-1 release records are read-only.');
  }
}

/** @param {string} stage */
function stateAfter(stage) {
  if (stage === 'publication-approved') return 'publication-approved';
  if (stage === 'published') return 'published';
  if (stage === 'distribution-finalized') return 'prepared';
  return 'preparing';
}

/** @param {unknown} value @param {string} label */
function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required.`);
  }
}

/** @param {unknown} value @param {string} label */
function assertGitHubPullRequestUrl(value, label) {
  requiredString(value, label);
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/u.test(String(value))) {
    throw new Error(`${label} must be a GitHub pull request URL.`);
  }
}

/** @param {string} value @param {string} label */
export function assertSemanticVersion(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a semantic version.`);
  }
  const match = SEMANTIC_VERSION.exec(value);
  if (match === null) {
    throw new Error(`${label} must be a semantic version.`);
  }
  return match[4] ?? null;
}

/** @param {unknown} value @param {string} label */
function assertTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
}
