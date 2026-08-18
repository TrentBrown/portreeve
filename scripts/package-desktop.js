// @ts-check

import { packager } from '@electron/packager';
import { Command } from 'commander';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveLocalReleaseCandidate } from '../apps/desktop/main/artifact.js';
import { PORTREEVE_VERSION } from '../src/version.js';
import {
  assertDesktopModuleGraph,
  assertDesktopPackageIdentity,
  smokePackagedDesktop,
  verifyPackagedDesktop,
} from './desktop-package-lib.js';
import {
  assertCoordinatedReleaseVersion,
  coordinatedReleaseVersionPlugin,
} from './release-version.js';

/**
 * @param {{workspaceRoot?: string, releaseDirectory?: string, outputRoot?: string, architecture?: 'arm64'|'x64', releaseChannel?: 'preview'|'stable', releaseVersion?: string, smoke?: boolean}} [options]
 */
export async function packageDesktop(options = {}) {
  if (process.platform !== 'darwin') {
    throw new Error('PortReeve Desktop packaging requires macOS.');
  }
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const architecture = options.architecture ?? nativeArchitecture();
  if (!['arm64', 'x64'].includes(architecture)) {
    throw new Error(`Unsupported Desktop architecture: ${architecture}`);
  }
  const releaseDirectory = resolve(
    options.releaseDirectory ?? resolve(workspaceRoot, 'dist', 'release'),
  );
  const outputRoot = resolve(
    options.outputRoot ?? resolve(workspaceRoot, 'dist', 'desktop'),
  );
  const desktopRoot = resolve(workspaceRoot, 'apps', 'desktop');
  const releaseChannel = options.releaseChannel ?? 'preview';
  const osxSign = createDesktopSignOptions(releaseChannel);
  const stage = resolve(outputRoot, `stage-${architecture}`);
  const output = resolve(outputRoot, architecture);
  const resources = resolve(stage, 'release-input', 'portreeve');
  const metadata = JSON.parse(
    await readFile(resolve(desktopRoot, 'package.json'), 'utf8'),
  );
  const releaseVersion = options.releaseVersion ?? String(metadata.version);
  assertCoordinatedReleaseVersion(releaseVersion, {
    server: PORTREEVE_VERSION,
    'Desktop package': String(metadata.version),
  });

  await rm(stage, { recursive: true, force: true });
  await rm(output, { recursive: true, force: true });
  await mkdir(resolve(stage, 'main'), { recursive: true });
  await mkdir(resources, { recursive: true });
  await cp(resolve(desktopRoot, 'preload'), resolve(stage, 'preload'), {
    recursive: true,
  });
  await cp(resolve(desktopRoot, 'renderer'), resolve(stage, 'renderer'), {
    recursive: true,
  });
  await cp(resolve(desktopRoot, 'assets'), resolve(stage, 'assets'), {
    recursive: true,
  });
  const guideBundlePath = resolve(stage, 'renderer', 'generated', 'client-guides.js');
  const guideBundle = await readFile(guideBundlePath, 'utf8');
  const sourceVersionMarker = `generatedForVersion: '${PORTREEVE_VERSION}'`;
  if (guideBundle.split(sourceVersionMarker).length !== 3) {
    throw new Error('Desktop client guide source-version attestation is invalid.');
  }
  await writeFile(
    guideBundlePath,
    guideBundle.replaceAll(
      sourceVersionMarker,
      `generatedForVersion: '${releaseVersion}'`,
    ),
    'utf8',
  );

  const build = await Bun.build({
    entrypoints: [resolve(desktopRoot, 'main', 'index.js')],
    outdir: resolve(stage, 'main'),
    target: 'node',
    format: 'esm',
    external: ['electron'],
    minify: true,
    naming: 'index.js',
    metafile: true,
    plugins: [coordinatedReleaseVersionPlugin({ workspaceRoot, releaseVersion })],
  });
  if (!build.success) {
    throw new Error(
      `Desktop main-process bundle failed: ${build.logs
        .map(({ message }) => message)
        .join('\n')}`,
    );
  }
  if (build.metafile === undefined) {
    throw new Error('Desktop main-process bundle did not produce module evidence.');
  }
  assertDesktopModuleGraph(Object.keys(build.metafile.inputs));

  const artifact = await resolveLocalReleaseCandidate({
    workspaceRoot,
    releaseDirectory,
    architecture,
  });
  assertDesktopPackageIdentity(PORTREEVE_VERSION, metadata.version);
  assertDesktopPackageIdentity(releaseVersion, artifact.version);

  await writeFile(
    resolve(stage, 'package.json'),
    JSON.stringify(
      {
        name: 'portreeve-desktop',
        productName: 'PortReeve',
        version: metadata.version,
        private: true,
        type: 'module',
        main: 'main/index.js',
        portreeveReleaseChannel: releaseChannel,
        portreeveReleaseVersion: releaseVersion,
      },
      null,
      2,
    ).concat('\n'),
  );
  await writeFile(
    resolve(stage, 'desktop-verification.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        controllerVersion: releaseVersion,
        artifactVersion: artifact.version,
        artifactSha256: artifact.sha256,
        architecture,
        releaseChannel,
        moduleGraph: {
          directLifecycleController: true,
          verifiedArtifactResolver: true,
          mcpSetupGenerator: true,
          lifecycleCliAdapter: false,
        },
      },
      null,
      2,
    ).concat('\n'),
  );
  await cp(
    resolve(releaseDirectory, 'manifest.json'),
    resolve(resources, 'manifest.json'),
  );
  await cp(artifact.executablePath, resolve(resources, artifact.filename));

  const paths = await packager({
    dir: stage,
    out: output,
    name: 'PortReeve',
    platform: 'darwin',
    arch: architecture,
    electronVersion: '43.2.0',
    appVersion: metadata.version,
    appBundleId: 'com.trentbrown.portreeve.desktop',
    icon: resolve(desktopRoot, 'assets', 'branding', 'PortReeve.icns'),
    asar: true,
    overwrite: true,
    prune: false,
    ignore: /^\/release-input(?:\/|$)/,
    extraResource: [resolve(stage, 'release-input', 'portreeve')],
    osxSign,
  });
  if (paths.length !== 1) {
    throw new Error(`Desktop packager returned ${paths.length} output paths.`);
  }
  const packageDirectory = paths[0];
  if (packageDirectory === undefined) {
    throw new Error('Desktop packager did not return an output path.');
  }
  const applicationPath = resolve(packageDirectory, 'PortReeve.app');
  const packagedArtifact = await verifyPackagedDesktop({
    applicationPath,
    controllerVersion: releaseVersion,
    architecture,
  });
  if (options.smoke ?? architecture === nativeArchitecture()) {
    await smokePackagedDesktop({
      applicationPath,
      controllerVersion: releaseVersion,
      artifactVersion: packagedArtifact.version,
    });
  }
  return {
    applicationPath,
    architecture,
    desktopVersion: releaseVersion,
    artifact: packagedArtifact,
  };
}

/**
 * Preview bundles use an ad-hoc identity so every nested executable and the final
 * application bundle are sealed consistently. This proves bundle integrity without
 * claiming a Developer ID identity or Gatekeeper trust. Stable packaging remains
 * unavailable until the separate Developer ID and notarization path is configured.
 *
 * @param {'preview'|'stable'} releaseChannel
 */
export function createDesktopSignOptions(releaseChannel) {
  if (releaseChannel !== 'preview') {
    throw new Error(
      'Stable Desktop packaging requires configured Developer ID signing and notarization.',
    );
  }
  return {
    identity: '-',
    identityValidation: false,
    continueOnError: false,
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false,
    ignore: isPromotedCliResource,
    optionsForFile: () => ({ hardenedRuntime: false, timestamp: 'none' }),
  };
}

/**
 * The promoted CLI must remain byte-for-byte identical to its release manifest.
 * The application signature seals that exact resource without re-signing it.
 *
 * @param {string} filePath
 */
export function isPromotedCliResource(filePath) {
  return /\/Contents\/Resources\/portreeve\/portreeve-v[^/]+$/u.test(
    filePath.replaceAll('\\', '/'),
  );
}

/** @returns {'arm64'|'x64'} */
function nativeArchitecture() {
  if (process.arch === 'arm64' || process.arch === 'x64') return process.arch;
  throw new Error(`Unsupported native Desktop architecture: ${process.arch}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const program = new Command()
    .name('desktop:package')
    .description('Package PortReeve Desktop around an exact promoted CLI artifact')
    .option('--release-directory <path>', 'prepared release artifacts directory')
    .option('--output <path>', 'Desktop packaging output root')
    .option('--arch <architecture>', 'arm64 or x64')
    .option('--no-smoke', 'skip native application startup smoke')
    .action(async (values) => {
      if (values.arch !== undefined && !['arm64', 'x64'].includes(values.arch)) {
        throw new Error('--arch must be arm64 or x64.');
      }
      const result = await packageDesktop({
        releaseDirectory: values.releaseDirectory,
        outputRoot: values.output,
        architecture: values.arch,
        smoke: values.smoke,
      });
      console.log(result.applicationPath);
    });
  await program.parseAsync();
}
