// @ts-check

import { Command } from 'commander';
import { chmod, copyFile, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPackagedDesktop } from './desktop-package-lib.js';
import { renderHomebrewCask } from './desktop-release-lib.js';
import { inspectReleaseCandidate } from './inspect-release-candidate.js';
import { renderHomebrewFormula } from './release-lib.js';
import { readReleaseRecord } from './release-record.js';

const TAP_NAME = 'portreeve/smoke';
export const HOMEBREW_SMOKE_FORMULA = `${TAP_NAME}/portreeve`;
export const HOMEBREW_SMOKE_CASK = `${TAP_NAME}/portreeve-app`;

/**
 * @param {{record: Record<string, any>, releaseRoot: string, stagingRoot: string}}
 * options
 */
export async function stageHomebrewCandidate(options) {
  const versionDirectory = resolve(
    options.stagingRoot,
    `v${options.record.releaseVersion}`,
  );
  await mkdir(versionDirectory, { recursive: true });

  const executables = options.record.artifacts.filter(
    (/** @type {Record<string, any>} */ artifact) => artifact.type === 'executable',
  );
  const desktopDmgs = options.record.artifacts.filter(
    (/** @type {Record<string, any>} */ artifact) => artifact.type === 'desktop-dmg',
  );
  if (executables.length !== 4) {
    throw new Error('Homebrew smoke requires exactly four native executables.');
  }
  if (desktopDmgs.length !== 2) {
    throw new Error('Homebrew smoke requires exactly two Desktop DMGs.');
  }

  for (const artifact of [...executables, ...desktopDmgs]) {
    const source = resolve(options.releaseRoot, artifact.path);
    const destination = resolve(versionDirectory, artifact.filename);
    await copyFile(source, destination);
    if (artifact.type === 'executable') {
      await chmod(destination, 0o755);
    }
  }

  const executableChecksums = Object.fromEntries(
    executables.map((/** @type {Record<string, any>} */ artifact) => [
      artifact.filename,
      artifact.sha256,
    ]),
  );
  const dmgChecksums = Object.fromEntries(
    desktopDmgs.map((/** @type {Record<string, any>} */ artifact) => [
      artifact.architecture,
      artifact.sha256,
    ]),
  );
  if (typeof dmgChecksums.arm64 !== 'string' || typeof dmgChecksums.x64 !== 'string') {
    throw new Error('Homebrew smoke requires ARM64 and x64 Desktop DMG checksums.');
  }

  const baseUrl = pathToFileURL(options.stagingRoot).href;
  return {
    versionDirectory,
    formula: renderHomebrewFormula({
      version: options.record.versions.server,
      releaseVersion: options.record.releaseVersion,
      releaseBaseUrl: baseUrl,
      homepageUrl: baseUrl,
      checksums: executableChecksums,
    }),
    cask: renderHomebrewCask({
      version: options.record.versions.desktop,
      releaseVersion: options.record.releaseVersion,
      releaseBaseUrl: baseUrl,
      homepageUrl: baseUrl,
      checksums: {
        arm64: dmgChecksums.arm64,
        x64: dmgChecksums.x64,
      },
    }),
  };
}

/**
 * @param {{recordPath: string, run?: typeof runCommand}} options
 */
export async function smokeHomebrewCandidate(options) {
  if (process.platform !== 'darwin') {
    throw new Error('The Homebrew candidate smoke requires macOS.');
  }
  const run = options.run ?? runCommand;
  const recordPath = resolve(options.recordPath);
  await inspectReleaseCandidate({ recordPath });
  const releaseRoot = dirname(recordPath);
  const record = await readReleaseRecord(recordPath);

  await requireAbsent(run, ['brew', 'list', '--formula', 'portreeve'], 'formula');
  await requireAbsent(run, ['brew', 'list', '--cask', 'portreeve-app'], 'cask');
  const taps = await requireSuccess(run, ['brew', 'tap'], 'Homebrew tap inventory');
  if (taps.stdout.split(/\r?\n/u).includes(TAP_NAME)) {
    throw new Error(`Refusing to replace existing Homebrew tap ${TAP_NAME}.`);
  }

  const developerState = await requireSuccess(
    run,
    ['brew', 'developer'],
    'Homebrew developer-mode inspection',
  );
  const developerWasEnabled = developerState.stdout.includes('enabled');
  const stagingRoot = await mkdtemp(join(tmpdir(), 'portreeve-homebrew-smoke-'));
  const applicationDirectory = resolve(stagingRoot, 'Applications');
  let tapCreated = false;
  let formulaInstalled = false;
  let caskInstalled = false;
  /** @type {Error | null} */
  let primaryError = null;
  /** @type {Error[]} */
  const cleanupErrors = [];

  try {
    const material = await stageHomebrewCandidate({
      record,
      releaseRoot,
      stagingRoot,
    });
    await mkdir(applicationDirectory, { recursive: true });
    await requireSuccess(
      run,
      ['brew', 'tap-new', '--no-git', TAP_NAME],
      'Homebrew smoke tap creation',
    );
    tapCreated = true;
    const tapRepository = await requireSuccess(
      run,
      ['brew', '--repository', TAP_NAME],
      'Homebrew smoke tap lookup',
    );
    const tapRoot = tapRepository.stdout.trim();
    await mkdir(resolve(tapRoot, 'Formula'), { recursive: true });
    await mkdir(resolve(tapRoot, 'Casks'), { recursive: true });
    await writeFile(resolve(tapRoot, 'Formula', 'portreeve.rb'), material.formula);
    await writeFile(resolve(tapRoot, 'Casks', 'portreeve-app.rb'), material.cask);

    await requireSuccess(
      run,
      ['brew', 'install', HOMEBREW_SMOKE_FORMULA],
      'Homebrew formula installation',
    );
    formulaInstalled = true;
    const prefix = await requireSuccess(
      run,
      ['brew', '--prefix', 'portreeve'],
      'Homebrew formula prefix lookup',
    );
    const executable = resolve(prefix.stdout.trim(), 'bin', 'portreeve');
    const version = await requireSuccess(
      run,
      [executable, '--version'],
      'Homebrew formula executable smoke',
    );
    if (version.stdout.trim() !== record.versions.server) {
      throw new Error(
        `Homebrew formula installed ${version.stdout.trim()}; expected ${record.versions.server}.`,
      );
    }

    await requireSuccess(
      run,
      [
        'brew',
        'install',
        '--cask',
        `--appdir=${applicationDirectory}`,
        HOMEBREW_SMOKE_CASK,
      ],
      'Homebrew cask installation',
    );
    caskInstalled = true;
    const applicationPath = resolve(applicationDirectory, 'PortReeve.app');
    if (!(await stat(applicationPath)).isDirectory()) {
      throw new Error('Homebrew cask did not install PortReeve.app.');
    }
    await verifyPackagedDesktop({
      applicationPath,
      controllerVersion: record.versions.server,
      architecture: process.arch === 'x64' ? 'x64' : 'arm64',
    });
  } catch (error) {
    primaryError = /** @type {Error} */ (error);
  } finally {
    if (caskInstalled) {
      await collectCleanupError(
        cleanupErrors,
        run,
        ['brew', 'uninstall', '--cask', HOMEBREW_SMOKE_CASK],
        'Homebrew cask cleanup',
      );
    }
    if (formulaInstalled) {
      await collectCleanupError(
        cleanupErrors,
        run,
        ['brew', 'uninstall', '--formula', HOMEBREW_SMOKE_FORMULA],
        'Homebrew formula cleanup',
      );
    }
    if (tapCreated) {
      await collectCleanupError(
        cleanupErrors,
        run,
        ['brew', 'untap', TAP_NAME],
        'Homebrew tap cleanup',
      );
    }
    if (!developerWasEnabled) {
      await collectCleanupError(
        cleanupErrors,
        run,
        ['brew', 'developer', 'off'],
        'Homebrew developer-mode cleanup',
      );
    }
    await rm(stagingRoot, { recursive: true, force: true });
  }

  if (primaryError !== null && cleanupErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      'Homebrew candidate smoke and cleanup both failed.',
    );
  }
  if (primaryError !== null) throw primaryError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'Homebrew candidate cleanup failed.');
  }
  return {
    releaseId: record.releaseId,
    serverVersion: record.versions.server,
    desktopVersion: record.versions.desktop,
    formulaInstalled: true,
    caskInstalled: true,
    sourceCandidateModified: false,
  };
}

/** @param {typeof runCommand} run @param {string[]} command @param {string} label */
async function requireAbsent(run, command, label) {
  const result = await run(command);
  if (result.code === 0) {
    throw new Error(`Refusing to replace an existing Homebrew PortReeve ${label}.`);
  }
}

/** @param {typeof runCommand} run @param {string[]} command @param {string} label */
async function requireSuccess(run, command, label) {
  const result = await run(command);
  if (result.code !== 0) {
    throw new Error(`${label} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result;
}

/**
 * @param {Error[]} errors
 * @param {typeof runCommand} run
 * @param {string[]} command
 * @param {string} label
 */
async function collectCleanupError(errors, run, command, label) {
  const result = await run(command);
  if (result.code !== 0) {
    errors.push(
      new Error(`${label} failed: ${result.stderr.trim() || result.stdout.trim()}`),
    );
  }
}

/** @param {string[]} command */
async function runCommand(command) {
  const child = Bun.spawn(command, {
    env: {
      ...process.env,
      HOMEBREW_NO_AUTO_UPDATE: '1',
      HOMEBREW_NO_ENV_HINTS: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('release:homebrew-smoke')
    .description(
      'Install and remove a finalized candidate through a disposable local Homebrew tap',
    )
    .requiredOption('--record <path>', 'finalized release-record.json path')
    .action(async (values) => {
      const result = await smokeHomebrewCandidate({ recordPath: values.record });
      console.log(
        `Verified ${result.releaseId} through temporary formula and cask installations; ` +
          'the candidate, supervision, and PortReeve data were not changed.',
      );
    });
  await program.parseAsync();
}
