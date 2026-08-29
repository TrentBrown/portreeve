// @ts-check

import { Command } from 'commander';
import { link, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertNativeVerificationMatrix,
  readNativeVerification,
} from './native-release-evidence.js';
import { readReleaseRecord, verifyReleaseArtifacts } from './release-record.js';

/**
 * @param {{recordPath: string, evidencePaths: string[], outputPath?: string}} options
 */
export async function qualifyTrustedRelease(options) {
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  const record = await readReleaseRecord(recordPath);
  if (record.policy.desktopTrust !== 'developer-id-notarized') {
    throw new Error('Protected release qualification requires trusted policy.');
  }
  await verifyReleaseArtifacts(record, releaseRoot);
  const verifications = await Promise.all(
    options.evidencePaths.map((path) => readNativeVerification(resolve(path))),
  );
  const ordered = assertNativeVerificationMatrix(record, verifications);
  const qualification = {
    schemaVersion: 1,
    kind: 'portreeve-trust-qualification',
    releaseId: record.releaseId,
    source: { ...record.source },
    targets: ordered.map(
      ({ target }) => `${target.operatingSystem}-${target.architecture}`,
    ),
    credentialAccess: false,
  };
  const outputPath = resolve(
    options.outputPath ?? resolve(releaseRoot, 'evidence', 'trust-qualification.json'),
  );
  await writeCreateOnce(outputPath, qualification);
  return { outputPath, qualification };
}

/** @param {string} path @param {unknown} value */
async function writeCreateOnce(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.qualification.tmp`;
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
    .name('release:qualify-trust')
    .description('Qualify a trusted release before protected credential access')
    .requiredOption('--record <path>', 'prepared release-record.json path')
    .requiredOption('--evidence <paths...>', 'native verification fragments')
    .action(async (values) => {
      const result = await qualifyTrustedRelease({
        recordPath: values.record,
        evidencePaths: values.evidence,
      });
      console.log(result.outputPath);
    });
  await program.parseAsync();
}
