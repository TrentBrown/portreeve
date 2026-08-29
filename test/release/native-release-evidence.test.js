// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectNativeReleaseEvidence } from '../../scripts/collect-native-release-evidence.js';
import { mergeNativeReleaseEvidence } from '../../scripts/merge-native-release-evidence.js';
import {
  createNativeVerification,
  currentNativeTarget,
  mergeNativeVerifications,
  readNativeVerification,
  targetKey,
  writeNativeVerification,
} from '../../scripts/native-release-evidence.js';
import { RELEASE_TARGETS } from '../../scripts/release-lib.js';
import {
  advanceReleaseRecord,
  assertReleaseRecord,
  createReleaseRecord,
  registerReleaseArtifact,
  writeReleaseRecord,
} from '../../scripts/release-record.js';

/** @type {string[]} */
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('native release evidence', () => {
  test('merges a complete matrix deterministically and advances the record once', async () => {
    const { record } = await preparedRecord();
    const evidence = RELEASE_TARGETS.map((target, index) =>
      createNativeVerification(
        record,
        target,
        {
          name: `runner-${index}`,
          operatingSystem: target.operatingSystem,
          architecture: target.architecture,
        },
        () => new Date(`2026-08-16T20:0${index}:00.000Z`),
      ),
    ).reverse();
    const merged = mergeNativeVerifications(
      record,
      evidence,
      () => new Date('2026-08-16T21:00:00.000Z'),
    );
    expect(merged.stages.at(-1)).toMatchObject({
      name: 'macos-cli-authority-established',
      evidence: { verificationCount: 4 },
    });
    expect(
      merged.verifications.map(({ target }) =>
        targetKey(
          /** @type {{operatingSystem: string, architecture: string}} */ (target),
        ),
      ),
    ).toEqual(['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64']);
    expect(() => mergeNativeVerifications(merged, evidence)).toThrow(
      'requires a qualified candidate',
    );
    const missing = structuredClone(merged);
    missing.verifications = [];
    expect(() => assertReleaseRecord(missing)).toThrow(
      'matrix does not match the release stage state',
    );
    const reordered = structuredClone(merged);
    reordered.verifications.reverse();
    expect(() => assertReleaseRecord(reordered)).toThrow(
      'matrix does not match the release stage state',
    );
  });

  test('rejects incomplete, duplicate, stale, and altered evidence', async () => {
    const { record } = await preparedRecord();
    const evidence = RELEASE_TARGETS.map((target) =>
      createNativeVerification(record, target, {
        name: 'runner',
        operatingSystem: target.operatingSystem,
        architecture: target.architecture,
      }),
    );
    const first = evidence[0];
    if (first === undefined) throw new Error('Expected native release targets.');
    expect(() => mergeNativeVerifications(record, evidence.slice(0, 3))).toThrow(
      'matrix is incomplete',
    );
    expect(() =>
      mergeNativeVerifications(record, [...evidence.slice(0, 3), first]),
    ).toThrow('Duplicate native verification target');
    const stale = structuredClone(evidence);
    const staleFirst = stale[0];
    if (staleFirst === undefined) throw new Error('Expected stale evidence.');
    staleFirst.source.commit = '9'.repeat(40);
    expect(() => mergeNativeVerifications(record, stale)).toThrow(
      'does not match the release identity',
    );
    const altered = structuredClone(evidence);
    const alteredFirst = altered[0];
    if (alteredFirst === undefined) throw new Error('Expected altered evidence.');
    alteredFirst.artifact.sha256 = 'f'.repeat(64);
    expect(() => mergeNativeVerifications(record, altered)).toThrow(
      'artifact does not match',
    );
  });

  test('writes portable evidence and collects without rebuilding', async () => {
    const { root, record } = await preparedRecord();
    const recordPath = join(root, 'release-record.json');
    await writeReleaseRecord(recordPath, record);
    let verifiedDirectory = '';
    const result = await collectNativeReleaseEvidence(
      { recordPath, workspaceRoot: process.cwd() },
      {
        verify: async ({ releaseDirectory }) => {
          verifiedDirectory = releaseDirectory;
        },
        now: () => new Date('2026-08-16T22:00:00.000Z'),
      },
    );
    expect(verifiedDirectory).toBe(join(root, 'artifacts'));
    expect(result.verification.target).toEqual(currentNativeTarget());
    expect(await readNativeVerification(result.outputPath)).toEqual(
      result.verification,
    );
    expect(await readFile(result.outputPath, 'utf8')).toEndWith('\n');
    await expect(
      writeNativeVerification(result.outputPath, result.verification),
    ).rejects.toMatchObject({ code: 'EEXIST' });
  });

  test('aggregates transported evidence files without changing artifact bytes', async () => {
    const { root, record } = await preparedRecord();
    const recordPath = join(root, 'release-record.json');
    await writeReleaseRecord(recordPath, record);
    const evidencePaths = [];
    for (const [index, target] of RELEASE_TARGETS.entries()) {
      const path = join(root, 'transported', `${targetKey(target)}.json`);
      await writeNativeVerification(
        path,
        createNativeVerification(record, target, {
          name: `runner-${index}`,
          operatingSystem: target.operatingSystem,
          architecture: target.architecture,
        }),
      );
      evidencePaths.push(path);
    }
    const artifact = record.artifacts[0];
    if (artifact === undefined) throw new Error('Expected a promoted artifact.');
    const before = await readFile(join(root, 'artifacts', artifact.filename));
    const result = await mergeNativeReleaseEvidence({ recordPath, evidencePaths });
    const after = await readFile(join(root, 'artifacts', artifact.filename));
    expect(result.record.stages.at(-1)?.name).toBe('macos-cli-authority-established');
    expect(after).toEqual(before);
  });
});

async function preparedRecord() {
  const root = await temporaryDirectory();
  await mkdir(join(root, 'artifacts'), { recursive: true });
  let record = createReleaseRecord({
    releaseVersion: '0.1.0-preview.2',
    source: {
      repository: 'https://github.com/TrentBrown/portreeve',
      commit: '8'.repeat(40),
    },
    versions: { server: '0.1.0', desktop: '0.1.0', client: '0.1.0' },
    policy: { maturity: 'alpha', channel: 'preview', desktopTrust: 'unsigned' },
    tools: { bun: '1.3.14', node: '22.20.0' },
    now: () => new Date('2026-08-16T19:00:00.000Z'),
  });
  record = advanceReleaseRecord(record, 'source-pinned', {});
  record = advanceReleaseRecord(record, 'policy-resolved', {});
  record = advanceReleaseRecord(record, 'native-cli-built', {});
  for (const target of RELEASE_TARGETS) {
    const filename = `portreeve-v0.1.0-${target.operatingSystem}-${target.architecture}`;
    const path = join(root, 'artifacts', filename);
    await Bun.write(path, `promoted-${target.operatingSystem}-${target.architecture}`);
    record = await registerReleaseArtifact(record, {
      root,
      path,
      type: 'executable',
      provenanceStage: 'native-cli-built',
      operatingSystem: target.operatingSystem,
      architecture: target.architecture,
    });
  }
  record = advanceReleaseRecord(record, 'artifact-digests-established', {
    artifactCount: record.artifacts.length,
  });
  record = advanceReleaseRecord(record, 'candidate-qualified', {
    artifactCount: record.artifacts.length,
    credentialAccess: false,
  });
  return { root, record };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-native-evidence-test-'));
  directories.push(directory);
  return directory;
}
