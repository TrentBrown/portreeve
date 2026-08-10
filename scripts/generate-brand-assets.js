// @ts-check

import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const workspaceRoot = process.cwd();
const brandingRoot = resolve(workspaceRoot, 'apps', 'desktop', 'assets', 'branding');
const markSource = resolve(brandingRoot, 'portreeve-mark.svg');
const lockupSource = resolve(brandingRoot, 'portreeve-lockup.svg');
const appIconSource = resolve(brandingRoot, 'portreeve-app-icon.svg');
const pngRoot = resolve(brandingRoot, 'png');
const iconsetRoot = resolve(brandingRoot, 'PortReeve.iconset');

const rsvgConvert = process.env.PORTREEVE_RSVG_CONVERT ?? 'rsvg-convert';
const iconutil = process.env.PORTREEVE_ICONUTIL ?? '/usr/bin/iconutil';
const magick = process.env.PORTREEVE_MAGICK ?? 'magick';

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
