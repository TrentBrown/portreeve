// @ts-check

import { Command } from 'commander';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createNativeVerification,
  currentNativeTarget,
  targetKey,
  writeNativeVerification,
} from './native-release-evidence.js';
import { readReleaseRecord, verifyReleaseArtifacts } from './release-record.js';

/**
 * @param {{recordPath: string, outputPath?: string, workspaceRoot?: string}} options
 * @param {{verify?: (options: {releaseDirectory: string, workspaceRoot: string}) => Promise<void>, now?: () => Date}} [dependencies]
 */
export async function collectNativeReleaseEvidence(options, dependencies = {}) {
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const record = await readReleaseRecord(recordPath);
  await verifyReleaseArtifacts(record, releaseRoot);
  await (dependencies.verify ?? verifyNatively)({
    releaseDirectory: resolve(releaseRoot, 'artifacts'),
    workspaceRoot,
  });
  await verifyReleaseArtifacts(record, releaseRoot);
  const target = currentNativeTarget();
  const verification = createNativeVerification(
    record,
    target,
    {
      name: process.env.GITHUB_RUN_ID
        ? `github-actions-${process.env.GITHUB_RUN_ID}`
        : 'local',
      operatingSystem: process.platform,
      architecture: process.arch,
    },
    dependencies.now,
  );
  const outputPath = resolve(
    options.outputPath ??
      resolve(releaseRoot, 'evidence', `native-${targetKey(target)}.json`),
  );
  await writeNativeVerification(outputPath, verification);
  return { outputPath, verification };
}

/** @param {{releaseDirectory: string, workspaceRoot: string}} options */
async function verifyNatively(options) {
  const child = Bun.spawn(
    [
      process.execPath,
      resolve(options.workspaceRoot, 'scripts', 'verify-release.js'),
      '--native',
      '--lifecycle',
    ],
    {
      cwd: options.workspaceRoot,
      env: {
        ...process.env,
        PORTREEVE_RELEASE_DIRECTORY: options.releaseDirectory,
      },
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  const code = await child.exited;
  if (code !== 0) {
    throw new Error(`Native release verification failed with exit code ${code}.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:native-evidence')
    .description('Verify the promoted CLI on this native host and emit evidence')
    .requiredOption('--record <path>', 'prepared release-record.json path')
    .option('--output <path>', 'native verification fragment path')
    .action(async (values) => {
      const result = await collectNativeReleaseEvidence({
        recordPath: values.record,
        outputPath: values.output,
      });
      console.log(result.outputPath);
    });
  await program.parseAsync();
}
