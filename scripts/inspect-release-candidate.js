// @ts-check

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPublicationPlan, renderPublicationPlan } from './publication-plan.js';
import { sha256File } from './release-lib.js';
import { readReleaseRecord, verifyReleaseArtifacts } from './release-record.js';

const NATIVE_TARGETS = ['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'];
const DESKTOP_ARCHITECTURES = ['arm64', 'x64'];

/** @param {{recordPath: string}} options */
export async function inspectReleaseCandidate(options) {
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  const record = await readReleaseRecord(recordPath);
  if (
    record.state !== 'prepared' ||
    record.stages.at(-1)?.name !== 'distribution-finalized' ||
    record.publication.state !== 'unpublished'
  ) {
    throw new Error(
      'Candidate inspection requires a finalized, unpublished prepared release.',
    );
  }
  await verifyReleaseArtifacts(record, releaseRoot);

  const nativeTargets = record.verifications.map((verification) => {
    const target = /** @type {{operatingSystem: string, architecture: string}} */ (
      verification.target
    );
    return `${target.operatingSystem}-${target.architecture}`;
  });
  if (nativeTargets.join(',') !== NATIVE_TARGETS.join(',')) {
    throw new Error(
      'Candidate does not contain the complete native verification matrix.',
    );
  }
  const desktopArchitectures = record.artifacts
    .filter((artifact) => artifact.type === 'desktop-dmg')
    .map((artifact) => artifact.architecture);
  if (desktopArchitectures.join(',') !== DESKTOP_ARCHITECTURES.join(',')) {
    throw new Error(
      'Candidate does not contain both architecture-specific Desktop DMGs.',
    );
  }
  for (const type of [
    'homebrew-formula',
    'homebrew-cask',
    'desktop-update-metadata',
    'release-metadata',
    'npm-package',
  ]) {
    if (!record.artifacts.some((artifact) => artifact.type === type)) {
      throw new Error(`Candidate is missing required artifact type ${type}.`);
    }
  }

  const planPath = resolve(releaseRoot, 'publication-plan.md');
  const expectedPlan = renderPublicationPlan(createPublicationPlan(record));
  if ((await readFile(planPath, 'utf8')) !== expectedPlan) {
    throw new Error('Candidate publication plan does not match its release record.');
  }

  return {
    schemaVersion: 1,
    status: 'ready-for-publication-review',
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    versions: { ...record.versions },
    policy: { ...record.policy },
    state: record.state,
    publicationState: record.publication.state,
    artifactCount: record.artifacts.length,
    nativeTargets,
    desktopArchitectures,
    publicationPlanSha256: await sha256File(planPath),
    publicMutationPerformed: false,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:inspect')
    .description('Inspect a finalized release candidate without publishing it')
    .requiredOption('--record <path>', 'finalized release-record.json path')
    .option('--json', 'emit the inspection summary as JSON', false)
    .action(async (values) => {
      const result = await inspectReleaseCandidate({ recordPath: values.record });
      if (values.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(
        `Verified ${result.releaseId} from ${result.source.commit}: ` +
          `${result.artifactCount} artifacts, ${result.nativeTargets.length} native targets, ` +
          `${result.desktopArchitectures.length} Desktop DMGs; no public mutation performed.`,
      );
    });
  await program.parseAsync();
}
