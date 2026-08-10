// @ts-check

import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveLocalReleaseCandidate } from '../apps/desktop/main/artifact.js';

const workspaceRoot = process.cwd();
const desktopRoot = resolve(workspaceRoot, 'apps', 'desktop');
const stage = resolve(workspaceRoot, 'dist', 'desktop-stage');
const output = resolve(workspaceRoot, 'dist', 'desktop');
const resources = resolve(stage, 'release-input', 'portreeve');
if (process.platform !== 'darwin') {
  throw new Error('The current desktop engineering package supports macOS ARM64/x64.');
}
const supportsArm64 = execFileSync('/usr/sbin/sysctl', ['-n', 'hw.optional.arm64'], {
  encoding: 'utf8',
}).trim();
if (!['0', '1'].includes(supportsArm64)) {
  throw new Error('The current desktop engineering package supports macOS ARM64/x64.');
}
const platform = /** @type {'darwin'} */ (process.platform);
const architecture = /** @type {'arm64'|'x64'} */ (
  supportsArm64 === '1' ? 'arm64' : 'x64'
);
const metadata = JSON.parse(
  await readFile(resolve(desktopRoot, 'package.json'), 'utf8'),
);

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

const build = await Bun.build({
  entrypoints: [resolve(desktopRoot, 'main', 'index.js')],
  outdir: resolve(stage, 'main'),
  target: 'node',
  format: 'esm',
  external: ['electron'],
  minify: true,
  naming: 'index.js',
});
if (!build.success) {
  throw new Error(
    `Desktop main-process bundle failed: ${build.logs
      .map(({ message }) => message)
      .join('\n')}`,
  );
}

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
    },
    null,
    2,
  ).concat('\n'),
);

const artifact = await resolveLocalReleaseCandidate({
  workspaceRoot,
  architecture,
});
await cp(
  resolve(workspaceRoot, 'dist', 'release', 'manifest.json'),
  resolve(resources, 'manifest.json'),
);
await cp(artifact.executablePath, resolve(resources, artifact.filename));

const paths = await packager({
  dir: stage,
  out: output,
  name: 'PortReeve',
  platform,
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
});

console.log(paths.join('\n'));
