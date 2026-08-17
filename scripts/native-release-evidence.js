// @ts-check

import { link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { RELEASE_TARGETS } from './release-lib.js';
import {
  advanceReleaseRecord,
  assertNativeVerification,
  assertReleaseRecord,
} from './release-record.js';

export const NATIVE_VERIFICATION_SCHEMA_VERSION = 1;

/** @returns {{operatingSystem: 'macos'|'linux', architecture: 'arm64'|'x64'}} */
export function currentNativeTarget() {
  const operatingSystem =
    process.platform === 'darwin'
      ? 'macos'
      : process.platform === 'linux'
        ? 'linux'
        : null;
  const architecture = process.arch === 'x64' ? 'x64' : process.arch;
  if (
    operatingSystem === null ||
    (architecture !== 'arm64' && architecture !== 'x64')
  ) {
    throw new Error(
      `Native release verification is unsupported on ${process.platform}/${process.arch}.`,
    );
  }
  return { operatingSystem, architecture };
}

/**
 * @param {import('./release-record.js').ReleaseRecord} record
 * @param {{operatingSystem: 'macos'|'linux', architecture: 'arm64'|'x64'}} target
 * @param {{name: string, operatingSystem: string, architecture: string}} runner
 * @param {() => Date} [now]
 */
export function createNativeVerification(
  record,
  target,
  runner,
  now = () => new Date(),
) {
  assertReleaseRecord(record);
  if (record.stages.at(-1)?.name !== 'artifact-digests-established') {
    throw new Error(
      'Native verification requires a record at artifact-digests-established.',
    );
  }
  const artifact = record.artifacts.find(
    (entry) =>
      entry.type === 'executable' &&
      entry.operatingSystem === target.operatingSystem &&
      entry.architecture === target.architecture,
  );
  if (artifact === undefined) {
    throw new Error(
      `No recorded executable exists for ${target.operatingSystem}/${target.architecture}.`,
    );
  }
  const verification = {
    schemaVersion: /** @type {const} */ (1),
    kind: /** @type {const} */ ('native-cli-verification'),
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    target: { ...target },
    artifact: {
      filename: artifact.filename,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
    },
    checks: {
      executableFormat: /** @type {const} */ (true),
      executableVersion: /** @type {const} */ (true),
      manualServer: /** @type {const} */ (true),
      supervisedLifecycle: /** @type {const} */ (true),
    },
    runner: { ...runner },
    verifiedAt: now().toISOString(),
  };
  assertNativeVerification(verification);
  return verification;
}

/**
 * @param {import('./release-record.js').ReleaseRecord} record
 * @param {unknown[]} verifications
 * @param {() => Date} [now]
 */
export function mergeNativeVerifications(
  record,
  verifications,
  now = () => new Date(),
) {
  assertReleaseRecord(record);
  if (record.stages.at(-1)?.name !== 'artifact-digests-established') {
    throw new Error(
      'Native verification aggregation requires artifact-digests-established.',
    );
  }
  if (record.verifications.length !== 0) {
    throw new Error('Native verification evidence has already been aggregated.');
  }
  const byTarget = new Map();
  for (const verification of verifications) {
    assertNativeVerification(verification);
    const candidate = /** @type {import('./release-record.js').NativeVerification} */ (
      verification
    );
    if (
      candidate.releaseId !== record.releaseId ||
      candidate.releaseVersion !== record.releaseVersion ||
      candidate.source.repository !== record.source.repository ||
      candidate.source.commit !== record.source.commit
    ) {
      throw new Error('Native verification does not match the release identity.');
    }
    const key = targetKey(candidate.target);
    if (byTarget.has(key)) {
      throw new Error(`Duplicate native verification target: ${key}`);
    }
    const artifact = record.artifacts.find(
      (entry) =>
        entry.type === 'executable' &&
        entry.operatingSystem === candidate.target.operatingSystem &&
        entry.architecture === candidate.target.architecture,
    );
    if (
      artifact === undefined ||
      candidate.artifact.filename !== artifact.filename ||
      candidate.artifact.bytes !== artifact.bytes ||
      candidate.artifact.sha256 !== artifact.sha256
    ) {
      throw new Error(`Native verification artifact does not match: ${key}`);
    }
    byTarget.set(key, candidate);
  }
  const required = RELEASE_TARGETS.map(targetKey);
  const missing = required.filter((key) => !byTarget.has(key));
  const unexpected = [...byTarget.keys()].filter((key) => !required.includes(key));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Native verification matrix is incomplete (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}).`,
    );
  }
  return advanceReleaseRecord(
    record,
    'native-cli-verified',
    {
      targets: required,
      verificationCount: required.length,
      verifications: required.map((key) => byTarget.get(key)),
    },
    now,
  );
}

/** @param {string} path @param {unknown} verification */
export async function writeNativeVerification(path, verification) {
  assertNativeVerification(verification);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(verification, null, 2).concat('\n'), {
      encoding: 'utf8',
      flag: 'wx',
    });
    await link(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** @param {string} path */
export async function readNativeVerification(path) {
  const verification = JSON.parse(await readFile(path, 'utf8'));
  assertNativeVerification(verification);
  return verification;
}

/** @param {{operatingSystem: string, architecture: string}} target */
export function targetKey(target) {
  return `${target.operatingSystem}-${target.architecture}`;
}
