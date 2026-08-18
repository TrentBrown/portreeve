// @ts-check

import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PORTREEVE_CLIENT_VERSION } from '../packages/client/src/version.js';
import { PORTREEVE_VERSION } from '../src/version.js';
import {
  RELEASE_TARGETS,
  artifactName,
  inspectExecutable,
  renderChecksumFile,
  renderHomebrewFormula,
  sha256File,
} from './release-lib.js';
import {
  assertCoordinatedReleaseVersion,
  coordinatedReleaseVersionPlugin,
} from './release-version.js';

/**
 * @param {{
 *   destination: string,
 *   releaseVersion: string,
 *   releaseBaseUrl: string,
 *   homepageUrl: string,
 *   workspaceRoot?: string,
 * }} options
 */
export async function buildReleaseArtifacts(options) {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const releaseDirectory = resolve(options.destination);
  const workspaceMetadata = JSON.parse(
    await readFile(resolve(workspaceRoot, 'package.json'), 'utf8'),
  );
  const packageMetadata = JSON.parse(
    await readFile(
      resolve(workspaceRoot, 'packages', 'client', 'package.json'),
      'utf8',
    ),
  );
  const desktopMetadata = JSON.parse(
    await readFile(resolve(workspaceRoot, 'apps', 'desktop', 'package.json'), 'utf8'),
  );
  if (
    workspaceMetadata.version !== PORTREEVE_VERSION ||
    packageMetadata.version !== PORTREEVE_CLIENT_VERSION
  ) {
    throw new Error(
      `Release versions are inconsistent: server ${PORTREEVE_VERSION}, workspace ${String(
        workspaceMetadata.version,
      )}, client ${PORTREEVE_CLIENT_VERSION}, package ${String(
        packageMetadata.version,
      )}.`,
    );
  }
  assertCoordinatedReleaseVersion(options.releaseVersion, {
    server: PORTREEVE_VERSION,
    workspace: String(workspaceMetadata.version),
    client: PORTREEVE_CLIENT_VERSION,
    'client package': String(packageMetadata.version),
    'Desktop package': String(desktopMetadata.version),
  });

  await rm(releaseDirectory, { recursive: true, force: true });
  await mkdir(releaseDirectory, { recursive: true });

  /** @type {Array<Record<string, unknown> & {filename: string, sha256: string}>} */
  const artifacts = [];
  for (const target of RELEASE_TARGETS) {
    const filename = artifactName(options.releaseVersion, target);
    const outfile = resolve(releaseDirectory, filename);
    const result = await Bun.build({
      entrypoints: [resolve(workspaceRoot, 'src', 'cli', 'main.js')],
      target: 'bun',
      compile: {
        autoloadBunfig: false,
        autoloadDotenv: false,
        outfile,
        target: /** @type {Bun.Build.CompileTarget} */ (target.bunTarget),
      },
      minify: true,
      plugins: [
        coordinatedReleaseVersionPlugin({
          workspaceRoot,
          releaseVersion: options.releaseVersion,
        }),
      ],
    });
    if (!result.success) {
      throw new Error(
        `Failed to compile ${target.bunTarget}: ${result.logs
          .map((entry) => entry.message)
          .join('\n')}`,
      );
    }
    await chmod(outfile, 0o755);
    const inspected = await inspectExecutable(outfile);
    if (
      inspected.operatingSystem !== target.operatingSystem ||
      inspected.architecture !== target.architecture
    ) {
      throw new Error(
        `${filename} format is ${inspected.operatingSystem}/${inspected.architecture}, expected ${target.operatingSystem}/${target.architecture}.`,
      );
    }
    artifacts.push({
      type: 'executable',
      filename,
      bunTarget: target.bunTarget,
      operatingSystem: target.operatingSystem,
      architecture: target.architecture,
      bytes: (await stat(outfile)).size,
      sha256: await sha256File(outfile),
    });
  }

  const packedClient = await packReleaseClient(
    workspaceRoot,
    releaseDirectory,
    options.releaseVersion,
  );
  artifacts.push({
    type: 'npm-package',
    filename: packedClient.filename,
    package: packedClient.package,
    version: packedClient.version,
    bytes: (await stat(resolve(releaseDirectory, packedClient.filename))).size,
    sha256: await sha256File(resolve(releaseDirectory, packedClient.filename)),
  });

  const executableChecksums = Object.fromEntries(
    artifacts
      .filter((artifact) => artifact.type === 'executable')
      .map((artifact) => [artifact.filename, artifact.sha256]),
  );
  await writeFile(
    resolve(releaseDirectory, 'portreeve.rb'),
    renderHomebrewFormula({
      version: options.releaseVersion,
      releaseBaseUrl: options.releaseBaseUrl,
      homepageUrl: options.homepageUrl,
      checksums: executableChecksums,
    }),
    'utf8',
  );
  artifacts.push({
    type: 'homebrew-formula',
    filename: 'portreeve.rb',
    bytes: (await stat(resolve(releaseDirectory, 'portreeve.rb'))).size,
    sha256: await sha256File(resolve(releaseDirectory, 'portreeve.rb')),
  });

  await writeFile(
    resolve(releaseDirectory, 'SHA256SUMS'),
    renderChecksumFile(artifacts),
    'utf8',
  );
  const manifest = {
    schemaVersion: 1,
    releaseVersion: options.releaseVersion,
    softwareVersion: options.releaseVersion,
    clientVersion: options.releaseVersion,
    protocolVersion: 1,
    generatedAt: new Date().toISOString(),
    artifacts,
    nativeExecutionRequired: RELEASE_TARGETS.map(
      ({ operatingSystem, architecture }) => ({ operatingSystem, architecture }),
    ),
  };
  await writeFile(
    resolve(releaseDirectory, 'manifest.json'),
    JSON.stringify(manifest, null, 2).concat('\n'),
    'utf8',
  );
  return { releaseDirectory, manifest };
}

/** @param {string} workspaceRoot @param {string} destination @param {string} releaseVersion */
export async function packReleaseClient(workspaceRoot, destination, releaseVersion) {
  const stagingRoot = await mkdtemp(join(tmpdir(), 'portreeve-client-release-'));
  const packageRoot = resolve(stagingRoot, 'package');
  try {
    await cp(resolve(workspaceRoot, 'packages', 'client'), packageRoot, {
      recursive: true,
    });
    const metadataPath = resolve(packageRoot, 'package.json');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    metadata.version = releaseVersion;
    await writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2).concat('\n'),
      'utf8',
    );
    await writeFile(
      resolve(packageRoot, 'src', 'version.js'),
      `// Generated for an immutable PortReeve release package.\n\nexport const PORTREEVE_CLIENT_VERSION = ${JSON.stringify(releaseVersion)};\n`,
      'utf8',
    );
    const child = Bun.spawn(
      ['npm', 'pack', packageRoot, '--json', '--pack-destination', destination],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) {
      throw new Error(`npm pack failed (${code}): ${error.trim()}`);
    }
    const result = JSON.parse(output)?.[0];
    if (
      typeof result?.filename !== 'string' ||
      result.version !== releaseVersion ||
      typeof result.name !== 'string'
    ) {
      throw new Error(`npm pack returned an invalid release identity: ${output}`);
    }
    return {
      filename: result.filename,
      package: result.name,
      version: result.version,
    };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}
