// @ts-check

import { Command } from 'commander';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  mergeNativeVerifications,
  readNativeVerification,
} from './native-release-evidence.js';
import {
  readReleaseRecord,
  verifyReleaseArtifacts,
  writeReleaseRecord,
} from './release-record.js';

/** @param {{recordPath: string, evidencePaths: string[]}} options */
export async function mergeNativeReleaseEvidence(options) {
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  const record = await readReleaseRecord(recordPath);
  await verifyReleaseArtifacts(record, releaseRoot);
  const verifications = await Promise.all(
    options.evidencePaths.map((path) => readNativeVerification(resolve(path))),
  );
  const next = mergeNativeVerifications(record, verifications);
  await verifyReleaseArtifacts(next, releaseRoot);
  await writeReleaseRecord(recordPath, next);
  return { recordPath, record: next };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:merge-native-evidence')
    .description('Merge a complete native verification matrix into a release record')
    .requiredOption('--record <path>', 'prepared release-record.json path')
    .requiredOption('--evidence <paths...>', 'native verification fragment paths')
    .action(async (values) => {
      const result = await mergeNativeReleaseEvidence({
        recordPath: values.record,
        evidencePaths: values.evidence,
      });
      console.log(result.recordPath);
    });
  await program.parseAsync();
}
