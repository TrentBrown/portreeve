// @ts-check

import { extractFile, listPackage } from '@electron/asar';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { resolveBundledReleaseCandidate } from '../apps/desktop/main/artifact.js';
import { inspectExecutable } from './release-lib.js';

const SMOKE_PREFIX = 'PORTREEVE_DESKTOP_SMOKE ';
const OUTPUT_LIMIT = 64 * 1024;

/** @param {string} controllerVersion @param {string} artifactVersion */
export function assertDesktopPackageIdentity(controllerVersion, artifactVersion) {
  if (controllerVersion !== artifactVersion) {
    throw new Error(
      `Desktop controller ${controllerVersion} does not match release artifact ${artifactVersion}.`,
    );
  }
}

/** @param {string[]} inputs */
export function assertDesktopModuleGraph(inputs) {
  const normalized = inputs.map((input) => input.replaceAll('\\', '/'));
  for (const required of [
    '/apps/desktop/main/artifact.js',
    '/apps/desktop/main/lifecycle-controller.js',
    '/apps/desktop/main/mcp-setup-adapter.js',
    '/src/mcp/setup.js',
    '/src/supervision/service.js',
  ]) {
    if (!normalized.some((input) => `/${input}`.endsWith(required))) {
      throw new Error(`Desktop bundle is missing required module ${required}.`);
    }
  }
  if (
    normalized.some((input) =>
      `/${input}`.endsWith('/apps/desktop/main/cli-adapter.js'),
    )
  ) {
    throw new Error('Desktop bundle still includes the retired lifecycle CLI adapter.');
  }
}

/**
 * @param {{packageDocument: string, verificationDocument: string, mainBundle: string, preloadBundle: string, rendererDocument: string, rendererBundle: string, guideViewBundle: string, guideBundleDocument: string, controllerVersion: string, artifactVersion: string, artifactSha256: string, architecture: 'arm64'|'x64'}} options
 */
export function assertPackagedDesktopContents(options) {
  const metadata = JSON.parse(options.packageDocument);
  const verification = JSON.parse(options.verificationDocument);
  if (
    metadata.main !== 'main/index.js' ||
    metadata.version !== options.controllerVersion ||
    verification.schemaVersion !== 1 ||
    verification.controllerVersion !== options.controllerVersion ||
    verification.artifactVersion !== options.artifactVersion ||
    verification.artifactSha256 !== options.artifactSha256 ||
    verification.architecture !== options.architecture ||
    verification.moduleGraph?.directLifecycleController !== true ||
    verification.moduleGraph?.verifiedArtifactResolver !== true ||
    verification.moduleGraph?.mcpSetupGenerator !== true ||
    verification.moduleGraph?.lifecycleCliAdapter !== false
  ) {
    throw new Error('Packaged Desktop identity attestation is invalid.');
  }
  if (
    !options.guideBundleDocument.startsWith('export const CLIENT_GUIDES_ATTESTATION') ||
    !options.guideBundleDocument.includes(
      `generatedForVersion: '${options.controllerVersion}'`,
    ) ||
    !options.guideBundleDocument.includes('cliCommands: 49') ||
    !options.guideBundleDocument.includes('mcpTools: 51')
  ) {
    throw new Error('Packaged Desktop client guide bundle is invalid or stale.');
  }
  for (const marker of [
    'controller_artifact_version_mismatch',
    'generateMcpSetup',
    'portreeve:desktop:generate-mcp-setup',
    'sourceExecutable',
    SMOKE_PREFIX.trim(),
  ]) {
    if (!options.mainBundle.includes(marker)) {
      throw new Error(`Packaged Desktop main bundle is missing ${marker}.`);
    }
  }
  for (const marker of [
    "from './generated/client-guides.js'",
    'createClientGuideView',
    'clientInstallationEvidence',
  ]) {
    if (!options.rendererBundle.includes(marker)) {
      throw new Error(`Packaged Desktop renderer bundle is missing ${marker}.`);
    }
  }
  const guideRuntime = `${options.rendererBundle}\n${options.guideViewBundle}`;
  for (const prohibited of [
    'fetch(',
    'innerHTML',
    'DOMParser',
    'marked',
    'markdown-it',
  ]) {
    if (guideRuntime.includes(prohibited)) {
      throw new Error(
        `Packaged Desktop guide runtime contains prohibited marker ${prohibited}.`,
      );
    }
  }
  for (const marker of [
    'portreeve:desktop:generate-mcp-setup',
    'generateMcpSetup',
    'requireMcpSetup',
  ]) {
    if (!options.preloadBundle.includes(marker)) {
      throw new Error(`Packaged Desktop preload is missing ${marker}.`);
    }
  }
  for (const marker of [
    'data-view="mcp"',
    'data-view="cli"',
    'id="mcp-setup-form"',
    'id="mcp-configuration"',
    'id="mcp-guide-content"',
    'id="cli-guide-content"',
  ]) {
    if (!options.rendererDocument.includes(marker)) {
      throw new Error(`Packaged Desktop renderer is missing ${marker}.`);
    }
  }
  for (const retiredMarker of [
    'invalid_lifecycle_json',
    'invalid_lifecycle_envelope',
    'The bundled PortReeve CLI could not be started.',
  ]) {
    if (options.mainBundle.includes(retiredMarker)) {
      throw new Error(
        `Packaged Desktop main bundle contains retired CLI adapter marker ${retiredMarker}.`,
      );
    }
  }
}

/**
 * @param {{applicationPath: string, controllerVersion: string, architecture: 'arm64'|'x64'}} options
 */
export async function verifyPackagedDesktop(options) {
  const resourcesRoot = resolve(options.applicationPath, 'Contents', 'Resources');
  const executableFormat = await inspectExecutable(
    resolve(options.applicationPath, 'Contents', 'MacOS', 'PortReeve'),
  );
  if (
    executableFormat.operatingSystem !== 'macos' ||
    executableFormat.architecture !== options.architecture
  ) {
    throw new Error('Packaged Desktop executable architecture is invalid.');
  }
  const artifact = await resolveBundledReleaseCandidate({
    resourcesRoot,
    platform: 'darwin',
    architecture: options.architecture,
  });
  assertDesktopPackageIdentity(options.controllerVersion, artifact.version);

  const asarPath = resolve(resourcesRoot, 'app.asar');
  const entries = listPackage(asarPath, { isPack: false });
  for (const required of [
    '/package.json',
    '/desktop-verification.json',
    '/main/index.js',
    '/preload/index.cjs',
    '/renderer/index.html',
    '/renderer/renderer.js',
    '/renderer/client-guide-model.js',
    '/renderer/client-guide-view.js',
    '/renderer/generated/client-guides.js',
  ]) {
    if (!entries.includes(required)) {
      throw new Error(`Packaged Desktop ASAR is missing ${required}.`);
    }
  }
  assertPackagedDesktopContents({
    packageDocument: extractFile(asarPath, 'package.json').toString('utf8'),
    verificationDocument: extractFile(asarPath, 'desktop-verification.json').toString(
      'utf8',
    ),
    mainBundle: extractFile(asarPath, 'main/index.js').toString('utf8'),
    preloadBundle: extractFile(asarPath, 'preload/index.cjs').toString('utf8'),
    rendererDocument: extractFile(asarPath, 'renderer/index.html').toString('utf8'),
    rendererBundle: extractFile(asarPath, 'renderer/renderer.js').toString('utf8'),
    guideViewBundle: extractFile(asarPath, 'renderer/client-guide-view.js').toString(
      'utf8',
    ),
    guideBundleDocument: extractFile(
      asarPath,
      'renderer/generated/client-guides.js',
    ).toString('utf8'),
    controllerVersion: options.controllerVersion,
    artifactVersion: artifact.version,
    artifactSha256: artifact.sha256,
    architecture: options.architecture,
  });
  return artifact;
}

/**
 * Launch the assembled application through its real Electron executable. The
 * smoke branch is read-only and receives isolated lifecycle and Desktop paths.
 *
 * @param {{applicationPath: string, controllerVersion: string, artifactVersion: string, timeoutMilliseconds?: number}} options
 */
export async function smokePackagedDesktop(options) {
  const directory = await mkdtemp(join(tmpdir(), 'portreeve-desktop-smoke-'));
  const executable = resolve(
    options.applicationPath,
    'Contents',
    'MacOS',
    basename(options.applicationPath, '.app'),
  );
  const stateRoot = join(directory, 'state');
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 20_000;
  try {
    const result = await runBounded(
      executable,
      {
        ...process.env,
        HOME: directory,
        XDG_CONFIG_HOME: join(directory, 'config'),
        PORTREEVE_HOME: stateRoot,
        PORTREEVE_SOCKET: join(stateRoot, 'portreeve.sock'),
        PORTREEVE_SUPERVISOR_DEFINITION: join(directory, 'portreeve-smoke.plist'),
        PORTREEVE_SUPERVISOR_LABEL: `com.portreeve.desktop-smoke.${process.pid}`,
        PORTREEVE_DESKTOP_SMOKE: '1',
        PORTREEVE_DESKTOP_SMOKE_USER_DATA: join(directory, 'desktop-user-data'),
      },
      timeoutMilliseconds,
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `Packaged Desktop smoke failed with exit ${result.exitCode}: ${result.stderr.trim()}`,
      );
    }
    const markerLine = result.stdout
      .split(/\r?\n/u)
      .find((/** @type {string} */ line) => line.startsWith(SMOKE_PREFIX));
    if (markerLine === undefined) {
      throw new Error('Packaged Desktop smoke did not emit its identity marker.');
    }
    const marker = JSON.parse(markerLine.slice(SMOKE_PREFIX.length));
    if (
      marker.schemaVersion !== 1 ||
      marker.desktopVersion !== options.controllerVersion ||
      marker.controllerVersion !== options.controllerVersion ||
      marker.artifactVersion !== options.artifactVersion ||
      !['manual', 'none', 'supervised', 'unknown'].includes(marker.mode)
    ) {
      throw new Error('Packaged Desktop smoke returned inconsistent identity.');
    }
    return marker;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** @param {string} executable @param {NodeJS.ProcessEnv} environment @param {number} timeoutMilliseconds @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} */
function runBounded(executable, environment, timeoutMilliseconds) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, [], {
      env: environment,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    /** @type {'timeout'|'output-limit'|null} */
    let termination = null;
    const timeout = setTimeout(() => {
      termination = 'timeout';
      child.kill('SIGKILL');
    }, timeoutMilliseconds);
    /** @param {string} current @param {string} chunk */
    const append = (current, chunk) => {
      const next = current + chunk;
      if (next.length > OUTPUT_LIMIT) {
        termination = 'output-limit';
        child.kill('SIGKILL');
      }
      return next.slice(0, OUTPUT_LIMIT);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (exitCode) => {
      clearTimeout(timeout);
      if (termination === 'timeout') {
        reject(new Error('Packaged Desktop smoke timed out.'));
        return;
      }
      if (termination === 'output-limit') {
        reject(new Error('Packaged Desktop smoke exceeded its output limit.'));
        return;
      }
      resolvePromise({ stdout, stderr, exitCode: exitCode ?? 70 });
    });
  });
}
