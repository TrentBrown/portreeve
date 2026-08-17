// @ts-check

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  desktopDmgName,
  renderHomebrewCask,
} from '../../scripts/desktop-release-lib.js';
import {
  assertDesktopPackageEvidence,
  finalizeDesktopDistribution,
} from '../../scripts/finalize-desktop-distribution.js';
import {
  createNativeVerification,
  mergeNativeVerifications,
} from '../../scripts/native-release-evidence.js';
import { RELEASE_TARGETS, sha256File } from '../../scripts/release-lib.js';
import {
  advanceReleaseRecord,
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

describe('Desktop distribution', () => {
  test('renders conventional architecture-specific DMGs and a lifecycle-safe cask', () => {
    expect(desktopDmgName('0.1.0', 'arm64')).toBe('PortReeve-0.1.0-macos-arm64.dmg');
    const cask = renderHomebrewCask({
      version: '0.1.0',
      releaseVersion: '0.1.0-preview.1',
      releaseBaseUrl: 'https://example.com/releases/download/',
      homepageUrl: 'https://example.com',
      checksums: { arm64: 'a'.repeat(64), x64: 'b'.repeat(64) },
    });
    expect(cask).toContain('cask "portreeve-app"');
    expect(cask).toContain('PortReeve-0.1.0-macos-#{arch}.dmg');
    expect(cask).toContain('/v0.1.0-preview.1/');
    expect(cask).toContain('Uninstall preserves claims, history, and settings.');
    expect(cask).not.toContain('zap ');
  });

  test('strictly validates Desktop package evidence', async () => {
    const { record, root } = await preparedRecord('preview');
    const evidence = await desktopEvidence(record, root, 'arm64');
    expect(() => assertDesktopPackageEvidence(evidence)).not.toThrow();
    const incomplete = structuredClone(evidence);
    incomplete.checks.nativeSmoke = false;
    expect(() => assertDesktopPackageEvidence(incomplete)).toThrow('nativeSmoke');
    const unsafe = structuredClone(evidence);
    unsafe.desktop.filename = '../PortReeve.dmg';
    expect(() => assertDesktopPackageEvidence(unsafe)).toThrow('artifact identity');
    const translated = structuredClone(evidence);
    translated.runner.architecture = 'x64';
    expect(() => assertDesktopPackageEvidence(translated)).toThrow('not target-native');
  });

  test('finalizes two exact DMGs, cask, trust state, and distribution checksums', async () => {
    const { record, root } = await preparedRecord('preview');
    const recordPath = join(root, 'release-record.json');
    await writeReleaseRecord(recordPath, record);
    const evidencePaths = [];
    for (const architecture of /** @type {const} */ (['arm64', 'x64'])) {
      const evidence = await desktopEvidence(record, root, architecture);
      const path = join(root, 'evidence', `desktop-${architecture}.json`);
      await mkdir(join(root, 'evidence'), { recursive: true });
      await writeFile(path, JSON.stringify(evidence));
      evidencePaths.push(path);
    }
    const result = await finalizeDesktopDistribution({
      recordPath,
      evidencePaths,
      releaseBaseUrl: 'https://example.com/releases/download',
      homepageUrl: 'https://example.com',
    });
    expect(result.record.state).toBe('prepared');
    expect(result.record.stages.slice(-3).map(({ name }) => name)).toEqual([
      'desktop-packaged',
      'desktop-trust-verified',
      'distribution-finalized',
    ]);
    expect(result.record.artifacts.map(({ filename }) => filename)).toContain(
      'portreeve-app.rb',
    );
    expect(await readFile(result.caskPath, 'utf8')).toContain('cask "portreeve-app"');
    expect(JSON.parse(await readFile(result.updateManifestPath, 'utf8'))).toMatchObject(
      {
        schemaVersion: 2,
        releases: [
          {
            releaseVersion: '0.1.0-preview.1',
            desktopVersion: '0.1.0',
            maturity: 'alpha',
            channel: 'preview',
            desktopTrust: 'unsigned',
          },
        ],
      },
    );
    expect((await stat(result.checksumsPath)).size).toBeGreaterThan(100);
  });

  test('fails stable Desktop finalization closed without Apple trust evidence', async () => {
    const { record, root } = await preparedRecord('stable');
    const recordPath = join(root, 'release-record.json');
    await writeReleaseRecord(recordPath, record);
    const evidencePaths = [];
    for (const architecture of /** @type {const} */ (['arm64', 'x64'])) {
      const evidence = await desktopEvidence(record, root, architecture);
      const path = join(root, 'evidence', `desktop-${architecture}.json`);
      await mkdir(join(root, 'evidence'), { recursive: true });
      await writeFile(path, JSON.stringify(evidence));
      evidencePaths.push(path);
    }
    await expect(
      finalizeDesktopDistribution({ recordPath, evidencePaths }),
    ).rejects.toThrow('requires Apple trust evidence');
  });
});

/** @param {'preview'|'stable'} channel */
async function preparedRecord(channel) {
  const root = await temporaryDirectory();
  await mkdir(join(root, 'artifacts'), { recursive: true });
  const version = channel === 'preview' ? '0.1.0-preview.1' : '1.0.0';
  const componentVersion = channel === 'preview' ? '0.1.0' : '1.0.0';
  let record = createReleaseRecord({
    releaseVersion: version,
    source: {
      repository: 'https://github.com/TrentBrown/portreeve',
      commit: '7'.repeat(40),
    },
    versions: {
      server: componentVersion,
      desktop: componentVersion,
      client: componentVersion,
    },
    policy:
      channel === 'preview'
        ? { maturity: 'alpha', channel, desktopTrust: 'unsigned' }
        : {
            maturity: 'stable',
            channel,
            desktopTrust: 'developer-id-notarized',
          },
    tools: { bun: '1.3.14' },
  });
  record = advanceReleaseRecord(record, 'source-pinned', {});
  record = advanceReleaseRecord(record, 'policy-resolved', {});
  record = advanceReleaseRecord(record, 'native-cli-built', {});
  for (const target of RELEASE_TARGETS) {
    const path = join(
      root,
      'artifacts',
      `portreeve-v${componentVersion}-${target.operatingSystem}-${target.architecture}`,
    );
    await Bun.write(path, `cli-${target.operatingSystem}-${target.architecture}`);
    record = await registerReleaseArtifact(record, {
      root,
      path,
      type: 'executable',
      provenanceStage: 'native-cli-built',
      operatingSystem: target.operatingSystem,
      architecture: target.architecture,
    });
  }
  const formulaPath = join(root, 'artifacts', 'portreeve.rb');
  await Bun.write(formulaPath, 'class Portreeve < Formula\nend\n');
  record = await registerReleaseArtifact(record, {
    root,
    path: formulaPath,
    type: 'homebrew-formula',
    provenanceStage: 'native-cli-built',
  });
  record = advanceReleaseRecord(record, 'artifact-digests-established', {});
  record = mergeNativeVerifications(
    record,
    RELEASE_TARGETS.map((target) =>
      createNativeVerification(record, target, {
        name: 'fixture',
        operatingSystem: target.operatingSystem,
        architecture: target.architecture,
      }),
    ),
  );
  return { root, record };
}

/** @param {Record<string, any>} record @param {string} root @param {'arm64'|'x64'} architecture */
async function desktopEvidence(record, root, architecture) {
  const filename = desktopDmgName(record.versions.desktop, architecture);
  const path = join(root, 'artifacts', filename);
  await Bun.write(path, `dmg-${architecture}`);
  const cli = record.artifacts.find(
    (/** @type {Record<string, any>} */ artifact) =>
      artifact.type === 'executable' &&
      artifact.operatingSystem === 'macos' &&
      artifact.architecture === architecture,
  );
  if (cli === undefined) throw new Error('Expected macOS CLI fixture.');
  return {
    schemaVersion: 1,
    kind: 'desktop-package-verification',
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    target: { operatingSystem: 'macos', architecture },
    cliArtifact: {
      filename: cli.filename,
      bytes: cli.bytes,
      sha256: cli.sha256,
    },
    desktop: {
      version: record.versions.desktop,
      filename,
      bytes: (await stat(path)).size,
      sha256: await sha256File(path),
    },
    checks: {
      exactCliEmbedded: true,
      packageInspected: true,
      dmgVerified: true,
      dmgMounted: true,
      nativeSmoke: true,
    },
    runner: { operatingSystem: 'darwin', architecture },
    verifiedAt: new Date().toISOString(),
  };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-desktop-release-test-'));
  directories.push(directory);
  return directory;
}
