// @ts-check

import { Command } from 'commander';
import { link, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageDesktop } from './package-desktop.js';
import { createAndVerifyDesktopDmg, desktopDmgName } from './desktop-release-lib.js';
import { readReleaseRecord, verifyReleaseArtifacts } from './release-record.js';

/**
 * @param {{recordPath: string, architecture: 'arm64'|'x64', workspaceRoot?: string, smoke?: boolean}} options
 */
export async function packageDesktopRelease(options) {
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const record = await readReleaseRecord(recordPath);
  if (record.stages.at(-1)?.name !== 'native-cli-verified') {
    throw new Error('Desktop packaging requires complete native CLI verification.');
  }
  await verifyReleaseArtifacts(record, releaseRoot);
  const outputRoot = resolve(releaseRoot, 'desktop-work', options.architecture);
  const packaged = await packageDesktop({
    workspaceRoot,
    releaseDirectory: resolve(releaseRoot, 'artifacts'),
    outputRoot,
    architecture: options.architecture,
    ...(options.smoke === undefined ? {} : { smoke: options.smoke }),
  });
  const dmgPath = resolve(
    releaseRoot,
    'artifacts',
    desktopDmgName(packaged.desktopVersion, options.architecture),
  );
  const dmg = await createAndVerifyDesktopDmg({
    applicationPath: packaged.applicationPath,
    outputPath: dmgPath,
    architecture: options.architecture,
    controllerVersion: packaged.desktopVersion,
  });
  await verifyReleaseArtifacts(record, releaseRoot);
  const cliArtifact = record.artifacts.find(
    (artifact) =>
      artifact.type === 'executable' &&
      artifact.operatingSystem === 'macos' &&
      artifact.architecture === options.architecture,
  );
  if (cliArtifact === undefined) {
    throw new Error(`Missing promoted macOS ${options.architecture} executable.`);
  }
  const evidence = {
    schemaVersion: 1,
    kind: 'desktop-package-verification',
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    target: { operatingSystem: 'macos', architecture: options.architecture },
    cliArtifact: {
      filename: cliArtifact.filename,
      bytes: cliArtifact.bytes,
      sha256: cliArtifact.sha256,
    },
    desktop: {
      version: packaged.desktopVersion,
      filename: dmg.filename,
      bytes: dmg.bytes,
      sha256: dmg.sha256,
    },
    checks: {
      exactCliEmbedded: true,
      packageInspected: true,
      dmgVerified: true,
      dmgMounted: true,
      nativeSmoke: options.smoke ?? process.arch === options.architecture,
    },
    runner: { operatingSystem: process.platform, architecture: process.arch },
    verifiedAt: new Date().toISOString(),
  };
  const evidencePath = resolve(
    releaseRoot,
    'evidence',
    `desktop-macos-${options.architecture}.json`,
  );
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeNativeVerificationDocument(evidencePath, evidence);
  return { dmgPath, evidencePath, evidence };
}

/** @param {string} path @param {unknown} value */
async function writeNativeVerificationDocument(path, value) {
  const temporary = `${path}.desktop.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2).concat('\n'), {
      flag: 'wx',
    });
    await link(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:package-desktop')
    .description('Package and verify one architecture-specific PortReeve DMG')
    .requiredOption('--record <path>', 'prepared release-record.json path')
    .requiredOption('--arch <architecture>', 'arm64 or x64')
    .option('--no-smoke', 'skip native application startup smoke')
    .action(async (values) => {
      if (!['arm64', 'x64'].includes(values.arch)) {
        throw new Error('--arch must be arm64 or x64.');
      }
      const result = await packageDesktopRelease({
        recordPath: values.record,
        architecture: values.arch,
        smoke: values.smoke,
      });
      console.log(result.dmgPath);
    });
  await program.parseAsync();
}
