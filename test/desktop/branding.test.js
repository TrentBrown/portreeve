// @ts-check

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const rendererRoot = resolve(workspaceRoot, 'apps', 'desktop', 'renderer');
const brandingRoot = resolve(workspaceRoot, 'apps', 'desktop', 'assets', 'branding');

const fogboundCoast = Object.freeze({
  '--pr-color-canvas': '#edf2f3',
  '--pr-color-surface': '#fafcfc',
  '--pr-color-text': '#26383f',
  '--pr-color-logo-ink': '#12344c',
  '--pr-color-text-muted': '#5b6b73',
  '--pr-color-primary': '#176b70',
  '--pr-color-on-primary': '#ffffff',
  '--pr-color-warning': '#8b5b18',
  '--pr-color-warning-soft': '#f8ecd7',
  '--pr-color-danger': '#9e3f3b',
  '--pr-color-danger-soft': '#f7e2e0',
  '--pr-color-code-background': '#15282f',
  '--pr-color-code-text': '#eaf6f5',
});

describe('Fogbound Coast desktop theme', () => {
  test('defines the approved semantic constants once', async () => {
    const theme = await readFile(resolve(rendererRoot, 'theme.css'), 'utf8');
    for (const [name, value] of Object.entries(fogboundCoast)) {
      expect(theme).toContain(`${name}: ${value};`);
      expect(
        theme.match(new RegExp(`${name.replaceAll('-', '\\-')}:`, 'g')),
      ).toHaveLength(1);
    }
  });

  test('keeps brand color literals out of component styles', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles.css'), 'utf8');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(styles).not.toMatch(/\brgb\(/i);
    expect(styles).toContain('var(--pr-color-primary)');
  });

  test('meets WCAG AA for application text pairs', () => {
    /** @type {Array<[string, string]>} */
    const pairs = [
      ['#26383f', '#edf2f3'],
      ['#5b6b73', '#edf2f3'],
      ['#12344c', '#fafcfc'],
      ['#ffffff', '#176b70'],
      ['#8b5b18', '#f8ecd7'],
      ['#9e3f3b', '#f7e2e0'],
      ['#eaf6f5', '#15282f'],
    ];
    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('PortReeve logo assets', () => {
  test('preserves the exact approved artwork and presents it through SVG', async () => {
    const approved = await readFile(
      resolve(brandingRoot, 'portreeve-approved-original.png'),
    );
    expect(createHash('sha256').update(approved).digest('hex')).toBe(
      'cf664538a4bfc275ed77e0ec8c1faa4f658b112abe5ad2aeea37e29772f45c69',
    );
    expect(
      await pngDimensions(resolve(brandingRoot, 'portreeve-approved-original.png')),
    ).toEqual({ width: 1254, height: 1254, colorType: 2 });

    const mark = await readFile(resolve(brandingRoot, 'portreeve-mark.svg'), 'utf8');
    const original = await readFile(
      resolve(brandingRoot, 'portreeve-approved-original.svg'),
      'utf8',
    );
    expect(mark).toContain('The approved right-facing bearded harbor steward');
    expect(mark).toContain('href="data:image/png;base64,');
    expect(mark).toContain('aria-label="80 · 443 · 3000 · 8080"');
    expect(original).toContain('href="data:image/png;base64,');
    expect(original).toContain('aria-label="80 · 443 · 3000 · 8080"');
    for (const svg of [mark, original]) {
      const encoded = svg.match(/href="data:image\/png;base64,([^"]+)"/)?.[1];
      expect(encoded).toBeDefined();
      expect(
        createHash('sha256')
          .update(Buffer.from(encoded ?? '', 'base64'))
          .digest('hex'),
      ).toBe('cf664538a4bfc275ed77e0ec8c1faa4f658b112abe5ad2aeea37e29772f45c69');
    }
  });

  test('integrates the decorative mark with the exact product header', async () => {
    const html = await readFile(resolve(rendererRoot, 'index.html'), 'utf8');
    expect(html).toContain('src="app://portreeve/branding/portreeve-mark.svg"');
    expect(html).toMatch(/class="app-logo"[\s\S]*alt=""[\s\S]*aria-hidden="true"/);
    expect(html).toContain('<p class="eyebrow">Local port authority</p>');
    expect(html).toContain('<h1>PortReeve</h1>');
  });

  test('includes faithful common PNGs and the macOS asset family', async () => {
    for (const size of [32, 128, 256, 512, 1024]) {
      expect(
        await pngDimensions(resolve(brandingRoot, 'png', `portreeve-mark-${size}.png`)),
      ).toEqual({ width: size, height: size, colorType: 2 });
    }
    expect(
      await pngDimensions(
        resolve(brandingRoot, 'png', 'portreeve-lockup-1520x480.png'),
      ),
    ).toEqual({ width: 1520, height: 480, colorType: 6 });
    expect(
      await pngDimensions(resolve(brandingRoot, 'portreeve-app-icon-1024.png')),
    ).toEqual({ width: 1024, height: 1024, colorType: 2 });

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
      const dimensions = await pngDimensions(
        resolve(brandingRoot, 'PortReeve.iconset', filename),
      );
      expect(dimensions.width).toBe(size);
      expect(dimensions.height).toBe(size);
    }
    const icns = await readFile(resolve(brandingRoot, 'PortReeve.icns'));
    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns');
  });
});

/** @param {string} path */
async function pngDimensions(path) {
  const png = await readFile(path);
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png[25] ?? -1,
  };
}

/** @param {string} foreground @param {string} background */
function contrastRatio(foreground, background) {
  const high = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const low = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (high + 0.05) / (low + 0.05);
}

/** @param {string} hex */
function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16) / 255);
  if (channels === undefined) throw new Error(`Invalid color ${hex}`);
  const weights = [0.2126, 0.7152, 0.0722];
  return channels
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0);
}
