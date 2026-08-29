// @ts-check

import { Command } from 'commander';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { desktopDmgName, renderHomebrewCask } from './desktop-release-lib.js';
import {
  createDesktopUpdateManifest,
  renderDesktopUpdateManifest,
} from './desktop-update-manifest.js';
import {
  renderChecksumFile,
  renderHomebrewFormula,
  sha256File,
} from './release-lib.js';
import {
  advanceReleaseRecord,
  readReleaseRecord,
  registerReleaseArtifact,
  verifyReleaseArtifacts,
  writeReleaseRecord,
} from './release-record.js';
import { createPublicationPlan, renderPublicationPlan } from './publication-plan.js';
import { aggregateAppleNativeTrustEvidence } from './apple-native-trust-evidence.js';

const DEFAULT_HOMEPAGE = 'https://github.com/TrentBrown/portreeve';
const DEFAULT_RELEASE_BASE = `${DEFAULT_HOMEPAGE}/releases/download`;
const NATIVE_TARGETS = ['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'];

/** @param {unknown} evidence @returns {asserts evidence is Record<string, any>} */
export function assertDesktopPackageEvidence(evidence) {
  const candidate = /** @type {Record<string, any>} */ (evidence);
  if (
    evidence === null ||
    typeof evidence !== 'object' ||
    candidate.schemaVersion !== 1 ||
    candidate.kind !== 'desktop-package-verification'
  ) {
    throw new Error('Unsupported Desktop package evidence schema.');
  }
  if (
    candidate.target?.operatingSystem !== 'macos' ||
    !['arm64', 'x64'].includes(candidate.target?.architecture)
  ) {
    throw new Error('Desktop package evidence target is invalid.');
  }
  for (const artifact of [candidate.cliArtifact, candidate.desktop]) {
    if (
      typeof artifact?.filename !== 'string' ||
      basename(artifact.filename) !== artifact.filename ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 0 ||
      !/^[a-f0-9]{64}$/u.test(String(artifact.sha256 ?? ''))
    ) {
      throw new Error('Desktop package evidence artifact identity is invalid.');
    }
  }
  for (const check of [
    'exactCliEmbedded',
    'packageInspected',
    'dmgVerified',
    'dmgMounted',
    'nativeSmoke',
  ]) {
    if (candidate.checks?.[check] !== true) {
      throw new Error(`Desktop package evidence check is incomplete: ${check}`);
    }
  }
  if (
    typeof candidate.releaseId !== 'string' ||
    typeof candidate.releaseVersion !== 'string' ||
    typeof candidate.source?.repository !== 'string' ||
    !/^[a-f0-9]{40}$/u.test(String(candidate.source?.commit ?? '')) ||
    typeof candidate.desktop?.version !== 'string' ||
    !Number.isFinite(Date.parse(candidate.verifiedAt))
  ) {
    throw new Error('Desktop package evidence release identity is invalid.');
  }
  if (
    candidate.runner?.operatingSystem !== 'darwin' ||
    candidate.runner?.architecture !== candidate.target.architecture
  ) {
    throw new Error('Desktop package evidence runner is not target-native.');
  }
}

/**
 * @param {{recordPath: string, evidencePaths?: string[], appleEvidencePaths?: string[], producerEvidencePath?: string, trustEvidencePath?: string, releaseBaseUrl?: string, homepageUrl?: string, currentUpdateManifestPath?: string}} options
 */
export async function finalizeDesktopDistribution(options) {
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  let record = await readReleaseRecord(recordPath);
  if (record.stages.at(-1)?.name !== 'macos-cli-authority-established') {
    throw new Error('Desktop finalization requires established macOS CLI authority.');
  }
  const authoritativeNativeEvidence = {
    targets: NATIVE_TARGETS,
    desktopArchitectures: ['arm64', 'x64'],
    verificationCount: NATIVE_TARGETS.length + 2,
  };
  let trustEvidence;
  let evidencePaths = options.evidencePaths ?? [];
  if (record.policy.desktopTrust === 'unsigned') {
    trustEvidence = { status: 'unsigned-internal' };
  } else {
    if (
      options.trustEvidencePath !== undefined &&
      options.producerEvidencePath === undefined &&
      options.appleEvidencePaths === undefined
    ) {
      trustEvidence = JSON.parse(
        await readFile(resolve(options.trustEvidencePath), 'utf8'),
      );
    } else {
      if (
        options.producerEvidencePath === undefined ||
        options.appleEvidencePaths === undefined
      ) {
        throw new Error(
          'Trusted Desktop finalization requires Apple trust evidence from the producer and native runners.',
        );
      }
      const producer = JSON.parse(
        await readFile(resolve(options.producerEvidencePath), 'utf8'),
      );
      const appleEvidence = await Promise.all(
        options.appleEvidencePaths.map(async (path) =>
          JSON.parse(await readFile(resolve(path), 'utf8')),
        ),
      );
      const aggregated = aggregateAppleNativeTrustEvidence(
        record,
        producer,
        appleEvidence,
      );
      trustEvidence = aggregated.trustEvidence;
      evidencePaths = [];
      for (const entry of aggregated.ordered) {
        const path = resolve(
          releaseRoot,
          'evidence',
          `desktop-from-apple-${entry.target.architecture}.json`,
        );
        const desktopEvidence = {
          schemaVersion: 1,
          kind: 'desktop-package-verification',
          releaseId: entry.releaseId,
          releaseVersion: entry.releaseVersion,
          source: entry.source,
          target: entry.target,
          cliArtifact: {
            filename: entry.cli.filename,
            bytes: entry.cli.bytes,
            sha256: entry.cli.sha256,
          },
          desktop: {
            version: entry.releaseVersion,
            filename: entry.dmg.filename,
            bytes: entry.dmg.bytes,
            sha256: entry.dmg.sha256,
          },
          checks: {
            exactCliEmbedded: true,
            packageInspected: true,
            dmgVerified: true,
            dmgMounted: true,
            nativeSmoke: true,
          },
          runner: entry.runner,
          verifiedAt: entry.verifiedAt,
        };
        await writeImmutableFile(
          path,
          JSON.stringify(desktopEvidence, null, 2).concat('\n'),
        );
        evidencePaths.push(path);
      }
    }
  }
  await verifyReleaseArtifacts(record, releaseRoot);
  const evidence = await Promise.all(
    evidencePaths.map(async (path) => {
      const value = JSON.parse(await readFile(resolve(path), 'utf8'));
      assertDesktopPackageEvidence(value);
      return value;
    }),
  );
  const byArchitecture = new Map();
  for (const entry of evidence) {
    const architecture = entry.target.architecture;
    if (byArchitecture.has(architecture)) {
      throw new Error(`Duplicate Desktop package evidence: ${architecture}`);
    }
    if (
      entry.releaseId !== record.releaseId ||
      entry.releaseVersion !== record.releaseVersion ||
      entry.source.repository !== record.source.repository ||
      entry.source.commit !== record.source.commit ||
      entry.desktop.version !== record.versions.desktop
    ) {
      throw new Error(`Desktop package evidence is stale: ${architecture}`);
    }
    const cli = record.artifacts.find(
      (artifact) =>
        artifact.type === 'executable' &&
        artifact.operatingSystem === 'macos' &&
        artifact.architecture === architecture,
    );
    if (
      cli === undefined ||
      cli.filename !== entry.cliArtifact.filename ||
      cli.bytes !== entry.cliArtifact.bytes ||
      cli.sha256 !== entry.cliArtifact.sha256
    ) {
      throw new Error(`Desktop package CLI identity changed: ${architecture}`);
    }
    const expectedDmg = desktopDmgName(record.versions.desktop, architecture);
    const dmgPath = resolve(releaseRoot, 'artifacts', expectedDmg);
    if (
      entry.desktop.filename !== expectedDmg ||
      (await stat(dmgPath)).size !== entry.desktop.bytes ||
      (await sha256File(dmgPath)) !== entry.desktop.sha256
    ) {
      throw new Error(`Desktop DMG identity changed: ${architecture}`);
    }
    byArchitecture.set(architecture, entry);
  }
  if (!byArchitecture.has('arm64') || !byArchitecture.has('x64')) {
    throw new Error('Desktop package evidence requires both arm64 and x64.');
  }

  const arm = byArchitecture.get('arm64');
  const intel = byArchitecture.get('x64');
  const caskPath = resolve(releaseRoot, 'artifacts', 'portreeve-app.rb');
  await writeImmutableFile(
    caskPath,
    renderHomebrewCask({
      version: record.versions.desktop,
      releaseVersion: record.releaseVersion,
      releaseBaseUrl: options.releaseBaseUrl ?? DEFAULT_RELEASE_BASE,
      homepageUrl: options.homepageUrl ?? DEFAULT_HOMEPAGE,
      checksums: { arm64: arm.desktop.sha256, x64: intel.desktop.sha256 },
      desktopTrust: record.policy.desktopTrust,
    }),
  );
  await verifyRuby(caskPath);
  record = advanceReleaseRecord(record, 'desktop-packaged', {
    packages: ['arm64', 'x64'].map((architecture) => {
      const entry = byArchitecture.get(architecture);
      return {
        architecture,
        filename: entry.desktop.filename,
        sha256: entry.desktop.sha256,
        cliSha256: entry.cliArtifact.sha256,
      };
    }),
  });
  for (const architecture of /** @type {const} */ (['arm64', 'x64'])) {
    record = await registerReleaseArtifact(record, {
      root: releaseRoot,
      path: resolve(
        releaseRoot,
        'artifacts',
        desktopDmgName(record.versions.desktop, architecture),
      ),
      type: 'desktop-dmg',
      provenanceStage: 'desktop-packaged',
      operatingSystem: 'macos',
      architecture,
    });
  }
  record = await registerReleaseArtifact(record, {
    root: releaseRoot,
    path: caskPath,
    type: 'homebrew-cask',
    provenanceStage: 'desktop-packaged',
  });
  record = advanceReleaseRecord(
    record,
    'authoritative-native-verified',
    authoritativeNativeEvidence,
  );
  record = advanceReleaseRecord(record, 'desktop-trust-verified', trustEvidence);
  if (
    record.policy.desktopTrust === 'developer-id-notarized' &&
    options.producerEvidencePath !== undefined
  ) {
    const formulaPath = resolve(releaseRoot, 'artifacts', 'portreeve.rb');
    const formula = record.artifacts.find(
      (artifact) => artifact.type === 'homebrew-formula',
    );
    if (formula === undefined) {
      throw new Error('Trusted finalization requires its Homebrew formula.');
    }
    const checksums = Object.fromEntries(
      record.artifacts
        .filter((artifact) => artifact.type === 'executable')
        .map((artifact) => [artifact.filename, artifact.sha256]),
    );
    await writeFile(
      formulaPath,
      renderHomebrewFormula({
        version: record.releaseVersion,
        releaseBaseUrl: options.releaseBaseUrl ?? DEFAULT_RELEASE_BASE,
        homepageUrl: options.homepageUrl ?? DEFAULT_HOMEPAGE,
        checksums,
      }),
      'utf8',
    );
    formula.bytes = (await stat(formulaPath)).size;
    formula.sha256 = await sha256File(formulaPath);
    const manifestPath = resolve(releaseRoot, 'artifacts', 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const artifact of manifest.artifacts ?? []) {
      const authoritative = record.artifacts.find(
        (entry) => entry.filename === artifact.filename,
      );
      if (authoritative !== undefined) {
        artifact.bytes = authoritative.bytes;
        artifact.sha256 = authoritative.sha256;
      }
    }
    await writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2).concat('\n'),
      'utf8',
    );
    await writeFile(
      resolve(releaseRoot, 'artifacts', 'SHA256SUMS'),
      renderChecksumFile(
        record.artifacts.filter((artifact) =>
          ['executable', 'npm-package', 'homebrew-formula'].includes(artifact.type),
        ),
      ),
      'utf8',
    );
  }
  const updateManifestPath = resolve(releaseRoot, 'artifacts', 'desktop-update.json');
  const currentUpdateManifest = JSON.parse(
    await readFile(
      resolve(
        options.currentUpdateManifestPath ??
          resolve(process.cwd(), 'distribution', 'desktop-update.json'),
      ),
      'utf8',
    ),
  );
  await writeImmutableFile(
    updateManifestPath,
    renderDesktopUpdateManifest(
      createDesktopUpdateManifest(record, currentUpdateManifest),
    ),
  );
  record = advanceReleaseRecord(record, 'distribution-finalized', {
    artifactCount: record.artifacts.length + 2,
  });
  record = await registerReleaseArtifact(record, {
    root: releaseRoot,
    path: updateManifestPath,
    type: 'desktop-update-metadata',
    provenanceStage: 'distribution-finalized',
  });
  const checksumsPath = resolve(releaseRoot, 'artifacts', 'SHA256SUMS-DISTRIBUTION');
  await writeImmutableFile(checksumsPath, renderChecksumFile(record.artifacts));
  record = await registerReleaseArtifact(record, {
    root: releaseRoot,
    path: checksumsPath,
    type: 'release-metadata',
    provenanceStage: 'distribution-finalized',
  });
  await verifyReleaseArtifacts(record, releaseRoot);
  const publicationPlanPath = resolve(releaseRoot, 'publication-plan.md');
  await writeImmutableFile(
    publicationPlanPath,
    renderPublicationPlan(createPublicationPlan(record)),
  );
  await writeImmutableFile(
    resolve(releaseRoot, 'publication-plan.sha256'),
    `${await sha256File(publicationPlanPath)}  publication-plan.md\n`,
  );
  await writeReleaseRecord(recordPath, record);
  return { recordPath, record, caskPath, checksumsPath, updateManifestPath };
}

/** @param {string} path @param {string} content */
async function writeImmutableFile(path, content) {
  try {
    await writeFile(path, content, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (!(
      error instanceof Error &&
      'code' in error &&
      /** @type {{code?: unknown}} */ (error).code === 'EEXIST'
    )) {
      throw error;
    }
    if ((await readFile(path, 'utf8')) !== content) {
      throw new Error(`Existing distribution artifact differs: ${basename(path)}`, {
        cause: error,
      });
    }
  }
}

/** @param {string} path */
async function verifyRuby(path) {
  const child = Bun.spawn(['ruby', '-c', path], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0 || !stdout.includes('Syntax OK')) {
    throw new Error(`Homebrew cask syntax failed: ${stderr || stdout}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:finalize-desktop')
    .description('Finalize both Desktop DMGs, Homebrew cask, and distribution state')
    .requiredOption('--record <path>', 'prepared release-record.json path')
    .option('--evidence <paths...>', 'arm64 and x64 unsigned Desktop evidence')
    .option('--apple-evidence <paths...>', 'ARM64 and Intel Apple trust evidence')
    .option('--producer-evidence <path>', 'protected producer evidence')
    .option(
      '--current-update-manifest <path>',
      'current channel-aware Desktop update manifest',
      'distribution/desktop-update.json',
    )
    .action(async (values) => {
      const result = await finalizeDesktopDistribution({
        recordPath: values.record,
        evidencePaths: values.evidence,
        appleEvidencePaths: values.appleEvidence,
        producerEvidencePath: values.producerEvidence,
        currentUpdateManifestPath: values.currentUpdateManifest,
      });
      console.log(result.recordPath);
    });
  await program.parseAsync();
}
