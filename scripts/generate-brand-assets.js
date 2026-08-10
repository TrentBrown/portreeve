// @ts-check

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workspaceRoot = process.cwd();
const brandingRoot = resolve(workspaceRoot, 'apps', 'desktop', 'assets', 'branding');
const approvedOriginal = resolve(brandingRoot, 'portreeve-approved-original.png');
const approvedOriginalSvg = resolve(brandingRoot, 'portreeve-approved-original.svg');
const transparentMaster = resolve(brandingRoot, 'portreeve-transparent-master.png');
const markSource = resolve(brandingRoot, 'portreeve-mark.svg');
const lockupSource = resolve(brandingRoot, 'portreeve-lockup.svg');
const appIconSource = resolve(brandingRoot, 'portreeve-app-icon.svg');
const pngRoot = resolve(brandingRoot, 'png');
const iconsetRoot = resolve(brandingRoot, 'PortReeve.iconset');

const rsvgConvert = process.env.PORTREEVE_RSVG_CONVERT ?? 'rsvg-convert';
const iconutil = process.env.PORTREEVE_ICONUTIL ?? '/usr/bin/iconutil';
const magick = process.env.PORTREEVE_MAGICK ?? 'magick';

const embeddedOriginal = await readFile(approvedOriginal, 'base64');
const embeddedTransparentMaster = await readFile(transparentMaster, 'base64');
await writeFile(
  approvedOriginalSvg,
  renderApprovedSvg({
    title: 'Approved PortReeve logo artwork',
    description:
      'Lossless SVG presentation of the original approved 1254-pixel PortReeve artwork.',
    embeddedArtwork: embeddedOriginal,
  }),
);
await writeFile(
  markSource,
  renderApprovedSvg({
    title: 'PortReeve harbor steward',
    description:
      'The approved right-facing bearded harbor steward wearing a nautical cap whose band reads 80, 443, 3000, and 8080.',
    embeddedArtwork: embeddedTransparentMaster,
  }),
);

await rm(pngRoot, { recursive: true, force: true });
await rm(iconsetRoot, { recursive: true, force: true });
await mkdir(pngRoot, { recursive: true });
await mkdir(iconsetRoot, { recursive: true });

for (const size of [32, 128, 256, 512, 1024]) {
  render(markSource, resolve(pngRoot, `portreeve-mark-${size}.png`), size, size);
}
render(lockupSource, resolve(pngRoot, 'portreeve-lockup-1520x480.png'), 1520, 480);
render(appIconSource, resolve(brandingRoot, 'portreeve-app-icon-1024.png'), 1024, 1024);

/** @type {Array<[string, number]>} */
const iconset = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];
for (const [filename, size] of iconset) {
  render(appIconSource, resolve(iconsetRoot, filename), size, size);
}

execFileSync(iconutil, [
  '--convert',
  'icns',
  iconsetRoot,
  '--output',
  resolve(brandingRoot, 'PortReeve.icns'),
]);

const contactInputs = iconset.map(([filename]) => resolve(iconsetRoot, filename));
execFileSync(magick, [
  'montage',
  ...contactInputs,
  '-thumbnail',
  '160x160',
  '-tile',
  '5x2',
  '-geometry',
  '180x180+12+12',
  '-background',
  '#edf2f3',
  resolve(brandingRoot, 'portreeve-iconset-contact-sheet.png'),
]);

/**
 * @param {string} source
 * @param {string} destination
 * @param {number} width
 * @param {number} height
 */
function render(source, destination, width, height) {
  execFileSync(rsvgConvert, [
    '--width',
    String(width),
    '--height',
    String(height),
    '--output',
    destination,
    source,
  ]);
}

/**
 * @param {{title: string, description: string, embeddedArtwork: string}} input
 */
function renderApprovedSvg({ title, description, embeddedArtwork }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" role="img" aria-labelledby="title description">
  <title id="title">${title}</title>
  <desc id="description">${description}</desc>
  <image href="data:image/png;base64,${embeddedArtwork}" width="1254" height="1254" preserveAspectRatio="xMidYMid meet" aria-label="80 · 443 · 3000 · 8080" />
</svg>
`;
}
