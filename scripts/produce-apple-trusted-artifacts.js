// @ts-check

import { randomUUID } from 'node:crypto';
import { Command } from 'commander';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  APPLE_NOTARY_KEY_NAME,
  APPLE_SIGNING_IDENTITY,
  APPLE_TEAM_ID,
  assertNotarizationCandidate,
  assertAppleSigningConfiguration,
  createNotarizationRecovery,
  nextNotarizationAction,
  parseCodesignFacts,
  parseGatekeeperFacts,
  parseNotarytoolFacts,
  parseNotarytoolSubmissionFacts,
  parseStaplerFacts,
  recordNotarizationObservation,
  runBoundedAppleCommand,
  withAppleCredentialScope,
} from './apple-trust-contract.js';
import {
  createAndVerifyDesktopDmg,
  desktopDmgName,
  verifyDesktopDmg,
} from './desktop-release-lib.js';
import { packageDesktop } from './package-desktop.js';
import {
  assertNativeVerificationMatrix,
  readNativeVerification,
} from './native-release-evidence.js';
import { renderChecksumFile, sha256File } from './release-lib.js';
import {
  advanceReleaseRecord,
  readReleaseRecord,
  verifyReleaseArtifacts,
  writeReleaseRecord,
} from './release-record.js';

const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
const NOTARIZATION_DEADLINE_MS = 30 * 60 * 1000;

/**
 * @typedef {{stdout: string, stderr: string, exitCode: number}} CommandResult
 */

/**
 * @typedef {ReturnType<typeof import('./release-record.js').createReleaseRecord>} ReleaseRecord
 */

/**
 * Produce both architecture-specific trusted macOS artifact sets inside one
 * protected credential scope. The input workspace is never modified.
 *
 * @param {{recordPath: string, qualificationPath: string, outputRoot: string, workspaceRoot?: string, configuration: Parameters<typeof assertAppleSigningConfiguration>[0], githubRef?: string, githubSha?: string, githubRunAttempt?: string}} options
 * @param {{run?: typeof runCommand, credentialLifecycle?: ReturnType<typeof createCredentialLifecycle>, now?: () => Date, packageDesktop?: typeof packageDesktop, createDmg?: typeof createAndVerifyDesktopDmg, verifyDmg?: typeof verifyDesktopDmg}} [dependencies]
 */
export async function produceAppleTrustedArtifacts(options, dependencies = {}) {
  if (process.platform !== 'darwin' && dependencies.run === undefined) {
    throw new Error('Apple trusted-artifact production requires macOS.');
  }
  const configuration = assertAppleSigningConfiguration(options.configuration);
  const recordPath = resolve(options.recordPath);
  const releaseRoot = dirname(recordPath);
  const record = await readReleaseRecord(recordPath);
  const githubRef = options.githubRef ?? process.env.GITHUB_REF;
  const githubSha = options.githubSha ?? process.env.GITHUB_SHA;
  const githubRunAttempt = options.githubRunAttempt ?? process.env.GITHUB_RUN_ATTEMPT;
  const lastStage = record.stages.at(-1)?.name;
  assertProtectedProducerContext({
    ...(githubRef === undefined ? {} : { githubRef }),
    ...(githubSha === undefined ? {} : { githubSha }),
    sourceCommit: record.source.commit,
    desktopTrust: record.policy.desktopTrust,
    ...(githubRunAttempt === undefined ? {} : { githubRunAttempt }),
    ...(lastStage === undefined ? {} : { lastStage }),
  });
  await verifyReleaseArtifacts(record, releaseRoot);
  const qualification = JSON.parse(
    await readFile(resolve(options.qualificationPath), 'utf8'),
  );
  assertQualification(qualification, record);

  const outputRoot = resolve(options.outputRoot);
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot);
  const run = dependencies.run ?? runCommand;
  const lifecycle =
    dependencies.credentialLifecycle ?? createCredentialLifecycle({ run });
  const now = dependencies.now ?? (() => new Date());
  const packageApplication = dependencies.packageDesktop ?? packageDesktop;
  const createDmg = dependencies.createDmg ?? createAndVerifyDesktopDmg;
  const verifyDmg = dependencies.verifyDmg ?? verifyDesktopDmg;
  try {
    return await withAppleCredentialScope(
      configuration,
      lifecycle,
      async (scope, validated) => {
        const workRoot = await mkdtemp(join(tmpdir(), 'portreeve-trust-producer-'));
        try {
          const signedRelease = resolve(workRoot, 'signed-release');
          const signedArtifacts = resolve(signedRelease, 'artifacts');
          await mkdir(signedArtifacts, { recursive: true });
          const manifest = JSON.parse(
            await readFile(resolve(releaseRoot, 'artifacts', 'manifest.json'), 'utf8'),
          );
          /** @type {Array<Record<string, any>>} */
          const transformations = [];
          /** @type {Array<Record<string, any>>} */
          const packages = [];
          const recoveryRoot = resolve(outputRoot, 'recovery');
          const recoveryCandidatesRoot = resolve(recoveryRoot, 'candidates');
          for (const architecture of /** @type {const} */ (['arm64', 'x64'])) {
            const recorded = record.artifacts.find(
              (artifact) =>
                artifact.type === 'executable' &&
                artifact.operatingSystem === 'macos' &&
                artifact.architecture === architecture,
            );
            if (recorded === undefined) {
              throw new Error(`Missing qualified macOS ${architecture} CLI.`);
            }
            const unsignedPath = resolve(releaseRoot, recorded.path);
            const signedPath = resolve(signedArtifacts, recorded.filename);
            await cp(unsignedPath, signedPath);
            await chmod(signedPath, 0o755);
            const predecessor = await fileIdentity(unsignedPath);
            await requireSuccess(
              run,
              'codesign',
              [
                '--force',
                '--options',
                'runtime',
                '--timestamp',
                '--sign',
                validated.identity,
                signedPath,
              ],
              'CLI signing',
            );
            const signed = await fileIdentity(signedPath);
            if (signed.sha256 === predecessor.sha256) {
              throw new Error('Developer ID signing did not transform the macOS CLI.');
            }
            const cliCodesign = await inspectCodesign(run, signedPath);
            const manifestArtifact = manifest.artifacts.find(
              (/** @type {Record<string, any>} */ artifact) =>
                artifact.type === 'executable' &&
                artifact.operatingSystem === 'macos' &&
                artifact.architecture === architecture,
            );
            if (manifestArtifact === undefined) {
              throw new Error(`Release manifest lacks macOS ${architecture}.`);
            }
            manifestArtifact.bytes = signed.bytes;
            manifestArtifact.sha256 = signed.sha256;
            transformations.push({
              architecture,
              filename: recorded.filename,
              predecessor,
              signed,
              codesign: cliCodesign,
            });
          }
          await writeFile(
            resolve(signedArtifacts, 'manifest.json'),
            JSON.stringify(manifest, null, 2).concat('\n'),
          );

          for (const architecture of /** @type {const} */ (['arm64', 'x64'])) {
            const transformation = transformations.find(
              (entry) => entry.architecture === architecture,
            );
            if (transformation === undefined) throw new Error('CLI transform missing.');
            const packaged = await packageApplication({
              workspaceRoot: resolve(options.workspaceRoot ?? process.cwd()),
              releaseDirectory: signedArtifacts,
              outputRoot: resolve(workRoot, 'desktop-work', architecture),
              architecture,
              releaseChannel: record.policy.channel,
              releaseVersion: record.releaseVersion,
              desktopTrust: 'developer-id-notarized',
              signingIdentity: validated.identity,
              smoke: false,
            });
            const embeddedPath = resolve(
              packaged.applicationPath,
              'Contents',
              'Helpers',
              transformation.filename,
            );
            const embedded = await fileIdentity(embeddedPath);
            if (
              embedded.bytes !== transformation.signed.bytes ||
              embedded.sha256 !== transformation.signed.sha256
            ) {
              throw new Error('Application signing changed the authoritative CLI.');
            }
            const embeddedCodesign = await inspectCodesign(run, embeddedPath);
            if (
              JSON.stringify(embeddedCodesign) !==
              JSON.stringify(transformation.codesign)
            ) {
              throw new Error(
                'Embedded CLI Developer ID facts changed during packaging.',
              );
            }
            const temporaryDmgPath = resolve(
              workRoot,
              'dmgs',
              desktopDmgName(record.releaseVersion, architecture),
            );
            await createDmg({
              applicationPath: packaged.applicationPath,
              outputPath: temporaryDmgPath,
              architecture,
              controllerVersion: record.releaseVersion,
            });
            await requireSuccess(
              run,
              'codesign',
              [
                '--force',
                '--timestamp',
                '--sign',
                validated.identity,
                temporaryDmgPath,
              ],
              'DMG signing',
            );
            const dmgCodesign = await inspectCodesign(run, temporaryDmgPath, false);
            const submittedDmgPath = await preserveNotarizationCandidate({
              sourcePath: temporaryDmgPath,
              recoveryCandidatesRoot,
            });
            const notarization = await notarizeDmg({
              dmgPath: submittedDmgPath,
              releaseId: record.releaseId,
              recoveryPath: resolve(recoveryRoot, `notarization-${architecture}.json`),
              scope,
              configuration: validated,
              run,
              now,
            });
            await requireSuccess(
              run,
              'xcrun',
              ['stapler', 'staple', temporaryDmgPath],
              'stapling',
            );
            const staplerResult = await runBounded(run, 'xcrun', [
              'stapler',
              'validate',
              temporaryDmgPath,
            ]);
            const stapler = parseStaplerFacts(staplerResult);
            const gatekeeperResult = await runBounded(run, 'spctl', [
              '--assess',
              '--type',
              'open',
              '--context',
              'context:primary-signature',
              '--verbose=4',
              temporaryDmgPath,
            ]);
            const gatekeeper = parseGatekeeperFacts(gatekeeperResult);
            await verifyDmg({
              dmgPath: temporaryDmgPath,
              architecture,
              controllerVersion: record.releaseVersion,
              verifyApplication: async (mountedApplicationPath) => {
                const mountedHelper = resolve(
                  mountedApplicationPath,
                  'Contents',
                  'Helpers',
                  transformation.filename,
                );
                const mountedIdentity = await fileIdentity(mountedHelper);
                if (
                  mountedIdentity.bytes !== transformation.signed.bytes ||
                  mountedIdentity.sha256 !== transformation.signed.sha256
                ) {
                  throw new Error('Mounted DMG changed the authoritative CLI.');
                }
                const mountedCodesign = await inspectCodesign(run, mountedHelper);
                if (
                  JSON.stringify(mountedCodesign) !==
                  JSON.stringify(transformation.codesign)
                ) {
                  throw new Error('Mounted CLI Developer ID facts changed.');
                }
                await inspectCodesign(run, mountedApplicationPath);
              },
            });
            packages.push({
              architecture,
              cliSha256: transformation.signed.sha256,
              application: {
                filename: basename(packaged.applicationPath),
                seal: await fileIdentity(
                  resolve(
                    packaged.applicationPath,
                    'Contents',
                    '_CodeSignature',
                    'CodeResources',
                  ),
                ),
                codesign: await inspectCodesign(run, packaged.applicationPath),
              },
              dmg: {
                filename: basename(temporaryDmgPath),
                ...(await fileIdentity(temporaryDmgPath)),
                codesign: dmgCodesign,
                notarization,
                stapler,
                gatekeeper,
              },
            });
          }

          const preliminaryVerifications = assertNativeVerificationMatrix(
            record,
            await readPreliminaryVerifications(releaseRoot),
          );
          const { evidenceRoot, stateRoot, trustedRecord } =
            await stageTrustedReleaseArtifacts({
              releaseRoot,
              outputRoot,
              signedArtifacts,
              dmgRoot: resolve(workRoot, 'dmgs'),
              record,
              packages,
              transformations,
            });
          const authoritativeRecord = advanceReleaseRecord(
            trustedRecord,
            'macos-cli-authority-established',
            {
              mode: 'developer-id-signed',
              architectures: ['arm64', 'x64'],
              targets: ['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'],
              verificationCount: preliminaryVerifications.length,
              verifications: preliminaryVerifications,
              transformations: transformations.map(
                ({ architecture, filename, predecessor, signed }) => ({
                  architecture,
                  filename,
                  predecessor,
                  signed,
                }),
              ),
            },
            now,
          );
          await verifyReleaseArtifacts(authoritativeRecord, outputRoot);
          await writeReleaseRecord(
            resolve(outputRoot, 'release-record.json'),
            authoritativeRecord,
          );
          await Promise.all([
            writeReleaseRecord(
              resolve(stateRoot, 'release-record.json'),
              authoritativeRecord,
            ),
            cp(
              options.qualificationPath,
              resolve(stateRoot, 'trust-qualification.json'),
            ),
            cp(
              resolve(signedArtifacts, 'manifest.json'),
              resolve(stateRoot, 'signed-manifest.json'),
            ),
          ]);
          const evidence = {
            schemaVersion: 1,
            kind: 'portreeve-apple-trust-producer',
            releaseId: record.releaseId,
            source: { ...record.source },
            producer: { operatingSystem: process.platform, architecture: process.arch },
            configuration: {
              identity: validated.identity,
              teamId: validated.teamId,
              keyId: validated.keyId,
              issuerId: validated.issuerId,
              keyName: validated.keyName,
            },
            transformations,
            packages,
            publicationAuthority: false,
            producedAt: now().toISOString(),
          };
          const evidencePath = resolve(evidenceRoot, 'apple-trust-producer.json');
          await writeFile(
            evidencePath,
            JSON.stringify(evidence, null, 2).concat('\n'),
            {
              flag: 'wx',
            },
          );
          await rm(recoveryCandidatesRoot, { recursive: true, force: true });
          return { outputRoot, evidencePath, evidence };
        } finally {
          await rm(workRoot, { recursive: true, force: true });
        }
      },
    );
  } catch (error) {
    const recoveryEntries = await readdir(resolve(outputRoot, 'recovery')).catch(
      () => [],
    );
    if (recoveryEntries.length === 0) {
      await rm(outputRoot, { recursive: true, force: true });
    }
    throw error;
  }
}

/**
 * Preserve the exact pre-staple bytes submitted to Apple independently from
 * the working DMG that stapling and later verification may mutate.
 * @param {{sourcePath: string, recoveryCandidatesRoot: string}} options
 */
export async function preserveNotarizationCandidate(options) {
  await mkdir(options.recoveryCandidatesRoot, { recursive: true });
  const submittedPath = resolve(
    options.recoveryCandidatesRoot,
    basename(options.sourcePath),
  );
  await cp(options.sourcePath, submittedPath, {
    errorOnExist: true,
    force: false,
  });
  return submittedPath;
}

/**
 * Stage transformed executables and DMGs over one untouched copy of the
 * qualified artifact set, then perform the single authoritative metadata
 * rewrite from predecessor identities to signed identities.
 *
 * @param {{releaseRoot: string, outputRoot: string, signedArtifacts: string, dmgRoot: string, record: ReleaseRecord, packages: Array<Record<string, any>>, transformations: Array<Record<string, any>>}} options
 */
export async function stageTrustedReleaseArtifacts(options) {
  const artifactsRoot = resolve(options.outputRoot, 'artifacts');
  const evidenceRoot = resolve(options.outputRoot, 'evidence');
  const stateRoot = resolve(options.outputRoot, 'release-state');
  await cp(resolve(options.releaseRoot, 'artifacts'), artifactsRoot, {
    recursive: true,
  });
  await Promise.all([
    mkdir(evidenceRoot, { recursive: true }),
    mkdir(stateRoot, { recursive: true }),
  ]);
  for (const transformation of options.transformations) {
    await cp(
      resolve(options.signedArtifacts, transformation.filename),
      resolve(artifactsRoot, transformation.filename),
    );
  }
  for (const entry of options.packages) {
    await cp(
      resolve(options.dmgRoot, entry.dmg.filename),
      resolve(artifactsRoot, entry.dmg.filename),
    );
  }
  const trustedRecord = structuredClone(options.record);
  for (const transformation of options.transformations) {
    const artifact = trustedRecord.artifacts.find(
      (/** @type {Record<string, any>} */ entry) =>
        entry.type === 'executable' &&
        entry.operatingSystem === 'macos' &&
        entry.architecture === transformation.architecture,
    );
    if (
      artifact === undefined ||
      artifact.filename !== transformation.filename ||
      artifact.bytes !== transformation.predecessor.bytes ||
      artifact.sha256 !== transformation.predecessor.sha256
    ) {
      throw new Error(
        'Signed CLI predecessor differs from the qualified release record.',
      );
    }
    artifact.bytes = transformation.signed.bytes;
    artifact.sha256 = transformation.signed.sha256;
  }
  await rewriteTrustedReleaseMetadata({
    releaseRoot: options.outputRoot,
    record: trustedRecord,
    transformations: options.transformations,
  });
  return { artifactsRoot, evidenceRoot, stateRoot, trustedRecord };
}

/**
 * Rewrite the metadata that names transformed macOS CLI bytes and synchronize
 * the corresponding release-record artifact identities.
 *
 * @param {{releaseRoot: string, record: Record<string, any>, transformations: Array<Record<string, any>>}} options
 */
export async function rewriteTrustedReleaseMetadata(options) {
  const artifactsRoot = resolve(options.releaseRoot, 'artifacts');
  const manifestPath = resolve(artifactsRoot, 'manifest.json');
  const formulaPath = resolve(artifactsRoot, 'portreeve.rb');
  const checksumsPath = resolve(artifactsRoot, 'SHA256SUMS');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  let formula = await readFile(formulaPath, 'utf8');
  for (const transformation of options.transformations) {
    const manifestArtifact = manifest.artifacts?.find(
      (/** @type {Record<string, any>} */ entry) =>
        entry.type === 'executable' &&
        entry.operatingSystem === 'macos' &&
        entry.architecture === transformation.architecture &&
        entry.filename === transformation.filename,
    );
    if (
      manifestArtifact === undefined ||
      manifestArtifact.bytes !== transformation.predecessor.bytes ||
      manifestArtifact.sha256 !== transformation.predecessor.sha256
    ) {
      throw new Error('Trusted manifest predecessor identity is invalid.');
    }
    const occurrences = formula.split(transformation.predecessor.sha256).length - 1;
    if (occurrences !== 1) {
      throw new Error('Trusted formula predecessor checksum is invalid.');
    }
    manifestArtifact.bytes = transformation.signed.bytes;
    manifestArtifact.sha256 = transformation.signed.sha256;
    formula = formula.replace(
      transformation.predecessor.sha256,
      transformation.signed.sha256,
    );
  }
  await writeFile(formulaPath, formula, 'utf8');
  const formulaIdentity = await fileIdentity(formulaPath);
  const manifestFormula = manifest.artifacts?.find(
    (/** @type {Record<string, any>} */ entry) =>
      entry.type === 'homebrew-formula' && entry.filename === 'portreeve.rb',
  );
  if (manifestFormula === undefined) {
    throw new Error('Trusted manifest lacks its Homebrew formula.');
  }
  manifestFormula.bytes = formulaIdentity.bytes;
  manifestFormula.sha256 = formulaIdentity.sha256;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2).concat('\n'), 'utf8');
  await writeFile(checksumsPath, renderChecksumFile(manifest.artifacts), 'utf8');
  for (const filename of ['portreeve.rb', 'manifest.json', 'SHA256SUMS']) {
    const artifact = options.record.artifacts.find(
      (/** @type {Record<string, any>} */ entry) => entry.filename === filename,
    );
    if (artifact === undefined) {
      throw new Error(`Trusted release record lacks ${filename}.`);
    }
    const identity = await fileIdentity(resolve(artifactsRoot, filename));
    artifact.bytes = identity.bytes;
    artifact.sha256 = identity.sha256;
  }
}

/** @param {string} releaseRoot */
async function readPreliminaryVerifications(releaseRoot) {
  const evidenceRoot = resolve(releaseRoot, 'evidence');
  const names = (await readdir(evidenceRoot))
    .filter((name) => /^native-(?:macos|linux)-(?:arm64|x64)\.json$/u.test(name))
    .sort();
  return Promise.all(
    names.map((name) => readNativeVerification(resolve(evidenceRoot, name))),
  );
}

/** @param {{githubRef?: string, githubSha?: string, githubRunAttempt?: string, sourceCommit: string, desktopTrust: string, lastStage?: string}} context */
export function assertProtectedProducerContext(context) {
  if (context.githubRef !== 'refs/heads/main') {
    throw new Error('Apple trusted-artifact production is main-only.');
  }
  if (context.githubSha !== context.sourceCommit) {
    throw new Error(
      'Protected producer source does not match the pinned release commit.',
    );
  }
  if (context.githubRunAttempt !== undefined && context.githubRunAttempt !== '1') {
    throw new Error(
      'Apple trusted-artifact production cannot be rerun after a protected attempt; dispatch the next unused preview version.',
    );
  }
  if (context.desktopTrust !== 'developer-id-notarized') {
    throw new Error('Protected producer requires Developer ID notarization policy.');
  }
  if (context.lastStage !== 'candidate-qualified') {
    throw new Error(
      'Protected producer requires a credential-free qualified candidate.',
    );
  }
}

/** @param {Record<string, any>} qualification @param {Record<string, any>} record */
function assertQualification(qualification, record) {
  if (
    qualification.schemaVersion !== 1 ||
    qualification.kind !== 'portreeve-trust-qualification' ||
    qualification.releaseId !== record.releaseId ||
    qualification.source?.commit !== record.source.commit ||
    qualification.source?.repository !== record.source.repository ||
    qualification.credentialAccess !== false ||
    qualification.targets?.join(',') !== 'macos-arm64,macos-x64,linux-arm64,linux-x64'
  ) {
    throw new Error('Protected producer qualification evidence is invalid.');
  }
}

/**
 * @param {{run: typeof runCommand}} options
 * @returns {{capture: () => Promise<string[]>, prepare: (configuration: ReturnType<typeof assertAppleSigningConfiguration>, captured: string[]) => Promise<{root: string, keychain: string, notaryKey: string}>, cleanup: (scope: {root: string, keychain: string, notaryKey: string}|undefined, captured: string[]) => Promise<void>}}
 */
export function createCredentialLifecycle(options) {
  /** @type {{root: string, keychain: string, notaryKey: string}|undefined} */
  let active;
  return {
    capture: async () => {
      const result = await requireSuccess(
        options.run,
        'security',
        ['list-keychains', '-d', 'user'],
        'keychain capture',
      );
      return [...result.stdout.matchAll(/"([^"]+)"/gu)]
        .map((match) => match[1])
        .filter((path) => path !== undefined);
    },
    prepare: async (configuration, captured) => {
      const secrets = readCredentialSecrets();
      const root = await mkdtemp(join(tmpdir(), 'portreeve-apple-credentials-'));
      await chmod(root, 0o700);
      const keychain = resolve(root, 'release.keychain-db');
      const certificate = resolve(root, 'developer-id.p12');
      const notaryKey = resolve(root, `AuthKey_${configuration.keyId}.p8`);
      active = { root, keychain, notaryKey };
      const keychainPassword = `${randomUUID()}${randomUUID()}`;
      await writePrivateBase64(certificate, secrets.certificateBase64);
      await writePrivateBase64(notaryKey, secrets.notaryKeyBase64);
      await requireSuccess(
        options.run,
        'security',
        ['create-keychain', '-p', keychainPassword, keychain],
        'keychain creation',
      );
      await requireSuccess(
        options.run,
        'security',
        ['unlock-keychain', '-p', keychainPassword, keychain],
        'keychain unlock',
      );
      await requireSuccess(
        options.run,
        'security',
        [
          'import',
          certificate,
          '-k',
          keychain,
          '-P',
          secrets.certificatePassword,
          '-T',
          '/usr/bin/codesign',
          '-T',
          '/usr/bin/security',
        ],
        'certificate import',
      );
      await requireSuccess(
        options.run,
        'security',
        [
          'set-key-partition-list',
          '-S',
          'apple-tool:,apple:',
          '-s',
          '-k',
          keychainPassword,
          keychain,
        ],
        'keychain partition configuration',
      );
      await requireSuccess(
        options.run,
        'security',
        ['list-keychains', '-d', 'user', '-s', keychain, ...captured],
        'keychain activation',
      );
      return active;
    },
    cleanup: async (scope, captured) => {
      /** @type {unknown[]} */
      const failures = [];
      try {
        await requireSuccess(
          options.run,
          'security',
          ['list-keychains', '-d', 'user', '-s', ...captured],
          'keychain restoration',
        );
      } catch (error) {
        failures.push(error);
      }
      const cleanupScope = scope ?? active;
      if (cleanupScope !== undefined) {
        try {
          await requireSuccess(
            options.run,
            'security',
            ['delete-keychain', cleanupScope.keychain],
            'ephemeral keychain deletion',
          );
        } catch (error) {
          failures.push(error);
        }
        try {
          await rm(cleanupScope.root, { recursive: true, force: true });
        } catch (error) {
          failures.push(error);
        }
      }
      active = undefined;
      if (failures.length > 0) {
        throw new AggregateError(failures, 'Apple credential cleanup failed.');
      }
    },
  };
}

function readCredentialSecrets() {
  return {
    certificateBase64: requiredEnvironment('PORTREEVE_APPLE_CERTIFICATE_P12_BASE64'),
    certificatePassword: requiredEnvironment('PORTREEVE_APPLE_CERTIFICATE_PASSWORD'),
    notaryKeyBase64: requiredEnvironment('PORTREEVE_APPLE_NOTARY_KEY_P8_BASE64'),
  };
}

/** @param {string} path @param {string} encoded */
async function writePrivateBase64(path, encoded) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error('Apple credential material is not valid base64.');
  }
  const content = Buffer.from(encoded, 'base64');
  if (content.length === 0 || content.toString('base64') !== encoded) {
    throw new Error('Apple credential material is not canonical base64.');
  }
  await writeFile(path, content, { mode: 0o600, flag: 'wx' });
}

/** @param {typeof runCommand} run @param {string} path @param {boolean} [requireRuntime] */
async function inspectCodesign(run, path, requireRuntime = true) {
  const result = await requireSuccess(
    run,
    'codesign',
    ['--display', '--verbose=4', path],
    'codesign inspection',
  );
  return parseCodesignFacts(`${result.stdout}\n${result.stderr}`, { requireRuntime });
}

/**
 * @param {{
 *   dmgPath: string,
 *   releaseId: string,
 *   recoveryPath?: string,
 *   recovery?: ReturnType<typeof createNotarizationRecovery>,
 *   persistRecovery?: (recovery: ReturnType<typeof createNotarizationRecovery>) => Promise<void>,
 *   scope: {notaryKey: string},
 *   configuration: ReturnType<typeof assertAppleSigningConfiguration>,
 *   run: typeof runCommand,
 *   now: () => Date,
 *   sleep?: (milliseconds: number) => Promise<void>,
 * }} options
 */
export async function notarizeDmg(options) {
  const candidate = {
    releaseId: options.releaseId,
    sha256: await sha256File(options.dmgPath),
  };
  const startedAt = options.now().toISOString();
  /** @type {ReturnType<typeof createNotarizationRecovery>} */
  let recovery =
    options.recovery ??
    createNotarizationRecovery({
      ...candidate,
      startedAt,
      deadlineAt: new Date(
        Date.parse(startedAt) + NOTARIZATION_DEADLINE_MS,
      ).toISOString(),
    });
  assertNotarizationCandidate(recovery, candidate);
  const recoveryPath = options.recoveryPath;
  const persistRecovery =
    options.persistRecovery ??
    (recoveryPath === undefined
      ? undefined
      : async (value) => persistRecoveryEvidence(recoveryPath, value));
  if (persistRecovery === undefined) {
    throw new Error('Notarization recovery persistence is required.');
  }
  const sleep =
    options.sleep ??
    ((milliseconds) =>
      new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)));
  await persistRecovery(recovery);

  while (true) {
    const now = options.now().toISOString();
    const nextAction = nextNotarizationAction(recovery, now);
    if (nextAction.action === 'accepted') {
      return {
        requestId: recovery.currentRequestId,
        status: 'Accepted',
        recovery,
      };
    }
    if (nextAction.action === 'blocked') {
      const lastStatus = recovery.history.at(-1)?.status;
      const reason =
        typeof lastStatus === 'string'
          ? `status ${lastStatus}`
          : (nextAction.reason ?? 'indeterminate state');
      throw new Error(`Apple notarization blocked: ${reason}.`);
    }
    if (nextAction.action === 'submit') {
      const submit = await runBounded(options.run, 'xcrun', [
        'notarytool',
        'submit',
        options.dmgPath,
        '--key',
        options.scope.notaryKey,
        '--key-id',
        options.configuration.keyId,
        '--issuer',
        options.configuration.issuerId,
        '--output-format',
        'json',
      ]);
      let submitted;
      let parseError;
      try {
        submitted = parseNotarytoolSubmissionFacts(submit.stdout);
      } catch (error) {
        parseError = error;
        const requestId = salvageNotarizationRequestId(submit.stdout);
        if (requestId !== null) submitted = { requestId };
      }
      const observedAt = options.now().toISOString();
      if (submitted === undefined) {
        recovery = recordNotarizationObservation(
          recovery,
          {
            kind: 'submission-indeterminate',
            diagnostic:
              submit.exitCode === 0
                ? 'notarytool submit returned malformed success output without a recoverable request ID'
                : `notarytool submit exited ${submit.exitCode} without a recoverable request ID`,
          },
          observedAt,
        );
      } else {
        recovery = recordNotarizationObservation(
          recovery,
          {
            kind: 'request-created',
            requestId: submitted.requestId,
            ...(submitted.status === undefined ? {} : { status: submitted.status }),
            ...(submit.exitCode === 0 && parseError === undefined
              ? {}
              : {
                  diagnostic:
                    submit.exitCode === 0
                      ? 'notarytool submit returned an unsupported status; request ID preserved'
                      : `notarytool submit exited ${submit.exitCode}; request ID preserved`,
                }),
          },
          observedAt,
        );
      }
      await persistRecovery(recovery);
      if (submit.exitCode !== 0) {
        throw new Error(`notarization submission failed with exit ${submit.exitCode}.`);
      }
      if (parseError !== undefined) throw parseError;
      continue;
    }

    await sleep(15_000);
    const pollAt = options.now().toISOString();
    if (Date.parse(pollAt) > Date.parse(recovery.deadlineAt)) {
      throw new Error('Apple notarization deadline expired.');
    }
    const poll = await runBounded(options.run, 'xcrun', [
      'notarytool',
      'info',
      nextAction.requestId,
      '--key',
      options.scope.notaryKey,
      '--key-id',
      options.configuration.keyId,
      '--issuer',
      options.configuration.issuerId,
      '--output-format',
      'json',
    ]);
    if (poll.exitCode !== 0) {
      recovery = recordNotarizationObservation(
        recovery,
        {
          kind: 'poll-indeterminate',
          requestId: nextAction.requestId,
          diagnostic: `notarytool info exited ${poll.exitCode}`,
        },
        pollAt,
      );
      await persistRecovery(recovery);
      throw new Error(`notarization polling failed with exit ${poll.exitCode}.`);
    }
    let polled;
    try {
      polled = parseNotarytoolFacts(poll.stdout);
    } catch (error) {
      recovery = recordNotarizationObservation(
        recovery,
        {
          kind: 'poll-indeterminate',
          requestId: nextAction.requestId,
          diagnostic: 'notarytool info returned malformed output',
        },
        pollAt,
      );
      await persistRecovery(recovery);
      throw error;
    }
    recovery = recordNotarizationObservation(
      recovery,
      {
        kind: 'poll',
        requestId: polled.requestId,
        status: polled.status,
      },
      pollAt,
    );
    await persistRecovery(recovery);
  }
}

/** @param {string} output */
function salvageNotarizationRequestId(output) {
  try {
    const value = JSON.parse(output);
    return parseNotarytoolSubmissionFacts(JSON.stringify({ id: value?.id })).requestId;
  } catch {
    return null;
  }
}

/** @param {string} path @param {ReturnType<typeof createNotarizationRecovery>} recovery */
async function persistRecoveryEvidence(path, recovery) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(recovery, null, 2).concat('\n'), {
    flag: 'wx',
  });
  await rename(temporaryPath, path);
}

/** @param {string} path */
async function fileIdentity(path) {
  return { bytes: (await stat(path)).size, sha256: await sha256File(path) };
}

/** @param {typeof runCommand} run @param {string} command @param {string[]} args */
function runBounded(run, command, args) {
  return runBoundedAppleCommand(command, args, {
    timeoutMs: COMMAND_TIMEOUT_MS,
    run: async (executable, arguments_, { signal }) =>
      run(executable, arguments_, { signal }),
  });
}

/** @param {typeof runCommand} run @param {string} command @param {string[]} args @param {string} action */
async function requireSuccess(run, command, args, action) {
  const result = await runBounded(run, command, args);
  if (result.exitCode !== 0) {
    throw new Error(`${action} failed with exit ${result.exitCode}.`);
  }
  return result;
}

/** @param {string} command @param {string[]} args @param {{signal: AbortSignal}} options @returns {Promise<CommandResult>} */
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

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:produce-apple-trust')
    .description('Produce both trusted macOS artifact sets without publishing')
    .requiredOption('--record <path>', 'qualified release-record.json path')
    .requiredOption('--qualification <path>', 'credential-free qualification')
    .requiredOption('--output <path>', 'new intentional trusted output root')
    .action(async (values) => {
      const result = await produceAppleTrustedArtifacts({
        recordPath: values.record,
        qualificationPath: values.qualification,
        outputRoot: values.output,
        configuration: {
          identity: process.env.PORTREEVE_APPLE_SIGNING_IDENTITY,
          teamId: process.env.PORTREEVE_APPLE_TEAM_ID,
          keyId: process.env.PORTREEVE_APPLE_NOTARY_KEY_ID,
          issuerId: process.env.PORTREEVE_APPLE_NOTARY_ISSUER_ID,
          keyName: process.env.PORTREEVE_APPLE_NOTARY_KEY_NAME,
        },
      });
      console.log(result.outputRoot);
    });
  await program.parseAsync();
}

export const APPLE_PRODUCER_POLICY = Object.freeze({
  identity: APPLE_SIGNING_IDENTITY,
  teamId: APPLE_TEAM_ID,
  keyName: APPLE_NOTARY_KEY_NAME,
});
