// @ts-check

import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  APPLE_SIGNING_IDENTITY,
  APPLE_TEAM_ID,
  parseCodesignFacts,
  parseGatekeeperFacts,
  parseStaplerFacts,
  runBoundedAppleCommand,
} from './apple-trust-contract.js';
import { smokePackagedDesktop } from './desktop-package-lib.js';
import { verifyDesktopDmg } from './desktop-release-lib.js';
import { sha256File } from './release-lib.js';
import { readReleaseRecord, verifyReleaseArtifacts } from './release-record.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Collect one create-once native Apple authority document from the exact
 * protected producer output. The runner architecture is authority.
 *
 * @param {{recordPath: string, producerEvidencePath: string, outputPath?: string, workspaceRoot?: string, architecture?: 'arm64'|'x64'}} options
 * @param {{run?: typeof runCommand, verifyDmg?: typeof verifyDesktopDmg, verifyNativeCli?: typeof verifyNativeCli, smokeApplication?: typeof smokePackagedDesktop, now?: () => Date}} [dependencies]
 */
export async function collectAppleNativeTrustEvidence(options, dependencies = {}) {
  const architecture = options.architecture ?? nativeArchitecture();
  if (process.platform !== 'darwin' && options.architecture === undefined) {
    throw new Error('Apple native trust evidence requires macOS.');
  }
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  const record = await readReleaseRecord(recordPath);
  if (
    record.policy.desktopTrust !== 'developer-id-notarized' ||
    record.stages.at(-1)?.name !== 'macos-cli-authority-established'
  ) {
    throw new Error(
      'Apple native evidence requires established trusted CLI authority.',
    );
  }
  await verifyReleaseArtifacts(record, releaseRoot);
  const producer = JSON.parse(
    await readFile(resolve(options.producerEvidencePath), 'utf8'),
  );
  assertProducerEvidence(producer, record);
  const transformation = producer.transformations.find(
    (/** @type {Record<string, any>} */ entry) => entry.architecture === architecture,
  );
  const packageEntry = producer.packages.find(
    (/** @type {Record<string, any>} */ entry) => entry.architecture === architecture,
  );
  if (transformation === undefined || packageEntry === undefined) {
    throw new Error(`Producer evidence lacks macOS ${architecture}.`);
  }
  const cliPath = resolve(releaseRoot, 'artifacts', transformation.filename);
  const dmgPath = resolve(releaseRoot, 'artifacts', packageEntry.dmg.filename);
  const cliIdentity = await fileIdentity(cliPath);
  const dmgIdentity = await fileIdentity(dmgPath);
  if (
    cliIdentity.bytes !== transformation.signed.bytes ||
    cliIdentity.sha256 !== transformation.signed.sha256 ||
    dmgIdentity.bytes !== packageEntry.dmg.bytes ||
    dmgIdentity.sha256 !== packageEntry.dmg.sha256
  ) {
    throw new Error('Native Apple inputs differ from protected producer evidence.');
  }
  const run = dependencies.run ?? runCommand;
  const cliCodesign = await inspectCodesign(run, cliPath);
  const cliGatekeeper = await inspectGatekeeper(run, cliPath, 'execute');
  const dmgCodesign = await inspectCodesign(run, dmgPath, false);
  const dmgGatekeeper = await inspectGatekeeper(run, dmgPath, 'open');
  const stapler = parseStaplerFacts(
    await runBounded(run, 'xcrun', ['stapler', 'validate', dmgPath]),
  );
  await (dependencies.verifyNativeCli ?? verifyNativeCli)({
    releaseDirectory: resolve(releaseRoot, 'artifacts'),
    workspaceRoot: resolve(options.workspaceRoot ?? process.cwd()),
  });
  let application;
  await (dependencies.verifyDmg ?? verifyDesktopDmg)({
    dmgPath,
    architecture,
    controllerVersion: record.releaseVersion,
    verifyApplication: async (applicationPath) => {
      const helperPath = resolve(
        applicationPath,
        'Contents',
        'Helpers',
        transformation.filename,
      );
      const helper = await fileIdentity(helperPath);
      if (helper.bytes !== cliIdentity.bytes || helper.sha256 !== cliIdentity.sha256) {
        throw new Error('Mounted application helper differs from standalone CLI.');
      }
      const seal = await fileIdentity(
        resolve(applicationPath, 'Contents', '_CodeSignature', 'CodeResources'),
      );
      if (
        seal.bytes !== packageEntry.application.seal.bytes ||
        seal.sha256 !== packageEntry.application.seal.sha256
      ) {
        throw new Error('Mounted application seal differs from producer evidence.');
      }
      const codesign = await inspectCodesign(run, applicationPath);
      const gatekeeper = await inspectGatekeeper(run, applicationPath, 'execute');
      await (dependencies.smokeApplication ?? smokePackagedDesktop)({
        applicationPath,
        controllerVersion: record.releaseVersion,
        artifactVersion: record.releaseVersion,
      });
      application = {
        filename: basename(applicationPath),
        seal,
        codesign,
        gatekeeper,
      };
    },
  });
  if (application === undefined) {
    throw new Error('Mounted application verification did not run.');
  }
  const evidence = {
    schemaVersion: 1,
    kind: 'portreeve-apple-native-trust',
    releaseId: record.releaseId,
    releaseVersion: record.releaseVersion,
    source: { ...record.source },
    policy: { ...record.policy },
    target: { operatingSystem: 'macos', architecture },
    predecessor: transformation.predecessor,
    cli: {
      filename: transformation.filename,
      ...cliIdentity,
      codesign: cliCodesign,
      gatekeeper: cliGatekeeper,
    },
    application,
    dmg: {
      filename: packageEntry.dmg.filename,
      ...dmgIdentity,
      codesign: dmgCodesign,
      notarization: packageEntry.dmg.notarization,
      stapler,
      gatekeeper: dmgGatekeeper,
    },
    checks: {
      deepStrictSignature: true,
      embeddedCliEqual: true,
      nativeCliSmoke: true,
      applicationSmoke: true,
      lifecycleSmoke: true,
    },
    runner: {
      name: process.env.GITHUB_RUN_ID
        ? `github-actions-${process.env.GITHUB_RUN_ID}`
        : 'local',
      operatingSystem: 'darwin',
      architecture,
    },
    verifiedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
  };
  assertAppleNativeTrustEvidence(evidence);
  const outputPath = resolve(
    options.outputPath ??
      resolve(releaseRoot, 'evidence', `apple-native-${architecture}.json`),
  );
  await writeCreateOnce(outputPath, evidence);
  return { outputPath, evidence };
}

/** @param {unknown} value @returns {asserts value is Record<string, any>} */
export function assertAppleNativeTrustEvidence(value) {
  const candidate = /** @type {Record<string, any>} */ (value);
  if (
    value === null ||
    typeof value !== 'object' ||
    candidate.schemaVersion !== 1 ||
    candidate.kind !== 'portreeve-apple-native-trust'
  ) {
    throw new Error('Unsupported Apple native trust evidence schema.');
  }
  if (
    typeof candidate.releaseId !== 'string' ||
    typeof candidate.releaseVersion !== 'string' ||
    typeof candidate.source?.repository !== 'string' ||
    !/^[a-f0-9]{40}$/u.test(String(candidate.source?.commit ?? '')) ||
    candidate.policy?.desktopTrust !== 'developer-id-notarized' ||
    candidate.target?.operatingSystem !== 'macos' ||
    !['arm64', 'x64'].includes(candidate.target?.architecture) ||
    candidate.runner?.operatingSystem !== 'darwin' ||
    candidate.runner?.architecture !== candidate.target.architecture ||
    !Number.isFinite(Date.parse(candidate.verifiedAt))
  ) {
    throw new Error('Apple native trust release or runner identity is invalid.');
  }
  for (const identity of [
    candidate.predecessor,
    candidate.cli,
    candidate.application?.seal,
    candidate.dmg,
  ]) {
    if (
      !Number.isSafeInteger(identity?.bytes) ||
      identity.bytes < 1 ||
      !SHA256.test(String(identity?.sha256 ?? ''))
    ) {
      throw new Error('Apple native trust artifact identity is invalid.');
    }
  }
  if (
    basename(candidate.cli.filename) !== candidate.cli.filename ||
    basename(candidate.application?.filename ?? '') !==
      candidate.application.filename ||
    basename(candidate.dmg.filename) !== candidate.dmg.filename ||
    candidate.predecessor.sha256 === candidate.cli.sha256
  ) {
    throw new Error('Apple native trust topology or transformation is invalid.');
  }
  for (const subject of [candidate.cli, candidate.application, candidate.dmg]) {
    if (
      subject.codesign?.identity !== APPLE_SIGNING_IDENTITY ||
      subject.codesign?.teamId !== APPLE_TEAM_ID ||
      subject.codesign?.secureTimestamp !== true ||
      subject.gatekeeper?.accepted !== true ||
      subject.gatekeeper?.source !== 'Notarized Developer ID' ||
      subject.gatekeeper?.origin !== APPLE_SIGNING_IDENTITY
    ) {
      throw new Error('Apple native trust identity checks are incomplete.');
    }
  }
  if (
    candidate.cli.codesign.hardenedRuntime !== true ||
    candidate.application.codesign.hardenedRuntime !== true ||
    typeof candidate.dmg.codesign.hardenedRuntime !== 'boolean'
  ) {
    throw new Error('Apple native executable hardened-runtime checks are incomplete.');
  }
  if (
    candidate.dmg.notarization?.status !== 'Accepted' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(
      String(candidate.dmg.notarization?.requestId ?? ''),
    ) ||
    candidate.dmg.stapler?.stapled !== true ||
    candidate.dmg.stapler?.validated !== true
  ) {
    throw new Error('Apple notarization or staple evidence is incomplete.');
  }
  for (const check of [
    'deepStrictSignature',
    'embeddedCliEqual',
    'nativeCliSmoke',
    'applicationSmoke',
    'lifecycleSmoke',
  ]) {
    if (candidate.checks?.[check] !== true) {
      throw new Error(`Apple native trust check is incomplete: ${check}`);
    }
  }
}

/**
 * @param {Record<string, any>} record
 * @param {Record<string, any>} producer
 * @param {unknown[]} values
 */
export function aggregateAppleNativeTrustEvidence(record, producer, values) {
  assertProducerEvidence(producer, record);
  const byArchitecture = new Map();
  for (const value of values) {
    assertAppleNativeTrustEvidence(value);
    const candidate = /** @type {Record<string, any>} */ (value);
    const architecture = candidate.target.architecture;
    if (byArchitecture.has(architecture)) {
      throw new Error(`Duplicate Apple native trust evidence: ${architecture}`);
    }
    const transformation = producer.transformations.find(
      (/** @type {Record<string, any>} */ entry) => entry.architecture === architecture,
    );
    const packageEntry = producer.packages.find(
      (/** @type {Record<string, any>} */ entry) => entry.architecture === architecture,
    );
    if (
      candidate.releaseId !== record.releaseId ||
      candidate.releaseVersion !== record.releaseVersion ||
      candidate.source.repository !== record.source.repository ||
      candidate.source.commit !== record.source.commit ||
      JSON.stringify(candidate.policy) !== JSON.stringify(record.policy) ||
      candidate.cli.sha256 !== transformation?.signed.sha256 ||
      candidate.predecessor.sha256 !== transformation?.predecessor.sha256 ||
      candidate.dmg.sha256 !== packageEntry?.dmg.sha256 ||
      candidate.application.seal.sha256 !== packageEntry?.application.seal.sha256
    ) {
      throw new Error(`Apple native trust evidence is stale: ${architecture}`);
    }
    byArchitecture.set(architecture, candidate);
  }
  if (
    !byArchitecture.has('arm64') ||
    !byArchitecture.has('x64') ||
    byArchitecture.size !== 2
  ) {
    throw new Error(
      'Apple native trust aggregation requires ARM64 and Intel evidence.',
    );
  }
  const ordered = ['arm64', 'x64'].map((architecture) =>
    byArchitecture.get(architecture),
  );
  const first = ordered[0];
  return {
    ordered,
    trustEvidence: {
      signatureIdentity: first.cli.codesign.identity,
      teamId: first.cli.codesign.teamId,
      notarizationId: ordered
        .map((entry) => entry.dmg.notarization.requestId)
        .join(','),
      hardenedRuntime: true,
      secureTimestamp: true,
      stapled: true,
      gatekeeperAssessment: 'accepted',
      nativeArchitectures: ['arm64', 'x64'],
    },
  };
}

/** @param {Record<string, any>} producer @param {Record<string, any>} record */
function assertProducerEvidence(producer, record) {
  const authority = record.stages.find(
    (/** @type {Record<string, any>} */ stage) =>
      stage.name === 'macos-cli-authority-established',
  )?.evidence;
  if (
    producer?.schemaVersion !== 1 ||
    producer?.kind !== 'portreeve-apple-trust-producer' ||
    producer.releaseId !== record.releaseId ||
    producer.source?.repository !== record.source.repository ||
    producer.source?.commit !== record.source.commit ||
    producer.publicationAuthority !== false ||
    producer.transformations?.length !== 2 ||
    producer.packages?.length !== 2
  ) {
    throw new Error('Protected producer evidence is invalid or stale.');
  }
  if (
    authority?.mode !== 'developer-id-signed' ||
    !Array.isArray(authority.transformations) ||
    JSON.stringify(authority.transformations) !==
      JSON.stringify(
        producer.transformations.map((/** @type {Record<string, any>} */ entry) => ({
          architecture: entry.architecture,
          filename: entry.filename,
          predecessor: entry.predecessor,
          signed: entry.signed,
        })),
      )
  ) {
    throw new Error('Producer transformations differ from release-record authority.');
  }
  for (const transformation of producer.transformations) {
    const artifact = record.artifacts.find(
      (/** @type {Record<string, any>} */ entry) =>
        entry.type === 'executable' &&
        entry.operatingSystem === 'macos' &&
        entry.architecture === transformation.architecture,
    );
    if (
      artifact?.filename !== transformation.filename ||
      artifact?.bytes !== transformation.signed.bytes ||
      artifact?.sha256 !== transformation.signed.sha256
    ) {
      throw new Error('Producer signed CLI differs from release-record authority.');
    }
  }
}

/** @param {string} path */
async function fileIdentity(path) {
  return { bytes: (await stat(path)).size, sha256: await sha256File(path) };
}

/** @param {typeof runCommand} run @param {string} path @param {boolean} [requireRuntime] */
async function inspectCodesign(run, path, requireRuntime = true) {
  const result = await requireSuccess(run, 'codesign', [
    '--display',
    '--verbose=4',
    path,
  ]);
  return parseCodesignFacts(`${result.stdout}\n${result.stderr}`, { requireRuntime });
}

/** @param {typeof runCommand} run @param {string} path @param {'execute'|'open'} type */
async function inspectGatekeeper(run, path, type) {
  const result = await runBounded(run, 'spctl', [
    '--assess',
    '--type',
    type,
    ...(type === 'open' ? ['--context', 'context:primary-signature'] : []),
    '--verbose=4',
    path,
  ]);
  return parseGatekeeperFacts(result);
}

/** @param {typeof runCommand} run @param {string} command @param {string[]} args */
async function requireSuccess(run, command, args) {
  const result = await runBounded(run, command, args);
  if (result.exitCode !== 0)
    throw new Error(`${command} failed with exit ${result.exitCode}.`);
  return result;
}

/** @param {typeof runCommand} run @param {string} command @param {string[]} args */
function runBounded(run, command, args) {
  return runBoundedAppleCommand(command, args, {
    timeoutMs: COMMAND_TIMEOUT_MS,
    run: (executable, arguments_, { signal }) =>
      run(executable, arguments_, { signal }),
  });
}

/** @param {{releaseDirectory: string, workspaceRoot: string}} options */
async function verifyNativeCli(options) {
  const child = Bun.spawn(
    [
      process.execPath,
      resolve(options.workspaceRoot, 'scripts', 'verify-release.js'),
      '--native',
      '--lifecycle',
    ],
    {
      cwd: options.workspaceRoot,
      env: { ...process.env, PORTREEVE_RELEASE_DIRECTORY: options.releaseDirectory },
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  const code = await child.exited;
  if (code !== 0)
    throw new Error(`Trusted native CLI verification failed with exit ${code}.`);
}

/** @param {string} path @param {unknown} value */
async function writeCreateOnce(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2).concat('\n'), {
      flag: 'wx',
    });
    await link(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

function nativeArchitecture() {
  if (process.arch === 'arm64' || process.arch === 'x64') return process.arch;
  throw new Error(`Unsupported Apple native architecture: ${process.arch}`);
}

/** @param {string} command @param {string[]} args @param {{signal: AbortSignal}} options */
async function runCommand(command, args, options) {
  const child = Bun.spawn([command, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    signal: options.signal,
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:apple-native-evidence')
    .description('Collect native Apple trust evidence from protected artifacts')
    .requiredOption('--record <path>', 'trusted release-record.json path')
    .requiredOption('--producer-evidence <path>', 'protected producer evidence')
    .option('--output <path>', 'create-once native evidence path')
    .action(async (values) => {
      const result = await collectAppleNativeTrustEvidence({
        recordPath: values.record,
        producerEvidencePath: values.producerEvidence,
        outputPath: values.output,
      });
      console.log(result.outputPath);
    });
  await program.parseAsync();
}
