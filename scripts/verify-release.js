// @ts-check

import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PortreeveClient } from '../packages/client/src/index.js';
import { PORTREEVE_VERSION } from '../src/version.js';
import {
  inspectExecutable,
  renderChecksumFile,
  renderHomebrewFormula,
  sha256File,
} from './release-lib.js';

const releaseDirectory = resolve('dist', 'release');
const manifest = JSON.parse(
  await readFile(resolve(releaseDirectory, 'manifest.json'), 'utf8'),
);
if (
  manifest.schemaVersion !== 1 ||
  manifest.softwareVersion !== PORTREEVE_VERSION ||
  !Array.isArray(manifest.artifacts)
) {
  throw new Error('Release manifest identity is invalid.');
}

for (const artifact of manifest.artifacts) {
  const path = resolve(releaseDirectory, artifact.filename);
  if ((await sha256File(path)) !== artifact.sha256) {
    throw new Error(`Checksum mismatch for ${artifact.filename}`);
  }
  if (artifact.type === 'executable') {
    const format = await inspectExecutable(path);
    if (
      format.operatingSystem !== artifact.operatingSystem ||
      format.architecture !== artifact.architecture
    ) {
      throw new Error(`Executable format mismatch for ${artifact.filename}`);
    }
    if (((await stat(path)).mode & 0o111) === 0) {
      throw new Error(`Release executable is not executable: ${artifact.filename}`);
    }
  }
}
const checksumDocument = await readFile(
  resolve(releaseDirectory, 'SHA256SUMS'),
  'utf8',
);
if (checksumDocument !== renderChecksumFile(manifest.artifacts)) {
  throw new Error('SHA256SUMS does not match the release manifest.');
}

const ruby = Bun.spawn(['ruby', '-c', resolve(releaseDirectory, 'portreeve.rb')], {
  stdout: 'pipe',
  stderr: 'pipe',
});
const [rubyCode, rubyOutput, rubyError] = await Promise.all([
  ruby.exited,
  new Response(ruby.stdout).text(),
  new Response(ruby.stderr).text(),
]);
if (rubyCode !== 0 || !rubyOutput.includes('Syntax OK')) {
  throw new Error(`Homebrew formula syntax failed: ${rubyError || rubyOutput}`);
}

if (process.argv.includes('--native')) {
  await smokeNativeArtifact(manifest);
}
if (process.argv.includes('--lifecycle')) {
  await smokeNativeLifecycle(manifest);
}
if (process.argv.includes('--homebrew')) {
  await smokeHomebrew(manifest);
}

console.log(
  `Verified ${manifest.artifacts.length} Portreeve ${PORTREEVE_VERSION} release artifacts.`,
);

/** @param {Record<string, any>} releaseManifest */
async function smokeNativeArtifact(releaseManifest) {
  const artifact = nativeArtifact(releaseManifest);
  const executable = resolve(releaseDirectory, artifact.filename);
  await chmod(executable, 0o755);
  await access(executable, constants.X_OK);

  const version = Bun.spawn([executable, '--version'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [versionCode, versionOutput, versionError] = await Promise.all([
    version.exited,
    new Response(version.stdout).text(),
    new Response(version.stderr).text(),
  ]);
  if (versionCode !== 0 || versionOutput.trim() !== PORTREEVE_VERSION) {
    throw new Error(
      `Native version smoke failed (${versionCode}): ${versionError.trim()}`,
    );
  }

  const directory = await mkdtemp(join(tmpdir(), 'portreeve-release-smoke-'));
  const socketPath = join(directory, 'portreeve.sock');
  const server = Bun.spawn([executable, 'serve', '--home', directory], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  try {
    const client = new PortreeveClient({ socketPath });
    let health = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        health = await client.health();
        break;
      } catch {
        await Bun.sleep(20);
      }
    }
    if (health?.softwareVersion !== PORTREEVE_VERSION || health?.mode !== 'manual') {
      throw new Error('Native server smoke did not reach healthy manual mode.');
    }
    await client.stopServer();
    if ((await server.exited) !== 0) {
      throw new Error('Native server did not exit cleanly after protected stop.');
    }
  } finally {
    server.kill('SIGKILL');
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}

/** @param {Record<string, any>} releaseManifest */
async function smokeNativeLifecycle(releaseManifest) {
  const artifact = nativeArtifact(releaseManifest);
  const executable = resolve(releaseDirectory, artifact.filename);
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-lifecycle-smoke-'));
  const applicationDirectory = join(directory, 'state');
  const socketPath = join(applicationDirectory, 'portreeve.sock');
  const uniqueName = `portreeve-release-smoke-${randomUUID()}`;
  const operatorHome = process.env.HOME;
  if (process.platform === 'linux' && !operatorHome) {
    throw new Error('HOME is required for the systemd user lifecycle smoke.');
  }
  const definitionPath =
    process.platform === 'darwin'
      ? join(directory, `${uniqueName}.plist`)
      : join(
          /** @type {string} */ (operatorHome),
          '.config',
          'systemd',
          'user',
          `${uniqueName}.service`,
        );
  const environment = {
    HOME: process.platform === 'darwin' ? directory : operatorHome,
    XDG_CONFIG_HOME:
      process.platform === 'darwin'
        ? join(directory, 'config')
        : join(/** @type {string} */ (operatorHome), '.config'),
    PORTREEVE_HOME: applicationDirectory,
    PORTREEVE_SOCKET: socketPath,
    PORTREEVE_SUPERVISOR_DEFINITION: definitionPath,
    ...(process.platform === 'darwin'
      ? { PORTREEVE_SUPERVISOR_LABEL: `com.portreeve.${uniqueName}` }
      : { PORTREEVE_SUPERVISOR_UNIT: `${uniqueName}.service` }),
  };
  const lifecycleArguments = [
    '--home',
    applicationDirectory,
    '--socket',
    socketPath,
    '--json',
  ];
  let primaryError = null;
  let cleanupError = null;

  try {
    const installation = await runJson(
      [executable, 'install', ...lifecycleArguments],
      environment,
      [0],
      'native lifecycle install',
    );
    if (
      installation.installation?.installed !== true ||
      installation.installation?.active !== false ||
      installation.installation?.upgraded !== false
    ) {
      throw new Error('Native lifecycle install did not preserve inactive state.');
    }

    const started = await runJson(
      [executable, 'start', ...lifecycleArguments],
      environment,
      [0],
      'native lifecycle start',
    );
    assertSupervisedStatus(started.status, 'start');

    const upgraded = await runJson(
      [executable, 'install', ...lifecycleArguments],
      environment,
      [0],
      'native lifecycle active upgrade',
    );
    if (
      upgraded.installation?.upgraded !== true ||
      upgraded.installation?.active !== true
    ) {
      throw new Error('Native lifecycle active upgrade did not remain active.');
    }

    const restarted = await runJson(
      [executable, 'restart', ...lifecycleArguments],
      environment,
      [0],
      'native lifecycle restart',
    );
    assertSupervisedStatus(restarted.status, 'restart');

    const stopped = await runJson(
      [executable, 'stop', ...lifecycleArguments],
      environment,
      [0],
      'native lifecycle stop',
    );
    if (stopped.stop?.changed !== true || stopped.stop?.mode !== 'supervised') {
      throw new Error('Native lifecycle stop did not unload supervision.');
    }

    const inactive = await runJson(
      [executable, 'status', ...lifecycleArguments],
      environment,
      [10],
      'native lifecycle inactive status',
    );
    if (
      inactive.status?.running !== false ||
      inactive.status?.native?.installed !== true ||
      inactive.status?.native?.active !== false
    ) {
      throw new Error('Native lifecycle inactive status is inconsistent.');
    }

    const removed = await runJson(
      [executable, 'uninstall', ...lifecycleArguments],
      environment,
      [0],
      'native lifecycle uninstall',
    );
    if (
      removed.installation?.installed !== false ||
      removed.installation?.dataPreserved !== true
    ) {
      throw new Error('Native lifecycle uninstall did not preserve user data.');
    }
    await access(join(applicationDirectory, 'registry.sqlite'));
    await assertMissing(join(applicationDirectory, 'bin', 'portreeve'));
    await assertMissing(definitionPath);
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
  } finally {
    const stop = await run([executable, 'stop', ...lifecycleArguments], environment);
    if (![0, 10].includes(stop.code)) {
      cleanupError = new Error(`Native lifecycle stop cleanup failed: ${stop.stderr}`);
    }
    const uninstall = await run(
      [executable, 'uninstall', ...lifecycleArguments],
      environment,
    );
    if (uninstall.code !== 0 && cleanupError === null) {
      cleanupError = new Error(
        `Native lifecycle uninstall cleanup failed: ${uninstall.stderr}`,
      );
    }
    await rm(directory, { recursive: true, force: true });
  }

  if (primaryError !== null && cleanupError !== null) {
    throw new AggregateError(
      [primaryError, cleanupError],
      'Native lifecycle smoke and cleanup both failed.',
    );
  }
  if (primaryError !== null) {
    throw primaryError;
  }
  if (cleanupError !== null) {
    throw cleanupError;
  }
}

/** @param {Record<string, any>} releaseManifest */
function nativeArtifact(releaseManifest) {
  const operatingSystem =
    process.platform === 'darwin'
      ? 'macos'
      : process.platform === 'linux'
        ? 'linux'
        : null;
  const architecture = process.arch === 'x64' ? 'x64' : process.arch;
  const artifact = releaseManifest.artifacts.find(
    (/** @type {Record<string, any>} */ candidate) =>
      candidate.type === 'executable' &&
      candidate.operatingSystem === operatingSystem &&
      candidate.architecture === architecture,
  );
  if (artifact === undefined) {
    throw new Error(
      `No native release artifact exists for ${String(operatingSystem)}/${architecture}.`,
    );
  }
  return artifact;
}

/** @param {Record<string, any>} releaseManifest */
async function smokeHomebrew(releaseManifest) {
  if (process.platform !== 'darwin') {
    throw new Error('The Homebrew installation smoke requires macOS.');
  }
  const existing = await run(['brew', 'list', '--formula', 'portreeve']);
  if (existing.code === 0) {
    throw new Error('Refusing to replace an existing Homebrew Portreeve installation.');
  }

  const versionDirectory = resolve(
    releaseDirectory,
    `v${releaseManifest.softwareVersion}`,
  );
  const checksums = Object.fromEntries(
    releaseManifest.artifacts
      .filter(
        (/** @type {Record<string, any>} */ artifact) => artifact.type === 'executable',
      )
      .map((/** @type {Record<string, any>} */ artifact) => [
        artifact.filename,
        artifact.sha256,
      ]),
  );
  const tapName = 'portreeve/smoke';
  const existingTap = await run(['brew', 'tap']);
  if (existingTap.stdout.split(/\r?\n/u).includes(tapName)) {
    throw new Error(`Refusing to replace existing Homebrew tap ${tapName}.`);
  }
  const developerState = await run(['brew', 'developer']);
  const developerWasEnabled = developerState.stdout.includes('enabled');
  let installed = false;
  let tapCreated = false;
  /** @type {Error | null} */
  let cleanupError = null;
  try {
    await mkdir(versionDirectory, { recursive: true });
    for (const artifact of releaseManifest.artifacts.filter(
      (/** @type {Record<string, any>} */ candidate) => candidate.type === 'executable',
    )) {
      await copyFile(
        resolve(releaseDirectory, artifact.filename),
        resolve(versionDirectory, artifact.filename),
      );
    }
    const tap = await run(['brew', 'tap-new', '--no-git', tapName]);
    if (tap.code !== 0) {
      throw new Error(`Homebrew tap creation failed: ${tap.stderr}`);
    }
    tapCreated = true;
    const tapRepository = await run(['brew', '--repository', tapName]);
    if (tapRepository.code !== 0) {
      throw new Error(`Homebrew tap lookup failed: ${tapRepository.stderr}`);
    }
    const formulaPath = join(tapRepository.stdout.trim(), 'Formula', 'portreeve.rb');
    await writeFile(
      formulaPath,
      renderHomebrewFormula({
        version: releaseManifest.softwareVersion,
        releaseBaseUrl: pathToFileURL(releaseDirectory).href,
        homepageUrl: pathToFileURL(releaseDirectory).href,
        checksums,
      }),
      'utf8',
    );
    const installation = await run(['brew', 'install', `${tapName}/portreeve`]);
    if (installation.code !== 0) {
      throw new Error(`Homebrew installation failed: ${installation.stderr}`);
    }
    installed = true;
    const prefix = await run(['brew', '--prefix', 'portreeve']);
    if (prefix.code !== 0) {
      throw new Error(`Homebrew prefix lookup failed: ${prefix.stderr}`);
    }
    const executable = join(prefix.stdout.trim(), 'bin', 'portreeve');
    const result = await run([executable, '--version']);
    if (result.code !== 0 || result.stdout.trim() !== releaseManifest.softwareVersion) {
      throw new Error(`Homebrew executable smoke failed: ${result.stderr}`);
    }
  } finally {
    if (installed) {
      const removal = await run(['brew', 'uninstall', '--formula', 'portreeve']);
      if (removal.code !== 0) {
        cleanupError = new Error(`Homebrew cleanup failed: ${removal.stderr}`);
      }
    }
    if (tapCreated) {
      const removal = await run(['brew', 'untap', tapName]);
      if (removal.code !== 0 && cleanupError === null) {
        cleanupError = new Error(`Homebrew tap cleanup failed: ${removal.stderr}`);
      }
    }
    if (!developerWasEnabled) {
      const developerOff = await run(['brew', 'developer', 'off']);
      if (developerOff.code !== 0 && cleanupError === null) {
        cleanupError = new Error(
          `Homebrew developer-mode cleanup failed: ${developerOff.stderr}`,
        );
      }
    }
    await rm(versionDirectory, { recursive: true, force: true });
  }
  if (cleanupError !== null) {
    throw cleanupError;
  }
}

/** @param {string[]} command */
async function run(command, environment = {}) {
  const child = Bun.spawn(command, {
    env: {
      ...process.env,
      ...environment,
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

/**
 * @param {string[]} command
 * @param {NodeJS.ProcessEnv} environment
 * @param {number[]} expectedCodes
 * @param {string} operation
 */
async function runJson(command, environment, expectedCodes, operation) {
  const result = await run(command, environment);
  if (!expectedCodes.includes(result.code)) {
    throw new Error(
      `${operation} failed (${result.code}): ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${operation} returned invalid JSON: ${result.stdout}`, {
      cause: error,
    });
  }
}

/**
 * @param {Record<string, any> | undefined} status
 * @param {string} operation
 */
function assertSupervisedStatus(status, operation) {
  if (
    status?.running !== true ||
    status.mode !== 'supervised' ||
    status.native?.installed !== true ||
    status.native?.active !== true ||
    status.native?.mainPid !== status.server?.pid
  ) {
    throw new Error(`Native lifecycle ${operation} status is inconsistent.`);
  }
}

/** @param {string} path */
async function assertMissing(path) {
  try {
    await access(path);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      /** @type {{code?: unknown}} */ (error).code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }
  throw new Error(`Expected lifecycle artifact to be removed: ${path}`);
}
