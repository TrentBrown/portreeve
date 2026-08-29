// @ts-check

import { cp, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { sha256File } from './release-lib.js';
import { verifyPackagedDesktop } from './desktop-package-lib.js';

/** @param {string} version @param {'arm64'|'x64'} architecture */
export function desktopDmgName(version, architecture) {
  return `PortReeve-${version}-macos-${architecture}.dmg`;
}

/**
 * @param {{applicationPath: string, outputPath: string, architecture: 'arm64'|'x64', controllerVersion: string}} options
 */
export async function createAndVerifyDesktopDmg(options) {
  if (process.platform !== 'darwin') {
    throw new Error('Desktop DMG creation requires macOS.');
  }
  if (basename(options.outputPath) === options.outputPath) {
    throw new Error('Desktop DMG output must include an explicit directory.');
  }
  await mkdir(resolve(options.outputPath, '..'), { recursive: true });
  const imageSource = await mkdtemp(join(tmpdir(), 'portreeve-dmg-source-'));
  try {
    await cp(options.applicationPath, resolve(imageSource, 'PortReeve.app'), {
      recursive: true,
    });
    await run([
      'hdiutil',
      'create',
      '-format',
      'UDZO',
      '-volname',
      'PortReeve',
      '-srcfolder',
      imageSource,
      options.outputPath,
    ]);
  } finally {
    await rm(imageSource, { recursive: true, force: true });
  }
  await verifyDesktopDmg({
    dmgPath: options.outputPath,
    controllerVersion: options.controllerVersion,
    architecture: options.architecture,
  });
  return {
    filename: basename(options.outputPath),
    bytes: (await stat(options.outputPath)).size,
    sha256: await sha256File(options.outputPath),
  };
}

/**
 * Mount the exact final DMG and re-run application, signature, architecture,
 * and embedded authoritative-CLI verification against its mounted contents.
 *
 * @param {{dmgPath: string, architecture: 'arm64'|'x64', controllerVersion: string, verifyApplication?: (applicationPath: string) => Promise<void>}} options
 */
export async function verifyDesktopDmg(options) {
  await run(['hdiutil', 'verify', options.dmgPath]);
  const mountRoot = await mkdtemp(join(tmpdir(), 'portreeve-dmg-'));
  try {
    await run([
      'hdiutil',
      'attach',
      '-readonly',
      '-nobrowse',
      '-mountpoint',
      mountRoot,
      options.dmgPath,
    ]);
    const applicationPath = resolve(mountRoot, 'PortReeve.app');
    await verifyPackagedDesktop({
      applicationPath,
      controllerVersion: options.controllerVersion,
      architecture: options.architecture,
    });
    await options.verifyApplication?.(applicationPath);
  } finally {
    await run(['hdiutil', 'detach', mountRoot], true);
    await rm(mountRoot, { recursive: true, force: true });
  }
}

/**
 * @param {{version: string, releaseVersion: string, releaseBaseUrl: string, homepageUrl: string, checksums: {arm64: string, x64: string}}} options
 */
export function renderHomebrewCask(options) {
  const base = options.releaseBaseUrl.replace(/\/+$/u, '');
  const homepage = options.homepageUrl.replace(/\/+$/u, '');
  return `cask "portreeve-app" do
  arch arm: "arm64", intel: "x64"

  version ${JSON.stringify(options.version)}
  sha256 arm: ${JSON.stringify(options.checksums.arm64)},
         intel: ${JSON.stringify(options.checksums.x64)}

  url ${JSON.stringify(`${base}/v${options.releaseVersion}/PortReeve-${options.version}-macos-#{arch}.dmg`)}
  name "PortReeve"
  desc "Local authority for development ports"
  homepage ${JSON.stringify(options.homepageUrl)}

  app "PortReeve.app"

  caveats <<~EOS
    PortReeve is alpha software. This preview may be unsigned. If macOS blocks
    first launch, verify the release checksum and use the scoped System Settings >
    Privacy & Security > Open Anyway flow described at:
    ${homepage}/blob/main/docs/installation.md

    PortReeve Desktop and its supervised per-user service have separate lifecycles.
    Before removing the app, use its Service tab or the PortReeve CLI to uninstall
    supervision. Uninstall preserves claims, history, and settings. Purge remains
    a separate explicit, confirmation-bound operation.
  EOS
end
`;
}

/** @param {string[]} command @param {boolean} [ignoreFailure] */
async function run(command, ignoreFailure = false) {
  const child = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0 && !ignoreFailure) {
    throw new Error(
      `${command[0]} failed (${code}): ${stderr.trim() || stdout.trim()}`,
    );
  }
}
